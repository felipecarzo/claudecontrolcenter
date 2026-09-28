/* A pergunta de confiança da pasta, respondida pelo texto e não pela posição.
 *
 * Medido em 24/09 na VPS: o painel apertava Enter às cegas. Na 2.1.231 o
 * cursor começava em "Yes, I trust this folder"; na 2.1.281 a ordem inverteu
 * e o cursor começa em "No, exit". O mesmo Enter passou a fechar a sessão, e o
 * Maurice não abria sem erro nenhum na tela.
 *
 * As duas telas abaixo são as reais, copiadas das duas versões. */
import assert from 'node:assert/strict'
import { passoDaConfianca } from './src/remotecontrol.mjs'

let n = 0
const ok = (m) => { n += 1; console.log(`  ok   ${m}`) }

const ANTIGA = ` Quick safety check: Is this a project you created or one you trust?
 Security guide
 ❯ 1. Yes, I trust this folder
   2. No, exit
 Enter to confirm · Esc to cancel`

const NOVA = ` Quick safety check: Is this a project you created or one you trust?
 Security guide
 ❯ No, exit
   Yes, I trust this folder
 Enter to confirm · Esc to cancel`

const NOVA_DEPOIS_DE_DESCER = NOVA.replace(' ❯ No, exit\n   Yes', '   No, exit\n ❯ Yes')

assert.equal(passoDaConfianca(ANTIGA), 'confirmar')
ok('versão antiga (cursor já no Yes): confirma direto')

assert.equal(passoDaConfianca(NOVA), 'descer')
ok('versão nova (cursor no "No, exit"): NÃO confirma, desce primeiro. Era aqui que o Enter fechava a sessão')

assert.equal(passoDaConfianca(NOVA_DEPOIS_DE_DESCER), 'confirmar')
ok('depois de descer, o cursor no Yes: confirma')

assert.equal(passoDaConfianca(' Quick safety check\n ❯ Sim, confio\n   Não'), 'sem-yes')
ok('texto que mudou e não tem "Yes": recusa em voz alta, não aperta nada')

assert.equal(passoDaConfianca(undefined), 'sem-yes')
ok('tela vazia não vira confirmação')

console.log(`\n  ${n} verificação(ões) da pergunta de confiança ok\n`)
