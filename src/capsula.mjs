/* CC-1080, passos 1 e 2: a cápsula de um projeto.
 *
 * Um arquivo `<nome>-<AAAAMMDD-HHMM>.capsula.tar.gz` que recoloca a pasta do projeto EXATAMENTE como estava (com
 * `.git`, `node_modules`, o que não foi commitado, permissões e atalhos), sem Node e sem IA: quem restaura é o
 * `restaurar.sh` que vai dentro, em sh puro.
 *
 * Dentro: RESTAURAR.md, restaurar.sh, manifesto.json, projeto.tar.gz e, só se houver segredo, segredos.tar.gpg.
 * Passo 2, só quando o painel liga o Docker (`docker: { executar }`): docker/compose/, docker/imagens/, docker/volumes/,
 * docker/plano.tsv e dados/*.dump (pg_dump). Tudo entra no manifesto com sha256.
 * Os segredos (`.env`, `.env.*` menos `.env.example`, e o que o chamador listar) NÃO entram no projeto.tar.gz:
 * vão só cifrados (gpg simétrico AES256), com a senha vinda por stdin. Nada de senha em argumento, variável ou arquivo.
 * Arquivo que o usuário não consegue ler (dono root) fica de fora e vai para `nao_coletado` ("precisa de root").
 *
 * Passo 3, só quando o chamador liga `servidor: {...}` (o painel liga): servidor/ com os blocos do nginx ligados ao projeto,
 * PM2, unidades de usuário, cron e domínios (ver capsulaServidor.mjs). Os arquivos de segredo que esses blocos apontam
 * (htpasswd, EnvironmentFile) entram só no segredos.tar.gpg, em `_servidor/`.
 * O Docker só roda dentro do painel (ver capsulaDocker.mjs); `cc capsula` pela linha de comando não liga Docker nem servidor.
 *
 * Lacuna do site publicado (formato 4): as pastas que o nginx serve de fora do projeto (publicado/) e as que os contêineres
 * montam do disco (montagens/), cada uma em um tar.gz com caminho original, tamanho e sha256, mais o pastas.tsv que o
 * restaurar.sh lê. Ver capsulaPastas.mjs.
 *
 * Segredos de fora do projeto: o `.env` (e parecidos, `ehSegredo`) que mora DENTRO de uma pasta publicada ou montada não vai
 * no tar da pasta: vai no MESMO segredos.tar.gpg, em `_externo/`, com o caminho original no manifesto (só o caminho) e no
 * pastas.tsv (linhas `segredo`). Sem senha a cápsula é recusada, como com os do projeto. Chave privada continua de fora.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as Dk from './capsulaDocker.mjs'
import * as Sv from './capsulaServidor.mjs'
import * as Pa from './capsulaPastas.mjs'
import { varrer, sha256Arquivo, ehSegredo } from './capsulaPastas.mjs'

export { varrer, ehSegredo }

export const MIN_SOBRA = 2 * 1024 ** 3
const PARTES = ['RESTAURAR.md', 'restaurar.sh', 'manifesto.json', 'projeto.tar.gz', 'segredos.tar.gpg', 'pastas.tsv', 'docker', 'dados', 'servidor', 'publicado', 'montagens']
/** As partes que existem na pasta, na ordem fixa (documento, script e manifesto primeiro: abrem rápido). */
const partesDe = (dir) => PARTES.filter((n) => fs.existsSync(path.join(dir, n)))

export const pastaCapsulas = () => process.env.CC_CAPSULAS || path.join(os.homedir(), '.local', 'share', 'agent-cockpit', 'capsulas')

const fmt = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)
export const formatarBytes = fmt

function exec(cmd, args, o = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...o })
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`)
  return r
}
function exigir(cmd, args, o) {
  const r = exec(cmd, args, o)
  if (r.status !== 0) throw new Error(`${cmd} ${args[0] || ''} falhou (código ${r.status}): ${String(r.stderr || '').trim().split('\n').slice(-3).join(' | ')}`)
  return r
}

/** A assinatura da árvore: tipo, permissão e soma (ou alvo do atalho) de cada entrada, fora as ignoradas. */
export function assinarArvore(raiz, itens, ignorar = new Set()) {
  const mapa = new Map()
  let bytes = 0
  for (const it of itens) {
    if (ignorar.has(it.rel)) continue
    const conteudo = it.tipo === 'f' ? sha256Arquivo(path.join(raiz, it.rel)) : it.tipo === 'l' ? it.alvo : ''
    mapa.set(it.rel, `${it.tipo}\t${it.modo.toString(8)}\t${conteudo}`)
    bytes += it.tam
  }
  const h = crypto.createHash('sha256')
  for (const [rel, ass] of mapa) h.update(`${rel}\t${ass}\n`)
  return { mapa, entradas: mapa.size, bytes, sha256: h.digest('hex') }
}

function diferencas(esperado, achado) {
  const faltam = [], sobram = [], diferentes = []
  for (const [k, v] of esperado) { if (!achado.has(k)) faltam.push(k); else if (achado.get(k) !== v) diferentes.push(k) }
  for (const k of achado.keys()) if (!esperado.has(k)) sobram.push(k)
  return { faltam, sobram, diferentes, total: faltam.length + sobram.length + diferentes.length }
}

const primeiraLinha = (cmd, args) => {
  try { const r = exec(cmd, args, { timeout: 8000 }); return r.status === 0 ? String(r.stdout || r.stderr).trim().split('\n')[0] : null } catch { return null }
}

function infoGit(pasta) {
  if (!fs.existsSync(path.join(pasta, '.git'))) return null
  const g = (...a) => { const r = exec('git', ['-C', pasta, '--no-optional-locks', ...a], { timeout: 20000 }); return r.status === 0 ? r.stdout.trim() : null }
  const st = g('status', '--porcelain')
  if (st === null) return null
  const linhas = st ? st.split('\n') : []
  return {
    ramo: g('rev-parse', '--abbrev-ref', 'HEAD'),
    commit: g('rev-parse', 'HEAD'),
    status: { total: linhas.length, nao_rastreados: linhas.filter((l) => l.startsWith('??')).length, modificados: linhas.filter((l) => !l.startsWith('??')).length },
  }
}

/** Disco livre na pasta (ou no ancestral mais próximo que exista). Em bytes. */
export function discoLivre(dir) {
  let d = path.resolve(dir)
  while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d)
  const s = fs.statfsSync(d)
  return Number(s.bavail) * Number(s.bsize)
}

function planejar(pasta) {
  const raiz = fs.realpathSync(pasta)
  if (!fs.statSync(raiz).isDirectory()) throw new Error(`${pasta} não é uma pasta`)
  const { itens, pulados, ilegiveis } = varrer(raiz)
  const bytes = itens.reduce((t, i) => t + i.tam, 0)
  return { raiz, itens, pulados, ilegiveis, bytes }
}

function segredosDe(itens, extras = []) {
  const s = new Set(itens.filter((i) => i.tipo === 'f' && ehSegredo(path.posix.basename(i.rel))).map((i) => i.rel))
  for (const e of extras) {
    const rel = e.replace(/^\.\//, '')
    const it = itens.find((i) => i.rel === rel)
    if (!it || it.tipo !== 'f') throw new Error(`segredo extra "${e}" não é um arquivo dentro do projeto`)
    s.add(rel)
  }
  return [...s].sort()
}

/** O custo de gravar: as partes soltas e a cápsula existem juntas (2x); depois as soltas saem, e a prova abre a cápsula de novo
 *  e a regrava (3x). É teto: a compressão deixa o real menor. */
const pico = (bytes) => bytes * 3
const seguro = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '_').slice(0, 80) || 'x'

/** Só mede a pasta. Não grava nada. */
export function ensaio(pasta, { saida = pastaCapsulas(), livre = discoLivre, extras = [] } = {}) {
  const p = planejar(pasta)
  const segredos = segredosDe(p.itens, extras)
  const disp = livre(saida)
  const sobra = disp - pico(p.bytes)
  return { raiz: p.raiz, entradas: p.itens.length, bytes: p.bytes, pico: pico(p.bytes), livre: disp, sobra, cabe: sobra >= MIN_SOBRA, segredos, pulados: p.pulados, ilegiveis: p.ilegiveis }
}

/** A pasta MAIS a parte Docker, as montagens e as pastas publicadas (no Docker só lê). Para o botão "Estimar" e a confirmação antes
 *  de fazer. `docker` = { executar }. As pastas de bloco candidato só entram na conta com `incluirCandidatos`; `cabe_com_candidatos`
 *  diz como ficaria se ele marcar. */
export async function ensaioCompleto(pasta, { saida = pastaCapsulas(), livre = discoLivre, extras = [], docker = null, projetoCompose = null, servidor = null, incluirCandidatos = false } = {}) {
  const e = ensaio(pasta, { saida, livre, extras })
  const d = docker ? await Dk.ensaioDocker(e.raiz, { executar: docker.executar, projetoCompose, mapear: docker.mapear }) : null
  // o nginx, os domínios e o resto do servidor: só leitura, para ele conferir ANTES de fazer
  const sd = servidor ? Sv.descobrir(e.raiz, { ...servidor, portasDocker: d?.portas || [] }) : null
  const [pubCertas, pubCand] = sd ? Sv.bytesPublicado(sd) : [0, 0]
  const base = e.bytes + (d ? d.bytes : 0) + pubCertas
  const total = base + (incluirCandidatos ? pubCand : 0)
  const sobra = e.livre - pico(total)
  const r = { ...e, docker: d, bytes_total: total, pico: pico(total), sobra, cabe: sobra >= MIN_SOBRA, bytes_publicado: pubCertas, bytes_publicado_candidatas: pubCand, incluir_candidatos: incluirCandidatos }
  r.cabe_com_candidatos = e.livre - pico(base + pubCand) >= MIN_SOBRA
  if (sd) r.servidor = Sv.resumir(sd)
  // os .env de dentro das pastas de fora do projeto: só os caminhos, para ele ver que a senha também os cobre
  r.segredos_de_fora = [...new Set([...(sd ? Pa.segredosDe(sd.publicado.filter((p) => p.certeza === 'certo' || incluirCandidatos)) : []), ...(d ? d.montagens.flatMap((m) => m.segredos || []) : [])])].sort()
  return r
}

function nomeLivre(dir, base) {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  const sel = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`
  let n = 1
  for (;;) {
    const f = path.join(dir, `${base}-${sel}${n > 1 ? `-${n}` : ''}.capsula.tar.gz`)
    if (!fs.existsSync(f)) return f
    n++
  }
}

function gravarTar(arquivo, dir, nomes) {
  // gzip -1: as partes já vêm comprimidas, comprimir de novo no máximo só gasta tempo
  exigir('tar', ['-c', '--use-compress-program=gzip -1', '-f', arquivo, '-C', dir, '--', ...nomes])
}

/**
 * Faz a cápsula. `docker` = { executar } liga a parte Docker (só o painel passa isso; ver capsulaDocker.mjs).
 * Assíncrona porque o Docker é. `progresso(texto)` conta onde está.
 */
export async function fazer(pasta, { senha = null, saida = pastaCapsulas(), livre = discoLivre, extras = [], provar: provarDepois = true, docker = null, projetoCompose = null, servidor = null, incluirCandidatos = false, progresso = () => {} } = {}) {
  const p = planejar(pasta)
  const nome = path.basename(p.raiz)
  const segredos = segredosDe(p.itens, extras)

  if (segredos.length && !senha) {
    throw Object.assign(new Error(`o projeto tem ${segredos.length} arquivo(s) de segredo (${segredos.join(', ')}) e nenhuma senha foi dada. Segredo só vai cifrado, e a senha vem por stdin (--senha-stdin). Recusei fazer a cápsula.`), { codigo: 'SENHA' })
  }
  if (senha && /[\r\n]/.test(senha)) throw new Error('a senha não pode ter quebra de linha')

  progresso('medindo o projeto')
  let inv = null, motivoDocker = null, est = null
  if (docker) {
    const desc = await Dk.descobrir(p.raiz, { executar: docker.executar, projetoCompose, mapear: docker.mapear })
    if (desc.projeto) { inv = await Dk.inventariar(desc); est = await Dk.estimar(inv) } else motivoDocker = desc.motivo
  }
  // a configuração do servidor é lida UMA vez, já aqui: o tamanho das pastas publicadas entra na conta do disco antes de gravar
  let sd = null, pubBytes = 0
  if (servidor) {
    progresso('lendo a configuração do servidor (nginx, PM2, unidades, cron)')
    sd = Sv.descobrir(p.raiz, { ...servidor, portasDocker: inv ? inv.portas : [] })
    const [certas, cand] = Sv.bytesPublicado(sd)
    pubBytes = certas + (incluirCandidatos ? cand : 0)
  }
  // .env de dentro das pastas publicadas e montadas: também só vão cifrados. Recusa já, antes de copiar GBs.
  const previstos = Pa.segredosDe([...(sd ? sd.publicado.filter((x) => x.certeza === 'certo' || incluirCandidatos) : []), ...(inv ? inv.montagens : [])])
  if (previstos.length && !senha) {
    throw Object.assign(new Error(`as pastas de fora do projeto têm ${previstos.length} arquivo(s) de segredo (${previstos.join(', ')}) e nenhuma senha foi dada. Segredo só vai cifrado. Recusei fazer a cápsula.`), { codigo: 'SENHA' })
  }
  const total = p.bytes + (est ? est.bytes : 0) + pubBytes
  const disp = livre(saida)
  if (disp - pico(total) < MIN_SOBRA) {
    throw Object.assign(new Error(`disco: livre ${fmt(disp)}, preciso de ${fmt(pico(total))} para gravar e deixar ${fmt(MIN_SOBRA)} de folga; sobraria ${fmt(disp - pico(total))}. Recusei gravar.`), { codigo: 'DISCO' })
  }

  fs.mkdirSync(saida, { recursive: true })
  const stage = fs.mkdtempSync(path.join(saida, '.fazendo-'))
  try {
    const pai = path.dirname(p.raiz)
    const segSet = new Set(segredos)
    const git = infoGit(p.raiz)
    const arv = assinarArvore(p.raiz, p.itens, segSet)
    const avisos = []

    // projeto.tar.gz: a pasta inteira, menos os segredos e o que este usuário não consegue ler
    progresso('empacotando a pasta do projeto')
    const excl = [...segredos, ...p.ilegiveis].flatMap((r) => ['--anchored', '--no-wildcards', `--exclude=${nome}/${r}`])
    const t = exec('tar', ['-c', '--use-compress-program=gzip -1', '-p', '-f', path.join(stage, 'projeto.tar.gz'), '-C', pai, ...excl, '--', nome])
    // código 1 do tar = "arquivo mudou durante a leitura": segue, avisa, e a prova diz se a árvore bateu
    if (t.status !== 0 && t.status !== 1) throw new Error(`tar falhou (código ${t.status}): ${String(t.stderr || '').trim().split('\n').slice(-3).join(' | ')}`)
    if (t.status === 1) avisos.push('o tar avisou que arquivos mudaram enquanto eram lidos (projeto em uso)')
    // trava: segredo que escapou para o projeto.tar.gz derruba tudo
    if (segredos.length) {
      const lista = new Set(exigir('tar', ['-tzf', path.join(stage, 'projeto.tar.gz')]).stdout.split('\n'))
      const vazou = segredos.filter((r) => lista.has(`${nome}/${r}`))
      if (vazou.length) throw new Error(`segredo vazou para o projeto.tar.gz: ${vazou.join(', ')}`)
    }

    // a parte Docker: compose, bancos, volumes, imagens
    let col = null
    if (inv) { progresso('copiando a parte Docker'); col = await Dk.coletar(inv, stage, { progresso }) }

    // a parte servidor: nginx, domínios, PM2, unidades, cron. Só lê; os segredos que ela aponta vão cifrados junto dos .env
    let sv = null
    if (servidor) {
      progresso('copiando a configuração do servidor e as pastas publicadas')
      sv = Sv.coletar(p.raiz, stage, { ...servidor, portasDocker: inv ? inv.portas : [], descoberta: sd, incluirCandidatos })
      if (sv.externos.length && !senha) {
        throw Object.assign(new Error(`a configuração do servidor aponta ${sv.externos.length} arquivo(s) de segredo (${sv.externos.map((x) => x.caminho).join(', ')}) e nenhuma senha foi dada. Recusei fazer a cápsula.`), { codigo: 'SENHA' })
      }
    }
    const externos = sv ? sv.externos : []

    // os .env de dentro das pastas de fora do projeto: copiados para um rascunho (0700) que entra no mesmo segredos.tar.gpg
    const extDir = path.join(stage, '.ext')
    const foraMap = new Map()
    for (const x of [...(col ? col.pastas.segredos : []), ...(sv ? sv.pastas.segredos : [])]) if (!foraMap.has(x.caminho)) foraMap.set(x.caminho, x)
    if (foraMap.size && !senha) {
      throw Object.assign(new Error(`as pastas de fora do projeto têm ${foraMap.size} arquivo(s) de segredo (${[...foraMap.keys()].join(', ')}) e nenhuma senha foi dada. Recusei fazer a cápsula.`), { codigo: 'SENHA' })
    }
    const fora = []
    const foraNao = []
    let nf = 0
    for (const x of foraMap.values()) {
      const membro = `_externo/${++nf}-${seguro(path.basename(x.caminho))}`
      try {
        fs.mkdirSync(path.join(extDir, '_externo'), { recursive: true, mode: 0o700 })
        fs.copyFileSync(x.real, path.join(extDir, membro))
        fs.chmodSync(path.join(extDir, membro), (fs.statSync(x.real).mode & 0o777) | 0o600) // o modo de origem volta; dono e grupo não
        fora.push({ membro, caminho: x.caminho, origem: x.origem, tipo: x.tipo, bytes: fs.statSync(path.join(extDir, membro)).size })
      } catch { foraNao.push({ caminho: x.caminho, motivo: 'não coletado, precisa de root' }) }
    }

    // segredos.tar.gpg: tar em claro por um instante, dentro do stage (0700), apagado logo em seguida
    if (segredos.length || externos.length || fora.length) {
      const claro = path.join(stage, 'segredos.tar')
      try {
        let criado = false
        const juntar = (cwd, nomes) => { exigir('tar', [criado ? '-rpf' : '-cpf', claro, '-C', cwd, '--', ...nomes]); criado = true }
        if (segredos.length) juntar(p.raiz, segredos)
        if (externos.length) juntar(sv.extDir, ['_servidor'])
        if (fora.length) juntar(extDir, ['_externo'])
        exigir('gpg', ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256', '-o', path.join(stage, 'segredos.tar.gpg'), claro], { input: senha + '\n' })
      } finally {
        fs.rmSync(claro, { force: true })
        fs.rmSync(extDir, { recursive: true, force: true }) // o rascunho dos segredos do servidor (sv.extDir) é a mesma pasta
      }
    }

    // o plano das pastas de fora do projeto (publicado/ e montagens/): é o que o restaurar.sh lê
    const planoPastas = [...(col ? col.pastas.plano : []), ...(sv ? sv.pastas.plano : []), ...fora.map((x) => ['segredo', x.tipo, 'f', x.membro, x.bytes, x.caminho.replace(/[\t\r\n]+/g, ' ')])]
    const somasPastas = { ...(col ? col.somas : {}), ...(sv ? sv.pastas.somas : {}) }
    const arquivosPastas = []
    if (planoPastas.length) {
      fs.writeFileSync(path.join(stage, 'pastas.tsv'), planoPastas.map((l) => l.join('\t')).join('\n') + '\n')
      arquivosPastas.push('pastas.tsv')
    }

    progresso('somando sha256')
    const sha256 = { 'projeto.tar.gz': sha256Arquivo(path.join(stage, 'projeto.tar.gz')) }
    if (segredos.length || externos.length || fora.length) sha256['segredos.tar.gpg'] = sha256Arquivo(path.join(stage, 'segredos.tar.gpg'))
    for (const rel of [...(col ? col.arquivos : []), ...(sv ? sv.arquivos : []), ...arquivosPastas].sort()) sha256[rel] = somasPastas[rel] || sha256Arquivo(path.join(stage, rel))

    const naoColetado = [...p.ilegiveis.map((c) => ({ caminho: c, motivo: 'não coletado, precisa de root' })), ...(sv ? sv.resumo.nao_coletado : []), ...(col ? col.nao_coletado : []), ...foraNao]
    const mani = {
      formato: 4,
      nome,
      caminho_origem: p.raiz,
      maquina: { hostname: os.hostname(), plataforma: process.platform, arquitetura: process.arch },
      criada_em: new Date().toISOString(),
      tamanho_projeto_bytes: p.bytes,
      partes_bytes: Object.fromEntries(Object.keys(sha256).map((k) => [k, fs.statSync(path.join(stage, k)).size])),
      sha256,
      versoes: {
        node: process.version,
        npm: primeiraLinha('npm', ['-v']),
        python3: primeiraLinha('python3', ['--version']),
        git: primeiraLinha('git', ['--version']),
      },
      git,
      arvore: { entradas: arv.entradas, bytes: arv.bytes, sha256: arv.sha256 },
      segredos: { cifrados: segredos.length > 0 || externos.length > 0 || fora.length > 0, arquivos: segredos, externos: externos.map((x) => ({ membro: x.membro, caminho_original: x.caminho, origem: x.origem })), pastas: fora.map((x) => ({ membro: x.membro, caminho_original: x.caminho, origem: x.origem })) },
      ignorados: p.pulados,
      nao_coletado_total: naoColetado.length,
      nao_coletado: naoColetado,
      avisos,
      docker: col ? col.docker : docker ? { projeto_compose: null, motivo: motivoDocker } : null,
      servidor: sv ? sv.resumo : null,
      publicado: sv ? sv.pastas.entradas : null,
      montagens: col ? col.pastas.entradas : null,
      incluiu_candidatos: incluirCandidatos === true,
      provada: { ok: null, em: null, motivo: 'ainda não provada' },
    }
    fs.writeFileSync(path.join(stage, 'manifesto.json'), JSON.stringify(mani, null, 2) + '\n')
    fs.writeFileSync(path.join(stage, 'RESTAURAR.md'), gerarRestaurar(mani))
    fs.writeFileSync(path.join(stage, 'restaurar.sh'), RESTAURAR_SH, { mode: 0o755 })

    const arquivo = nomeLivre(saida, nome)
    const parcial = arquivo + '.parcial'
    progresso('gravando a cápsula')
    gravarTar(parcial, stage, partesDe(stage))
    fs.renameSync(parcial, arquivo)
    // as partes soltas já estão dentro da cápsula: libera o disco antes da prova, que abre tudo de novo
    for (const n of PARTES) if (n !== 'manifesto.json') fs.rmSync(path.join(stage, n), { recursive: true, force: true })

    const r = { arquivo, bytes: fs.statSync(arquivo).size, manifesto: mani, prova: null }
    if (provarDepois) {
      progresso('provando: restaurando numa pasta temporária')
      const segMapa = new Map(segredos.map((rel) => [rel, sha256Arquivo(path.join(p.raiz, rel))]))
      r.prova = provar(arquivo, { senha, esperado: { mapa: arv.mapa, segredos: segMapa } })
      r.manifesto.provada = { ok: r.prova.ok, em: r.prova.em, motivo: r.prova.motivo }
      r.bytes = fs.statSync(arquivo).size // a prova regrava o manifesto dentro da cápsula
    }
    return r
  } finally {
    fs.rmSync(stage, { recursive: true, force: true })
  }
}

/** Restaura numa pasta temporária, compara e grava `provada` no manifesto da cápsula. Apaga a temporária. */
export function provar(arquivo, { senha = null, esperado = null, gravar = true } = {}) {
  // a pasta temporária fica ao lado da cápsula: é o disco que o `fazer` conferiu (o /tmp pode ser memória)
  let T
  try { T = fs.mkdtempSync(path.join(path.dirname(path.resolve(arquivo)), '.prova-')) } catch { T = fs.mkdtempSync(path.join(os.tmpdir(), 'capsula-prova-')) }
  const t0 = Date.now()
  try {
    const cap = path.join(T, 'cap')
    const dest = path.join(T, 'dest')
    fs.mkdirSync(cap)
    exigir('tar', ['-xzpf', arquivo, '-C', cap])
    const mani = JSON.parse(fs.readFileSync(path.join(cap, 'manifesto.json'), 'utf8'))
    const segs = mani.segredos?.arquivos || []
    const temSeg = !!mani.sha256['segredos.tar.gpg']
    const semSenha = temSeg && !senha

    // a prova nunca encosta no Docker nem no servidor: só confere as somas e abre os arquivos. Cápsula antiga não conhece a opção.
    const script = path.join(cap, 'restaurar.sh')
    const texto = fs.readFileSync(script, 'utf8')
    const semDocker = texto.includes('--sem-docker') ? ['--sem-docker'] : []
    const semServidor = texto.includes('--sem-servidor') ? ['--sem-servidor'] : [] // a prova nunca encosta no nginx, no PM2 nem no cron
    const semPastas = texto.includes('--sem-pastas') ? ['--sem-pastas'] : [] // nem /var/www, nem /opt, nem pasta nenhuma de fora do projeto
    const r = exec('sh', [script, '--aplicar', '--destino', dest, ...semDocker, ...semServidor, ...semPastas], { input: (senha || '') + '\n', timeout: 30 * 60 * 1000 })
    const falhas = []
    const okSaida = r.status === 0 || (semSenha && r.status === 6)
    if (!okSaida) falhas.push(`restaurar.sh saiu com código ${r.status}: ${String(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')}`)

    if (okSaida) {
      const { itens } = varrer(dest)
      const arv = assinarArvore(dest, itens, new Set(segs))
      if (esperado) {
        const d = diferencas(esperado.mapa, arv.mapa)
        if (d.total) falhas.push(`árvore difere em ${d.total} entrada(s): faltam ${d.faltam.length}, sobram ${d.sobram.length}, diferentes ${d.diferentes.length} (ex.: ${[...d.faltam, ...d.sobram, ...d.diferentes].slice(0, 3).join(', ')})`)
      } else if (arv.sha256 !== mani.arvore.sha256) falhas.push(`assinatura da árvore difere do manifesto (${arv.entradas} entradas contra ${mani.arvore.entradas})`)
      if (temSeg && senha) {
        for (const rel of segs) {
          const f = path.join(dest, rel)
          if (!fs.existsSync(f)) { falhas.push(`segredo ${rel} não voltou`); continue }
          if (esperado?.segredos?.get(rel) && sha256Arquivo(f) !== esperado.segredos.get(rel)) falhas.push(`segredo ${rel} voltou diferente`)
        }
      }
    }

    // a parte Docker: as somas o restaurar.sh já conferiu; aqui abre cada arquivo e vê se é o que diz ser
    let docker = ''
    const semPgRestore = []
    let nImg = 0, nVol = 0, nDump = 0, nPub = 0, nMont = 0
    for (const rel of Object.keys(mani.sha256)) {
      const f = path.join(cap, rel)
      if (rel.startsWith('docker/imagens/')) {
        nImg++
        const l = exec('tar', ['-tf', f])
        if (l.status !== 0 || !/(^|\n)(manifest\.json|index\.json)\n/.test(l.stdout)) falhas.push(`a imagem ${rel} não parece um docker save`)
      } else if (rel.startsWith('docker/volumes/')) {
        nVol++
        if (exec('tar', ['-tzf', f]).status !== 0) falhas.push(`o volume ${rel} não abre como tar.gz`)
      } else if (rel.startsWith('publicado/') || rel.startsWith('montagens/')) {
        // as somas o restaurar.sh já conferiu; aqui abre cada tar, sem extrair nada (e sem tocar em /var/www nem em /opt)
        if (rel.startsWith('publicado/')) nPub++; else nMont++
        if (exec('tar', ['-tzf', f]).status !== 0) falhas.push(`a pasta ${rel} não abre como tar.gz`)
      } else if (rel.startsWith('dados/') && rel.endsWith('.dump')) {
        nDump++
        const l = spawnSync('pg_restore', ['-l', f], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 })
        if (l.error) semPgRestore.push(rel)
        else if (l.status !== 0) falhas.push(`o despejo ${rel} não abre no pg_restore -l`)
      }
    }
    if (mani.docker?.falhas?.length) falhas.push(`a coleta Docker ficou incompleta (${mani.docker.falhas.length} falha(s): ${mani.docker.falhas.slice(0, 3).map((x) => `${x.tipo} ${x.nome}`).join(', ')})`)
    const esperadas = (mani.publicado || []).filter((x) => x.estado === 'coletada').length + (mani.montagens || []).filter((x) => x.estado === 'coletada').length
    if (nPub + nMont !== esperadas) falhas.push(`o manifesto diz ${esperadas} pasta(s) de fora do projeto coletada(s) e a cápsula traz ${nPub + nMont}`)
    if (nPub + nMont) docker += `; pastas de fora do projeto: ${nPub} publicada(s) e ${nMont} montada(s), somas conferidas e tar aberto`
    if (nImg + nVol + nDump) docker += `; Docker: ${nImg} imagem(ns), ${nVol} volume(s), ${nDump} despejo(s) abertos${semPgRestore.length ? ` (pg_restore não instalado: ${semPgRestore.length} despejo(s) só conferidos pela soma)` : ''}`

    const em = new Date().toISOString()
    const ms = Date.now() - t0
    if (semSenha) {
      return { ok: false, parcial: true, em, motivo: `${falhas.length ? falhas.join('; ') : 'o resto confere'}; os segredos NÃO foram conferidos (sem senha), então a prova não foi gravada`, gravada: false, ms }
    }
    const ok = falhas.length === 0
    const motivo = ok ? `restaurado numa pasta temporária, ${mani.arvore.entradas} entradas idênticas (sha256 e permissões)${temSeg ? `, ${segs.length} segredo(s) abertos com a senha e conferidos` : ', sem segredos'}${docker}` : falhas.join('; ')
    if (gravar) {
      mani.provada = { ok, em, motivo }
      fs.writeFileSync(path.join(cap, 'manifesto.json'), JSON.stringify(mani, null, 2) + '\n')
      const parcial = arquivo + '.parcial'
      gravarTar(parcial, cap, partesDe(cap))
      fs.renameSync(parcial, arquivo)
    }
    return { ok, em, motivo, gravada: gravar, ms }
  } finally {
    fs.rmSync(T, { recursive: true, force: true })
  }
}

const NA = 'Não se aplica a esta cápsula.'
const unicosL = (a) => [...new Set(a)]
/** Caminho que, num servidor comum, só o root grava. É palpite de documento: o restaurar.sh decide pelo que o usuário consegue escrever. */
const rootProvavel = (c) => /^\/(var|opt|srv|etc|usr|mnt|root)\//.test(c)

/** O RESTAURAR.md, sempre nas mesmas 9 seções, a partir do manifesto. Não inventa o que o manifesto não sabe. */
export function gerarRestaurar(m) {
  const temSeg = m.segredos?.cifrados
  const g = m.git
  const v = m.versoes
  const dk = m.docker?.projeto_compose ? m.docker : null
  const sv = m.servidor || null
  const nginxArqs = sv?.nginx?.arquivos || []
  const temServ = !!(sv && (nginxArqs.length || sv.pm2?.processos?.length || sv.unidades?.arquivos?.length || sv.cron?.linhas))
  const naoColetado = m.nao_coletado || []
  const pub = m.publicado || [], mont = m.montagens || []
  const pubDe = (c) => pub.find((x) => x.caminho === c)
  const colet = [...pub, ...mont].filter((x) => x.estado === 'coletada')
  const segPastas = m.segredos?.pastas || [] // os .env de dentro das pastas de fora do projeto, cifrados
  const L = []
  L.push(`# Restaurar ${m.nome}`, '',
    'Este documento acompanha uma cápsula de projeto. Ele foi gerado por código a partir do manifesto.json e não depende de IA.', '')
  L.push('## 1. O que é', '',
    `- Projeto: ${m.nome}`,
    '- De quem é (cliente ou pessoal): esta cápsula não registra.',
    `- Feita em: ${m.criada_em}`,
    `- Servidor de origem: ${m.maquina.hostname} (${m.maquina.plataforma}, ${m.maquina.arquitetura})`,
    `- Tamanho do projeto: ${fmt(m.tamanho_projeto_bytes)}, ${m.arvore.entradas} entradas (pastas, arquivos e atalhos)`, '')
  L.push('## 2. Onde ele morava', '',
    `- Pasta: ${m.caminho_origem}`,
    g ? `- Git: ramo ${g.ramo}, commit ${g.commit}` : '- Git: a pasta não era um repositório git.')
  if (dk) {
    L.push(`- Docker: projeto Compose "${dk.projeto_compose}", pasta de trabalho ${dk.pasta_de_trabalho}${dk.versao_docker ? `, Docker ${dk.versao_docker} na origem` : ''}`)
    for (const c of dk.conteineres || []) L.push(`  - contêiner ${c.nome} (serviço ${c.servico}), imagem ${c.imagem}, estava ${c.estado}${c.variaveis?.length ? `; variáveis de ambiente (só os nomes): ${c.variaveis.join(', ')}` : ''}`)
    for (const b of dk.bancos || []) L.push(`  - banco Postgres: ${b.banco} no serviço ${b.servico}, usuário ${b.usuario}, despejo em ${b.arquivo} (${fmt(b.bytes)})`)
    for (const x of dk.volumes || []) L.push(`  - volume ${x.nome}, montado em ${x.montagens.join(', ')}, cópia em ${x.arquivo} (${fmt(x.bytes)})`)
    for (const i of dk.imagens || []) L.push(`  - imagem ${i.ref}${i.digest ? `, digest ${i.digest}` : ''}, em ${i.arquivo} (${fmt(i.bytes)})`)
    for (const pt of dk.portas || []) L.push(`  - porta ${pt.publica ?? '?'} do servidor leva ao serviço ${pt.servico} (${pt.privada})`)
    for (const b of (dk.binds || []).filter((x) => !x.socket && !x.sistema)) {
      const mt = mont.find((x) => x.caminho === b.origem)
      const onde = b.na_pasta ? ' (está dentro do projeto)' : mt ? (mt.estado === 'coletada' ? ` (FORA do projeto, guardada em ${mt.parte})` : mt.estado === 'coberta' ? ` (FORA do projeto, ${mt.motivo})` : ` (FORA do projeto, NÃO guardada: ${mt.motivo})`) : ' (FORA do projeto: esta cápsula NÃO a guardou)'
      L.push(`  - pasta ligada ao contêiner: ${b.origem} em ${b.destino}${onde}`)
    }
  } else if (m.docker) L.push(`- Docker: nenhum projeto Compose achado para esta pasta (${m.docker.motivo || 'sem motivo registrado'}).`)
  else if (!sv) L.push('- Docker, domínios e processos: esta cápsula não registra. Ela guarda a pasta do projeto.')
  if (sv) {
    if (!sv.nginx.lido) L.push(`- nginx: não foi lido (${sv.nginx.motivo || 'sem motivo'}).`)
    else if (!nginxArqs.length) L.push(`- nginx: li ${sv.nginx.arquivos_lidos} arquivo(s) em ${sv.nginx.pasta} e nenhum bloco foi ligado a este projeto.`)
    for (const f of nginxArqs) {
      L.push(`- nginx, arquivo ${f.arquivo} (${f.certeza === 'certo' ? 'ligação certa' : 'CANDIDATO, a ligação é incerta'}), vindo de ${f.origem}, cópia em servidor/nginx/:`)
      for (const b of f.blocos) L.push(`  - bloco ${b.server_name.join(' ') || '(sem server_name)'}, escuta ${b.listen.join(', ') || '?'}: ${b.certeza}. Motivo: ${b.motivos.map((x) => x.motivo).join('; ')}`)
      if (f.fora_da_capsula?.length) L.push(`  - serve arquivos de fora da pasta do projeto: ${f.fora_da_capsula.map((c) => { const q = pubDe(c); return q ? (q.estado === 'coletada' ? `${c} (guardada em ${q.parte})` : q.estado === 'candidata-nao-incluida' ? `${c} (candidata, NÃO incluída)` : `${c} (NÃO guardada: ${q.motivo})`) : `${c} (esta cápsula NÃO a guarda)` }).join(', ')}`)
      if (f.redigidos?.length) L.push(`  - valor de segredo trocado por *** na cópia: ${f.redigidos.join(', ')}`)
    }
    if (sv.dominios?.length) L.push(`- Domínios: ${sv.dominios.map((d) => `${d.dominio} (${d.certeza}, certificado ${d.certificado})`).join(', ')}. A lista está em servidor/dominios.txt.`)
    if (sv.portas?.length) L.push(`- Portas que o projeto usa: ${sv.portas.map((x) => `${x.porta} (${x.certeza}; ${x.origem.join('; ')})`).join('; ')}`)
    for (const x of sv.pm2?.processos || []) L.push(`- PM2: processo ${x.nome}, script ${x.script}, pasta ${x.cwd}${x.args?.length ? `, argumentos ${x.args.join(' ')}` : ''}${x.variaveis?.length ? `; variáveis de ambiente (só os nomes): ${x.variaveis.join(', ')}` : ''}`)
    for (const u of sv.unidades?.arquivos || []) L.push(`- Unidade de usuário do systemd: ${u.arquivo}, cópia em servidor/systemd/${u.arquivo}`)
    if (sv.cron?.linhas) L.push(`- Cron: ${sv.cron.linhas} linha(s) que citam a pasta, em servidor/cron.txt`)
  }
  for (const x of pub) {
    if (x.estado === 'coletada') L.push(`- Pasta publicada (${x.certeza === 'certo' ? 'ligação certa' : 'CANDIDATA, incluída'}): ${x.caminho}, ${fmt(x.bytes_origem)}, ${x.entradas} entradas, guardada em ${x.parte} (sha256 ${x.sha256}); servida por ${x.origens.join('; ')}${x.excluidos_total ? `; ${x.excluidos_total} item(ns) de chave privada ficaram de fora de propósito` : ''}${x.segredos_total ? `; ${x.segredos_total} arquivo(s) de segredo (.env) saíram do tar e estão CIFRADOS no segredos.tar.gpg: ${x.segredos.map((r) => path.posix.join(x.caminho, r)).join(', ')}` : ''}`)
    else if (x.estado === 'segredo-cifrado') L.push(`- Arquivo de segredo servido ou montado de fora do projeto: ${x.caminho}, CIFRADO no segredos.tar.gpg (não está em nenhum tar).`)
    else if (x.estado === 'candidata-nao-incluida') L.push(`- Pasta publicada, CANDIDATA e NÃO incluída: ${x.caminho} (${x.origens.join('; ')}). Para guardá-la, refaça a cápsula marcando "incluir candidatos".`)
    else if (x.estado === 'coberta') L.push(`- Pasta publicada ${x.caminho}: ${x.motivo}.`)
    else if (x.estado === 'excluida') L.push(`- Pasta publicada ${x.caminho}: ${x.motivo}.`)
    else L.push(`- Pasta publicada, NÃO coletada: ${x.caminho}: ${x.motivo}`)
  }
  for (const x of mont) {
    if (x.estado === 'coletada') L.push(`- Pasta montada por contêiner: ${x.caminho}, ${fmt(x.bytes_origem)}, ${x.entradas} entradas, guardada em ${x.parte} (sha256 ${x.sha256}); ${x.origens.join('; ')}${x.excluidos_total ? `; ${x.excluidos_total} item(ns) de chave privada ficaram de fora de propósito` : ''}${x.segredos_total ? `; ${x.segredos_total} arquivo(s) de segredo (.env) saíram do tar e estão CIFRADOS no segredos.tar.gpg: ${x.segredos.map((r) => path.posix.join(x.caminho, r)).join(', ')}` : ''}`)
    else if (x.estado === 'segredo-cifrado') L.push(`- Arquivo de segredo montado por contêiner: ${x.caminho}, CIFRADO no segredos.tar.gpg (não está em nenhum tar).`)
    else if (x.estado === 'excluida' && /^montagem de sistema/.test(x.motivo)) continue // docker.sock, localtime, /proc: ruído, está só no manifesto
    else if (x.estado === 'excluida' || x.estado === 'coberta') L.push(`- Pasta montada por contêiner ${x.caminho}: ${x.motivo}.`)
    else L.push(`- Pasta montada por contêiner, NÃO coletada: ${x.caminho}: ${x.motivo}`)
  }
  L.push('')
  L.push('## 3. Pré-requisitos', '',
    'Para restaurar (comando que confere entre parênteses):', '',
    '- sh, tar, gzip e sha256sum (`command -v sh tar gzip sha256sum`)')
  if (temSeg) L.push('- gpg, para abrir os segredos (`gpg --version`)')
  if (temServ) L.push('- para a parte servidor: root (ou sudo), o nginx (`nginx -v`), e, se houver domínio com certificado do certbot, o certbot (`certbot --version`); se houver processo PM2, o pm2 (`pm2 -v`)')
  if (dk) L.push(`- docker com o plugin compose, e o seu usuário no grupo docker (\`docker version\`, \`docker compose version\`)${dk.versao_docker ? `; a origem usava Docker ${dk.versao_docker}` : ''}`,
    '- espaço livre para as imagens e os volumes (veja os tamanhos na seção 2)')
  L.push('', 'Para o projeto rodar depois de restaurado (as versões em que a cápsula foi feita):', '',
    `- Node ${v.node} (\`node -v\`)`,
    v.npm ? `- npm ${v.npm} (\`npm -v\`)` : null,
    v.python3 ? `- ${v.python3} (\`python3 --version\`)` : null,
    v.git ? `- ${v.git} (\`git --version\`)` : null,
    `- Mesma arquitetura (${m.maquina.arquitetura}) e sistema (${m.maquina.plataforma}): o node_modules veio junto e pode ter módulos nativos.`, '')
  L.push('## 4. Restaurar com o script', '',
    'Abra a cápsula e entre na pasta:', '',
    '```', `tar -xzf ${m.nome}-*.capsula.tar.gz -C uma-pasta-de-trabalho`, 'cd uma-pasta-de-trabalho', '```', '',
    'Ensaio (só confere as somas e mostra o que faria, não muda nada):', '', '```', 'sh restaurar.sh', '```', '',
    'Executar de verdade:', '', '```', 'sh restaurar.sh --aplicar', '```', '',
    `Sem \`--destino\`, o destino é a pasta de origem (${m.caminho_origem}). Para outro lugar, use \`--destino <pasta>\`. Destino que já existe e não está vazio é recusado, a não ser com \`--sobrescrever\` (que troca os arquivos de mesmo nome e não apaga os outros).`, '')
  if (dk) L.push('Parte Docker: o `--aplicar` carrega as imagens, recria os volumes, sobe o compose e restaura os bancos. Tudo nasce sob um projeto Compose NOVO, para não esbarrar no original:', '',
    '```', `sh restaurar.sh --aplicar --destino /srv/${m.nome} --projeto-compose ${dk.projeto_compose}-restaurado`, '```', '',
    `Sem \`--projeto-compose\`, o nome é "${dk.projeto_compose}-restaurado". Volume ou contêiner que já exista com o nome novo recusa tudo (saída 7) antes de mudar qualquer coisa; só \`--sobrescrever\` usa o nome original e restaura por cima, sem apagar. \`--sem-docker\` restaura só a pasta. Se o compose fixa \`container_name\` ou portas do servidor, mude no arquivo do destino antes, ou o Docker recusa subir ao lado do original.`, '')
  if (temServ) L.push('Parte servidor: o `--aplicar` só mexe no nginx, no certificado, no PM2, nas unidades e no cron se for rodado como root. Rodando sem root, ele NÃO tenta nada disso e imprime os comandos com `sudo`, prontos para colar. Como root:', '',
    '```', `sudo sh restaurar.sh --aplicar --destino /srv/${m.nome}`, '```', '',
    'Cada bloco do nginx é copiado para `sites-available` com um atalho em `sites-enabled`, e o `nginx -t` roda ANTES de recarregar: se falhar, tudo que foi instalado é desfeito e o motivo aparece. Servidor novo sem o certificado: o script troca pelos blocos só-HTTP (`.sem-ssl.conf`) e o certbot acrescenta o HTTPS. Só os blocos de ligação "certa" entram; os CANDIDATOS só com `--incluir-candidatos`. Bloco que já existe com o mesmo nome é recusado (saída 9) sem `--sobrescrever`. `--nginx-dir` muda a pasta do nginx e `--sem-servidor` pula esta parte.', '')
  if (colet.length) L.push('Pastas de fora do projeto (`publicado/` e `montagens/`, listadas na seção 2): o `--aplicar` recoloca cada uma no CAMINHO ORIGINAL quando você consegue escrever nele, e quando não consegue (por exemplo `/var/www` e `/opt`, sem root) NÃO tenta nada e imprime os comandos com `sudo`, prontos para colar. Com `--destino`, elas vão para `<destino>/_externo/<caminho original>` e os blocos do nginx copiados passam a apontar para lá; `--externos-originais` mantém o caminho original mesmo com `--destino`. Pasta que já existe com conteúdo DIFERENTE recusa tudo antes de mudar qualquer coisa (saída 12), a não ser com `--sobrescrever`; pasta igual é mantida. `--sem-pastas` pula esta parte.', '')
  if (segPastas.length) L.push('Segredos de fora do projeto (os `.env` de dentro dessas pastas, cifrados no `segredos.tar.gpg`): depois de abrir o `segredos.tar.gpg` com a senha, o `--aplicar` recoloca cada um no mesmo lugar de origem (ou sob `<destino>/_externo/...`), com a mesma regra de root das pastas: sem permissão de escrita NADA é tentado e o comando com `sudo` é impresso. Arquivo que já existe é mantido se for igual; se for diferente, só `--sobrescrever` o troca (sem ele, sai 6). O dono e o grupo originais do arquivo NÃO são restaurados (rodando como root ele fica do root): ajuste com `chown` se o site roda com outro usuário. Sem a senha, esses arquivos não voltam.', '')
  L.push('## 5. Restaurar à mão', '',
    'Para o dia em que o script não rodar, na mesma ordem dele:', '',
    '1. Abrir a cápsula: `tar -xzf <cápsula> -C <pasta de trabalho>`.',
    '2. Conferir a soma de cada parte listada no campo `sha256` do manifesto.json: `sha256sum <parte>`.',
    '3. Criar o destino: `mkdir -p <destino>`.',
    '4. Extrair o projeto: `tar -xzpf projeto.tar.gz -C <destino> --strip-components=1` (o `p` guarda as permissões).',
    temSeg ? '5. Abrir os segredos (pede a senha): `gpg --decrypt segredos.tar.gpg > segredos.tar` e depois `tar -xpf segredos.tar -C <destino>`; apague o segredos.tar em seguida.' : '5. Segredos: esta cápsula não tem.')
  if (dk) {
    L.push('6. Imagens: `docker load -i docker/imagens/<arquivo>.tar` para cada arquivo.',
      '7. Volumes: para cada arquivo em `docker/volumes/`, `docker volume create <nome-novo>` e depois `docker run --rm -i --network none -v <nome-novo>:/v --entrypoint tar <imagem> xzf - -C /v < docker/volumes/<arquivo>`. O nome novo é o do projeto Compose novo, um sublinhado e o resto do nome original.',
      `8. Compose: \`docker compose -p <projeto-novo> --project-directory <destino>/${dk.pasta_de_trabalho_relativa} -f <compose> up -d\`.`,
      '9. Bancos: com o serviço de pé, `docker exec -i <contêiner> pg_restore --clean --if-exists --no-owner -U <usuário> -d <banco> < dados/<arquivo>.dump`.')
  }
  if (colet.length) {
    L.push('', 'Pastas de fora do projeto, à mão (o caminho original de cada uma está na seção 2 e no pastas.tsv; as partes já vêm conferidas pelo manifesto):', '')
    for (const x of colet) L.push(`- ${x.caminho}: \`${rootProvavel(x.caminho) ? 'sudo ' : ''}mkdir -p ${x.tipo_origem === 'f' ? path.posix.dirname(x.caminho) : x.caminho} && ${rootProvavel(x.caminho) ? 'sudo ' : ''}tar -xzpf ${x.parte} -C ${x.tipo_origem === 'f' ? path.posix.dirname(x.caminho) : x.caminho}\``)
  }
  if (segPastas.length) {
    L.push('', 'Segredos de fora do projeto, à mão (depois de recolocar a pasta correspondente; o gpg pede a senha):', '')
    for (const x of segPastas) L.push(`- ${x.caminho_original}: \`gpg --decrypt segredos.tar.gpg | tar -xOf - '${x.membro}' | ${rootProvavel(x.caminho_original) ? 'sudo ' : ''}tee '${x.caminho_original}' >/dev/null\` e depois \`${rootProvavel(x.caminho_original) ? 'sudo ' : ''}chmod 600 '${x.caminho_original}'\` (e \`chown\` para o usuário do site)`)
  }
  if (temServ) {
    L.push('', 'Servidor, à mão (o nginx e o certbot exigem root; troque os caminhos de origem pelos do destino dentro dos arquivos, se a pasta mudou):', '')
    for (const f of nginxArqs.filter((x) => x.certeza === 'certo')) {
      L.push(`- nginx ${f.arquivo}: \`sudo cp servidor/nginx/${f.copia || '<arquivo>.conf'} /etc/nginx/sites-available/${f.arquivo}\` e \`sudo ln -s /etc/nginx/sites-available/${f.arquivo} /etc/nginx/sites-enabled/${f.arquivo}\``)
    }
    if (nginxArqs.length) L.push('- Teste e recarregue: `sudo nginx -t && sudo nginx -s reload`. Se o `nginx -t` reclamar de certificado que ainda não existe, use a cópia `.sem-ssl.conf` do mesmo arquivo no lugar.')
    const cb = (sv.dominios || []).filter((d) => d.certificado === 'certbot' && d.certeza === 'certo' && !d.dominio.startsWith('*'))
    if (cb.length) L.push(`- Certificado: \`sudo certbot --nginx ${cb.map((d) => `-d ${d.dominio}`).join(' ')}\` (o DNS precisa apontar para este servidor antes).`)
    for (const x of sv.pm2?.processos || []) L.push(`- PM2: \`pm2 start ${x.script} --name ${x.nome} --cwd ${x.cwd}${x.args?.length ? ` -- ${x.args.join(' ')}` : ''}\` e depois \`pm2 save\``)
    if (sv.unidades?.arquivos?.length) L.push('- Unidades: copie servidor/systemd/* para `~/.config/systemd/user/`, rode `systemctl --user daemon-reload` e `systemctl --user enable --now <unidade>`.')
    if (sv.cron?.linhas) L.push('- Cron: `(crontab -l 2>/dev/null; cat servidor/cron.txt) | crontab -`')
  }
  L.push('')
  L.push('## 6. Segredos', '')
  if (temSeg) {
    if (m.segredos.arquivos.length) L.push('Estes arquivos foram tirados do projeto.tar.gz e estão só cifrados em `segredos.tar.gpg` (gpg simétrico, AES256):', '', ...m.segredos.arquivos.map((a) => `- ${a}`), '')
    else L.push('O projeto em si não tinha arquivos de segredo, mas esta cápsula tem um `segredos.tar.gpg` (gpg simétrico, AES256) com os arquivos citados abaixo.', '')
    L.push('O conteúdo e os nomes das variáveis ficam dentro do arquivo cifrado. A senha é a que foi digitada ao fazer a cápsula; ela não fica guardada em lugar nenhum. Sem a senha, a cápsula restaura o projeto sem esses arquivos. Perdeu a senha, perdeu os segredos: refaça as chaves nos serviços de origem.', '')
  } else L.push('O projeto não tinha arquivos de segredo (`.env`, `.env.*` fora o `.env.example`). Nada foi cifrado.', '')
  if (segPastas.length) L.push('Também estão cifrados, em `_externo/` dentro do segredos.tar.gpg, os arquivos de segredo (`.env`) que estavam DENTRO das pastas publicadas e montadas, fora do projeto (o restaurador os devolve ao lugar de origem). Só o caminho de cada um está no manifesto, nunca o conteúdo:', '',
    ...segPastas.map((x) => `- ${x.caminho_original} (${x.origem})`), '')
  if (m.segredos?.externos?.length) L.push('Também estão cifrados, em `_servidor/` dentro do segredos.tar.gpg, os arquivos de segredo que a configuração do servidor aponta (o restaurador os devolve ao lugar de origem quando roda como root):', '',
    ...m.segredos.externos.map((x) => `- ${x.caminho_original} (${x.origem})`), '')
  if (sv?.nginx?.arquivos?.some((f) => f.certificados?.length)) L.push('Certificados e chaves privadas NÃO foram lidos nem guardados: só o nome dos domínios. O certbot emite o certificado de novo; certificado de outra origem (autoassinado, Cloudflare) precisa ser reinstalado à mão.', '')
  if (dk) L.push('A senha do banco não foi lida nem guardada: o despejo roda dentro do contêiner, pelo socket local. Os arquivos do compose (`docker/compose/`) ficam em claro, como estão na pasta do projeto: se algum tiver senha escrita direto nele, ela está lá.', '')
  L.push('## 7. O que exige root', '')
  if (!naoColetado.length && !dk && !temServ && !colet.length && !segPastas.length) L.push(`Nada nesta cápsula exige root. ${NA} Se a pasta de destino for de outro usuário, escolha uma sua com \`--destino\`.`, '')
  else {
    if (dk) L.push('- Rodar `docker` exige root ou estar no grupo docker do servidor de destino (`sudo usermod -aG docker <usuário>` e entrar de novo).')
    if (naoColetado.length) {
      L.push(`- não coletado, precisa de root: ${naoColetado.length} item(ns) que o usuário que fez a cápsula não conseguia ler. Eles NÃO estão nela. Para guardá-los, refaça a cápsula como root ou copie com \`sudo\`:`)
      for (const c of naoColetado.slice(0, 100)) L.push(`  - ${c.caminho}`)
      if (naoColetado.length > 100) L.push(`  - e mais ${naoColetado.length - 100} (a lista inteira está no manifesto.json)`)
    }
    for (const x of colet.filter((y) => rootProvavel(y.caminho))) {
      const d = x.tipo_origem === 'f' ? path.posix.dirname(x.caminho) : x.caminho
      L.push(`- Recolocar ${x.caminho} (${x.parte}) exige root, é fora da sua casa. Rodado sem root, o \`restaurar.sh --aplicar\` imprime isto pronto: \`sudo mkdir -p ${d} && sudo tar -xzpf ${x.parte} -C ${d}\``)
    }
    for (const x of segPastas.filter((y) => rootProvavel(y.caminho_original))) {
      L.push(`- Recolocar o segredo ${x.caminho_original} exige root, é fora da sua casa. Rodado sem root, o \`restaurar.sh --aplicar\` imprime isto pronto: \`gpg --decrypt segredos.tar.gpg | tar -xOf - '${x.membro}' | sudo tee '${x.caminho_original}' >/dev/null\` e \`sudo chmod 600 '${x.caminho_original}'\``)
    }
    if (temServ) {
      L.push('- Instalar o nginx, reemitir o certificado, ligar PM2/unidades/cron: root (ou sudo). Rodado sem root, o `restaurar.sh --aplicar` imprime estes comandos prontos:')
      for (const f of nginxArqs.filter((x) => x.certeza === 'certo')) L.push(`  - \`sudo cp servidor/nginx/${f.copia || '<arquivo>.conf'} /etc/nginx/sites-available/${f.arquivo}\``, `  - \`sudo ln -s /etc/nginx/sites-available/${f.arquivo} /etc/nginx/sites-enabled/${f.arquivo}\``)
      if (nginxArqs.length) L.push('  - `sudo nginx -t && sudo nginx -s reload`')
      for (const d of (sv.dominios || []).filter((x) => x.certificado === 'certbot' && x.certeza === 'certo' && !x.dominio.startsWith('*'))) L.push(`  - \`sudo certbot --nginx -d ${d.dominio}\``)
    } else if (!colet.length && !segPastas.length) L.push('- nginx, certificado e `/opt`, `/var/www` não fazem parte desta cápsula.')
    L.push('')
  }
  L.push('## 8. Como saber que voltou', '',
    `- O script termina dizendo quantas entradas restaurou (esperado: ${m.arvore.entradas}).`,
    g ? `- \`git -C <destino> rev-parse HEAD\` deve dar ${g.commit}.` : null,
    g ? `- \`git -C <destino> status --porcelain | wc -l\` deve dar ${g.status.total} (eram ${g.status.modificados} modificados e ${g.status.nao_rastreados} não rastreados${temSeg ? '; sem a senha os segredos não voltam e esse número pode diferir' : ''}).` : null)
  if (dk) {
    L.push('- `docker compose -p <projeto-novo> ps` deve mostrar os serviços de pé.')
    for (const b of dk.bancos || []) L.push(`- Banco ${b.banco}: \`docker exec <contêiner> psql -U ${b.usuario} -d ${b.banco} -c '\\dt'\` deve listar as tabelas.`)
    for (const pt of (dk.portas || []).filter((x) => x.publica)) L.push(`- A porta ${pt.publica} do servidor deve responder (serviço ${pt.servico}).`)
  } else if (!(sv?.dominios?.length)) L.push('- Endereço de saúde e página esperada: esta cápsula não registra.')
  for (const d of (sv?.dominios || []).filter((x) => x.certeza === 'certo' && !x.dominio.startsWith('*'))) L.push(`- \`curl -sI https://${d.dominio}/\` deve responder 200 ou um redirecionamento (só depois de o DNS apontar para este servidor).`)
  for (const x of colet.filter((y) => y.tipo_origem === 'd')) L.push(`- Pasta ${x.caminho}: \`ls -A ${x.caminho} | head\` deve listar o conteúdo, e \`du -sk ${x.caminho}\` deve dar perto de ${Math.round(x.bytes_origem / 1024)} KB (eram ${x.entradas} entradas).`)
  for (const x of pub.filter((y) => y.estado === 'coletada' && y.origens.length)) {
    const dom = unicosL(x.origens.map((o) => (/, ([^()]*?) \((?:root|alias)\)$/.exec(o) || [])[1]).filter(Boolean).flatMap((n) => n.split(' ')).filter((n) => n.includes('.') && !n.startsWith('*') && !n.startsWith('~')))
    if (dom.length) L.push(`- O caminho publicado ${x.caminho} é servido por ${dom.join(', ')}: abra o endereço e confira que a página aparece (só depois de o DNS apontar para este servidor).`)
  }
  if (sv?.nginx?.arquivos?.length) L.push('- `sudo nginx -t` deve dizer que a sintaxe está ok.')
  L.push('')
  L.push('## 9. O que a cápsula NÃO tem', '')
  if (!dk) L.push('- Banco de dados, volumes e imagens Docker.')
  else if (dk.falhas?.length) {
    L.push(`- O que a coleta Docker NÃO conseguiu guardar (${dk.falhas.length}):`)
    for (const f of dk.falhas) L.push(`  - ${f.tipo} ${f.nome}: ${f.motivo}`)
  }
  if (!sv) L.push('- Configuração de servidor: nginx, certificado, PM2, serviços, cron.')
  else {
    L.push('- DNS no registrador: os registros A/AAAA (e o proxy do Cloudflare, se havia) NÃO estão na cápsula. Aponte cada domínio da seção 2 para o IP do servidor novo antes de pedir certificado.')
    L.push('- Certificados e chaves privadas (nunca lidos de propósito); o que não for do certbot precisa ser reinstalado.')
    const fora = unicosL(nginxArqs.flatMap((f) => f.fora_da_capsula || [])).filter((c) => pubDe(c)?.estado !== 'coletada')
    if (fora.length) L.push(`- O conteúdo servido de fora da pasta do projeto que esta cápsula NÃO guardou (${fora.join(', ')}): é o que foi publicado, veja o motivo na seção 2.`)
    L.push('- PM2 e serviços de OUTRO usuário (por exemplo o PM2 do root) e os blocos do nginx que não foram ligados a este projeto.')
  }
  const exc = colet.filter((x) => x.excluidos_total)
  if (exc.length) L.push(`- Chaves privadas e certificados que estavam dentro das pastas de fora do projeto (${exc.map((x) => `${x.caminho}: ${x.excluidos.join(', ')}${x.excluidos_total > x.excluidos.length ? ' e mais' : ''}`).join('; ')}): ficaram de fora de propósito, nunca são lidos nem cifrados. Reponha à mão. (Os arquivos .env dessas pastas NÃO estão aqui: estão cifrados no segredos.tar.gpg, seção 6.)`)
  L.push(sv ? '- E-mail (MX, SPF) e serviços de terceiros (Cloudflare, Supabase hospedado, Resend, Stripe e parecidos).' : '- DNS, e-mail e serviços de terceiros.',
    '- A senha dos segredos.',
    m.ignorados?.length ? `- Itens que não dá para guardar em arquivo (sockets, pipes): ${m.ignorados.join(', ')}.` : null,
    naoColetado.length ? `- ${naoColetado.length} arquivo(s) ou pasta(s) ilegíveis para quem fez a cápsula (seção 7).` : null,
    m.avisos?.length ? `- Aviso na hora de fazer: ${m.avisos.join('; ')}.` : null, '')
  return L.filter((x) => x !== null).join('\n')
}

/** O restaurador. sh POSIX puro: sem Node, sem IA. Mora em src/restaurar.sh, para editar sem escape de texto. */
export const RESTAURAR_SH = fs.readFileSync(fileURLToPath(new URL('./restaurar.sh', import.meta.url)), 'utf8')
