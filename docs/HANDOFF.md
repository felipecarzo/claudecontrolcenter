# HANDOFF

**Sessão:** 2026-08-19 · Claude (Sonnet 5, sessão interativa `a4452c23`) ·
**VPS**, pelo celular via Remote Control · continuação direta de 18/08
**Último commit:** `537b0dd`, docs: o que a sessão do PC não pode desfazer
**Branch:** `backlog/cc-46-48-49-52-53-56-65`, **enviada ao GitHub**. 25 commits
à frente do que o PC tem.

O que aconteceu: [diario/2026-08-19.md](diario/2026-08-19.md). Ponteiro, não
relatório.

## ⚠️ Se você está no PC, leia isto primeiro

Ele vai abrir este projeto no PC para construir a integração entre as duas
máquinas. **Seis dias de trabalho aconteceram só na VPS**, e vários commits
consertam coisa que só acontece lá. Cada um parece código defensivo demais
para quem chega de fora, e desfazer volta o defeito sem erro na tela.

**[guias/PC-E-VPS.md](guias/PC-E-VPS.md) lista os cinco**, com o que cada um
evita e como conferir no Windows antes de encostar. Leia antes de mexer em
código, não depois.

## O que muda para quem chega agora

**Sessão que não consegue gravar na pasta de configuração agora tem um abrigo.**
Dentro do sandbox, `~/.claude` fica somente leitura, e sem isso nenhuma sessão
aparecia no painel, sem erro nenhum. Se você mexer em `metaSessao.mjs`, o
caminho alternativo não é remendo: é o que mantém a VPS visível.

**Falha de rede na tela agora avisa, em vez de sumir.** Quatro pontos. O mais
importante é a lista de projetos: ela dizia "nenhum projeto encontrado nesta
máquina" quando na verdade não tinha conseguido perguntar.

**A partilha por parte de arquivo continua valendo**: declare
`src/ui.html#nomeDaFuncao` na sua linha do quadro, e quem também declarou o
mesmo arquivo edita junto. Leia [ROTAS-ATIVAS.md](ROTAS-ATIVAS.md) antes de
tocar em código.

## Estado: nada executável em aberto, uma frente em curso

| Item | O que é | Espera |
|---|---|---|
| **CC-156** | o redesenho da tela | **em curso**, direção fechada, 1 de 4 camadas no ar |
| **CC-104** | integração PC mais VPS | **é o que ele quer construir agora** |
| **CC-155** | mapa visual das avenidas | **decisão dele**: onde a tela mora, quanto cabe no celular |
| **CC-80** | visão estrutural | **decisão dele**, estudo pronto desde 15/08 |
| **CC-08** | macOS | ambiente, não há Mac aqui |
| **CC-102/103/105/106/107** | as frentes grandes | executáveis, cada uma em fatias |

Fechados hoje: CC-138 (decidido), CC-140, CC-101, CC-154, CC-157, CC-158.

## Próximo passo exato

**No PC**, nesta ordem:

1. `git pull` nesta branch.
2. **Ler [guias/PC-E-VPS.md](guias/PC-E-VPS.md)** antes de tocar em código.
3. `npm test`. Se falhar no Windows, **registrar o que falhou antes de
   consertar**: provavelmente é diferença real de sistema operacional, e essa
   informação vale para a integração que ele quer construir.
4. `cc json`. Se responder `total: 0` com agentes rodando, é o CC-124 de novo,
   e a causa é sempre a mesma: uma das duas fontes de agente não está sendo
   lida.

**Se for mexer em tela**, entre no perfil Designer (`cc framework perfil
designer`): ele exige print nas duas larguras e cobra a forma que ele nomeou.

## Arquivos a ler

- [guias/PC-E-VPS.md](guias/PC-E-VPS.md), o que não desfazer, e por quê
- [diario/2026-08-19.md](diario/2026-08-19.md), o dia inteiro
- [produto/REDESENHO-TELA.md](produto/REDESENHO-TELA.md), a direção do CC-156,
  fechada com ele em duas rodadas de pergunta
- [ROADMAP.md](ROADMAP.md), com as palavras dele em citação
- `PRODUCT.md` na raiz, o contexto de produto capturado em 19/08
- `src/metaSessao.mjs`, a casa e o abrigo

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

## O que está em curso e não terminou

- **CC-156, o redesenho da tela.** Direção fechada com ele em duas rodadas de
  pergunta, escrita em [produto/REDESENHO-TELA.md](produto/REDESENHO-TELA.md).
  Primeira fatia no ar (as telas de ajuste saíram para uma gaveta atrás de
  "mais"). Faltam as três camadas maiores: projetos como cartões completos,
  backlog cruzando todos os projetos em tabela, e a fusão de ligar servidor
  com configurar ele.
- **CC-104, a integração PC mais VPS**, que é o que ele quer construir agora.
  A federação já funciona; falta o serviço do lado do Windows que empurra o
  pacote. **A topologia é torta de um lado só, e isso decide o desenho:** o PC
  alcança a VPS, a VPS nunca alcança o PC atrás do NAT. Qualquer desenho que
  ignore isso não sai do papel.
