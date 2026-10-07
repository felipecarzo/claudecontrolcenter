# Jev: decisão de sim ou não barata, e como ter o mesmo papel sem ele

Estudo do CC-562, 07/10. O pedido dele era estudar o Jev para rodar o papel dele num
modelo barato ou no Gemini pelo AGY, e não no Claude.

## O que o Jev é

- **Quem fez:** a TypeSafe, lançado em setembro de 2026. Eles chamam de modelo "Sistema Um":
  decide rápido, sem escrever raciocínio.
- **O que responde:** uma pergunta de sim ou não sobre uma entrada. Devolve a **probabilidade
  de ser sim** (de 0 a 1) e o veredito. Não explica o porquê.
- **Preço:** cobra só a entrada, cerca de 0,04 dólar por milhão de tokens. Num teste público,
  1.000 vereditos custaram 0,012 dólar contra 2,22 dólares no Claude Sonnet.
- **Velocidade:** cerca de 0,4 segundo por pergunta.

## Onde acerta e onde erra (medido por terceiros)

| Tipo de pergunta | Jev | Juízes de texto (Sonnet, Flash-Lite) |
|---|---|---|
| sim ou não simples | 96% | 98% |
| tabela com várias regras juntas | 81% | acima de 90% |
| geral | 87% | 93% a 94% |

- **O achado que importa:** quando o Jev está muito seguro (probabilidade acima de 0,9 ou
  abaixo de 0,1), ele **não errou nenhuma** das 125 vezes. Os erros ficam perto de 0,5.
- **O uso certo, então, é em cascata:** o barato decide o que é claro, e só o duvidoso sobe
  para um modelo melhor. Assim chegaram a 93,7% de acerto mandando só 16% das perguntas ao
  Sonnet, a um sexto do custo.

## Como ter o mesmo papel com o que ele já paga

O Jev não roda aqui e cobra à parte. O papel dele (decidir rápido e barato, com grau de
certeza) dá para reproduzir com o **AGY no Gemini Flash**, que já está no plano Google dele:

1. **Pergunta fechada, resposta fechada:** pedir só JSON com `{ "sim": true|false, "certeza": 0 a 100 }`,
   nunca texto livre. É o que torna a resposta conferível pelo programa.
2. **Em lote:** cada chamada ao AGY custa cerca de 17,8 mil tokens fixos de entrada (medido em
   06/10). Uma pergunta por chamada desperdiça; 30 por chamada diluem o custo, como já fazem as
   explicações dos itens (CC-936).
3. **Cascata:** certeza acima de 90 ou abaixo de 10 vale como decidido. O resto sobe para o
   Claude, ou vira pergunta para ele.
4. **Medir antes de confiar:** guardar cada veredito com a resposta certa quando ela aparecer, e
   só baixar o limiar da cascata quando a conta mostrar acerto acima de 95% na faixa segura.

## Onde isso serve no painel hoje

- **Etiqueta da parada** (responder, testar, nada): o resumo do AGY já faz isso, mas sem certeza.
  Com certeza, uma parada duvidosa poderia aparecer marcada como "confira".
- **Auditoria das perguntas do arquiteto** (redundante, fora do backlog, repetida, técnica): hoje
  é regra de palavras. Um juiz de sim ou não em lote pegaria o que a regra não pega.
- **Conferência por olho:** "a foto mostra o app logado?" é sim ou não. Ainda precisa de imagem,
  que o AGY aceita.

## Decisão que fica com ele

Vale seguir? Se sim, o primeiro passo recomendado é o juiz em cascata na auditoria das perguntas
do arquiteto, porque já existe a regra para comparar e medir o acerto.

Fontes: [DEV Community, "We tried replacing our LLM judges with Jev"](https://dev.to/ialijr/we-tried-replacing-our-llm-judges-with-jev-1en7),
[Langfuse, Jev as a judge](https://langfuse.com/docs/evaluation/evaluation-methods/jev-as-a-judge),
[Emergent Mind, Jev vs LLMs as rubric judges](https://www.emergentmind.com/papers/2609.29769).
