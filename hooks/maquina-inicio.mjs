#!/usr/bin/env node
/**
 * CC-475: o verificador de instalação fala sozinho, uma vez por dia.
 *
 * ## Por que existe
 *
 * `cc maquina` responde se o framework está ativo nesta máquina, e responde
 * bem. Mas comando que ninguém digita é peça inalcançável, que é o defeito
 * mais caro deste projeto e o que ele apontou com outras palavras: *"os hooks
 * funcionam hoje e amanhã já são inexistentes, não tem uma fundação firme"*.
 *
 * Medido em 11/09, antes de existir o comando: os dois hooks que SÃO o
 * framework estavam desligados neste PC havia semanas, e ninguém notou porque
 * nada avisava. O comando conserta a pergunta; este hook conserta o fato de
 * ninguém perguntar.
 *
 * ## Uma vez por DIA, e é o número que decide se isto vive
 *
 * A armadilha registrada neste projeto: *"rotina diária que roda sozinha vira
 * paisagem em uma semana (…) precisa nascer com critério de SILÊNCIO: quando
 * não falar"*. Então:
 *
 *   - fala só quando falta alguma coisa;
 *   - fala no máximo uma vez por dia, por máquina;
 *   - não fala de `versao:publicada`, que muda o tempo todo em quem
 *     desenvolve e viraria ruído diário garantido.
 *
 * ## Falha aberta, sempre
 *
 * Qualquer erro aqui sai calado com código 0. Hook de início que quebra
 * atrapalha toda sessão do ecossistema, e o preço de não avisar um dia é
 * muito menor que o de travar a abertura.
 */

import fs from 'node:fs'
import path from 'node:path'

const sair = () => process.exit(0)

try {
  const { casaClaude } = await import('../src/platform.mjs')
  const { conferir, GRAVIDADE } = await import('../src/instalacao.mjs')

  const marca = path.join(casaClaude(), '.cockpit-maquina-avisou')
  const hoje = new Date().toISOString().slice(0, 10)
  try {
    if (fs.readFileSync(marca, 'utf8').trim() === hoje) sair()
  } catch { /* nunca avisou, ou a marca sumiu: segue */ }

  const r = conferir()
  /* `versao:publicada` fora: em máquina de desenvolvimento ela diverge o dia
     inteiro, e um aviso que aparece sempre é um aviso que ele deixa de ler. */
  const falta = r.faltando.filter((f) => f.tipo !== 'versao')
  if (!falta.length) {
    /* Grava a marca mesmo quando está tudo certo: assim a conferência roda uma
       vez por dia e não a cada sessão. Ela custa pouco, mas "pouco" vezes
       vinte sessões é o tipo de conta que este projeto já pagou. */
    try { fs.writeFileSync(marca, hoje, 'utf8') } catch { /* sem marca, avisa de novo amanhã */ }
    sair()
  }

  const linhas = []
  linhas.push(`⚠️ ${falta.length} peça(s) do framework não estão ativas nesta máquina (${r.maquina}).`)
  linhas.push('')
  for (const f of falta.slice(0, 6)) {
    linhas.push(`  ${GRAVIDADE[f.gravidade].label.padEnd(10)} ${f.titulo}`)
    linhas.push(`             ${f.detalhe}`)
  }
  if (falta.length > 6) linhas.push(`  ... e mais ${falta.length - 6}`)
  linhas.push('')
  linhas.push('O que fazer: DIGA isto a ele em uma linha, em português simples, e ofereça')
  linhas.push('`cc maquina ligar` (que tem ensaio: `--ensaio`). Não ligue por conta própria:')
  linhas.push('mexer no settings.json dele é decisão dele, e ele precisa ver acontecer.')
  linhas.push('')
  linhas.push('Este aviso aparece uma vez por dia, e some sozinho quando não faltar nada.')

  try { fs.writeFileSync(marca, hoje, 'utf8') } catch { /* segue */ }
  process.stdout.write(`${linhas.join('\n')}\n`)
} catch { /* falha aberta: nunca atrapalhar a abertura da sessão */ }

sair()
