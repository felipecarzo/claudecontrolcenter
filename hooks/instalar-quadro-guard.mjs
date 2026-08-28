#!/usr/bin/env node
/**
 * Põe o `quadro-guard` na lista de fim de resposta do Claude Code.
 *
 * ## Por que isto existe como comando, e não como instrução
 *
 * O painel NUNCA escreve no `settings.json` do Claude Code, e essa decisão do
 * projeto continua de pé: nenhuma rota, nenhum daemon, nenhum hook mexe nele.
 * Este arquivo é outra coisa: é um comando que ELE roda, uma vez, sabendo o que
 * faz. A diferença é quem aperta o botão.
 *
 * E existe por um motivo prático dele: *"eu colo isso aonde?"*. A resposta
 * honesta era "num JSON de 21 grupos aninhados, no telefone", que é pedir para
 * quebrar o arquivo que faz o Claude Code funcionar.
 *
 * ## O que ele garante
 *
 * - **Cópia de segurança antes de tocar**, com data no nome. O `settings.json`
 *   quebrado desliga todos os guardas de uma vez, calado.
 * - **Não duplica.** Rodar duas vezes não põe o guarda duas vezes.
 * - **Escrita atômica** (arquivo temporário e depois renomeia), a mesma regra
 *   do resto da casa: leitor concorrente nunca pega arquivo pela metade.
 * - **`--conferir` não muda nada**, só conta o que faria.
 */
import { copyFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const SO_CONFERIR = process.argv.includes('--conferir')
const ALVO = join(homedir(), '.claude', 'settings.json')
const COMANDO = 'node /home/claudedev/projetos/proj_controlcenter/hooks/quadro-guard.mjs'

let bruto = ''
try { bruto = readFileSync(ALVO, 'utf8') } catch (e) {
  console.error(`não consegui ler ${ALVO}: ${e.message}`)
  process.exit(1)
}

let cfg = null
try { cfg = JSON.parse(bruto) } catch (e) {
  console.error(`o arquivo existe mas não é JSON válido: ${e.message}`)
  console.error('não vou tocar nele. Conserte o JSON primeiro.')
  process.exit(1)
}

cfg.hooks ||= {}
cfg.hooks.Stop ||= []

const jaTem = cfg.hooks.Stop.some((g) => (g.hooks || []).some((h) => String(h.command || '').includes('quadro-guard.mjs')))
const quantos = cfg.hooks.Stop.reduce((n, g) => n + (g.hooks || []).length, 0)

if (jaTem) {
  console.log(`o quadro-guard JÁ está instalado. São ${quantos} guardas de fim de resposta.`)
  process.exit(0)
}

if (SO_CONFERIR) {
  console.log(`ele NÃO está instalado. Hoje são ${quantos} guardas de fim de resposta.`)
  console.log('rode sem --conferir para instalar.')
  process.exit(0)
}

/* `timeout: 10` é o mesmo dos vizinhos. O guarda custa 62ms medidos, então dez
   segundos é folga enorme, e existe só para o caso de o disco estar ocupado. */
cfg.hooks.Stop.push({ hooks: [{ type: 'command', command: COMANDO, timeout: 10 }] })

const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const copia = `${ALVO}.antes-do-quadro-guard-${carimbo}`
try {
  copyFileSync(ALVO, copia)
} catch (e) {
  console.error(`não consegui fazer a cópia de segurança: ${e.message}`)
  console.error('não vou escrever sem ter para onde voltar.')
  process.exit(1)
}

try {
  const tmp = `${ALVO}.tmp`
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n')
  /* Relê antes de trocar: JSON quebrado aqui desliga TODOS os guardas de uma
     vez, e em silêncio. */
  JSON.parse(readFileSync(tmp, 'utf8'))
  renameSync(tmp, ALVO)
} catch (e) {
  console.error(`falhou ao gravar: ${e.message}`)
  console.error(`o arquivo original está intacto, e há cópia em ${copia}`)
  process.exit(1)
}

console.log('instalado.')
console.log(`  guardas de fim de resposta: ${quantos} -> ${quantos + 1}`)
console.log(`  cópia de segurança: ${copia}`)
console.log('')
console.log('Para conferir: na próxima resposta o guarda fala do VPS_escritorio,')
console.log('que é o único projeto lido e fora do quadro hoje. Na resposta seguinte,')
console.log('ele cala. Se falar duas vezes, alguma coisa está errada.')
