#!/usr/bin/env node
/**
 * CC-1120, desenho D1: o ouvido. Registrado no Stop e no SessionStart com `asyncRewake: true`, roda ao fundo,
 * espera a caixa desta sessão e, quando a mensagem dele chega pelo cockpit, escreve no stderr e sai com 2. O Claude
 * Code acorda a sessão ociosa com esse texto (provado em 23/11 numa sessão de terminal). O Stop arma de novo a cada
 * resposta.
 *
 * Regras:
 *   - uma trava por sessão: ouvido vivo recente da mesma sessão, com pid vivo, faz este sair calado com 0;
 *   - espera até quase 24 h por armada (o `timeout` do registro, 86400 s, precisa ser maior), e sai 0 limpando o marcador;
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

/* CC-1133, medido em 25/11: dentro de `claude -p` (as chamadas não interativas que o cockpit faz por baixo: arquiteto,
   textos, conferências) este gancho prendia a chamada inteira, 151 s sem resposta até o limite, porque o `-p` espera o
   gancho ao fundo acabar e ele espera até 24 h. Quem recebe mensagem do cockpit é sessão com gente do outro lado, não
   chamada de uma linha. As variáveis de ambiente não distinguem (herdam as da sessão que chamou), então olha-se quem
   abriu o gancho: linha de comando do pai com `-p` ou `--print`. As sessões do aplicativo usam `stream-json` e não têm. */
if (!process.env.CC_OUVIDO_FORCAR) {
  const { linhaDeComandoDe, pidPaiDe } = await import('../src/platform.mjs').catch(() => ({}))
  /* Na VPS o pai é um `/bin/sh -c` e o `claude -p` é o avô: sobe até 3 níveis, passando só por shell. */
  let pid = process.ppid
  for (let nivel = 0; linhaDeComandoDe && nivel < 3 && pid; nivel += 1) {
    const linha = linhaDeComandoDe(pid)
    if (/(^|\s)(-p|--print)(\s|$)/.test(linha)) sair()
    if (!/(^|[\\/\s])(ba|da)?sh(\.exe)?(\s|$)|cmd(\.exe)?(\s|$)/i.test(linha.split(' ')[0] + ' ')) break
    pid = pidPaiDe(pid)
  }
}

const dir = O.dirCaixas()
const vivo = path.join(dir, `${sessao}.vivo`)
const caixa = path.join(dir, `${sessao}.txt`)
/* 23/11, medido na VPS: com 55 min, a sessão parada desde 02:52 ficou surda às 03:47, e a mensagem do cockpit não
   chegou. O ouvido só arma de novo quando a sessão responde, então a espera tem de cobrir a sessão parada: quase 24 h
   (o `timeout` do registro é 86400 s). */
const TETO = Number(process.env.CC_OUVIDO_TETO_MS) || (24 * 60 - 10) * 60_000
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
