/**
 * As quatro ações de uma conversa remota, de ponta a ponta, com Claude Code de
 * verdade subindo num porta-terminal de verdade.
 *
 * FORA do `npm test`, e de propósito: sobe uma conversa real e manda uma
 * mensagem, então gasta token e leva alguns minutos. O gate diário não pode
 * depender disso. Rodar à mão:
 *
 *     npm run test:remoto
 *
 * Por que ele existe: em 24/08 uma conversa dele em pleno trabalho foi morta
 * porque a única ação que o painel oferecia era matar, e porque eu li a hora de
 * criação da sessão como se fosse a da última atividade. O que este arquivo
 * guarda é justamente o que impede a repetição: abrir sem expor acesso,
 * conectar e soltar o celular sem matar nada, e encerrar deixando caminho de
 * volta que reabre a MESMA conversa, com o histórico.
 *
 * Ele nunca encosta em sessão de verdade: nome próprio (`ZZ-prova-volta`),
 * pasta temporária própria, e limpa o que criou no fim.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  ligar, conectar, desconectar, desligar, reabrir, estado, lerVinculos,
} from './src/remotecontrol.mjs'

if (process.platform === 'win32') {
  console.log('pulado: este teste depende de tmux, que não existe no Windows')
  process.exit(0)
}
try { execFileSync('tmux', ['-V'], { stdio: 'ignore' }) } catch {
  console.log('pulado: tmux não está instalado nesta máquina')
  process.exit(0)
}

const PROJETO = 'ZZ-prova-volta'
const SESSAO = `cc-remote-${PROJETO}`
const CWD = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-prova-remoto-'))

let falhas = 0
const ok = (cond, msg) => { if (!cond) falhas++; console.log(`${cond ? 'ok  ' : 'FALHA'}  ${msg}`) }
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const tmux = (...args) => { try { return execFileSync('tmux', args, { encoding: 'utf8' }) } catch { return '' } }

try { tmux('kill-session', '-t', SESSAO) } catch { /* não havia nenhuma */ }

console.log('1) abrir SEM acesso remoto')
const abriu = await ligar(PROJETO, CWD, { remoto: false, esperarMs: 9000 })
ok(abriu.ok, `subiu: ${abriu.ok ? abriu.sessao : abriu.erro}`)
ok(abriu.remoto === false, 'nasceu sem acesso remoto')

/* A conversa só ganha arquivo em disco depois da primeira mensagem. Sem isto o
   teste mediria o caso degenerado, em que não há histórico nenhum para voltar. */
tmux('send-keys', '-t', SESSAO, 'responda apenas: ok')
await dorme(1500)
tmux('send-keys', '-t', SESSAO, 'Enter')
await dorme(25000)

const vivas = await estado()
const aConversa = (vivas[PROJETO] || {}).conversa
ok(Boolean(aConversa), `a lista sabe qual conversa é: ${aConversa || 'NÃO SABE'}`)
ok(Boolean((vivas[PROJETO] || {}).ativa), 'a lista sabe a hora da última fala, não só a de criação')

console.log('\n2) conectar o celular numa conversa que nasceu sem ele')
const c1 = await conectar(PROJETO)
ok(c1.ok && /claude\.ai\/code\/session_/.test(c1.url || ''), `endereço: ${c1.ok ? c1.url : c1.erro}`)

console.log('\n3) soltar o celular: a conversa tem que continuar viva')
const solto = await desconectar(PROJETO)
ok(solto.ok && solto.viva, `soltou e seguiu viva: ${solto.ok ? solto.viva : solto.erro}`)

/* Medido em 24/08, em três ciclos: soltar de verdade faz a religada devolver
   endereço NOVO, e ele só se repete quando a desconexão não aconteceu. Por isso
   a verificação é "existe endereço", nunca "é o mesmo endereço". */
console.log('\n4) religar: tem que devolver um endereço válido')
const c2 = await conectar(PROJETO)
ok(c2.ok && /claude\.ai\/code\/session_/.test(c2.url || ''), `endereço de volta: ${c2.ok ? c2.url : c2.erro}`)

console.log('\n5) encerrar: tem que guardar o caminho de volta')
const fim = await desligar(PROJETO)
ok(fim.ok && Boolean(fim.volta?.conversa), `guardou qual conversa era: ${fim.volta?.conversa || 'NADA'}`)
ok((await estado())[PROJETO] === undefined, 'saiu da lista de vivas')

console.log('\n6) reabrir de onde parou')
const volta = await reabrir(PROJETO, { remoto: false })
ok(volta.ok, `reabriu: ${volta.ok ? volta.sessao : volta.erro}`)
ok(volta.retomada === aConversa, `retomou a MESMA conversa (${volta.retomada || '?'})`)
await dorme(12000)
ok(/responda apenas: ok/i.test(tmux('capture-pane', '-t', SESSAO, '-p', '-S', '-120')),
  'a conversa voltou COM o histórico dela')

/* Limpeza. O vínculo do projeto de teste sai do arquivo de verdade: teste que
   deixa lixo em dado dele é defeito, mesmo sendo lixo pequeno. */
await desligar(PROJETO)
const todos = lerVinculos()
delete todos[PROJETO]
for (const p of [path.join(os.homedir(), '.claude', 'control-center-remoto.json'),
  path.join(os.homedir(), '.local', 'share', 'agent-cockpit', 'control-center-remoto.json')]) {
  try { if (fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(todos, null, 2)) } catch { /* sem permissão, segue */ }
}
try { fs.rmSync(CWD, { recursive: true, force: true }) } catch { /* já foi */ }

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
process.exit(falhas ? 1 : 0)
