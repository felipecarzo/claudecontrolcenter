/* CC-1080, passo 2: a parte Docker da cápsula.
 *
 * ONDE RODA: SÓ dentro do processo do painel (o serviço `agent-cockpit`, que já tem acesso ao Docker por desenho), disparado
 * pelo botão dele na tela. A sessão do Claude nunca executa `docker`, nem para ler: o executor padrão recusa rodar quando o
 * ambiente é de sessão de IA, a não ser que `CC_DOCKER_BIN` aponte para outro binário (é como os testes usam um Docker falso).
 *
 * O QUE FAZ: só LÊ e COPIA. Descobre o projeto Compose dono da pasta, e copia compose, banco (pg_dump), volumes e imagens.
 * O que NUNCA faz: parar, reiniciar, apagar ou matar contêiner, baixar imagem, mexer em compose do original. A lista
 * `PERMITIDOS` abaixo é uma lista de quem PODE; tudo que não está nela é recusado antes de chegar ao Docker, e o que está nela
 * ainda só vale para contêiner, volume e imagem do projeto Compose pedido.
 *
 * Senha de banco: não é lida nem guardada. O pg_dump roda DENTRO do contêiner, pelo socket local, sem `-h`.
 * Manifesto: nomes e números. Variáveis de ambiente entram só pelo NOME, nunca pelo valor.
 *
 * Lacuna do site publicado: as pastas que os contêineres montam direto do disco (bind mount) e que ficam FORA da pasta do projeto
 * entram como `montagens/<caminho codificado>.tar.gz`. É só leitura de pasta, sem nenhum comando docker novo (ver capsulaPastas.mjs).
 * Fora: docker.sock, /etc/localtime, /etc/timezone, /proc, /sys, /dev, /etc/letsencrypt e qualquer chave privada. A pasta de
 * trabalho do Compose mora sempre dentro do projeto (é assim que o dono é descoberto), então já vai no projeto.tar.gz.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import * as Pa from './capsulaPastas.mjs'

/** Quem pode ser chamado, e nada além. `exec` só com estes três programas; `run` só no formato de cópia somente leitura. */
const VERBOS = new Set(['ps', 'inspect', 'image', 'volume', 'exec', 'run', 'save', 'version'])
const PROGRAMAS_EXEC = new Set(['pg_dump', 'psql'])
const ENTRYPOINTS_RUN = new Set(['tar', 'du'])

export const MIN_VOLUME_IMAGEM = 1

const erro = (codigo, msg) => Object.assign(new Error(msg), { codigo })
const unicos = (a) => [...new Set(a.filter(Boolean))]
const slug = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '_').slice(0, 80) || 'x'
const cauda = (s, n = 300) => String(s || '').trim().split('\n').slice(-3).join(' | ').slice(-n)

/** O executor de verdade: chama o binário `docker`. `para` manda a saída padrão direto para um arquivo (dump, volume, imagem). */
export function executorPadrao() {
  const bin = process.env.CC_DOCKER_BIN
  if (!bin && (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT)) {
    throw erro('SESSAO_IA', 'o Docker só é chamado de dentro do painel, pelo botão. Esta é uma sessão de IA e não deve rodar docker, nem para ler.')
  }
  const exe = bin || 'docker'
  return (args, { para = null } = {}) => new Promise((resolve) => {
    let fd = null
    const fechar = () => { if (fd !== null) { try { fs.closeSync(fd) } catch { /* já fechado */ } fd = null } }
    try { if (para) fd = fs.openSync(para, 'w', 0o600) } catch (e) { return resolve({ codigo: -1, saida: '', erro: e.message }) }
    let out = '', err = ''
    const p = spawn(exe, args, { stdio: ['ignore', fd ?? 'pipe', 'pipe'] })
    if (!para) p.stdout.on('data', (d) => { if (out.length < 64e6) out += d })
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000) })
    p.on('error', (e) => { fechar(); resolve({ codigo: -1, saida: '', erro: e.message }) })
    p.on('close', (code) => { fechar(); resolve({ codigo: code ?? -1, saida: para ? '' : out, erro: err }) })
  })
}

/** O contexto de uma coleta: o executor mais o que o projeto pedido possui. Vazio até a descoberta terminar. */
export const criarContexto = (executar) => ({ executar, ok: { conteineres: new Set(), volumes: new Set(), imagens: new Set() } })

/** Confere o comando ANTES de chegar ao Docker. Lança se não for um dos formatos permitidos para este projeto. */
export function guardar(ctx, args) {
  if (!Array.isArray(args) || !args.length || !args.every((a) => typeof a === 'string')) throw erro('PROIBIDO', 'comando docker inválido')
  const [v, a1, a2] = args
  if (!VERBOS.has(v)) throw erro('PROIBIDO', `comando docker não permitido: ${v}`)
  if (v === 'image' && a1 !== 'inspect') throw erro('PROIBIDO', `docker image ${a1}: só inspect é permitido`)
  if (v === 'volume' && !['inspect', 'ls'].includes(a1)) throw erro('PROIBIDO', `docker volume ${a1}: só inspect e ls`)
  if (v === 'exec') {
    if (!ctx.ok.conteineres.has(a1)) throw erro('PROIBIDO', `exec em contêiner que não é do projeto pedido: ${a1}`)
    if (!PROGRAMAS_EXEC.has(a2)) throw erro('PROIBIDO', `exec só roda pg_dump e psql, pediram ${a2}`)
  }
  if (v === 'save') {
    const alvo = args[args.length - 1]
    if (!ctx.ok.imagens.has(alvo)) throw erro('PROIBIDO', `save de imagem que não é do projeto pedido: ${alvo}`)
  }
  if (v === 'run') {
    if (!args.includes('--rm')) throw erro('PROIBIDO', 'run sem --rm')
    const i = args.indexOf('--network')
    if (i < 0 || args[i + 1] !== 'none') throw erro('PROIBIDO', 'run sem --network none')
    const vols = args.flatMap((a, k) => (a === '-v' ? [args[k + 1]] : []))
    if (!vols.length) throw erro('PROIBIDO', 'run sem volume')
    for (const m of vols) {
      const [nome, destino, modo] = String(m).split(':')
      if (modo !== 'ro' || destino !== '/v') throw erro('PROIBIDO', `volume sem :ro: ${m}`)
      if (!ctx.ok.volumes.has(nome)) throw erro('PROIBIDO', `volume que não é do projeto pedido: ${nome}`)
    }
    const e = args.indexOf('--entrypoint')
    if (e < 0 || !ENTRYPOINTS_RUN.has(args[e + 1])) throw erro('PROIBIDO', 'run só com entrypoint tar ou du')
    for (const proibida of ['--privileged', '-d', '--detach', '--pid', '--cap-add', '--device', '--volumes-from', '--mount']) {
      if (args.includes(proibida)) throw erro('PROIBIDO', `run com ${proibida}`)
    }
  }
}

async function rodar(ctx, args, opts) {
  guardar(ctx, args)
  const r = await ctx.executar(args, opts || {})
  return { codigo: r.codigo, saida: String(r.saida ?? ''), erro: String(r.erro ?? '') }
}

const real = (p) => { try { return fs.realpathSync(p) } catch { return path.resolve(p) } }
const dentro = (pai, filho) => filho === pai || filho.startsWith(pai.endsWith('/') ? pai : pai + '/')
const L = (c, k) => (c.Config?.Labels || {})[k]
const nomeDe = (c) => String(c.Name || '').replace(/^\//, '')
const servicoDe = (c) => L(c, 'com.docker.compose.service') || nomeDe(c)

/** Acha o projeto Compose dono da pasta. Vários projetos: pega o que mora exatamente nela; ainda vários, recusa e diz quais. */
export async function descobrir(pasta, { executar, projetoCompose = null, ctx = criarContexto(executar), mapear = (p) => p } = {}) {
  const raiz = real(pasta)
  const ps = await rodar(ctx, ['ps', '-a', '-q', '--no-trunc'])
  if (ps.codigo !== 0) throw erro('DOCKER', `docker ps falhou (código ${ps.codigo}): ${cauda(ps.erro || ps.saida)}`)
  const ids = unicos(ps.saida.split(/\s+/))
  if (!ids.length) return { ctx, projeto: null, motivo: 'não há contêiner nenhum nesta máquina' }
  const insp = await rodar(ctx, ['inspect', ...ids])
  if (insp.codigo !== 0) throw erro('DOCKER', `docker inspect falhou (código ${insp.codigo}): ${cauda(insp.erro || insp.saida)}`)
  let todos
  try { todos = JSON.parse(insp.saida) } catch { throw erro('DOCKER', 'docker inspect devolveu algo que não é JSON') }

  const donos = todos.filter((c) => { const wd = L(c, 'com.docker.compose.project.working_dir'); return wd && dentro(raiz, real(wd)) })
  const nomes = unicos(donos.map((c) => L(c, 'com.docker.compose.project')))
  if (!nomes.length) return { ctx, projeto: null, motivo: 'nenhum contêiner Compose tem esta pasta como pasta de trabalho' }

  let escolhido = projetoCompose
  if (escolhido) {
    if (!nomes.includes(escolhido)) throw erro('COMPOSE', `o projeto Compose "${escolhido}" não mora em ${raiz}. Os que moram: ${nomes.join(', ')}`)
  } else if (nomes.length === 1) escolhido = nomes[0]
  else {
    const exatos = unicos(donos.filter((c) => real(L(c, 'com.docker.compose.project.working_dir')) === raiz).map((c) => L(c, 'com.docker.compose.project')))
    if (exatos.length === 1) escolhido = exatos[0]
    else throw erro('COMPOSE', `esta pasta tem mais de um projeto Compose (${nomes.join(', ')}). Diga qual.`)
  }

  // o filtro que vale: só os contêineres com o RÓTULO do projeto escolhido
  const conteineres = todos.filter((c) => L(c, 'com.docker.compose.project') === escolhido)
  const wd = real(L(conteineres.find((c) => L(c, 'com.docker.compose.project.working_dir')) || conteineres[0], 'com.docker.compose.project.working_dir') || raiz)
  const arquivos = unicos(conteineres.flatMap((c) => String(L(c, 'com.docker.compose.project.config_files') || '').split(',').map((s) => s.trim())))
  for (const c of conteineres) { ctx.ok.conteineres.add(c.Id); ctx.ok.conteineres.add(nomeDe(c)) }
  return { ctx, raiz, projeto: escolhido, trabalho: wd, trabalhoRel: path.relative(raiz, wd) || '.', configFiles: arquivos, conteineres, mapear }
}

const ehPostgres = (c) => /postgres|postgis|timescale|pgvector/i.test(String(c.Config?.Image || '')) || (c.Config?.Env || []).some((e) => e.startsWith('POSTGRES_PASSWORD='))
const envValor = (c, nome) => { const e = (c.Config?.Env || []).find((x) => x.startsWith(nome + '=')); return e ? e.slice(nome.length + 1) : null }

/** O que o projeto tem: imagens (com digest), volumes nomeados, bancos, portas. Sem valor de variável de ambiente. */
export async function inventariar(desc) {
  const { ctx, conteineres } = desc
  const ids = unicos(conteineres.map((c) => c.Image))
  const ii = await rodar(ctx, ['image', 'inspect', ...ids])
  let infos = []
  if (ii.codigo === 0) { try { infos = JSON.parse(ii.saida) } catch { /* segue sem o digest */ } }
  const porId = new Map(infos.map((i) => [i.Id, i]))
  const imagens = ids.map((id) => {
    const i = porId.get(id) || {}
    const usam = conteineres.filter((c) => c.Image === id)
    const pedida = usam.map((c) => c.Config?.Image).find((r) => (i.RepoTags || []).includes(r.includes(':') || r.includes('@') ? r : r + ':latest'))
    const tags = i.RepoTags || []
    const ref = pedida || tags[0] || id
    const salvar = tags.length ? ref : id
    ctx.ok.imagens.add(id); ctx.ok.imagens.add(salvar); ctx.ok.imagens.add(ref)
    return { id, ref, salvar, tags, digests: i.RepoDigests || [], bytes: Number(i.Size) || 0, servicos: unicos(usam.map(servicoDe)) }
  })

  const vols = new Map()
  const binds = []
  for (const c of conteineres) for (const m of c.Mounts || []) {
    if (m.Type === 'volume' && m.Name) {
      const v = vols.get(m.Name) || { nome: m.Name, montagens: [], conteineres: [] }
      v.montagens.push(m.Destination); v.conteineres.push(c); vols.set(m.Name, v)
      ctx.ok.volumes.add(m.Name)
    } else if (m.Type === 'bind' && m.Source) {
      binds.push({ origem: m.Source, destino: m.Destination, servico: servicoDe(c), na_pasta: dentro(desc.raiz, real(m.Source)), socket: /\.sock$/.test(m.Source), sistema: Pa.SISTEMA_RE.test(path.posix.normalize(m.Source)) })
    }
  }

  const bancos = conteineres.filter(ehPostgres).map((c) => ({
    conteiner: nomeDe(c), id: c.Id, servico: servicoDe(c), imagem: c.Image,
    usuario: envValor(c, 'POSTGRES_USER') || 'postgres', banco: envValor(c, 'POSTGRES_DB'),
    rodando: !!c.State?.Running,
  }))

  const portas = []
  for (const c of conteineres) for (const [priv, lig] of Object.entries(c.NetworkSettings?.Ports || {})) {
    for (const l of lig || []) portas.push({ servico: servicoDe(c), privada: priv, publica: Number(l.HostPort) || null, ip: l.HostIp || '' })
  }

  const resumo = conteineres.map((c) => ({
    nome: nomeDe(c), servico: servicoDe(c), imagem: c.Config?.Image || '', estado: c.State?.Status || '',
    variaveis: (c.Config?.Env || []).map((e) => e.split('=')[0]), // SÓ os nomes
  }))
  // pastas montadas de fora do projeto: uma por origem, medidas agora (só leitura de pasta) e coletadas em coletar()
  const porOrigem = new Map()
  for (const b of binds.filter((x) => !x.na_pasta)) {
    const e = porOrigem.get(b.origem) || { caminho: b.origem, certeza: 'certo', origens: [] }
    e.origens.push(`contêiner ${b.servico}, montada em ${b.destino}`)
    porOrigem.set(b.origem, e)
  }
  const raizes = [desc.raiz, real(desc.raiz)]
  const montagens = [...porOrigem.values()].map((e) => ({ ...e, av: Pa.avaliar(e.caminho, { raizes, mapear: desc.mapear || ((p) => p) }) }))
  return { ...desc, imagens, volumes: [...vols.values()], binds, montagens, bancos, portas, resumo }
}

/** As imagens que podem servir de ferramenta para ler um volume: já existem aqui, a do banco primeiro. */
function candidatas(inv, vol) {
  const dosBancos = inv.bancos.map((b) => b.imagem)
  const dosQueMontam = vol.conteineres.map((c) => c.Image)
  const todas = inv.imagens.map((i) => i.id)
  return unicos([...dosBancos, ...dosQueMontam, ...todas])
}
const refDaImagem = (inv, id) => { const i = inv.imagens.find((x) => x.id === id); return i ? (i.tags.length ? i.ref : i.id) : id }

async function listarBancos(ctx, b) {
  const r = await rodar(ctx, ['exec', b.id, 'psql', '-U', b.usuario, '-d', 'postgres', '-At', '-c', 'select datname from pg_database where not datistemplate order by 1'])
  const lista = r.codigo === 0 ? r.saida.split('\n').map((s) => s.trim()).filter(Boolean) : []
  return lista.length ? lista : [b.banco || b.usuario]
}

/** Estimativa em bytes, sem gravar nada. Teto: o que está em disco, sem contar a compressão. */
export async function estimar(inv) {
  const { ctx } = inv
  const avisos = []
  const imagens = inv.imagens.map((i) => ({ ref: i.ref, bytes: i.bytes }))
  const volumes = []
  for (const v of inv.volumes) {
    let bytes = null
    for (const img of candidatas(inv, v)) {
      const r = await rodar(ctx, ['run', '--rm', '--network', 'none', '-v', `${v.nome}:/v:ro`, '--entrypoint', 'du', img, '-sk', '/v'])
      const kb = parseInt(r.saida, 10)
      if (r.codigo === 0 && Number.isFinite(kb)) { bytes = kb * 1024; break }
    }
    if (bytes === null) avisos.push(`não consegui medir o volume ${v.nome}`)
    volumes.push({ nome: v.nome, bytes })
  }
  const bancos = []
  for (const b of inv.bancos) {
    if (!b.rodando) { avisos.push(`o banco ${b.servico} está parado: não dá para despejar, só copiar o volume`); bancos.push({ servico: b.servico, banco: b.banco, bytes: null }); continue }
    const r = await rodar(ctx, ['exec', b.id, 'psql', '-U', b.usuario, '-d', 'postgres', '-At', '-c', 'select coalesce(sum(pg_database_size(datname)),0) from pg_database where not datistemplate'])
    const n = Number(String(r.saida).trim())
    bancos.push({ servico: b.servico, banco: b.banco, bytes: r.codigo === 0 && Number.isFinite(n) ? n : null })
  }
  const soma = (a) => a.reduce((t, x) => t + (x.bytes || 0), 0)
  const montagens = inv.montagens.filter((m) => m.av.situacao !== 'sistema').map(Pa.resumirAv)
  for (const m of montagens) if (m.situacao !== 'ok' && m.situacao !== 'excluida') avisos.push(`a pasta montada ${m.caminho} não será guardada: ${m.texto}`)
  return { imagens, volumes, bancos, montagens, avisos, bytes: soma(imagens) + soma(volumes) + soma(bancos) + Pa.bytesDe(inv.montagens) }
}

/**
 * Grava no `stage`: docker/compose/, docker/imagens/, docker/volumes/, dados/*.dump e docker/plano.tsv.
 * Devolve a lista de arquivos (relativos ao stage), o resumo para o manifesto e as falhas. Uma falha não derruba o resto.
 */
export async function coletar(inv, stage, { progresso = () => {} } = {}) {
  const { ctx } = inv
  const falhas = []
  const arquivos = []
  const plano = []
  const falhar = (tipo, nome, motivo) => { falhas.push({ tipo, nome, motivo: String(motivo).slice(0, 300) }); progresso(`FALHOU ${tipo} ${nome}`) }
  const pasta = (rel) => { fs.mkdirSync(path.join(stage, rel), { recursive: true }); return rel }
  const tamanho = (rel) => fs.statSync(path.join(stage, rel)).size
  const larga = (rel) => fs.rmSync(path.join(stage, rel), { force: true })

  const versao = await rodar(ctx, ['version', '--format', '{{.Server.Version}}'])
  plano.push(['projeto', inv.projeto], ['workdir', inv.trabalhoRel])

  // 1. compose: os arquivos que o rótulo aponta
  const compose = []
  inv.configFiles.forEach((orig, i) => {
    try {
      const rel = `${pasta('docker/compose')}/${i + 1}-${slug(path.basename(orig))}`
      fs.copyFileSync(orig, path.join(stage, rel))
      const emProjeto = dentro(inv.raiz, real(orig)) ? path.relative(inv.raiz, real(orig)) : '-'
      compose.push({ arquivo: rel, original: orig }); arquivos.push(rel); plano.push(['arqcompose', emProjeto, rel])
    } catch (e) { falhar('arquivo-compose', orig, e.code === 'EACCES' ? 'não coletado, precisa de root' : e.message) }
  })
  progresso(`compose: ${compose.length} arquivo(s)`)

  // 2. bancos: pg_dump dentro do contêiner, formato custom, sem senha (socket local)
  const bancos = []
  for (const b of inv.bancos) {
    if (!b.rodando) { falhar('banco', b.servico, 'contêiner parado: não dá para despejar; o volume dele é copiado (consistente porque parado)'); continue }
    for (const db of await listarBancos(ctx, b)) {
      const rel = `${pasta('dados')}/${slug(b.servico)}-${slug(db)}.dump`
      progresso(`despejando o banco ${db} (${b.servico})`)
      const r = await rodar(ctx, ['exec', b.id, 'pg_dump', '-Fc', '-U', b.usuario, db], { para: path.join(stage, rel) })
      if (r.codigo !== 0) { larga(rel); falhar('banco', `${b.servico}/${db}`, cauda(r.erro || r.saida)); continue }
      arquivos.push(rel); bancos.push({ servico: b.servico, conteiner: b.conteiner, usuario: b.usuario, banco: db, arquivo: rel, bytes: tamanho(rel) })
      plano.push(['banco', b.servico, b.usuario, db, rel])
    }
  }

  // 3. volumes: tar em contêiner descartável, volume montado SOMENTE LEITURA, imagem que já existe aqui
  const volumes = []
  let n = 0
  for (const v of inv.volumes) {
    n++
    const rel = `${pasta('docker/volumes')}/${n}-${slug(v.nome)}.tar.gz`
    let feito = null, ultimo = ''
    for (const img of candidatas(inv, v)) {
      progresso(`copiando o volume ${v.nome}`)
      const r = await rodar(ctx, ['run', '--rm', '--network', 'none', '-v', `${v.nome}:/v:ro`, '--entrypoint', 'tar', img, 'czf', '-', '-C', '/v', '.'], { para: path.join(stage, rel) })
      if (r.codigo === 0) { feito = img; break }
      ultimo = cauda(r.erro || r.saida)
    }
    if (!feito) { larga(rel); falhar('volume', v.nome, ultimo || 'nenhuma imagem local conseguiu ler o volume'); continue }
    arquivos.push(rel)
    volumes.push({ nome: v.nome, montagens: v.montagens, arquivo: rel, bytes: tamanho(rel), imagem_usada: refDaImagem(inv, feito) })
    plano.push(['volume', v.nome, rel, refDaImagem(inv, feito)])
  }

  // 4. imagens: docker save, com o digest no manifesto
  const imagens = []
  n = 0
  for (const im of inv.imagens) {
    n++
    const rel = `${pasta('docker/imagens')}/${n}-${slug(im.ref.replace(/^sha256:/, '').slice(0, 60))}.tar`
    progresso(`salvando a imagem ${im.ref}`)
    const r = await rodar(ctx, ['save', im.salvar], { para: path.join(stage, rel) })
    if (r.codigo !== 0) { larga(rel); falhar('imagem', im.ref, cauda(r.erro || r.saida)); continue }
    arquivos.push(rel)
    imagens.push({ ref: im.ref, id: im.id, digest: im.digests[0] || null, digests: im.digests, servicos: im.servicos, arquivo: rel, bytes: tamanho(rel) })
    plano.push(['imagem', rel, im.tags.length ? im.ref : im.id])
  }

  // 5. pastas montadas de fora do projeto (bind mount): só leitura de pasta, sem comando docker
  progresso('copiando as pastas montadas pelos contêineres')
  const mont = Pa.coletar(inv.montagens, stage, 'montagens', { tipo: 'montagem' })
  arquivos.push(...mont.arquivos)

  const planoRel = `${pasta('docker')}/plano.tsv`
  fs.writeFileSync(path.join(stage, planoRel), plano.map((l) => l.join('\t')).join('\n') + '\n')
  arquivos.push(planoRel)

  return {
    arquivos,
    falhas,
    somas: mont.somas,
    nao_coletado: mont.naoColetado,
    pastas: { plano: mont.plano, entradas: mont.entradas, segredos: mont.segredos },
    docker: {
      projeto_compose: inv.projeto,
      pasta_de_trabalho: inv.trabalho,
      pasta_de_trabalho_relativa: inv.trabalhoRel,
      versao_docker: versao.codigo === 0 ? versao.saida.trim() : null,
      conteineres: inv.resumo, compose, imagens, volumes, bancos,
      binds: inv.binds, portas: inv.portas, falhas,
    },
  }
}

/** Mede o que a parte Docker teria. Só leitura. Para o botão "Estimar" e a confirmação antes de fazer. */
export async function ensaioDocker(pasta, { executar, projetoCompose = null, mapear } = {}) {
  const desc = await descobrir(pasta, { executar, projetoCompose, mapear })
  if (!desc.projeto) return { projeto_compose: null, motivo: desc.motivo, bytes: 0, imagens: [], volumes: [], bancos: [], montagens: [], portas: [], binds: [], avisos: [] }
  const inv = await inventariar(desc)
  const est = await estimar(inv)
  return {
    projeto_compose: inv.projeto, conteineres: inv.resumo.map((c) => ({ nome: c.nome, servico: c.servico, imagem: c.imagem, estado: c.estado })),
    portas: inv.portas, binds: inv.binds.filter((b) => !b.socket), ...est,
  }
}
