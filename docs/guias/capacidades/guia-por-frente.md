# Guia: guia por frente, escrito pelo Haiku e disparado por código

itens: CC-1076
codigo: src/frenteConcluida.mjs, src/guiaHaiku.mjs, hooks/guia-frente.mjs, hooks/parada.mjs, hooks/teto-robo.mjs, src/guias.mjs, src/hooksCatalogo.mjs, src/hooksExplica.mjs, cc.mjs, test-cc1076.mjs
atualizado: 2026-10-30
gerado: a mao
manual:

Este é o último guia escrito por uma sessão de IA. Os próximos nascem do código descrito aqui.

## 1. Estado e para quem vale

Pronto e em prova (30/10/2026), na VPS e em qualquer projeto que tenha `docs/backlog.jsonl`. Pedido dele em 30/10 (item
CC-1076, plano em `docs/CC-1076.md`). Nenhuma chamada real ao modelo roda nos testes; a prova real é uma chamada manual.

## 2. O que é, em uma frase, e o que NÃO é

É um mecanismo em código que, quando uma frente do backlog termina, pede ao modelo Haiku (o menor e mais barato da
família Claude) o guia de funções dela, confere por script as citações e grava o guia e a linha do índice.
NÃO é um robô de segundo plano (sem timer, cron nem laço), NÃO é manual de usuário (o manual sai depois, do guia) e NÃO
é pedido à sessão de IA: a sessão não escreve guia.

## 3. Vocabulário

- **ESTADO REAL:** bloco calculado por código no início do material (estado atual de cada item da frente, estado de cada gancho do catálogo com o interruptor global, e a lista real de `GUARDAS` do `hooks/parada.mjs`). Manda sobre plano, guia antigo, conversa e código, que entram rotulados como HISTÓRICO.
- **Frente:** o campo `frente` do item do backlog (uma palavra do catálogo `docs/frentes.json`, como `sincronia`). É o
  mesmo agrupamento do ROADMAP gerado (`regerarRoadmap` em `src/backlog.mjs`).
- **Frente pronta:** nenhum item dela em B0, B1, EM, DE ou TR (fora os mandados para `lugar.onde: "fora"`, do MVP);
  todos em PR (prova) ou OK (fechado); KO (cancelado) e micro tarefa (item com `pai`) não contam; e pelo menos um item
  mudou para PR ou OK nos últimos 30 minutos.
- **Cobertura:** o conjunto de ids em PR/OK que o último guia da frente já cobriu. Mora em
  `~/.local/share/agent-cockpit/guias-frente/<pasta-do-projeto>.json`.
- **Ensaio:** `--ensaio`, monta o material e imprime o tamanho, sem chamar o modelo.
- **Citação:** `arquivo:linha` no texto do guia (ou `arquivo:inicio-fim`). Só o nome do arquivo vira caminho completo se um único arquivo da lista do material tem esse nome.
- **Afirmação de estado:** frase do guia que liga um id de item a "andando/em prova/fechado/a fazer" ou um nome de gancho a "ativo/ligado/roda/desligado/aposentado". Conferida por código contra o ESTADO REAL.

## 4. O ciclo de ponta a ponta

1. Fim de cada resposta (Stop): o `hooks/parada.mjs` roda `hooks/guia-frente.mjs`.
2. O gancho sai calado se estiver no `claude -p`, dentro do próprio guia (`CC_GUIA_HAIKU=1`), com `stop_hook_active` ou
   desligado no catálogo. Falha de qualquer parte passa e grava `~/logs/guia-frente.log`.
3. Chama `frentesConcluidas(raiz)` (`src/frenteConcluida.mjs`). Primeiro lê só a cauda de `docs/eventos.jsonl`: sem
   evento recente para PR ou OK, para ali (custa poucos milissegundos). Só então lê o backlog e agrupa por frente.
4. Para cada frente pronta com id novo fora da cobertura, o gancho já grava a cobertura (é o que impede disparar duas
   vezes enquanto o Haiku escreve) e dispara, solto, `node src/guiaHaiku.mjs --raiz ... --frente ... --transcrito ... --sessao ...`.
5. O gancho devolve ao Claude UMA linha (saída 2, a volta seguinte passa) dizendo que o guia foi pedido e onde vai aparecer.
6. `guiaHaiku.mjs` monta o material (parte 5, com o ESTADO REAL no começo), confere o teto por hora, faz UMA chamada
   `claude -p --model haiku --output-format json --tools "" --no-session-persistence` em pasta própria
   (`~/.local/share/agent-cockpit/guia-haiku`), com `CC_CONFERENTE=1` e `CC_GUIA_HAIKU=1` no ambiente.
7. Confere as citações e as afirmações de estado do texto devolvido (`conferirCitacoes` e `conferirEstado`), grava `docs/guias/capacidades/<frente-slug>.md` e a linha no `INDICE.md`,
   e grava o resultado em `~/logs/guia-haiku.log`. Termina sozinho.

## 5. Onde cada coisa mora

- `src/frenteConcluida.mjs`: `frentesConcluidas`, `marcarCobertos`, `lerCobertura`, `slugDaFrente`, `itensPorFrente`.
- **Segunda correção de 30/10:** a seção "1. Estado e para quem vale" do guia gravado é ESCRITA POR CÓDIGO (`secaoEstado`, em `src/guiaHaiku.mjs`, a partir do mesmo `estadoReal`): tabela dos itens da frente com o estado do backlog, contagem por estado, ganchos do cabeçalho `codigo:` com ligado, desligado ou aposentado, e o total de ligados do catálogo. O pedido ao Haiku pede só as seções 2 a 11 e proíbe contar itens ou ganchos e dizer estado. `conferirEstado` também aponta id de item de OUTRA frente dito com palavra de estado e TODA contagem de itens ou ganchos ("cinco itens", "35 ganchos"), pois o Haiku não deve contar.
- **Terceira correção de 30/10:** `conferirEstado` também aponta MENÇÃO ao nome de gancho `desligado` ou `aposentado` (mesmo `estadoReal` da seção 1) quando a frase não traz palavra que o declare ("aposentado", "desligado", "não roda mais", "substituído"). O apontamento leva o nome, o estado real e um trecho da frase, e conta no `estado: X de Y`; gancho ligado não é apontado, e afirmação de estado já conferida não conta duas vezes. O pedido ao Haiku manda não descrever esses ganchos como ativos nem citar o nome deles, salvo para dizer que estão desligados ou aposentados.
- `src/guiaHaiku.mjs`: `estadoReal`, `blocoEstado`, `secaoEstado`, `montarMaterial`, `conversaDe`, `montarPedido`, `chamarHaiku`, `conferirCitacoes`, `conferirEstado`, `gravarGuia`,
  `gerar` e o modo de linha de comando. Reusa `acharRaiz`, `movidosRecentes` e `guiasDe` de `src/guias.mjs`.
- `hooks/guia-frente.mjs`: o gancho. Entrada `guia-frente` em `src/hooksCatalogo.mjs` e `src/hooksExplica.mjs`.
- `hooks/teto-robo.mjs`: ignora `CC_GUIA_HAIKU=1` e a pasta `agent-cockpit-guia-haiku` na contagem de robôs.
- Material montado (teto de 120 KB): itens da frente (título, intenção, pronto, conferir); planos `docs/<ID>.md` (15 KB cada,
  40 KB no total); lista de arquivos de código citados nos planos e em guias existentes; `git diff --stat` deles; o código
  numerado linha a linha (6 KB por arquivo, o que sobrar do teto, os menores primeiro, sem `test-*`); e a conversa (só fala
  dele e da IA, sem saída de ferramenta, últimos 60 KB). O que foi cortado vai no log.
- Logs: `~/logs/guia-frente.log` (disparos e erros do gancho), `~/logs/guia-haiku.log` (hora, frente, modelo que
  respondeu, tokens, citações, tempo, `status`: `gravou`, `erro` ou `teto`).
- O guia gravado: cabeçalho `itens:`, `codigo:`, `atualizado:`, `gerado: haiku`, `origem:` (data do primeiro guia, mantida
  nas regerações), `citacoes: X de Y conferidas`, `estado: X de Y afirmações conferem` e `manual:` (vazio, previsto para o
  manual de usuário). Citações que não conferem entram numa seção final "Citações que não conferem", e afirmações de
  estado erradas em "Afirmações de estado que não conferem". Travessão que o modelo escrever é trocado por vírgula.

## 6. A interface, item por item

- `node cc.mjs guia frente <nome> [--ensaio] [--saida <arquivo>]`: roda na pasta de um projeto. Sem `--ensaio`, faz a chamada ao Haiku e imprime
  o caminho, o modelo, as citações e o estado conferidos; com `--ensaio`, imprime quantos itens, quantos bytes e o que foi cortado.
- `node src/guiaHaiku.mjs --raiz <pasta> --frente <nome> [--transcrito <jsonl>] [--sessao <id>] [--ensaio] [--saida <arquivo>]`: o mesmo, usado pelo gancho.
- `--saida <arquivo>`: grava o guia nesse caminho e NÃO mexe no `INDICE.md` nem em `docs/guias/capacidades/`; serve para provar a qualidade sem sujar a pasta.
- Interruptor: o hook `guia-frente` na aba Hooks (padrão ligado).

## 7. Regras e limites

- 6 chamadas por hora no total (conta o log `guia-haiku.log`, inclusive as manuais), 180 s por chamada, uma tentativa,
  sem repetir sozinho. Estourou o teto: grava `status: teto` e não chama.
- A cobertura é gravada ao disparar, não ao terminar: se a chamada falhar, a frente NÃO dispara de novo sozinha. O
  caminho é o comando manual.
- A janela de "acabou de mudar" vale no máximo 30 minutos (teto de `movidosRecentes`).
- A conferência de citações só diz se o arquivo e a linha existem. NÃO prova que a afirmação ao lado está certa.
- A conferência de estado só vê dois formatos (`<ids> está <palavra>` e `<palavra> (<ids>)`, com ids vizinhos formando grupo) e só os ids da própria frente; id de outra frente dito com palavra de estado é apontado (segunda correção), e frase solta fora desses formatos não é conferida, e negação ("não está em andamento") não conta.
- A frente `sem frente` nunca dispara. Frente com item em B0/B1/EM/DE/TR nunca dispara (por isso frentes grandes e
  sempre abertas, como `framework`, não disparam sozinhas; o comando manual funciona mesmo assim).

## 8. O que a combinação torna possível

- Com o INDICE (colunas `itens do backlog` e `manual`), uma IA acha que guia tem material para virar manual e quais frentes
  ainda não têm manual.
- Com o `guia-de-capacidades` (skill) e a seção "Não verificado", quem corrige o guia vê exatamente o que o Haiku não achou.
- Com o conferente (CC-1070) e o `teto-robo` (CC-1069), as chamadas de modelo por código têm três tetos separados e medidos.

## 9. O que ainda não existe

- O manual de usuário (só o campo `manual:` e a coluna do INDICE estão previstos).
- Nova tentativa automática de uma chamada que falhou, e fila quando o teto estoura.
- Conferência de que a frase certa está ao lado da citação certa (só existência).
- Conferência de estado de qualquer frase fora dos dois formatos acima.
- Disparo por uma frente que nunca fecha por inteiro: só o comando manual.

## 10. Receitas curtas

- Ver o que um guia receberia: `node cc.mjs guia frente <nome> --ensaio`.
- Gerar ou regerar à mão: `node cc.mjs guia frente <nome>`.
- Ver o que aconteceu: `tail ~/logs/guia-haiku.log` e `tail ~/logs/guia-frente.log`.
- Zerar a cobertura de um projeto, para a frente poder disparar de novo: apagar o arquivo dele em
  `~/.local/share/agent-cockpit/guias-frente/`.

## 11. Como provar que continua funcionando

- `node test-cc1076.mjs`: casa falsa e `claude` falso no PATH, nunca chama o modelo. Cobre disparo único, repetição,
  item andando, id novo, ensaio, citações (inclusive só com o nome do arquivo), estado real, conferência de estado com guia
  falso, `--saida`, teto, falha do modelo e `CC_GUIA_HAIKU`.
- `node test-parada.mjs` (35 guardas, com `guia-frente` no lugar de `guia-fim` e `guia-contexto`) e `node test-cc1071.mjs`
  (os dois aposentados fora da lista e do catálogo).
- Outros documentos: `docs/CC-1076.md` (plano), `guias-de-capacidades.md` (o sistema anterior, CC-1071).
