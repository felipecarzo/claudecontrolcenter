// CC-1060, M1: o terminal do painel no PC (WezTerm) abre, digita, lê e fecha.
// Roda de verdade, sem janela na tela. Fora do Windows ou sem WezTerm, pula.
import assert from 'node:assert/strict'
import os from 'node:os'
import * as P from './src/platform.mjs'

if (!P.ehWindows || !P.wezterm()) {
  console.log('test-terminal-pc: pulado (só roda no Windows com o WezTerm instalado)')
  process.exit(0)
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
async function telaAte(painel, cond, tetoMs = 6000) {
  let tela = ''
  for (let g = 0; g < tetoMs; g += 250) {
    tela = (await P.lerTerminal(painel)) || ''
    if (cond(tela)) return tela
    await esperar(250)
  }
  return tela
}

let ok = 0
const passou = (nome) => { ok += 1; console.log(`  ok  ${nome}`) }

const g = await P.garantirTerminal()
assert.equal(g.ok, true, g.erro)
passou(`servidor de pé (${g.subiu ? 'subiu agora' : 'já estava'})`)

const a = await P.abrirTerminalPainel({ cwd: os.tmpdir(), comando: ['cmd.exe'] })
assert.equal(a.ok, true, a.erro)
assert.match(a.painel, /^\d+$/)
passou(`abriu o terminal ${a.painel}`)

try {
  assert.ok((await P.listarTerminais()).some((t) => t.painel === a.painel), 'o terminal novo não está na lista')
  passou('o terminal aparece na lista')

  const marca = `marca-${Date.now()}`
  assert.equal((await P.escreverTerminal(a.painel, `echo ${marca}`)).ok, true)
  assert.equal((await P.apertarTerminal(a.painel, 'Enter')).ok, true)
  /* O eco aparece duas vezes: a linha digitada e a resposta do cmd. */
  const tela = await telaAte(a.painel, (t) => t.split(marca).length >= 3)
  assert.ok(tela.split(marca).length >= 3, `o eco não voltou na tela:\n${tela.slice(-400)}`)
  passou('digitou e leu a resposta na tela')

  assert.equal((await P.apertarTerminal(a.painel, 'Escape')).ok, true)
  passou('a tecla Esc é aceita')
  assert.equal((await P.apertarTerminal(a.painel, 'TeclaInventada')).ok, false)
  passou('tecla desconhecida é recusada')

  const comCor = await P.lerTerminal(a.painel, { cor: true })
  assert.equal(typeof comCor, 'string')
  passou('lê a tela com cor')

  /* O terminal não herda a identidade da sessão do Claude que ligou o painel:
     herdando, o Claude lá dentro não grava a conversa (medido em 12/10). */
  assert.deepEqual(Object.keys(P.ambienteDoTerminal({ PATH: 'x', CLAUDECODE: '1', CLAUDE_CODE_CHILD_SESSION: '1', CLAUDE_PID: '9', CLAUDE_CONFIG_DIR: 'c' })), ['PATH', 'CLAUDE_CONFIG_DIR'])
  await P.escreverTerminal(a.painel, 'if defined CLAUDE_CODE_CHILD_SESSION (echo herdou-1060) else (echo limpo-1060)')
  await P.apertarTerminal(a.painel, 'Enter')
  const env = await telaAte(a.painel, (t) => /^(herdou|limpo)-1060/m.test(t))
  assert.match(env, /^limpo-1060/m, `o terminal herdou a sessão do Claude:\n${env.slice(-300)}`)
  passou('o terminal nasce sem as variáveis da sessão do Claude que chamou')
} finally {
  await P.fecharTerminal(a.painel)
}

/* M2: o mesmo envio de mensagem da VPS, chegando num terminal do WezTerm.
   O cmd faz o papel do Claude Code: prompt `❯`, que é o que `telaNoCampo`
   procura. A "conversa gravada" é a própria tela, relida a cada espera. */
const D = await import('./src/decisao.mjs')
const b = await P.abrirTerminalPainel({ cwd: os.tmpdir(), comando: ['cmd.exe', '/k', 'chcp 65001>nul & prompt ❯$S'] })
assert.equal(b.ok, true, b.erro)
try {
  const sessao = `${D.PREFIXO_WEZ}${b.painel}`
  let tela = await telaAte(b.painel, (t) => t.includes('❯'))
  assert.ok(tela.includes('❯'), `o prompt ❯ não apareceu:\n${tela.slice(-300)}`)
  /* A conversa gravada só cresce; a tela tem tamanho fixo. Por isso o registro acumula cada leitura. */
  let gravado = ''
  const deps = {
    sessoes: async () => ({ teste: { sessao, conversa: 'conversa-teste' } }),
    lerTranscrito: () => gravado,
    capturar: (s, o) => P.lerTerminal(D.painelWez(s), o),
    apertar: (s, t) => P.apertarTerminal(D.painelWez(s), t),
    escrever: (s, t) => P.escreverTerminal(D.painelWez(s), t),
    esperar: async (ms) => { await esperar(ms); tela = (await P.lerTerminal(b.painel)) || tela; gravado += tela },
  }
  const r = await D.enviarMensagem({ conversa: 'conversa-teste', texto: 'echo mensagem-do-cockpit' }, deps)
  assert.equal(r.ok, true, r.erro)
  assert.ok(tela.includes('mensagem-do-cockpit'), 'a mensagem não chegou na tela')
  passou('a mensagem do Cockpit chega no terminal do PC pelo mesmo caminho da VPS')
} finally {
  await P.fecharTerminal(b.painel)
  await esperar(500)
  const sobrou = await P.listarTerminais()
  assert.ok(!sobrou.some((t) => t.painel === a.painel || t.painel === b.painel), 'o terminal não fechou')
  passou('fechou o terminal')
  if (g.subiu) { await P.pararServidorTerminal(); passou('desligou o servidor que o teste subiu') }
}

/* M3: o "ligar projeto" do painel, no PC, nasce num terminal do WezTerm, aparece
   no estado com o nome wez:<n> e fecha pelo desligar. Casa temporária, para o
   vínculo não ir parar no arquivo de verdade; um cmd no lugar do Claude. */
{
  const fs = await import('node:fs'); const path = await import('node:path')
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-casa-'))
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-proj-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  const g3 = await P.garantirTerminal()
  try {
    const R = await import('./src/remotecontrol.mjs')
    const r = await R.ligar('proj-teste', pasta, { binario: 'cmd.exe', remoto: false, esperarMs: 800 })
    assert.equal(r.ok, true, r.erro)
    assert.match(r.sessao, /^wez:\d+$/)
    passou(`ligar abre a sessão no terminal do painel (${r.sessao})`)
    const e = await R.estado()
    assert.equal(e['proj-teste']?.sessao, r.sessao, `o estado não achou a sessão: ${JSON.stringify(e)}`)
    passou('o estado acha a sessão pelo vínculo gravado')

    /* A conversa do terminal vem do registro de sessões abertas do Claude, e não
       do palpite por pasta (que apontava a conversa de ontem, medido em 18/10).
       Registro de mentira, na casa temporária: um processo vivo (este mesmo) e
       uma sessão velha de antes do `ligar`, que não pode ser escolhida. */
    const reg = path.join(casa, 'sessions'); fs.mkdirSync(reg, { recursive: true })
    const desde = e['proj-teste'].desde
    const sessaoReg = (pid, id, em) => fs.writeFileSync(path.join(reg, `${pid}.json`), JSON.stringify({ pid, sessionId: id, cwd: pasta, startedAt: em }))
    sessaoReg(process.pid, 'conversa-velha-0000', desde - 3_600_000)
    sessaoReg(4194301, 'conversa-morta-0000', desde + 100) // pid que não existe: ignorada
    sessaoReg(process.ppid, 'conversa-nova-1111', desde + 1000)
    assert.equal((await R.estado())['proj-teste'].conversa, 'conversa-nova-1111')
    passou('a conversa do terminal vem do registro: a viva e posterior ao ligar, nunca a velha')
    fs.rmSync(reg, { recursive: true, force: true })
    const d = await R.desligar('proj-teste')
    assert.equal(d.ok, true)
    await esperar(500)
    assert.equal((await R.estado())['proj-teste'], undefined, 'a sessão continuou no estado depois de desligar')
    assert.ok(!(await P.listarTerminais()).some((t) => `wez:${t.painel}` === r.sessao), 'o terminal continuou aberto')
    passou('desligar fecha o terminal e tira a sessão do estado')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME; else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true }); fs.rmSync(pasta, { recursive: true, force: true })
    if (g3.subiu) await P.pararServidorTerminal()
  }
}

console.log(`test-terminal-pc: ${ok} verificações, 0 falhas`)
