# Ganchos do PC refeitos em node: resumo em português ao compactar e título do terminal

itens: CC-1072
codigo: hooks/compactar-idioma.mjs, hooks/titulo-terminal.mjs
atualizado: 2026-10-29

Guia de capacidades dos dois ganchos que existiam só no PC dele e foram refeitos na VPS. Plano de origem: `docs/CC-1072.md`
não existe (o pedido veio da sessão PC_cockpit, 22/10); o item no backlog é o CC-1072. Modelo do guia: skill
`guia-de-capacidades`.

## 1. Estado e para quem vale

Prontos e cobertos por `test-cc1072.mjs` (13 verificações, no Linux). NÃO provados no Windows, que é onde rodam de
verdade: o item continua "andando" por isso. Não estão registrados no `settings.json` da VPS (somente leitura para a
sessão): quem os registra no settings do PC é a sessão PC_cockpit. Na VPS os arquivos existem e passam no teste.

## 2. O que são, e o que não são

São dois ganchos pequenos, em node puro, sem bash e sem jq. Não chamam modelo, não criam nada que rode sozinho e saem
sempre com código 0 (falha aberta): nunca travam uma compactação nem um pedido.

## 3. Vocabulário

- **PreCompact**: evento do Claude Code que roda ANTES de compactar a conversa. O que o gancho escreve no stdout entra
  nas instruções adicionais do pedido de resumo.
- **UserPromptSubmit**: evento que roda quando ele envia um pedido.
- **Título do terminal**: o nome da pasta da raiz do projeto, que o terminal do PC lê para nomear a aba.

## 4. O ciclo de ponta a ponta

1. Ao compactar, `compactar-idioma.mjs` escreve uma ordem de 4 linhas no máximo: o resumo inteiro em português do Brasil,
   com só o literal do código em inglês, acentuação correta, sem travessão.
2. A cada pedido dele, `titulo-terminal.mjs` lê o JSON do stdin (`session_id`, `cwd`), acha a raiz do projeto com
   `git rev-parse --show-toplevel` (sem git, usa o `cwd`), grava a sessão e o nome do projeto e imprime o nome.

## 5. Onde cada coisa mora

| O quê | Onde |
|---|---|
| Ordem de idioma do resumo | `hooks/compactar-idioma.mjs` |
| Título e sessão do terminal | `hooks/titulo-terminal.mjs` |
| Sessão da conversa | `<raiz do projeto>/.claude/current-session.tmp` (uma linha com `\n`, só se houver `session_id`) e a pasta `<raiz>/.claude/sessions` |
| Nome do projeto | `~/.claude/current-title.tmp` (uma linha com `\n`; respeita `CC_HOME`). Um gancho do PowerShell do PC o lê no próximo pedido |
| Teste | `test-cc1072.mjs`, na cadeia do `npm test` |

## 6. A interface, item por item

Sem tela. O que se vê: o resumo da compactação sai em português, e o stdout do gancho de título aparece na conversa como
"UserPromptSubmit hook success: <nome do projeto>".

## 7. Regras e limites

- O texto do resumo NÃO cita o bloco de análise do modelo nem traz os traços longos escritos de verdade: pelo guia
  `hooks/mensagens-guia.md`, pedir esse bloco é o tipo de frase que derrubou respostas por "reasoning extraction". O
  texto antigo do PC fazia as duas coisas.
- O gancho de título só grava a sessão quando há `session_id`. Escreve no abrigo do PC; no sandbox da VPS a gravação em
  `~/.claude` falha em silêncio.
- O gancho de título precisa receber o JSON no stdin e o canal fechado: sem isso ele espera para sempre.
- URL de módulo é sempre `pathToFileURL`, nunca `file://` com caminho cru (quebra no Windows).

## 8. O que a combinação torna possível

- Junto com o `settings.json` do PC: o PC passa a ter os mesmos 38 ganchos da VPS, com o fim de resposta em um único
  processo, o que tirou os erros de "reasoning extraction" que ele via toda hora lá.
- Junto com o terminal do PC e o painel: o título da aba segue o projeto, e a sessão gravada na raiz dá ao painel um
  jeito de saber qual conversa está aberta naquela pasta.

## 9. O que ainda não existe

- Prova no Windows (os dois só rodaram no Linux).
- Registro no `settings.json` da VPS: nenhum dos dois é necessário lá, e o arquivo é somente leitura.
- Quem lê `current-title.tmp` (um gancho do PowerShell do PC) não foi encontrado em nenhum repositório; fica o mesmo
  formato do script antigo.

## 10. Receitas curtas

- Mudar a ordem de idioma: editar o texto em `hooks/compactar-idioma.mjs`, mantendo 1 a 4 linhas e sem citar raciocínio.
- Ver o título que o gancho daria: `echo '{"session_id":"x","cwd":"<pasta>"}' | node hooks/titulo-terminal.mjs` (grava
  `current-session.tmp` na raiz; apague depois se for só um teste).

## 11. Como provar que continua funcionando

```
node test-cc1072.mjs
```
Outros documentos: `docs/guias/capacidades/INDICE.md`, `hooks/mensagens-guia.md`.
