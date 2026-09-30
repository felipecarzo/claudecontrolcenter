#!/usr/bin/env node
/**
 * CC-651: põe o gancho de permissão do cockpit no Claude Code desta máquina.
 *
 * O painel NUNCA escreve no `settings.json` do Claude Code sozinho: este é um
 * comando que ELE roda, uma vez, sabendo o que faz (mesmo formato do
 * `instalar-quadro-guard.mjs`).
 *
 * - cópia de segurança antes de tocar, com data no nome;
 * - não duplica (rodar duas vezes não põe duas vezes);
 * - grava em arquivo temporário, relê, e só então troca;
 * - `--conferir` não muda nada, só diz se já está instalado.
 *
 * Tempo do gancho: 90 s. Ele espera a resposta do painel por até 30 s, ou 75 s
 * quando ele está olhando de outra máquina (CC-735); sem painel, sai na hora.
 * Rodar de novo sobe o tempo de quem instalou com 40 s.
 */
import { copyFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SO_CONFERIR = process.argv.includes('--conferir')
const ALVO = join(homedir(), '.claude', 'settings.json')
const GANCHO = join(dirname(fileURLToPath(import.meta.url)), 'permissao-painel.mjs')
const COMANDO = `node "${GANCHO}"`

let cfg = null
try { cfg = JSON.parse(readFileSync(ALVO, 'utf8')) } catch (e) {
  console.error(`não consegui ler ${ALVO} como JSON: ${e.message}`)
  console.error('não vou tocar nele.')
  process.exit(1)
}

cfg.hooks ||= {}
cfg.hooks.PermissionRequest ||= []
const nossos = cfg.hooks.PermissionRequest.flatMap((g) => (g.hooks || []).filter((h) => String(h.command || '').includes('permissao-painel.mjs')))
/* CC-735: 90 s, porque olhando de outra máquina o gancho espera até 75 s. */
const TEMPO = 90
const curtos = nossos.filter((h) => !(h.timeout >= TEMPO))

if (nossos.length && !curtos.length) { console.log('o gancho de permissão do cockpit JÁ está instalado.'); process.exit(0) }
if (SO_CONFERIR) {
  console.log(nossos.length ? `instalado, mas com tempo curto (${curtos[0].timeout || 'padrão'} s). Rode sem --conferir para subir para ${TEMPO} s.` : 'ele NÃO está instalado. Rode sem --conferir para instalar.')
  process.exit(0)
}

if (nossos.length) for (const h of curtos) h.timeout = TEMPO
else cfg.hooks.PermissionRequest.push({ hooks: [{ type: 'command', command: COMANDO, timeout: TEMPO }] })

const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const copia = `${ALVO}.antes-da-permissao-painel-${carimbo}`
try { copyFileSync(ALVO, copia) } catch (e) {
  console.error(`não consegui fazer a cópia de segurança: ${e.message}`)
  process.exit(1)
}
try {
  const tmp = `${ALVO}.tmp`
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n')
  JSON.parse(readFileSync(tmp, 'utf8'))
  renameSync(tmp, ALVO)
} catch (e) {
  console.error(`falhou ao gravar: ${e.message}. O original está intacto; cópia em ${copia}`)
  process.exit(1)
}
console.log(nossos.length ? `tempo do gancho subiu para ${TEMPO} s.` : 'instalado.')
console.log(`  cópia de segurança: ${copia}`)
console.log('  vale para as sessões abertas DEPOIS de agora (as que já estão abertas precisam reabrir).')
