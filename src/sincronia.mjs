/**
 * CC-269: sincronizar as máquinas sem abrir terminal.
 *
 * Pedido dele em 21/08: *"esse protocolo de git, sempre ter que ficar dando git,
 * pode ser tão cansativo (…) eu nunca vou ter interesse de ter um projeto na VPS
 * ou no PC desatualizado"*.
 *
 * Ele escolheu **botão**, entre três caminhos apresentados com o custo de cada
 * um. Commit continua sendo dele.
 *
 * ## O que este módulo faz
 *
 * Lê o estado de cada projeto e executa duas ações: puxar e enviar. **Não
 * commita.** A única escrita no repositório é a que o git faz ao trazer o que a
 * outra máquina mandou.
 *
 * ## As duas condições, e o que cada uma protege
 *
 * 1. **arquivo solto trava o puxar**, e a resposta lista quais são. Trabalho não
 *    commitado é a única coisa aqui que não existe em outro lugar.
 * 2. **o gate roda antes de enviar**, onde o projeto tem `npm test`. O que sai
 *    daqui chega na outra máquina e passa a ser o que ela executa.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const rodar = promisify(execFile)

/** Nunca lança: git que falha é resposta, não acidente. */
async function git(dir, args, { timeout = 60_000 } = {}) {
  try {
    const { stdout, stderr } = await rodar('git', args, { cwd: dir, timeout, encoding: 'utf8' })
    return { ok: true, saida: (stdout || '').trim(), erro: (stderr || '').trim() }
  } catch (e) {
    return { ok: false, saida: (e.stdout || '').trim(), erro: (e.stderr || e.message || '').trim() }
  }
}

export const ehRepo = (dir) => {
  try { return fs.existsSync(path.join(dir, '.git')) } catch { return false }
}

/**
 * O estado de um projeto, do jeito que a tela precisa para ele decidir.
 *
 * `aEnviar` e `aReceber` saem de `rev-list` contra o par remoto, e **exigem um
 * `fetch` recente para valerem**: sem ele, o número conta a última vez que
 * alguém olhou. Por isso `buscar` existe e a tela o usa sob clique, mantendo a
 * rede fora do tique de 2 segundos.
 */
export async function estado(dir, { buscar = false } = {}) {
  if (!ehRepo(dir)) return { existe: false, dir }
  if (buscar) await git(dir, ['fetch', '--quiet'], { timeout: 45_000 })

  const branch = (await git(dir, ['branch', '--show-current'])).saida
  const sujoBruto = (await git(dir, ['status', '--short'])).saida
  const soltos = sujoBruto ? sujoBruto.split(/\r?\n/).filter(Boolean) : []

  const up = await git(dir, ['rev-parse', '--abbrev-ref', '@{u}'])
  const temPar = up.ok && Boolean(up.saida)
  const aEnviar = temPar ? Number((await git(dir, ['rev-list', '--count', '@{u}..HEAD'])).saida) || 0 : null
  const aReceber = temPar ? Number((await git(dir, ['rev-list', '--count', 'HEAD..@{u}'])).saida) || 0 : null

  return {
    existe: true,
    dir,
    projeto: path.basename(dir),
    branch: branch || null,
    /* Sem par remoto, a branch nunca foi enviada. Este caso já enganou hoje:
       `git push` sozinho falha pedindo `--set-upstream`, e a mensagem não é
       óbvia para quem está lendo no celular. */
    temPar,
    aEnviar,
    aReceber,
    soltos: soltos.length,
    quaisSoltos: soltos.slice(0, 12).map((l) => l.replace(/^..\s*/, '')),
    ultimo: (await git(dir, ['log', '--oneline', '-1'])).saida || null,
  }
}

/** O estado de vários, de uma vez. Em paralelo: são chamadas de disco curtas,
 *  e uma por vez em 17 projetos deixaria a tela esperando à toa. */
export async function estadoDeVarios(dirs = [], opcoes = {}) {
  return Promise.all(dirs.filter(ehRepo).map((d) => estado(d, opcoes)))
}

/**
 * Traz o que a outra máquina enviou.
 *
 * Com arquivo solto, responde quais são e não segue: trabalho não commitado é a
 * única coisa aqui que não existe em outro lugar.
 *
 * `--ff-only` de propósito: assim a operação ou avança em linha reta, ou para e
 * conta. Mesclagem automática no meio de um clique é o que produz conflito sem
 * ninguém por perto para resolver.
 */
export async function puxar(dir) {
  const e = await estado(dir)
  if (!e.existe) return { ok: false, erro: 'não é um repositório' }
  if (e.soltos) {
    return {
      ok: false,
      erro: `${e.soltos} arquivo(s) sem salvar aqui, e eles não existem em outro lugar.`,
      quaisSoltos: e.quaisSoltos,
    }
  }
  if (!e.temPar) return { ok: false, erro: `a branch \`${e.branch}\` nunca foi enviada, então não há o que puxar` }

  await git(dir, ['fetch', '--quiet'], { timeout: 45_000 })
  const r = await git(dir, ['merge', '--ff-only', '@{u}'], { timeout: 60_000 })
  if (!r.ok) {
    return {
      ok: false,
      erro: 'as duas máquinas andaram por caminhos diferentes, então isto precisa de você',
      detalhe: r.erro.split(/\r?\n/)[0] || '',
    }
  }
  const depois = await estado(dir)
  return { ok: true, mensagem: r.saida || 'já estava em dia', ultimo: depois.ultimo, aReceber: depois.aReceber }
}

/**
 * Manda o que já está commitado aqui.
 *
 * Roda o gate antes, onde o projeto tem `npm test`: o que sai daqui vira o que a
 * outra máquina executa. Quem chama pode pular com `semGate`, e a resposta
 * registra que pulou, para isso nunca virar o padrão calado.
 */
export async function enviar(dir, { semGate = false } = {}) {
  const e = await estado(dir)
  if (!e.existe) return { ok: false, erro: 'não é um repositório' }
  if (!e.aEnviar && e.temPar) return { ok: true, mensagem: 'nada novo para enviar', nada: true }

  let gate = null
  const temTeste = (() => {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
      return Boolean(p?.scripts?.test)
    } catch { return false }
  })()

  if (temTeste && !semGate) {
    const r = await rodar('npm', ['test'], { cwd: dir, timeout: 300_000, encoding: 'utf8' })
      .then(() => ({ ok: true }))
      .catch((err) => ({ ok: false, saida: String(err.stdout || err.message || '').split(/\r?\n/).slice(-6).join('\n') }))
    gate = r.ok ? 'passou' : 'falhou'
    if (!r.ok) {
      return { ok: false, gate, erro: 'o teste do projeto falhou, e nada foi enviado', detalhe: r.saida }
    }
  } else {
    gate = temTeste ? 'pulado' : 'este projeto não tem teste'
  }

  /* `-u` quando não há par: `push` sozinho falha pedindo `--set-upstream`, e
     aconteceu hoje com este mesmo projeto. */
  const args = e.temPar ? ['push'] : ['push', '-u', 'origin', e.branch]
  const r = await git(dir, args, { timeout: 120_000 })
  if (!r.ok) return { ok: false, gate, erro: 'o envio falhou', detalhe: (r.erro || '').split(/\r?\n/).slice(-3).join(' ') }
  return { ok: true, gate, mensagem: (r.erro || r.saida || 'enviado').split(/\r?\n/).slice(-1)[0] }
}

/** Os dois, na ordem que importa: receber antes de mandar. */
export async function sincronizar(dir, opcoes = {}) {
  const p = await puxar(dir)
  /* Parando aqui quando o puxar não passou, as duas máquinas continuam com a
     mesma história. Enviar por cima daria a uma delas um lado só. */
  if (!p.ok) return { ok: false, etapa: 'puxar', ...p }
  const e = await enviar(dir, opcoes)
  return { ok: e.ok, etapa: e.ok ? 'pronto' : 'enviar', puxou: p, enviou: e }
}
