# Como se escreve a mensagem de um guarda

Vale para todo texto que um hook devolve ao modelo (stderr com saída 2, `additionalContext`, `systemMessage`, `reason`)
e para as regras injetadas no início da sessão. A detecção (o que dispara o guarda) NÃO muda. Só muda o que é dito.

## Por que existe

Em 19/10/2026 o Claude Opus 5.5 passou a ter respostas barradas por um filtro de segurança
(`reasoning_extraction`) quando a conversa tinha textos que mandavam o modelo descrever o caminho que o levou a uma
conclusão, justificar-se, ou citavam de volta o que ele escreveu. A causa exata não está confirmada. A regra abaixo
é a forma de escrever que não pode dar problema: a mensagem fala do FORMATO e da AÇÃO, nunca do processo do modelo.

## A forma

1. **Uma a quatro linhas.** A primeira: `[nome-do-guarda] o que falta, em uma frase.`
2. **Imperativo sobre a saída ou sobre a ação.** "Reenvie a resposta com o separador antes do que ele decide."
   "Faça a pergunta na caixa de escolha (AskUserQuestion)." "Ponha o comando sozinho no bloco de código."
3. **Dados variáveis, só os curtos:** contagem, nome de arquivo, número de linha, uma lista de até 5 termos soltos.
   Frase inteira que o modelo escreveu NUNCA entra, nem entre aspas.
4. **Termina dizendo o que passa:** "A próxima volta passa." quando o guarda só barra uma vez (mantenha a mecânica
   de volta única que o guarda já tem).

## O que não entra, em nenhuma forma

- Pedir que o modelo descreva, narre, explique ou justifique como chegou, o que pensou, mediu, descartou ou decidiu.
- Citar de volta o que o modelo escreveu ("você disse...", "o trecho ...").
- Palavras sobre o pensamento do modelo: raciocínio, caminho percorrido, "como você chegou lá", "o que você descartou".
  Troque por palavras sobre o conteúdo: "fatos", "o que foi medido", "o que mudou", "o que ele precisa fazer".
- A história do bate-boca que originou a regra ("Ele em 10/09 disse..."). Isso é útil a quem mantém o guarda, não ao
  modelo: mova para um comentário no código (não é emitido) ou apague.
- Travessão (em dash) e meia-risca. Hífen comum pode.

## Antes e depois (exemplos, não copie literalmente)

Antes: um parágrafo contando que ele pediu a regra em tal data, o que o modelo fez de errado antes e uma explicação do
motivo. Depois: `[resumo-guard] Resposta longa sem o separador. Reenvie com a linha de separação antes do que ele
decide ou faz. A próxima volta passa.`

Antes: devolver ao modelo as frases que ele escreveu e o nome do padrão. Depois: `[fala-guard] padrão 3: narração do
caminho. Reescreva dizendo o fato e, se a causa importar, em uma linha. A próxima volta passa.`

## Testes

Teste que confere o TEXTO antigo da mensagem muda para conferir a nova (ou, melhor, confere o código de saída e o
nome do guarda entre colchetes, que são o que importa). Não mude teste que confere detecção.
