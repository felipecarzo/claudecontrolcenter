#!/usr/bin/env node
/**
 * pergunta-risco-guard — a outra metade da trava de 23/08.
 *
 * Quando ELE pergunta se uma mudança quebra algo ("vai quebrar?", "é seguro?",
 * "tem risco?"), este hook injeta um protocolo no meu contexto ANTES de eu
 * responder. O erro do dia foi responder "não quebra" de uma conferência
 * parcial; o remédio é obrigar o formato de resposta que teria pego o buraco.
 *
 * Roda como hook UserPromptSubmit. Lê o JSON do stdin, e se a mensagem dele bate
 * com uma pergunta de risco, escreve o protocolo no stdout — que o Claude Code
 * injeta como contexto do turno. Não bloqueia nada: é lembrete, não trava.
 *
 * Falha calado em erro próprio: um injetor que derruba o turno por bug seria
 * pior que a ausência dele.
 */
import fs from 'node:fs'

let entrada = ''
try { entrada = fs.readFileSync(0, 'utf8') } catch { process.exit(0) }

let prompt = ''
try {
  const j = JSON.parse(entrada)
  prompt = String(j.prompt ?? j.user_prompt ?? j.message ?? '')
} catch { prompt = entrada }
if (!prompt.trim()) process.exit(0)

// As formas dele de perguntar se algo é seguro. Acento opcional porque ele dita
// por voz e o texto chega ora com, ora sem.
const GATILHOS = [
  /\bn[ãa]o\s+(vai\s+)?(quebra|quebrar|afeta|afetar)/i,
  /\bvai\s+quebrar/i,
  /\bquebra\s+(algo|alguma\s+coisa|nada|alguma)/i,
  /(^|[^a-zà-ú])[ée]\s+seguro/i,
  /\btem\s+risco\b/i,
  /\bcorre\s+risco\b/i,
  /\bpode\s+(dar|causar)\s+(problema|erro|dor\s+de\s+cabe)/i,
  /\bisso\s+(afeta|impacta|quebra)/i,
  /\bnada\s+(vai\s+)?quebra/i,
]
if (!GATILHOS.some((re) => re.test(prompt))) process.exit(0)

process.stdout.write(
  `[PROTOCOLO DE RISCO. Ele perguntou se algo quebra. Isto é obrigatório antes de responder.]\n\n`
  + `Proibido responder "não quebra" a partir de uma conferência parcial. Em 23/08\n`
  + `isso custou o venv de dois projetos e quatro conversas do painel.\n\n`
  + `1. ENUMERE onde a mudança pode bater. Para mudança de caminho/pasta, as\n`
  + `   classes conhecidas estão em varredura-impacto.mjs: venv, serviço do\n`
  + `   sistema, link do npm, atalho de shell, cópia do git, estado do painel,\n`
  + `   script solto. Para outra mudança, pense nas dependências equivalentes.\n`
  + `2. CHEQUE cada uma DE FATO (grep, varredura, teste). Não responda de memória.\n`
  + `   Se for mexer em pasta de projeto, rode: node varredura-impacto.mjs\n`
  + `3. RESPONDA em DUAS metades, e a segunda é obrigatória:\n`
  + `     a) "verifiquei X, Y, Z e está ok", com a prova de cada.\n`
  + `     b) "NÃO verifiquei / não consigo descartar: W", o que ficou de fora.\n\n`
  + `Um "não quebra" sem a metade (b) é exatamente o erro que este protocolo existe\n`
  + `para impedir.`)
process.exit(0)
