---
tags: [produto, visao]
tipo: visao
atualizado: 2026-08-25
estado: registrada, não implementar
---

# Central e Projetos viram uma tela só

Proposta dele em 25/08, no telefone, depois de eu mostrar que a gaveta "sem
sessão aberta" que eu tinha acabado de criar na Central era quase uma cópia da
lista do bloco Remoto. **Registrada, não planejada e não implementada** (regra 4
do ciclo). Este arquivo existe para a sessão que for fazer começar do que ele
disse, não do que alguém lembrou que ele disse.

## O pedido, na frase dele

> "temos uma aba 'projetos' já temos o que seria uma boa adição pra misturar com
> central, talvez possamos juntar ambas... no topo um filtro, depois as sessões
> ligadas e depois as outras; as ligadas possuem as opções do framework ativadas
> ou nao e as outras não (porém a pessoa pode descolapsar um menu framework nas
> desativadas, caso queiram configurar o default de cada projeto ao ser ligado).
> Além disso todos os projetos tem ver tudo, pastas, abrir sessão claude code ou
> openroom etc"

E o alerta que ele deu junto, que muda o desenho:

> "temos que lembrar que temos as sessões do desktop também, e elas precisam ser
> separadas das da vps"

## O que já existe, e por isso a base é a aba Projetos

Medido em 25/08, antes de opinar. A aba Projetos **já tem as duas coisas que
faltam na Central**:

- **o filtro do topo** (`pj-ver`: só ativos, ou todos)
- **a separação por máquina**, em três grupos: os daqui, as pastas de trabalho
  que não são projeto (nascidas do *"que projeto é esse fatia0?"*), e os de
  outra máquina, sem pasta aqui

E a Central tem o que falta lá: o framework por projeto (estado, papel, modo,
fase, portão, módulos, entrevista) e os selos de git e de rota.

Então a fusão é a aba Projetos **recebendo** o framework, e não a Central
crescendo. Inverter isso significaria reescrever filtro e separação de máquina
que já funcionam.

## Não existe barreira técnica, e isso está medido

As três leituras que a tela fundida precisaria, cronometradas nesta VPS:

| leitura | custo |
|---|---|
| `/api/framework/projetos` | 0,42s |
| `/api/projetos` | 0,15s |
| `/api/remote-control` | 0,03s |

Somadas, 0,6s, e nenhuma delas entra no tique de 2 segundos. Não há motivo de
desempenho para manter o mesmo projeto em duas telas.

## As três decisões, e a que ele já tomou

### 1. O que "ligado" quer dizer — DECIDIDA em 25/08

A aba Projetos chama de ativo quem tem **agente, conversa ou sessão**. A Central
chama de ligado quem tem **sessão**. Duas contas para a mesma palavra na mesma
tela é o defeito que acabamos de consertar no framework, e não pode voltar.

**Escolha dele: ligado é ter sessão de agente no ar.** Conversa parada do
Coderoom não sobe o projeto para o topo.

### 2. Projeto de outra máquina não tem framework legível daqui

A Central lê o disco DESTA máquina. O cartão de um projeto do PC não tem como
oferecer os mesmos controles, e a regra deste painel é que **isso se diz na
tela**: nunca um controle desabilitado em silêncio, que é indistinguível de
defeito. Aberto: o cartão de fora mostra o estado do framework de lá (que a
federação já traz) ou só diz em que máquina configurar.

### 3. O tamanho do cartão

Hoje o cartão da Central tem doze controles e o da aba Projetos tem quatro.
Juntos passam de dezesseis, e no telefone dele isso é rolagem longa.

A ideia dele resolve metade: **nas desligadas o framework nasce colapsado**, e
serve para configurar como o projeto vai nascer quando for ligado. Falta decidir
o que aparece nas ligadas sem dobrar informação.

## Como fica a tela, na ordem dele

1. **filtro** no topo
2. **as ligadas** (sessão de agente no ar), com as opções do framework à mostra
3. **as outras**, com o framework colapsado, para configurar o padrão de quando
   ligar
4. **em todo cartão**, independente do estado: ver tudo, pastas, abrir sessão do
   Claude Code, abrir conversa do Coderoom
5. **a separação por máquina** continua, porque as sessões do desktop não podem
   se misturar com as da VPS

## O que sai de cena

O bloco Remoto deixa de listar os projetos desta máquina, e guarda só o que é
dele e não existe em outro lugar: as outras máquinas, a sessão avulsa na pasta
pessoal, e a sincronia entre as duas máquinas.

## Pendente antes de executar

O pedido anterior dele, de 25/08, ainda não fechado: o **"?" em cada opção**
(entrevista, comunicação, entrega, código, rotas, e cada modo do framework).
Ele mesmo deu o motivo, e ele vale mais na tela nova do que na atual:

> "eu quem criei e eu mesmo já esqueci o que é entrevista, comunicação, entrega,
> código, rotas, os tipos de framework etc"
