# A tela Agentes (atalho "Sessões" do menu), item por item

Lista feita em 27/09/2026, conferida na tela (foto em
`assets/feedback/260927/agentes-hoje-1536.png`). Mesmo método de
[[INICIO-BLOCOS]], [[PROJETOS-BLOCOS]] e [[DECISOES-BLOCOS]].

## 1. O topo da lista

Campo "filtrar por projeto, assunto ou frente", três jeitos de ver (cartão,
Trello, fila) e a contagem "131 de 131 agente(s)".

Medido: os 131 incluem as 112 consultas do simulador de cripto da pasta
pessoal do PC, que na Início viraram uma caixinha só.

**Decisão:** em aberto

## 2. As faixas

Esperando você, Trabalhando, Parados, Sem contato, cada uma com a contagem.

Medido: "Esperando você" diz 1, enquanto a tela Decisões e o sino dizem 4. A
Início passou a contar como decisão também a sessão ociosa em que o agente
disse algo; esta tela não.

**Decisão:** em aberto

## 3. A linha de cada sessão

Projeto, máquina, o PEDIDO dele ("↑ o que você pediu, o agente não resumiu"),
o estado e há quanto tempo.

Medido: a Início mostra o que o AGENTE disse por último (decisão do item 4 da
Início); esta tela ainda mostra o pedido dele.

**Decisão:** em aberto

## 4. O detalhe

Tocar numa sessão abre o detalhe dela, com o histórico do agente ("logs
detalhados", pelo subtítulo da tela).

**Decisão:** em aberto

## 5. O desenho

É o visual antigo: linhas sem o quadrado colorido, sem os cartões e a pílula de
estado que Início, Projetos e Decisões ganharam em 26/09.

**Decisão:** em aberto

## Decisão dele (27/09): "alinhar com a Início"

Uma decisão para a tela toda, no lugar dos 5 itens um a um.
- **Faixas:** quem está nas Decisões da Início fica em "Esperando você" aqui
  também, nos modos cartão e fila (uma função só, `agZona`). Medido: "Esperando
  você" foi de 1 para 4, o mesmo número do sino.
- **Linha:** mostra a última fala do agente ("↑ o que o agente disse por
  último"); sem fala, o pedido dele, como antes.
- **Consultas do simulador:** saem da lista nos três modos, contadas à parte:
  "19 sessão(ões) · +112 consultas na pasta pessoal, fora da lista".
- Os três jeitos de ver e o detalhe ficaram como estavam.

No caminho: a tela desenha na carga inicial antes da parte da Início existir
na página, e ler dela lançava "Cannot access 'C2' before initialization". A
leitura é protegida (`c2DadosSeguro`), e a tela repinta quando a leitura da
Início chega (medido: alinhada em ~7 s depois de abrir).
