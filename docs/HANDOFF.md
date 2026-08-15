# HANDOFF

**Sessão:** 2026-08-15 · Claude (Opus 5, sessão interativa `ff0d68b2`) ·
**VPS**, pelo celular via Remote Control · continuação direta de 14/08
**Último commit:** `5efdb52` — feat(remoto): vários agentes por projeto, e a
sessão para de nascer travada
**Branch:** `backlog/cc-46-48-49-52-53-56-65` — **PR aberto, esperando merge:**
https://github.com/felipecarzo/claudecontrolcenter/pull/1

O que aconteceu: [diario/2026-08-15.md](diario/2026-08-15.md). Ponteiro, não
relatório — o diário tem os porquês.

## O que está esperando o Felipe agora

1. **Fazer o merge do PR e rodar `npm test` no PC.** O gate roda inteiro aí,
   inclusive a parte que a VPS pula por não ter job de background. Se falhar
   lá, é regressão e vale reportar.
2. **Registrar os dois hooks do padrão de resposta no `settings.json` do PC**
   (`hooks/estilo-inicio.mjs` em `SessionStart`, `hooks/estilo-fim.mjs` em
   `Stop`, com caminho `D:/`). Sem isso o padrão vale só na VPS. Ele pediu o
   trecho de JSON pronto e a conversa foi interrompida antes.
3. **Deploy do Pierre.** O hash de privacidade servido em produção não bate com
   o repositório desde 12/08, e o conserto está no git desde hoje. Detalhes em
   `inovallbond/docs/AUDITORIA-ANONIMIZACAO-2026-08-15.md`.
4. **Testar o framework** na sessão `teste_pierre_agenda`, que está no ar
   esperando ele no Remote Control. O teste: pedir código e confirmar que ela
   recusa, porque o projeto está na fase de Definição sem MVP.

## ⚠️ A sessão de senhas: não toca em código

O Felipe vai abrir uma sessão **só para resolver as senhas da VPS** (ele perdeu
as anotações à mão e vai passar tudo para o Bitwarden). Nela, **todas as rotas
de desenvolvimento ficam bloqueadas** — decisão dele, em 15/08.

**Isso não exige nada de novo: é o comportamento padrão do Routia.** O
`rota-guard` recusa edição de código a quem não marcou rota. Então a regra da
sessão de senhas é uma só:

> **Não marque rota nenhuma.** Sem rota marcada, o gate já barra qualquer
> `Edit`/`Write` em `src/`, e é isso que se quer ali.

Se aquela sessão precisar mexer em código por algum motivo, o certo é parar e
abrir outra — misturar credencial com edição de arquivo é como segredo vaza
para dentro de commit.

Três cuidados que valem repetir para quem abrir aquela sessão:

- **Nunca imprimir senha, chave privada ou o conteúdo de `~/.cockpit-auth.json`
  e `~/.cockpit-sessions.json`.** Vale mesmo se ele pedir: o que sai na tela
  entra no transcrito, que fica em disco e é lido pelo painel.
- **A chave SSH importa mais que a senha.** Foi ela que resolveu o sudo hoje,
  não a senha. Perder `id_ed25519_ahtleta` é perder o acesso root a uma máquina
  que hospeda cinco sites de cliente.
- Se ele pedir a senha do cockpit, ela **não existe em texto** — só o hash. O
  caminho é trocar por uma nova (`cockpit-auth senha "<nova>"`), que revoga
  todos os dispositivos junto.

## Dois pedidos do Felipe em 15/08, na sessão de senhas

Registrados aqui a pedido dele, para outro agente ler. Nenhum dos dois foi
implementado: a sessão de senhas não toca em código.

### 1. Guia tem que virar etapa, não bloco de texto

Palavras dele:

> "se eu nao acho o primeiro item da sua mensagem eu automaticamente perco todo
> o resto do texto, o ideal seria a gente usar o framework e transformar essas
> guias em etapas, assim se eu nao achar algo ja trava desde o inicio"

O caso real que gerou: passo a passo do Bitwarden escrito com âncora relativa
("logo abaixo de X"). Ele não achou o X, e as outras seis linhas da mensagem
viraram perda total. **O custo de uma âncora errada não é a âncora, é a
mensagem inteira.**

O formato que passou a valer na conversa, e que funcionou de primeira:

- **uma etapa por mensagem**, nunca o guia todo
- âncora **absoluta** (nome do bloco na tela), nunca "abaixo do que eu disse antes"
- critério de sucesso explícito ("achou?")
- **parada declarada** se não achar, em vez de seguir para a etapa seguinte
- o total anunciado no começo ("etapa 1 de 3"), para ele saber onde está

Candidato a virar recurso do framework, e não só jeito de escrever. É a mesma
família do gate de MVP: o sistema para no primeiro critério que não fecha, em
vez de despejar tudo e deixar a verificação por conta dele.

### 2. ⚠️ Contato entre agentes do mesmo projeto, urgente

Palavras dele:

> "precisamos aprimorar o contato entre agentes no mesmo projeto urgente, esse
> recadinho que a gente ta fazendo é ineficiente"

O "recadinho" é o `docs/ROTAS-ATIVAS.md`. Hoje ele tem **336 linhas**, e a
maior parte é conversa entre sessões: ticket escrito em markdown, que o outro
agente só lê se abrir o arquivo, e responde escrevendo mais markdown embaixo.
Quem chega depois lê tudo de novo para descobrir o que ainda vale.

O `rota-pedidos.mjs` (13/08) resolveu **um** caso, o pedido de autorização, e é
justamente o caso que virou comando em vez de texto. O resto continua sendo
recado. Vale olhar o que ele resolveu e por quê antes de desenhar o geral.

## A rodada de backlog de 15/08, à noite

Ele mandou consolidar tudo e executar até o fim. **A fila de 8 saiu inteira,
menos o item 8**, que depende dele. Junto saíram três que estavam fora da fila.

| | |
|---|---|
| **CC-84** | dois agentes no mesmo projeto se falam, com recado que chega na PRÓXIMA ferramenta |
| **CC-86** | `cc deps` — o que quebra se eu mexer aqui, lido do código em 23ms |
| **CC-67** | `cc hooks install` — os 8 hooks de uma vez, sem editar JSON à mão |
| **CC-81** | o mapa guarda as palavras DELE, e o clique abre colado na pastilha |
| **CC-78** | rotas clicáveis no mapa; o azul é "o dono sumiu", derivado do CC-49 |
| **CC-83** | três backlogs (agora / na fila / prontas), com o do meio derivado |
| **CC-69** | quatro níveis de hook declarados num lugar só |
| **CC-70** | `cc framework check` — o gate sob demanda, com código de saída pra CI |
| **CC-72** | `cc hooks sync` — a cópia do repositório contra o que roda |

**A decisão de método que atravessa tudo isso**, e que ele firmou depois de
tentar organizar o projeto e desistir: **não organize, derive.** Peso das
pastilhas, sprint, presença, dependência — nada disso é digitado, e por isso
nada disso envelhece.

## Feito nesta sessão, em uma linha cada

F16 (PDF sem `pdfjs-dist`), CC-46, CC-48, CC-49, CC-52, CC-53, CC-56, CC-65
(hooks globais versionados), CC-66 (padrão de resposta como hook), e a aba
`remoto` ganhando vários agentes por projeto.

No Pierre: o `RE_ENDERECO` parou de engolir texto (`46999be`) e o hash de
privacidade virou gate (`a409029`), mais o documento de passe de bastão
(`03e5603`).

Na VPS, feito por ele com acesso root: `KillMode=process` no
`agent-cockpit`, que era o que matava escritório e Pixel Agents a cada
reinício do painel.

## Dois achados que valem mais que os itens

- **O gate escrevia nas notas de verdade do Felipe** e restaurava no fim.
  Interrompido no meio, deixava a lista vazia — sintoma exato do apagamento de
  09/08 que nunca teve causa provada. Fechado com `CC_HOME`.
- **Os hooks globais não existiam em repositório nenhum**, e o painel liga e
  desliga cinco deles pela tela.

## Aberto, e por quê

- **CC-08 (macOS)**: precisa de um Mac. Pendente por tempo indeterminado, por
  decisão dele.
- **A última perna do CC-48**: o `rota-guard` ainda lê só o arquivo local. O
  encanamento está pronto (as rotas viajam no pacote da federação). Falta
  decidir quanto tempo o hook pode esperar pela rede — hook lento trava o CLI.
- **CC-60**: o outro Pixel Agents (porta 3100, usuário `agente`). O que dava
  para saber está respondido; que agentes ele mostra exige permissão em
  `/home/agente/`. Mostrar no cockpit ou desligar é decisão dele.
- **CC-61**: `~/cockpit-auth.mjs` continua fora de repositório, e é a porta de
  entrada do painel inteiro. Irmão do CC-65, que foi resolvido hoje.

## Uma coisa sem explicação

A sessão de teste que subi de manhã morreu em algum momento; a minha, criada
antes, sobreviveu ao mesmo período. Não sei por quê e não chutei. Se a nova
cair de novo, aí é padrão e vale investigar.
