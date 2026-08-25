/**
 * A caixa de ponto do git multi-agente.
 *
 * Ideia dele, em 25/08: *"cada cliente quando for criado bate ponto e quando
 * sair faz um commit interno, e no final o último a sair apaga a luz, confere o
 * git e dá o push."*
 *
 * Nasceu de uma dor medida: várias sessões trabalham na MESMA árvore, e quem
 * commita varre tudo e leva trabalho de sessão que ainda está mexendo. Aconteceu
 * ao vivo nesta máquina: uma sessão commitou e levou junto o arquivo que outra
 * ainda editava.
 *
 * ## A decisão que molda tudo (dele, 25/08)
 *
 * **Commit ao sair é sozinho, local, e SEM push.** A regra dele de nunca
 * commitar sem pedir vale para o que SAI da máquina, que é o push. O commit
 * local não sai, não some nada, e é reversível. O push fica só com a última
 * sessão a sair, e só depois de o teste passar.
 *
 * ## Por que commita TUDO, e não só "os meus arquivos"
 *
 * A árvore é uma só, e o git não sabe qual sessão mexeu em qual arquivo. Separar
 * exigiria depender do histórico interno do Claude Code (nome de arquivo é hash,
 * formato não documentado) ou das marcas de rota, e as duas quebram calado.
 * Commitar tudo LOCAL é seguro: nada vaza, e se outra sessão ainda está mexendo,
 * ela não é a última, então nada é empurrado, e as edições seguintes dela viram
 * commits novos por cima. O único lugar onde meia-obra faria mal é o push, e o
 * push só acontece com o teste verde.
 *
 * ## Zero rede na leitura
 *
 * `situacao()` só lê disco local (status do git e sessões vivas). A única função
 * que fala com a internet é `apagarLuz()`, e só quando é a última a sair, nunca
 * num tique de tela.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { readSessoes } from './sessoes.mjs'
import { estadoGit } from './git.mjs'

/** git que devolve `{ok, saida}` e nunca lança: comando ausente ou repo sem
 *  nada não podem derrubar quem chama. O `push` precisa de mais tempo. */
function git(raiz, args, { timeout = 8000 } = {}) {
  try {
    const saida = execFileSync('git', ['-C', raiz, ...args], {
      encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, saida: saida.trim() }
  } catch (e) {
    return { ok: false, saida: (e?.stdout || '').toString().trim(), erro: (e?.stderr || e?.message || '').toString().trim() }
  }
}

/** A raiz do repositório de uma pasta, ou `null`. `--show-toplevel` sobe sozinho
 *  até o `.git`, e cobre o worktree (o `--front` deste projeto). */
export function raizGit(dir) {
  if (!dir || !fs.existsSync(dir)) return null
  const r = git(dir, ['rev-parse', '--show-toplevel'], { timeout: 4000 })
  return r.ok && r.saida ? r.saida : null
}

/**
 * Quem está de ponto batido neste repositório agora.
 *
 * "De ponto batido" é sessão viva e não ociosa: quem parou há muito já saiu de
 * fato, e segurar a porta por ela deixaria o push preso para sempre. A presença
 * sai da lista de sessões que o painel já mantém, então bater ponto é implícito
 * (a sessão existe = está de ponto), sem escrita nova em lugar nenhum.
 */
export function pontos(raiz, now = Date.now()) {
  const alvo = raizGit(raiz)
  if (!alvo) return []
  return readSessoes(now)
    .filter((s) => s.state !== 'idle')
    .filter((s) => raizGit(s.cwd) === alvo)
    .map((s) => ({ sessionId: s.sessionId, curto: (s.sessionId || '').slice(0, 8), estado: s.state, remoto: Boolean(s.remoto) }))
}

/**
 * Sou a última a sair? Verdadeiro quando nenhuma OUTRA sessão viva segura a
 * porta deste repositório. O `sessionId` é o de quem está saindo, para não se
 * contar a si mesmo.
 */
export function souUltimo(raiz, sessionId, now = Date.now()) {
  const curto = String(sessionId || '').slice(0, 8)
  return !pontos(raiz, now).some((p) => p.sessionId !== sessionId && p.curto !== curto)
}

/** O retrato da caixa para este repositório, sem tocar em nada. */
export function situacao(raiz, sessionId = null, now = Date.now()) {
  const alvo = raizGit(raiz)
  if (!alvo) return { repo: null, motivo: 'esta pasta não é um repositório git' }
  const g = estadoGit(alvo)
  const dentro = pontos(alvo, now)
  return {
    repo: alvo,
    git: g, // { ramo, sujo, atras, naoEmpurrados, semUpstream, emDia }
    pontos: dentro,
    quantos: dentro.length,
    ultimo: sessionId ? souUltimo(alvo, sessionId, now) : dentro.length <= 1,
  }
}

/**
 * O commit interno de quem está saindo: local, sem push.
 *
 * Não faz nada quando não há o que salvar (árvore limpa), e diz isso em vez de
 * criar commit vazio. Marca a sessão na mensagem, para o histórico dizer de
 * quem foi o ponto.
 */
export function commitAoSair(raiz, { sessionId, quando } = {}) {
  const alvo = raizGit(raiz)
  if (!alvo) return { commitou: false, motivo: 'não é repositório git' }

  const sujo = (git(alvo, ['status', '--porcelain']).saida || '').split(/\r?\n/).filter(Boolean)
  if (!sujo.length) return { commitou: false, motivo: 'nada para salvar: a árvore está limpa' }

  const add = git(alvo, ['add', '-A'])
  if (!add.ok) return { commitou: false, motivo: `git add falhou: ${add.erro}` }

  const curto = String(sessionId || 'sessao').slice(0, 8)
  const msg = `wip(ponto ${curto}): commit automático ao sair da caixa de ponto`
  // `-c` de identidade evita "empty ident" em ambiente sem git config de usuário.
  const commit = git(alvo, [
    '-c', 'user.name=agent-cockpit', '-c', 'user.email=cockpit@local',
    'commit', '-m', msg,
  ])
  if (!commit.ok) return { commitou: false, motivo: `git commit falhou: ${commit.erro || commit.saida}` }

  const hash = (git(alvo, ['rev-parse', '--short', 'HEAD']).saida || '').trim()
  return { commitou: true, hash, arquivos: sujo.length, quando: quando || null }
}

/** Roda `npm test` sem shell e devolve só se passou e um resumo curto. */
function rodarNpmTest(raiz) {
  try {
    const saida = execFileSync('npm', ['test', '--silent'], {
      cwd: raiz, encoding: 'utf8', timeout: 300_000, stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { passou: true, resumo: saida.trim().split(/\r?\n/).slice(-3).join(' | ') }
  } catch (e) {
    const txt = ((e?.stdout || '') + (e?.stderr || '')).toString().trim()
    return { passou: false, resumo: txt.split(/\r?\n/).slice(-3).join(' | ') }
  }
}

/**
 * A última a sair apaga a luz: confere o git, roda o teste se houver, e empurra.
 *
 * Só empurra com o teste VERDE, porque o push é o que sai da máquina e alcança a
 * outra: publicar defeito é pior que não publicar. Repositório sem script de
 * teste pula essa trava, mas o pulo aparece no relatório em vez de sumir.
 */
export function apagarLuz(raiz, { rodarTeste = true } = {}) {
  const alvo = raizGit(raiz)
  if (!alvo) return { empurrou: false, motivo: 'não é repositório git' }

  const g = estadoGit(alvo)
  if (g?.semUpstream) return { empurrou: false, motivo: `${g.ramo || 'esta branch'} nunca foi empurrada: defina o upstream antes` }
  if (!g?.naoEmpurrados) return { empurrou: false, motivo: 'nada para empurrar: o remoto já tem tudo', jaEmDia: true }

  let teste = { rodou: false, passou: null }
  if (rodarTeste) {
    let temTeste = false
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(alvo, 'package.json'), 'utf8'))
      temTeste = Boolean(pkg?.scripts?.test)
    } catch { temTeste = false }
    if (temTeste) {
      const npm = rodarNpmTest(alvo)
      teste = { rodou: true, passou: npm.passou, saida: npm.resumo }
      if (!npm.passou) {
        return { empurrou: false, motivo: 'o teste não passou: não empurro defeito', teste }
      }
    }
  }

  const push = git(alvo, ['push'], { timeout: 30_000 })
  if (!push.ok) return { empurrou: false, motivo: `git push falhou: ${push.erro || push.saida}`, teste }
  return { empurrou: true, commits: g.naoEmpurrados, ramo: g.ramo, teste }
}

/**
 * O fluxo inteiro de uma sessão saindo: commita o próprio ponto (local), e se
 * for a última a sair, apaga a luz (teste + push). É o que um gancho de fim de
 * sessão chamaria.
 */
export function sair(raiz, { sessionId, now = Date.now(), rodarTeste = true } = {}) {
  const alvo = raizGit(raiz)
  if (!alvo) return { ok: false, motivo: 'não é repositório git' }

  const commit = commitAoSair(alvo, { sessionId, quando: now })
  const ultimo = souUltimo(alvo, sessionId, now)
  const luz = ultimo ? apagarLuz(alvo, { rodarTeste }) : null
  return { ok: true, repo: alvo, commit, ultimo, luz }
}
