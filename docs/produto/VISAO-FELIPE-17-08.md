---
tags: [produto, visao, fonte-primaria]
tipo: produto
atualizado: 2026-08-17
resumo: Quatro ideias dele, guardadas havia mais de dois dias, ditas antes de dormir em 17/08. Fonte primária, palavras inteiras.
---

# O que o Felipe guardava havia dois dias

Dito em 17/08, de madrugada, com este aviso: *"tô guardando algumas dessas
informações pra a mais de 2 dias e não falava pq não estávamos caminhando tão
rapidos nesse projeto já que eh um projeto muito complexo"*.

**Isto é fonte primária.** As palavras dele estão inteiras, e a leitura vem
separada. Cada bloco virou um item de backlog; este arquivo é o registro do
pensamento, que o item resume.

## 1. Sprint como etapa de um item do backlog

> "eu acho que a unidade Sprint é importante mas talvez não seja a exata
> definição do Scrum, pode ser algo de fora. exemplo: Sprint pode ser o período
> exato que define a implementação de uma etapa do backlog.
>
> exemplo:
> produto10 - criaçao da área de login
> produto10_sprint01 - criação das classes e estrutura da página"

**A leitura:** o sprint dele não é janela de tempo do time, é **fatia nomeada de
um item do produto**. `produto10_sprint01` diz de quem a fatia é só de olhar, e
resolve de graça os dois defeitos que a tela tem hoje: o código instável (`S1`
que muda quando outro fecha) e a falta de elo entre a tarefa e o item de
backlog.

## 2. A planilha do Routia, que já funcionava

> "o routia segue o modelo de backlog em .md que já era muito utilizado pela
> gente nos produtos, tipo uma planilha onde as tarefas eram separadas por
> backlogs estilo Scrum e cada Sprint era dividido em tarefas que eram definidas
> por mudanças em arquivos relevantes naquela Sprint e não só pela tarefa. Dessa
> forma conseguiamos definir qual tarefa mexia em quais arquivos e quais rotas
> de arquivos e funções, ativos e classes ele influenciaria, criando uma linha
> de informações cruzadas que serviam pros agentes definirem se podem mexer em
> uma rota ou não, nessa planilha eles colocavam também qual tarefa dependência
> de outra ou desbloqueava outra, o que parecia bem útil. o modo de visualizar
> era muito positivo pra mim, era um modo de visualização que se possível eu
> colocaria no cockpit, pq eu via as rotas com nomes e cores e isso agilizava o
> entendimento e o formato tabela é muito prático."

**A leitura:** a tarefa é definida **pelos arquivos que toca**, não só pelo
texto. Isso já existe pela metade no quadro de rotas (a rota reivindica arquivo
desde 16/08), mas a planilha dele ia além em três coisas que hoje não existem:

- função, classe e ativo, não só arquivo
- dependência e desbloqueio entre tarefas, escritos na própria linha
- **o formato tabela com nome e cor**, que é como ele lê rápido

## 3. Routia e framework como plugins do cockpit

> "o routia tá cada vez mais imerso no cockpit, talvez possamos adicionar o
> routia como parte do funcionamento do cockpit. como um plugin pro routia, que
> pode ser ligado e desligado, alias o framework, o routia etc podiam ser
> plugins"

**A leitura:** hoje o Routia mora em arquivos espalhados e o framework noutro
canto, e os dois já são operados de dentro do painel. Virar plugin quer dizer:
liga e desliga por projeto, aparece como módulo na tela, e o cockpit é a casa.

## 4. Framework por SESSÃO, não por projeto

> "eu quero poder separar os framework por sessão e não por projeto, quero
> poder ter uma sessão de frontend e uma de backend no mesmo projeto de formas
> seguras através do routia e usando a comunicação entre agentes e com modos
> diferentes como uma no restritivo e outra no sugestivo"

**A leitura:** o estado do framework hoje é um arquivo por projeto, então duas
sessões no mesmo projeto dividem o mesmo modo. O que ele quer é o modo por
sessão: o agente de frontend no restritivo executando a fila, o de backend no
sugestivo propondo, os dois no mesmo repositório, separados pelas rotas e
conversando pelos recados que já existem.

**O que já está pronto para isso:** a oficina por agente, a rota que reivindica
arquivo, e os recados. **O que falta:** o estado do framework deixar de ser um
por pasta.


## 4b. Pedido em lote nunca pode se perder (17/08, urgente)

Palavras dele, na íntegra:

> "qdo eu te peço mil coisas e voce pausa no meio eu não sei quanto você
> implementou e eu perco as ideias, precisamos que essas coisas fiquem mais
> bem escritas e definidas num lugar de fácil acesso urgente, isso vai mudar
> completamente a nossa dinâmica de trabalho"

O que isso define, em regras:

1. Mensagem dele com vários pedidos: CADA pedido vira item registrado (cartão
   ou backlog) ANTES de eu começar a executar qualquer um.
2. Toda pausa minha enumera os pedidos da conversa, um por linha, cada um com
   o estado: feito (com prova), em curso, ou na fila. Nenhum pode faltar.
3. O lugar de fácil acesso é o painel: sprint backlog para o que está em
   execução, product backlog para o que ficou na fila. O resumo do chat só
   aponta; a fonte é a tela.

Virou o CC-117.

## 5. Onde o valor mora, dito por ele

> "o framework é legal. mas na verdade o mais forte do cockpit eh o sistema de
> sprints e o fato de eu poder ligar e desligar o Claude na VPS e programar de
> qualquer lugar na VPS pelo telefone tipo agora. isso é incrível pq eu posso
> ativar o remote e desativar por ele"

**A leitura, corrigida por ele na hora:** eu tinha lido isto como diretriz de
prioridade, e ele desfez: *"não muda prioridade nada, é só pq isso já eh algo
legal que a gente faz antes mesmo do framework nascer"*. É apreço pelo que já
existe (sprints e o liga/desliga remoto pelo telefone), não ordem de
investimento. Fica registrado como o que ele valoriza no uso diário, e a
prioridade continua sendo a ordem do backlog.
