/* CC-546: a sessão remota que nasce deslogada tem que dizer isso.
 *
 * Medido em 21/09 na VPS: o login do Claude Code de lá venceu, e toda sessão
 * subia com "Not logged in · Run /login" no rodapé. O painel dizia "ligado" e
 * "conectar celular" devolvia "não achei o endereço", sem a causa.
 *
 * Só a parte pura tem prova aqui, de propósito: ler a tela e dizer o motivo
 * não depende de tmux, então roda no Windows também. O caminho com tmux de
 * verdade continua em `test-remoto.mjs`, que pula fora do Linux. */
import assert from 'node:assert/strict'
import { motivoDaTela } from './src/remotecontrol.mjs'

let n = 0
const ok = (msg) => { n++; console.log(`  ok   ${msg}`) }

// A tela real da VPS em 21/09, como o tmux a devolve.
const telaDeslogada = [
  ' ▐▛███▜▌   Claude Code v2.1.231',
  '▝▜█████▛▘  Opus 5 (1M context) with high effort · API Usage Billing',
  '  ▘▘ ▝▝    ~/projetos/VPS_carzo',
  '❯ ',
  '  ⏸ manual mode on · ← for agents',
  '                                                    Not logged in · Run /login',
  '   ✘ Auto-update failed: no write permission to npm prefix · Run claude doctor',
].join('\n')
assert.equal(motivoDaTela(telaDeslogada), 'deslogada')
ok('a tela real da VPS deslogada é reconhecida')

assert.equal(motivoDaTela('not LOGGED in'), 'deslogada')
ok('sem depender de maiúscula')

const telaSa = [
  ' ▐▛███▜▌   Claude Code v2.1.278',
  '❯ ',
  '  ⏸ manual mode on · ← for agents            Remote Control: https://claude.ai/code/session_abc',
].join('\n')
assert.equal(motivoDaTela(telaSa), null)
ok('tela logada, com endereço, não acusa nada')

assert.equal(motivoDaTela(''), null)
assert.equal(motivoDaTela(null), null)
assert.equal(motivoDaTela(undefined), null)
ok('tela vazia ou ausente não acusa nada: afirmar sobre o que não se leu é o defeito que este painel mais paga')

console.log(`\n  ${n} verificação(ões) da sessão deslogada (CC-546) ok\n`)
