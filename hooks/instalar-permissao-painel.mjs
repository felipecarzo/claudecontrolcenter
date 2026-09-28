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
 * Tempo do gancho: 40 s, porque ele espera a resposta do painel por até 30 s
 * (e só quando o painel está aberto; sem painel, sai na hora).
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
const jaTem = cfg.hooks.PermissionRequest.some((g) => (g.hooks || []).some((h) => String(h.command || '').includes('permissao-painel.mjs')))

if (jaTem) { console.log('o gancho de permissão do cockpit JÁ está instalado.'); process.exit(0) }
if (SO_CONFERIR) { console.log('ele NÃO está instalado. Rode sem --conferir para instalar.'); process.exit(0) }

cfg.hooks.PermissionRequest.push({ hooks: [{ type: 'command', command: COMANDO, timeout: 40 }] })

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
console.log('instalado.')
console.log(`  cópia de segurança: ${copia}`)
console.log('  vale para as sessões abertas DEPOIS de agora (as que já estão abertas precisam reabrir).')
