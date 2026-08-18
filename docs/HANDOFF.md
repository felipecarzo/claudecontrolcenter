# HANDOFF

**Sessão:** 2026-08-17 · Claude (Fable 5, sessão interativa `ff0d68b2`) ·
**VPS**, pelo celular via Remote Control · continuação direta de 16/08
**Último commit:** `c7d0b2c` — docs(routia): libera a rota remote-control
**Branch:** `backlog/cc-46-48-49-52-53-56-65`. Nada foi enviado ao remoto hoje:
ele não pediu, e a regra é não subir sem pedido.

O que aconteceu: [diario/2026-08-17.md](diario/2026-08-17.md). Ponteiro, não
relatório.

## O que muda para quem chega agora

**Duas sessões trabalharam neste repositório o dia inteiro, e funcionou.** A
peça que destravou foi a partilha por parte de arquivo: declare
`src/ui.html#nomeDaFuncao` na sua linha do quadro, e quem também declarou o
mesmo arquivo edita junto. Leia
[ROTAS-ATIVAS.md](ROTAS-ATIVAS.md) antes de tocar em código, como sempre, mas
agora sabendo que dividir arquivo é possível.

**O modo de trabalho pode vir da rota** (`🎚 <modo>` na linha), e as travas
agora obedecem ao modo: perfil que exige uma trava liga ela mesmo com o
interruptor global desligado. Se algo travar você e você não entender por quê,
olhe o modo do projeto antes de olhar o hook.

## Estado: 15 itens abertos, seis nasceram hoje

| Item | O que é | Espera |
|---|---|---|
| **CC-133** | a entrevista que conduz a definição de um projeto novo | executável |
| **CC-134** | registro do que os agentes conversaram entre si | executável |
| **CC-135** | o modo sugestivo tem que SUGERIR, não só travar | executável |
| **CC-136** | o padrão de trabalho dele vira trava, não só regra escrita | executável |
| **CC-137** | as 14 travas sem teste (19 de 33 provadas hoje) | executável |
| **CC-138** | prioridade e complexidade na planilha | **decisão dele**: quer declarar por tarefa? |
| **CC-124** | o comando `json` responde zero com ar de resposta completa | executável |
| **CC-129** | sessão avulsa na pasta pessoal (feito pela outra sessão) | conferir e fechar |
| **CC-101 a CC-107** | as sete frentes grandes | executáveis, cada uma em fatias |
| **CC-80** | visão estrutural | **decisão dele**, estudo pronto |
| **CC-08** | macOS | ambiente, não há Mac aqui |

## Próximo passo exato

`cc ideias` na próxima sessão, antes de qualquer coisa: ele pode ter falado algo
entre uma sessão e outra. Depois, o item de cima da fila.

Se for mexer em tela, **entre no perfil Designer** (`cc framework perfil
designer`): ele exige print nas duas larguras e cobra a forma que ele nomeou na
conferência. Foi a falta disso que custou o dia hoje.

## Arquivos a ler

- [diario/2026-08-17.md](diario/2026-08-17.md) — o dia, com o erro e as travas
- [ROADMAP.md](ROADMAP.md) — os 15 abertos, com as palavras dele em citação
- [produto/VISAO-FELIPE-17-08.md](produto/VISAO-FELIPE-17-08.md) — as ideias
  longas dele, na íntegra
- `src/framework.mjs` — modos, perfis e a trava de etapa
- `src/ideias.mjs` — o que ele falou e não virou item

## O que só ele resolve

1. **Os nomes dos papéis.** Designer, Modelagem de sistema, Scrum Master,
   Depurador (com Perito, Pesquisador e Revisor dentro). A primeira lista foi
   reprovada por ser rasa; esta ele não avaliou ainda.
2. **CC-138**: prioridade e complexidade por tarefa exigem que o agente declare
   as duas ao registrar. Vale perguntar se ele quer isso ou prefere estimado.
3. **CC-80**, parado desde 15/08 esperando ele escolher a forma.
4. **Enviar ao remoto**: dois commits locais esperando o pedido dele.
5. **A regra que liga dificuldade de tarefa a nível de decomposição.** Ele pediu
   em 17/08, pela sessão do `app_escritorio`, que o nível (júnior, pleno,
   sênior) apareça no nome do personagem no escritório. Duas armadilhas para
   quem pegar: **senioridade aqui não é autonomia, é granularidade** (sênior
   quebra a tarefa em partes menores, até linha a linha), e ele disse
   "independente do modelo" depois de ter escolhido o modelo como origem. O
   nível vem da dificuldade da tarefa; o modelo é só teto.
   Detalhe, falas dele e a regra extraída por exemplo estão em
   `app_escritorio/docs/produto/BACKLOG.md`, item B-009.
   **O que é decisão daqui:** o agente declarar o nível pelo mesmo canal por
   onde já reporta assunto e tarefas, em vez de o escritório abrir um caminho
   próprio de escrita. Toca o CC-138, que pergunta a mesma coisa por outro lado.

---

## 2026-08-19, fim da temporada na VPS

**Estado:** 24 commits nesta branch (`backlog/cc-46-48-49-52-53-56-65`) que o
PC ainda não tinha. Já enviados para o GitHub. Gate verde.

**Próximo passo exato, para quem abrir no PC:**

1. `git pull` nesta branch.
2. **Ler `docs/guias/PC-E-VPS.md` antes de mexer em código.** Ele lista as
   cinco coisas que parecem erro e não são, e o que cada uma evita.
3. `npm test`. Se falhar no Windows, registrar o que falhou antes de
   consertar: provavelmente é diferença real de sistema, não defeito.

**O que está em curso e não terminou:**

- **CC-156, o redesenho da tela.** Direção fechada com ele e escrita em
  `docs/produto/REDESENHO-TELA.md`. Primeira fatia no ar (as telas de ajuste
  saíram para uma gaveta atrás de "mais"). Faltam as três camadas maiores:
  projetos como cartões completos, backlog cruzando todos os projetos em
  tabela, e a fusão de ligar servidor com configurar ele.
- **CC-104, a integração PC mais VPS**, que é o que ele quer construir agora.
  A federação já funciona; falta o serviço do lado do Windows que empurra o
  pacote. A topologia é torta de um lado só, e isso decide o desenho: o PC
  alcança a VPS, a VPS nunca alcança o PC atrás do NAT.

**Decisões abertas, que só ele toma:** CC-80 (forma da tela de visão
estrutural) e CC-155 (mapa visual das avenidas).
