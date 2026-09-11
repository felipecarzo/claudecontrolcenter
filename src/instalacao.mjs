/**
 * O que esta máquina PRECISA ter para o framework valer aqui, e o que ela tem.
 *
 * ## Por que existe
 *
 * Pergunta dele em 11/09: *"o framework tá funcionando no desktop também?"*. A
 * medição dizia que não, e o jeito como não dizia é o ponto:
 *
 * - `framework-guard` e `framework-inicio`, que SÃO o framework, não estavam
 *   registrados neste PC. Os dois existiam em disco, prontos;
 * - o encaixe do opencode existia no repositório e nunca foi instalado: a
 *   pasta `~/.config/opencode/plugin/` nem existia;
 * - `acharCC.mjs`, que o `routia-fim` importa, faltava em `~/.claude/hooks/`, e
 *   o hook quebrava a cada fim de turno. **320 dos 470 registros de trava eram
 *   esse erro**, e apareciam na tela como uma trava chamada "sem nome".
 *
 * Nenhum dos três dava erro visível. O diagnóstico dele: *"os hooks funcionam
 * hoje e amanhã já são inexistentes, não tem uma fundação firme"*.
 *
 * ## A regra que faz este arquivo valer a pena
 *
 * **Exigência não declarada não pode ser cobrada, e a falta fica invisível.**
 * Era exatamente o caso dos dois hooks do framework: o catálogo não os listava,
 * então nenhuma verificação podia sentir falta deles. Por isso o que este
 * módulo exporta primeiro é a DECLARAÇÃO, e a conferência vem depois.
 *
 * ## O que ele NÃO faz
 *
 * Não liga nada sozinho. `conferir()` só olha; quem liga é `ligar()`, chamado
 * por comando. Instalação silenciosa em máquina alheia é o tipo de coisa que
 * ele precisa ver acontecer, e o `settings.json` é dele, não do painel.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOOKS } from './hooksCatalogo.mjs'
import { arquivoSettings, comandoDe, instalar, pastaHooks, readSettings, registrado } from './hooksRegistro.mjs'
import { casaClaude, ehWindows } from './platform.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Gravidade, e ela decide a ordem na tela. */
export const GRAVIDADE = {
  quebra: { peso: 3, label: 'quebra', explica: 'alguma coisa falha toda vez, mesmo que em silêncio' },
  desliga: { peso: 2, label: 'desligado', explica: 'a peça existe, está pronta, e não age nesta máquina' },
  atrasa: { peso: 1, label: 'atrasado', explica: 'funciona, mas não é o que está no repositório' },
}

/**
 * Um arquivo que um hook importa e que precisa estar AO LADO dele.
 *
 * `routia-fim.mjs` faz `import { acharCC } from './acharCC.mjs'`, e o caminho é
 * relativo ao hook. Copiar só o hook deixa o import órfão, e o erro sai como
 * `ERR_MODULE_NOT_FOUND` a cada fim de turno, em todo projeto.
 */
const VIZINHOS = [
  { arquivo: 'acharCC.mjs', de: path.join('hooks', 'routia', 'acharCC.mjs'), porque: 'o hook que lembra de liberar a rota importa este arquivo; sem ele quebra a cada fim de turno' },
]

/** Onde o opencode procura plugin, por sistema. */
export function pastaPluginOpencode() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(base, 'opencode', 'plugin')
}

/**
 * A declaração: tudo que o framework exige de uma máquina.
 *
 * Cada exigência sabe se conferir e (quando dá) como se ligar. `ligar: null`
 * significa passo humano, e a frase diz o que fazer: prometer automático o que
 * não é automático é pior que declarar o passo manual.
 */
export function exigencias() {
  const lista = []

  /* 1. Os hooks do catálogo que já vinham por padrão. */
  for (const h of HOOKS) {
    if (!h.script || h.implementado === false) continue
    lista.push({
      id: `hook:${h.id}`,
      tipo: 'hook',
      titulo: h.label || h.id,
      porque: h.padrao
        ? 'vem ligado por padrão: sem ele a regra não age nesta máquina'
        : 'faz parte do framework e só age quando registrado',
      gravidade: 'desliga',
      hook: h,
    })
  }

  /* 2. Os vizinhos que os hooks importam. */
  for (const v of VIZINHOS) {
    lista.push({ id: `vizinho:${v.arquivo}`, tipo: 'vizinho', titulo: v.arquivo, porque: v.porque, gravidade: 'quebra', vizinho: v })
  }

  /* 3. O encaixe do opencode. Ele usa as três ferramentas, e um protocolo que
        só vale numa delas nasce valendo por um terço do trabalho. */
  lista.push({
    id: 'plugin:opencode',
    tipo: 'plugin',
    titulo: 'o encaixe do opencode',
    porque: 'sem ele o opencode não reporta tarefa nenhuma ao painel, e some do quadro sem erro',
    gravidade: 'desliga',
  })

  /* 3b. O antigravity. Ele usa TRÊS ferramentas, e esta era a única sem
         nenhum ponto de integração escrito, nem mesmo ruim.
         ⚠️ **É exigência de DIAGNÓSTICO, não de protocolo.** Não há como o
         antigravity reportar tarefa hoje: ele não tem gancho de fim de turno
         nem plugin, e prometer o contrário seria inventar. O que dá para saber
         é se ele está instalado e com leitura liberada, que é o mínimo para as
         skills dele funcionarem, medido no CC-450. Declarar o que NÃO dá é
         parte do trabalho: a falta some do radar justamente quando ninguém a
         declara, que foi como os dois hooks do framework ficaram invisíveis. */
  lista.push({
    id: 'antigravity:leitura',
    tipo: 'antigravity',
    titulo: 'o antigravity pode ler arquivo de skill',
    porque: 'sem a permissão de leitura declarada ele recusa ler a skill e responde outra coisa, sem erro visível',
    gravidade: 'desliga',
  })

  /* 4. O que RODA contra o que está no repositório. Aqui foi a queixa dele
        sobre fundação: `git pull` não muda o que roda. */
  lista.push({
    id: 'versao:publicada',
    tipo: 'versao',
    titulo: 'a cópia que roda bate com a do repositório',
    porque: 'o painel e os hooks rodam da cópia instalada; mexer no repositório sem publicar serve código velho',
    gravidade: 'atrasa',
  })

  return lista
}

const existe = (p) => { try { return fs.statSync(p).isFile() } catch { return false } }

/** A cópia instalada, quando existe nesta máquina. */
export function pastaInstalada() {
  if (ehWindows) {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return path.join(base, 'AgentCockpit')
  }
  return path.join(os.homedir(), '.local', 'share', 'agent-cockpit')
}

/**
 * Confere uma exigência contra a máquina real.
 *
 * Devolve sempre `{ ok, detalhe }`: `ok: null` é "não deu para saber", e ele
 * nunca vira `false`. Falha de leitura que se parece com ausência é o defeito
 * que este projeto mais paga, e aqui apareceria como "está tudo desligado".
 */
export function conferirUma(e, ctx = {}) {
  /* `'settings' in ctx` e não `??`: quem passa `null` de propósito está
     dizendo "não deu para ler", e com `??` isso caía na leitura do disco e
     virava "está faltando". Era o defeito que este arquivo existe para não
     ter, escrito dentro dele mesmo. Foi o teste que pegou. */
  const settings = 'settings' in ctx ? ctx.settings : readSettings()

  if (e.tipo === 'hook') {
    if (!settings) return { ok: null, detalhe: `não consegui ler ${arquivoSettings()}` }
    const reg = registrado(e.hook, settings)
    if (reg) return { ok: true, detalhe: `registrado em ${e.hook.evento}` }
    const temScript = Boolean(comandoDe(e.hook))
    return { ok: false, detalhe: temScript ? 'existe no repositório e não está registrado' : 'nem o script existe nesta máquina' }
  }

  if (e.tipo === 'vizinho') {
    const alvo = path.join(casaClaude(), 'hooks', e.vizinho.arquivo)
    const fonte = path.join(RAIZ, e.vizinho.de)
    if (existe(alvo)) return { ok: true, detalhe: 'no lugar' }
    return { ok: false, detalhe: existe(fonte) ? `falta em ${alvo}` : 'falta, e a fonte também não existe neste repositório' }
  }

  if (e.tipo === 'plugin') {
    const alvo = path.join(pastaPluginOpencode(), 'tarefas.js')
    const fonte = path.join(RAIZ, 'hooks', 'opencode', 'tarefas.js')
    if (existe(alvo)) return { ok: true, detalhe: 'instalado' }
    if (!existe(fonte)) return { ok: null, detalhe: 'a fonte não existe neste repositório' }
    return { ok: false, detalhe: `falta em ${alvo}` }
  }

  if (e.tipo === 'antigravity') {
    const cfg = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json')
    if (!existe(cfg)) return { ok: null, detalhe: 'o antigravity não está instalado nesta máquina' }
    let s
    try { s = JSON.parse(fs.readFileSync(cfg, 'utf8')) } catch { return { ok: null, detalhe: 'não consegui ler a configuração dele' } }
    const permitido = (s?.permissions?.allow || []).some((p) => String(p).startsWith('read_file'))
    return permitido
      ? { ok: true, detalhe: 'leitura de arquivo liberada' }
      : { ok: false, detalhe: `falta read_file(*) em permissions.allow, em ${cfg}` }
  }

  if (e.tipo === 'versao') {
    const inst = pastaInstalada()
    if (!fs.existsSync(inst)) return { ok: null, detalhe: 'não há cópia instalada nesta máquina: o que roda é o próprio repositório' }
    /* Compara os módulos por conteúdo, e não a versão do `package.json`: a
       versão só muda quando alguém lembra de subir o número, e o caso real de
       11/09 foi código novo com a MESMA versão dos dois lados. */
    const diferentes = []
    let olhados = 0
    let dir
    try { dir = fs.readdirSync(path.join(RAIZ, 'src')) } catch { return { ok: null, detalhe: 'não consegui listar src/' } }
    for (const f of dir) {
      if (!f.endsWith('.mjs')) continue
      const a = path.join(RAIZ, 'src', f)
      const b = path.join(inst, 'src', f)
      if (!existe(b)) { diferentes.push(f); continue }
      olhados++
      try { if (fs.readFileSync(a, 'utf8') !== fs.readFileSync(b, 'utf8')) diferentes.push(f) } catch { /* segue */ }
    }
    if (!olhados) return { ok: null, detalhe: 'não consegui comparar os arquivos' }
    if (!diferentes.length) return { ok: true, detalhe: `${olhados} módulos iguais` }
    return { ok: false, detalhe: `${diferentes.length} módulo(s) diferentes: ${diferentes.slice(0, 4).join(', ')}${diferentes.length > 4 ? '…' : ''}` }
  }

  return { ok: null, detalhe: 'tipo desconhecido' }
}

/** O retrato inteiro da máquina. */
export function conferir() {
  const settings = readSettings()
  const itens = exigencias().map((e) => ({ ...e, ...conferirUma(e, { settings }) }))
  const faltando = itens.filter((i) => i.ok === false)
  faltando.sort((a, b) => GRAVIDADE[b.gravidade].peso - GRAVIDADE[a.gravidade].peso)
  return {
    maquina: os.hostname(),
    total: itens.length,
    ok: itens.filter((i) => i.ok === true).length,
    faltando,
    naoSei: itens.filter((i) => i.ok === null),
    itens,
    /* A frase de uma linha, que é o que cabe num cartão. */
    frase: faltando.length
      ? `${faltando.length} de ${itens.length} peças não estão ativas nesta máquina`
      : `as ${itens.length} peças do framework estão ativas aqui`,
  }
}

/**
 * Liga o que falta. Só age no que `conferir()` apontou como ausente.
 *
 * `versao` fica de fora de propósito: publicar troca o que roda no painel dele
 * e é decisão dele, não consequência de um comando de conserto.
 */
export function ligar({ dryRun = false, apenas = null } = {}) {
  const r = conferir()
  const alvos = r.faltando.filter((f) => (apenas ? apenas.includes(f.id) : true))
  const feitos = []

  const hooks = alvos.filter((a) => a.tipo === 'hook').map((a) => a.hook)
  if (hooks.length) {
    const out = instalar(hooks, { dryRun })
    /* O `instalar()` devolve a ação no passado ("registrado") mesmo em ensaio,
       e ensaio que diz ter feito é pior que ensaio nenhum: ele lê "registrado",
       acredita, e não roda o comando de verdade. A palavra é corrigida aqui,
       no ponto que sabe se foi ensaio. */
    for (const f of out.feitos || []) {
      const acao = dryRun && f.acao === 'registrado' ? 'registraria' : f.acao
      feitos.push({ id: `hook:${f.id}`, acao })
    }
    if (out.erro) feitos.push({ id: 'hook:*', acao: `falhou: ${out.erro}` })
  }

  for (const a of alvos) {
    if (a.tipo === 'vizinho') {
      const fonte = path.join(RAIZ, a.vizinho.de)
      const alvo = path.join(casaClaude(), 'hooks', a.vizinho.arquivo)
      if (!existe(fonte)) { feitos.push({ id: a.id, acao: 'a fonte não existe neste repositório' }); continue }
      if (!dryRun) {
        fs.mkdirSync(path.dirname(alvo), { recursive: true })
        fs.copyFileSync(fonte, alvo)
      }
      feitos.push({ id: a.id, acao: dryRun ? 'copiaria' : 'copiado' })
    }
    if (a.tipo === 'antigravity') {
      const cfg = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json')
      try {
        const s = JSON.parse(fs.readFileSync(cfg, 'utf8'))
        s.permissions ??= {}
        s.permissions.allow = [...new Set([...(s.permissions.allow || []), 'read_file(*)'])]
        if (!dryRun) {
          /* Cópia antes: é configuração dele, editada à mão, e sem outra fonte.
             Mesma razão do `notes.mjs` e do migrador de backlog. */
          fs.copyFileSync(cfg, cfg + '.bak')
          fs.writeFileSync(cfg, JSON.stringify(s, null, 2), 'utf8')
        }
        feitos.push({ id: a.id, acao: dryRun ? 'liberaria leitura' : 'leitura liberada' })
      } catch (e) { feitos.push({ id: a.id, acao: `falhou: ${e.message.slice(0, 50)}` }) }
    }
    if (a.tipo === 'plugin') {
      const fonte = path.join(RAIZ, 'hooks', 'opencode', 'tarefas.js')
      const alvo = path.join(pastaPluginOpencode(), 'tarefas.js')
      if (!existe(fonte)) { feitos.push({ id: a.id, acao: 'a fonte não existe neste repositório' }); continue }
      if (!dryRun) {
        fs.mkdirSync(path.dirname(alvo), { recursive: true })
        fs.copyFileSync(fonte, alvo)
      }
      feitos.push({ id: a.id, acao: dryRun ? 'copiaria' : 'copiado' })
    }
  }

  return { feitos, sobrou: alvos.filter((a) => a.tipo === 'versao').map((a) => a.id) }
}
