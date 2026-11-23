#!/usr/bin/env node
/**
 * CC-1120, desenho D1: o ouvido. Registrado no Stop e no SessionStart com `asyncRewake: true`, roda ao fundo,
 * espera a caixa desta sessão e, quando a mensagem dele chega pelo cockpit, escreve no stderr e sai com 2. O Claude
 * Code acorda a sessão ociosa com esse texto (provado em 23/11 numa sessão de terminal). O Stop arma de novo a cada
 * resposta.
 *
 * Regras:
 *   - uma trava por sessão: ouvido vivo recente da mesma sessão, com pid vivo, faz este sair calado com 0;
 *   - espera até 55 min por armada (o `timeout` do registro precisa ser maior), e sai 0 limpando o marcador;
 *   - sai 0 se a sessão acabou (o processo pai morreu);
 *   - caixa que não dá para apagar não é entregue: entregar e deixar lá acordaria a sessão em laço;
 *   - falha aberta: qualquer erro sai 0, calado.
 *
 * O caminho da caixa e a limpeza do texto moram em `src/ouvido.mjs`, que o painel também usa.
 * Ajustes de teste: CC_OUVIDO_TETO_MS (espera total) e CC_OUVIDO_PASSO_MS (intervalo de olhar a caixa).
 */
import fs from 'node:fs'
import path from 'node:path'

const sair = (c = 0) => process.exit(c)

let entrada = null
try { entrada = JSON.parse(fs.readFileSync(0, 'utf8') || 'null') } catch { sair() }

let O
try { O = await import('../src/ouvido.mjs') } catch { sair() }
const { limparTextoRemoto } = await import('../src/federacao.mjs').catch(() => ({}))
if (!limparTextoRemoto) sair()

const sessao = String(entrada?.session_id || '')
if (!O.ID_SESSAO.test(sessao)) sair()

const dir = O.dirCaixas()
const vivo = path.join(dir, `${sessao}.vivo`)
const caixa = path.join(dir, `${sessao}.txt`)
const TETO = Number(process.env.CC_OUVIDO_TETO_MS) || 55 * 60_000
const PASSO = Number(process.env.CC_OUVIDO_PASSO_MS) || 1000
const RENOVA = 20_000
const pai = process.ppid

try { fs.mkdirSync(dir, { recursive: true }) } catch { sair() }

const outro = O.lerVivo(sessao, dir)
if (outro && outro.pid !== process.pid && O.marcadorValido(outro)) sair()

const marcar = () => {
  try {
    fs.writeFileSync(vivo, JSON.stringify({
      pid: process.pid, sessao, hora: Date.now(),
      cwd: entrada?.cwd || null, transcrito: entrada?.transcript_path || null, evento: entrada?.hook_event_name || null,
    }), 'utf8')
  } catch { /* sem marcador o painel só não oferece o campo */ }
}
/** Só apaga o marcador se ainda é deste processo. */
const limpar = () => { try { if (O.lerVivo(sessao, dir)?.pid === process.pid) fs.unlinkSync(vivo) } catch { /* já foi */ } }

marcar()
const fim = Date.now() + TETO
let renovadoEm = Date.now()
while (Date.now() < fim) {
  if (fs.existsSync(caixa)) {
    let texto = ''
    try { texto = fs.readFileSync(caixa, 'utf8'); fs.unlinkSync(caixa) } catch { limpar(); sair() }
    /* Cada linha é uma mensagem (a caixa junta as que chegaram antes de ser lida). */
    const linhas = texto.split(/\r?\n/).map((l) => limparTextoRemoto(l)).filter(Boolean)
    if (linhas.length) {
      limpar()
      process.stderr.write(`Mensagem dele pelo cockpit: ${linhas.join(' / ')}`)
      sair(2)
    }
  }
  if (!O.pidVivo(pai)) { limpar(); sair() }
  if (Date.now() - renovadoEm >= RENOVA) { marcar(); renovadoEm = Date.now() }
  await new Promise((r) => setTimeout(r, PASSO))
}
limpar()
sair()
