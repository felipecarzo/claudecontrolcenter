#!/usr/bin/env node
// PreCompact: injeta a ordem de idioma no pedido de resumo.
// O prompt de resumo do Claude Code e 100% em ingles e nao herda a chave
// "language" do settings.json, entao o resumo saia em ingles mesmo com a
// conversa toda em portugues. O stdout deste arquivo vira o bloco
// "Additional Instructions:" no fim daquele prompt.
process.stdout.write(
  'IDIOMA: escreva TODO o resumo em português do Brasil, incluindo os ' +
  'títulos das seções e o bloco <analysis>. Mantenha em inglês apenas o que ' +
  'é literal do código: nomes de arquivo, funções, comandos, mensagens de ' +
  'erro e trechos de código. Use acentuação correta e nunca troque letra ' +
  'acentuada por equivalente sem acento. Não use travessão (—) nem ' +
  'meia-risca (–) em lugar nenhum do texto.\n'
);
