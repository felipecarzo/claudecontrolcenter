#!/usr/bin/env node
/**
 * CC-1072: PreCompact. A ordem de idioma do resumo, escrita no stdout, entra nas "Additional Instructions" do pedido
 * de resumo (que é em inglês e ignora a chave de idioma das configurações).
 *
 * Forma da mensagem: seguiu hooks/mensagens-guia.md. Só formato e idioma da saída, nada sobre o rascunho de análise
 * do modelo nem sobre o caminho dele. O texto antigo do PC pedia o resumo "incluindo o bloco de análise" e trazia os
 * dois traços longos escritos de verdade; os dois saíram.
 *
 * Falha aberta: qualquer erro sai calado com código 0, para nunca travar uma compactação.
 */
try {
  process.stdout.write(
    'Escreva o resumo inteiro em português do Brasil, inclusive os títulos das seções. '
    + 'Mantenha em inglês apenas o literal do código: nomes de arquivo, funções, comandos, mensagens de erro e trechos de código. '
    + 'Use acentuação correta e não troque letra acentuada por equivalente sem acento. '
    + 'Não use travessão nem meia-risca.\n',
  )
} catch {
  // falha aberta
}
process.exit(0)
