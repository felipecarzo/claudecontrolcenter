# Visão — Cockpit de retomada de contexto

Reposicionamento do produto pelo Felipe em 12/08, no meio da sessão do
framework de hooks:

> "os hooks não são o produto, o produto é o control center gerenciar isso tudo
> e se beneficiar dos hooks pra alimentar o cockpit dos nossos agentes."

## O problema

Ele toca 4-5 projetos em paralelo e se perde. Nas palavras dele:

> "diferente de agentes de IA o meu contexto é gigante mas muito vago, o meu
> maior poder é o poder de decisão e abstração do projeto enviesado no mundo
> real. Não tem pq eu tentar entender as tarefas e cada linha de mensagem que o
> agente manda se o principal que eu faço hoje em dia é desenvolver, consertar
> erros e guiar os agentes, é mais fácil eu ter um lugar onde eu tenho acesso
> fácil a 'hooks' de contexto que me fazem voltar rapidamente no contexto que
> eu tava"

Perguntado o que precisa ver ao voltar num projeto depois de horas fora,
respondeu **todos os quatro**: (a) onde parou e por que travou, (b) o que
mudou desde que saiu, (c) o que espera decisão dele, (d) onde está cada
projeto no mapa — e pediu **mapa visual**. Maior dor: **"não saber o que
priorizar agora"**.

## O que isso muda

O critério de sucesso de qualquer sinal ou gate deixa de ser "impõe boa
prática" e passa a ser **"me faz voltar ao contexto mais rápido?"**. Gate que
só disciplina e não informa é a burocracia que o próprio dono desliga na
terceira semana — e o painel tem histórico de rejeitar isso (CC-18).

Também muda a leitura da concorrência (pesquisa de 12/08): `probity` resolve
enforcement genérico, `tdd-guard` resolve TDD, `AI-SDLC` resolve governança
declarativa, `spec-kit`/BMAD orientam sem bloquear. **Nenhum resolve reentrada
de contexto em N projetos paralelos.** É o território vazio, e é a dor real.

## Princípios

- **A ordem é a informação.** O topo da lista é onde mexer. Uma coluna, não
  grade — grade faz o olho varrer, e a pergunta é "o primeiro", não "todos".
- **O peso nunca aparece na tela.** O que aparece é a frase ("travado: falta
  credencial da VPS"). Número sem explicação não é discutível: ele não teria
  como discordar de um "87".
- **Só dado que já está no snapshot de 2s.** Nada de `tempo.mjs` (800 MB) nem
  spawn no caminho da aba. Última atividade sai de `updatedAt` dos jobs: de
  graça, e mais fresco que o cache do tempo (que só atualiza quando a aba
  tempo abre).
- **Uma verdade só para "o que é urgente".** A lógica mora em
  `src/cockpit.mjs`, código puro coberto pelo `npm test`, e o servidor manda
  pronto no snapshot — duplicar em JS de navegador criaria duas verdades.

## Três achados que moldaram o backlog

1. **"O que mudou desde que saí" NÃO precisa de log de eventos.** Já existem
   carimbos honestos: `feitoEm` (por tarefa), `createdAt` (agente novo),
   `visto` do histórico (agente sumiu), `mapa.atualizadoEm` (roadmap editado),
   `git log --since`. Falta só a marca de visita. Evita construir o CC-23
   inteiro — 80% do valor por duas linhas.
2. **Duas linhas em `historico.mjs` destravam quase tudo**: `guardavel()` não
   guarda `cwd` (é só por isso que o mapa exige agente vivo), e `arquivar()`
   sobrescreve `feitoEm` com a versão já podada por `marcarConclusoes()`.
   Merge em vez de sobrescrita torna o histórico registro permanente de toda
   tarefa fechada, com hora.
3. **`sinais.arquivos` do `tempo.mjs` é contagem, não lista** (`edicoes.size`).
   Não existe hoje "quais arquivos essa tarefa mexe" — a fonte real é
   `git log --name-only`, sob clique.

## Backlog

- **CC-32** — a aba `projetos` vira cockpit. Feito em 13/08.
- **CC-33** — marca de visita + delta "desde que você saiu".
- **CC-34** — mapa visual em pastilhas, todo projeto.
- **CC-35** — `git log --since` na abertura do projeto.
- **CC-36** — enriquecimento de to-dos pelo opencode.
- **CC-37** — enriquecimento automático (stretch, provavelmente não fazer).

Detalhe de cada um no `ROADMAP.md`.

## Decisões fechadas

- **Marca de visita é explícita** (botão "vi isso"), mais carimbo implícito ao
  abrir o mapa. Automático ao abrir a aba destruiria o sinal — ele olha o
  painel o dia todo, o delta zeraria sempre.
- **Título gerado pelo opencode vira a linha principal**, original no hover.
  Nunca sobrescreve `t.text`.
- **O opencode nunca roda com `cwd` de projeto.** Verificado que todos os
  agentes dele (`build`, `plan`, `explore`, `general`, `summary`, `title`)
  têm `{"permission":"*","action":"allow"}` neste setup — nenhum é read-only.
  Roda em pasta neutra, recebendo o contexto pelo prompt.
