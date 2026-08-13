# O que as rotinas fazem hoje, em português

Escrito em linguagem simples de propósito, a pedido do Felipe: descrever o
comportamento sem exigir que ele conheça termo de programação. Onde um termo
técnico for inevitável, ele vem explicado ali mesmo — e quando for conceito de
fundamento (coisa que vale entender), vem com a explicação do porquê, não só do
o quê.

Este documento é **retrato do que existe hoje**, não do que deveria existir. É
a base para decidir o que o Control Center vai passar a exigir, medir ou
mostrar.

---

## Vocabulário mínimo (só o necessário para ler o resto)

**Agente** — uma conversa/sessão de trabalho com a IA. Cada uma roda separada,
com sua própria memória e seu próprio histórico.

**Job** — cada agente rodando em segundo plano vira uma pasta no disco, com
arquivos que descrevem o estado dele. É de lá que o painel lê tudo.

**Hook** — um programa que o Claude Code chama sozinho quando algo acontece
(sessão abriu, agente terminou de responder, arquivo vai ser editado). É a
diferença entre *pedir* ("por favor faça X") e *obrigar* (o sistema chama X
sozinho, sem depender de ninguém lembrar). Fundamento importante: instrução
escrita é sugestão, hook é regra.

**Commit** — um "salvamento" no histórico do projeto, com mensagem dizendo o
que mudou. **Push** — mandar esses salvamentos para o servidor (GitHub), para
não viverem só na sua máquina.

**Roadmap** — o arquivo `docs/ROADMAP.md`, a lista do que está aberto no
projeto. **Handoff** — o arquivo `docs/HANDOFF.md`, o bilhete que uma sessão
deixa para a próxima: onde parei, o que fazer agora.

---

## Rotina 1 — `/start-session` (abrir o trabalho)

O que ela faz, em ordem:

**1. Confere a realidade antes de acreditar em documento.** Pergunta ao
histórico do projeto três coisas: quais arquivos estão modificados e ainda não
salvos, quais foram os 5 últimos salvamentos, e em que "linha do tempo" do
projeto estamos (a *branch* — uma versão paralela do projeto, como um rascunho
que depois se junta ao principal).

O fundamento por trás: **o código real vence os documentos**. O bilhete da
sessão anterior pode estar errado ou velho; o histórico do projeto não mente,
porque é gerado pela máquina a cada salvamento.

**2. Confere se alguém mais está mexendo no projeto** (Método Routia). Se
existe o quadro de rotas (`docs/ROTAS-ATIVAS.md`), lê antes de tocar em
qualquer arquivo: a área que vou mexer está livre? Se sim, marco meu nome. Se
já tem dono, não mexo — abro um pedido no mesmo arquivo e trabalho em outra
coisa.

**3. Lê o bilhete da sessão anterior** (o handoff): qual tarefa estava em
andamento, qual o próximo passo exato. E compara com a realidade do passo 1 —
se divergir, a realidade ganha e o Felipe é avisado.

**4. Carrega o contexto**: as memórias do projeto, o roadmap, o perfil do
Felipe.

**5. Apresenta um relatório** de meia tela: branch, último salvamento, arquivos
pendentes, o que o bilhete diz, qual rota foi marcada, e qual a próxima tarefa.
Depois **espera** — não começa a trabalhar sozinho.

### O que ela NÃO faz hoje (e é onde mora a oportunidade)

- **Não exige direção nenhuma.** Ela informa e espera. Não pergunta "esta
  sessão é conserto, teste, ideia nova ou entrega?" — que é exatamente o que o
  Felipe descreveu querer quando falou do framework.
- **Não bloqueia nada.** Se o Felipe ignorar tudo e mandar mexer em código, ela
  não impede.
- É instrução escrita, então **depende do agente ler e obedecer**. Não é hook.

---

## Rotina 2 — `/end-session` (fechar o trabalho)

Bem mais pesada que a de abertura — nove passos:

**1. Confere a realidade** (igual à abertura).

**2. Roadmap**: o que foi concluído hoje está marcado como concluído? O que
essas conclusões desbloquearam está como pendente? A data no fim do arquivo é
a de hoje? Se estiver desatualizado, corrige ali.

**3. Diário do dia**: todas as sessões do dia estão registradas (não só a
última)? Para cada tarefa: o que foi feito, o que o Tester e o Revisor
disseram? Tem resumo do dia?

**4. Bilhete para a próxima sessão** (handoff): sobrescreve com o estado
correto — data, último salvamento, qual é a *próxima* tarefa (não a que acabou
de terminar), o que ficou sem salvar, quais arquivos ler antes.

**4.5. Libera a rota**: se marcou área como sua na abertura, devolve para
livre. Pedido que você abriu e ainda não teve resposta fica — não é seu para
fechar.

**5. Memória do projeto**: o estado do sprint reflete o que foi feito hoje?
Algum aprendizado desta sessão merece virar memória permanente?

**5.5. Pendências humanas → quadro no vault**: identifica tudo que **só o
Felipe pode fazer** (criar conta, configurar serviço, aprovar, comprar,
decidir) e registra num quadro em `D:\secondbrain\vault`, separado em duas
colunas: "Bloqueando Progresso" (a IA não continua sem isso) e "Preciso Fazer"
(não bloqueia, mas precisa).

**5.6. Diário centralizado do vault**: registra o que aconteceu num arquivo
por dia que junta todos os projetos, separado por projeto.

**6. Relatório e pedido de aprovação**: mostra tudo que verificou e propõe a
mensagem de salvamento. **Espera o Felipe aprovar** — nunca salva sozinho.

**7. Salva e envia** (commit e push), depois de aprovado.

### O que ela NÃO faz hoje

- **Não fecha os to-dos automaticamente.** Se o agente esqueceu de marcar
  tarefa como feita, a rotina não corrige — só o hook do painel avisa (o
  `cc check`, que trava a entrega quando o status diz "pronto" e a lista está
  aberta).
- **Não mede nada.** Não registra quanto tempo levou, quantas tarefas fecharam,
  o que travou. Tudo que ela produz é texto para humano ler depois.
- Também é instrução escrita: **depende do agente executar os nove passos**.
  Se ele pular o passo 5.5, ninguém percebe.

---

## Rotina 3 — as regras globais (o `CLAUDE.md` da máquina)

Vale para **todo projeto**, sem precisar copiar nada. Manda:

- **Sempre começar conferindo a realidade** (o mesmo "Step 0" da abertura).
- **Pipeline por tarefa**: Planner (planeja) → implementação → Tester (testa) →
  Revisor (revisa) → Felipe aprova → Scrum Manager (atualiza roadmap e salva) →
  encerramento.
- **Quatro regras absolutas**: nunca pular o Tester depois de mexer em código;
  nunca rodar o Revisor antes do Tester; nunca atualizar o roadmap sem
  aprovação; ações de git sempre em primeiro plano (nunca em segundo plano,
  onde o Felipe não vê).
- **Como reportar ao Control Center** (o bloco entre marcadores no arquivo):
  ao entender a tarefa, escrever assunto + frente + lista de to-dos; ao fechar
  cada to-do, marcar; ao entregar, status e lista fechada.

### O que é regra de verdade vs. o que é só pedido

Hoje, **quase tudo aí é só pedido**. O que realmente obriga são quatro hooks:

| O que obriga | Quando dispara | O que faz |
|---|---|---|
| `rota-guard` | antes de editar arquivo | **bloqueia** edição em área sem rota marcada |
| `git-add-guard` | antes de rodar comando | **bloqueia** "salvar tudo de uma vez" em projeto com rotas |
| `cc check` (via `todo-guard`) | quando o agente termina | **trava** entrega com to-do aberto e status "pronto" |
| `routia-inicio` / `routia-fim` | ao abrir / ao terminar | mostra o quadro de rotas; lembra de liberar |

Todo o resto — os nove passos do encerramento, o pipeline Planner→Tester→
Revisor, o "nunca pule o Tester" — é texto que o agente lê e **pode ignorar
sem que nada aconteça**.

---

## Rotina 4 — o que cada projeto tem por conta própria

Seis projetos têm comandos próprios (`app_maurice`, `Clinica Bela Vida`,
`app_questguide`, `proj_carzo`, `proj_ghoscode` e o template). O template
carrega dez: abertura, encerramento, salvar agora, puxar agora, arquivar
sprint, fechar às pressas, rotas, tickets, papéis e autorização.

Ou seja: **as rotinas existem espalhadas e em duplicata** — parte é global
(vale para todos), parte é copiada dentro de cada projeto. Nada garante que a
cópia dentro do projeto esteja igual à global.

---

## Resumo honesto do estado atual

**O que funciona bem:**
- A abertura confere a realidade antes de acreditar em documento — e isso já
  salvou de trabalhar em cima de informação velha.
- O encerramento é minucioso: nove passos que cobrem roadmap, diário, bilhete,
  memória, pendências humanas e diário do vault.
- Quatro hooks obrigam de verdade, e os três do Método Routia impedem duas
  sessões de se atropelarem.

**Onde estão os buracos:**
1. **Nenhuma rotina exige direção.** A abertura informa e espera; não pergunta
   que tipo de trabalho é esta sessão.
2. **Quase tudo é pedido, não regra.** Nove passos de encerramento que o agente
   pode pular sem consequência nenhuma.
3. **Nada é medido.** As rotinas produzem texto para humano ler. Não geram
   número, nem carimbo de tempo, nem sinal que o painel possa mostrar — com
   uma exceção: o carimbo de quando cada to-do foi fechado.
4. **Duplicação**: rotina global e rotina copiada dentro do projeto, sem nada
   garantindo que estejam iguais.
5. **A ligação com o painel é frouxa**: o agente reporta se lembrar. Não há
   nada que force "esta sessão declarou sua frente de trabalho".

Esses cinco buracos são o material bruto do que o Control Center pode passar a
exigir e mostrar — e o critério para escolher qual atacar continua sendo o do
[[COCKPIT]]: **isso me faz voltar ao contexto mais rápido?**
