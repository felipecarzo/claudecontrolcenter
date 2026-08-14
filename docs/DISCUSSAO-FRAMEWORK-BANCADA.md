---
tags: [produto, discussao]
tipo: ata
aberto: 2026-08-14
---

# Discussão: Framework de engenharia + Bancada

Pauta de decisão aberta em 14/08, a partir de dois gatilhos: o documento
`BANCADA__Framework_de_testes_do_Cockpit.md` que o Felipe trouxe (upload,
provavelmente escrito por outra sessão/máquina), e um pedido novo dele no meio
da conversa: introduzir no próprio framework um mecanismo de perguntas com
opções, o mesmo que este chat já usa.

**Formato:** cada ponto tem o que está em aberto, minha leitura de por que
importa, e um espaço "Decidido" que fica vazio até ele responder. Resolvido
sai daqui e migra pro `FRAMEWORK.md`, pro `BANCADA.md` novo, ou vira item do
ROADMAP — nunca fica órfão neste arquivo.

---

## Bloco 1 — O sistema de perguntas dentro do framework (pedido dele, hoje)

Palavras dele: "introduzir esse sistema de perguntas no framework que obriga a
IA a me perguntar coisas ou aceitar sugestões extras ou selecionar coisas como
tecnologias, stacks ou recursos. isso é bom pq se encaixa perfeitamente no
conceito de network".

### 1.1 — Isso é a entrevista inicial, ou é mais amplo?

O `FRAMEWORK.md` já tem, na seção "Próximo passo", a ideia da entrevista
inicial ("o que é o projeto") como a peça que falta para o gate deixar de só
recusar e passar a **conduzir**. Esse pedido de hoje é essa mesma peça, ou é
algo maior: qualquer momento do ciclo (não só o início) pode pausar e
perguntar — por exemplo no meio da execução, ao escolher uma stack, ao
decidir uma camada da Bancada?

**Decidido, 14/08: qualquer momento.** A entrevista inicial é só o primeiro
uso do mecanismo, não o limite dele.

### 1.2 — Catálogo fixo ou a IA decide na hora?

Tensão real com uma regra que o próprio framework já tem: **o gate é
mecânico, nunca julgamento de IA** (é a lição do risco 1, os 545 testes
verdes com a tela quebrada). Duas formas de construir isso, e são
diferentes:

- **Catálogo, como dado.** As perguntas e as opções de cada uma são
  declaradas em arquivo, no molde do `hooksCatalogo.mjs` e do
  `bancadaCatalogo.mjs` do documento novo. Determinístico, testável, mas
  alguém tem que escrever cada pergunta com antecedência.
- **A IA gera a pergunta e as opções na hora**, olhando o projeto. Mais
  flexível — cobre qualquer situação sem catálogo prévio — mas é julgamento
  de IA numa camada que hoje é só dado, e falha do mesmo jeito que falharia
  em qualquer outra decisão de IA: parecendo certo sem estar.

Provavelmente as duas convivem (catálogo para o que se repete — stack,
método —, IA para o que é específico do momento), mas vale a decisão
explícita de qual é o padrão e qual é a exceção.

**Decidido, 14/08: as duas coisas, cada uma no seu lugar.** Catálogo para o
que se repete entre projetos (stack, método, tipo de camada de teste), a IA
gera a pergunta só para a decisão específica daquele momento.

### 1.3 — "Se encaixa no conceito de network": o que isso quer dizer?

Não quero adivinhar essa palavra errado (é a regra 2 do ciclo: a segunda vez
que uma palavra aparece carregando peso, desambiguar antes de agir). Quatro
leituras possíveis, para ele escolher ou corrigir:

(a) As perguntas e respostas viajam entre as máquinas pela federação que
    construímos hoje — uma pergunta feita na VPS pode ser respondida do PC,
    ou vice-versa.
(b) É uma rede de decisões: cada resposta vira um nó que perguntas futuras
    podem consultar, tipo grafo de conhecimento do projeto, não perguntas
    soltas e sem memória entre si.
(c) É sobre vários agentes na mesma rede de trabalho, repassando ou
    delegando perguntas entre si.
(d) Outra coisa.

**Decidido, 14/08: as três primeiras (a, b, c), palavra dele — "os 3
conceitos são bem legais".** Não escolheu uma, ele quer as três juntas:
pergunta viaja entre máquinas, respostas viram nó de uma rede de decisões com
memória, e serve para agentes repassarem decisão entre si. Isto é maior do
que uma peça isolada do framework — é arquitetura de dado compartilhado, e
entra no design como tal, não como detalhe de implementação da entrevista
inicial.

### 1.4 — Próximo passo pro sistema de perguntas em rede

Ambição grande decidida em 1.3 (viaja entre máquinas + memória entre
decisões + agentes repassando entre si). Perguntei se paramos tudo pra
desenhar isso agora, ou se registra como visão e termina o que já estava
decidido primeiro.

**Decidido, 14/08: registra como visão, termina o resto primeiro.** Não
implementar ainda. Vira frente própria no ROADMAP quando chegar a vez —
depois de Framework (gate de MVP, já em produção neste projeto) e Bancada
(a construir).

---

## Bloco 2 — A Bancada

### 2.1 — Vira gate do framework, ou fica independente?

O framework de MVP (`framework.mjs`) já bloqueia código sem definição de
pronto. A Bancada poderia ser mais um portão: por exemplo, não deixar
"pronto" fechar sem passar pela camada de segredo (Gitleaks). Ou os dois
ficam desacoplados — a Bancada é botão que qualquer um aperta, sem relação
com a fase do framework.

**Decidido, 14/08: vira gate do framework.** Não deixar "pronto" fechar sem
passar pelo menos pela camada de segredo. As duas frentes de hoje se juntam:
o framework não é só sobre definir escopo, é sobre garantir que o que foi
escrito não vaza dado.

### 2.2 — Confirma a ordem de implementação do documento?

Etapa 1 (runner + CVE Lite + Gitleaks + unit) → Etapa 2 (instalar/desinstalar
com Playwright) → Etapa 3 (sondas de dado: RLS, `service_role`, zona
restrita) → Etapa 4 (Sandyaa) → Etapa 5 (resto do catálogo). O documento já
argumenta por essa ordem (prova o barato antes do que escreve em projeto
alheio, e o caro só depois).

**Decidido, por mim, sem perguntar** ([[feedback_decisao_tecnica_e_minha]]:
escolha de ordem/ferramenta é minha, testo e sigo): mantenho a ordem do
documento. A justificativa dela é sólida e não achei razão técnica pra mudar.

### 2.3 — Onde fica o botão de disparo?

O documento original deixou isso "adiado, de propósito": aba nova, dentro da
aba `remoto`, ou disparado pela sessão `claude --remote-control` do celular.

**Decidido, 14/08: aba nova, só dela.** "bancada" no menu, ao lado de
tempo/preço/servidores.

### 2.4 — O risco do systemd matando processo filho no restart

Medido em 14/08, duas vezes, com o Pixel Agents: reiniciar o `agent-cockpit`
mata o cgroup inteiro, e qualquer processo filho (`detached` ou não) morre
junto. A Bancada terá exatamente esse problema com corridas longas
(Sandyaa pode levar horas). Conserto de raiz é `KillMode=process` no unit do
systemd, que exige root.

**Decidido, 14/08: registrar e deixar pra depois.** Não bloqueia nada hoje —
o botão de religar já resolve na prática. Mexer em unit do systemd com sudo é
melhor feito com calma, fora de uma sessão de decisão de produto.

---

## Bloco 3 — A síntese do framework (parte 1 do documento enviado)

### 3.1 — UML/MER: corrigir a redação ou descartar o trecho?

A seção 1.2 do documento diz que "o agente força a definição dos padrões
estruturais através da geração guiada de documentação UML/MER" — isso
contradiz a correção que você fez hoje mais cedo ("não vamos ser restritos
ao Scrum, MER, UML etcétera"). A própria Matriz de Riscos do mesmo documento
já tem a versão mais próxima do que você decidiu ("a IA deve sugerir
modelagem apenas ao detectar tarefas complexas ou ambíguas, dispensando em
edição rotineira"). Ajusto a seção 1.2 para bater com essa segunda versão,
ou descarto o trecho inteiro?

**Decidido, por mim, sem perguntar** (a resposta do bloco 3.2 acima já
resolve o princípio geral): a redação "o agente força a definição dos
padrões" não fica. Nenhuma ferramenta é forçada por padrão — a decisão de
quando usar UML/MER, como qualquer outra ferramenta, é minha, testada,
registrada como candidata na fase de Definição do framework junto com o
resto do que aquele projeto vai usar. A frase da própria Matriz do documento
("sugerir apenas ao detectar tarefas complexas ou ambíguas") sobrevive como
um caso de uso, não como regra fixa.

### 3.2 — As quatro propostas de incremento: o que entra no backlog?

Detecção de Drift Arquitetural, Presets de Stack ("`cc stack apply`"),
Wizard Design-First com Mermaid.js, Painel de Telemetria de bloqueios. Nenhuma
foi decidida ainda, são ideias soltas do documento.

**Resposta dele, 14/08, correção de fundo — não é sobre estas quatro, é sobre
como decidir qualquer uma delas dali pra frente.** Registro quase completo,
porque a força está nas palavras dele (ver memória
[[feedback_decisao_tecnica_e_minha]] pra a versão condensada e o "como
aplicar"):

> "eu falei antes que não precisava de MER e UML, e falei mais antes ainda
> que precisa. O ponto chave aqui é que isso tudo é ferramenta. E a minha
> dúvida é: como usar qualquer ferramenta e como ela poderia melhorar o nosso
> processo, mas sinceramente quem pode testar e me dizer o que funciona e o
> que não funciona é unicamente você como IA. Pq no fim, tudo isso que você
> produzir e todos os gatilhos são pra criar conexões de segurança entre
> todas e cada etapa do desenvolvimento de um projeto do zero à entrega, e a
> melhor forma de saber quais ferramentas a gente vai usar pra garantir a
> integridade e segurança das etapas é você. A única coisa que é essencial
> pra mim é que as suas decisões sejam revisadas e testadas e que gerem
> ruídos, esses ruídos não precisam estar na linguagem natural, pode ser o
> mais rápido leve e fácil possível pra você, pq a ideia do cockpit é pegar
> esse ruído e traduzir pra mim, e criar uma forma do meu cérebro controlar
> você como uma máquina de produção, ao invés de ficarmos discutindo prosa.
> Teremos nossos momentos de debate assim como profissionais que trabalham
> juntos param pra tomar café, mas o foco é no mouse e poucas teclas resolver
> problemas complexos de forma rápida, e só parar o trabalho pra discutir
> coisas que só juntos poderíamos resolver, e que o framework JÁ teria isso
> definido desde o início do projeto na definição de pronto."
> (última frase corrigida por ele logo em seguida — o erro de ditado era
> "não teria", o certo é "já teria")

**Consequências de design, que eu extraio e registro, não pergunto:**

1. **Escolha de ferramenta (UML sim/não, Mermaid sim/não, qual scanner) é
   minha, testada empiricamente, não decisão prévia dele.** As quatro
   propostas ficam TODAS como candidatas no meu arsenal — nenhuma é
   descartada nem aprovada de antemão. Uso quando o teste mostrar que ajuda,
   deixo de usar quando não ajudar.
2. **Toda decisão minha precisa gerar rastro, mas o rastro não é prosa.**
   Log estruturado, campo de estado, linha de ROADMAP — o mesmo padrão dos
   selos e resumos de uma frase que o painel já usa. O cockpit traduz; eu não
   narro.
3. **A escolha de QUAIS ferramentas/camadas um projeto específico vai usar
   entra na fase de Definição do framework, junto do MVP** — não é decisão
   solta que aparece no meio da execução. "O framework já teria isso
   definido desde o início do projeto na definição de pronto." Isto é peça
   nova pro `framework.mjs`: o campo `mvp` provavelmente ganha um
   `camadas: []` ou equivalente, decidido no mesmo momento que nome e
   critérios.
4. Pergunta com opções continua existindo, mas só pra decisão de rumo — o
   que "só juntos poderíamos resolver". As quatro perguntas do Bloco 1 e a
   2.1 eram desse tipo; esta pergunta sobre as quatro propostas técnicas não
   era, e foi a correção dele nisso que gerou toda esta seção.

---

## Bloco 4 — Onde tudo isso é salvo

### 4.1 — A Bancada vira `docs/produto/BANCADA.md`?

O próprio documento já aponta esse destino.

**Decidido, por mim, sem perguntar:** sim, confirma o que já estava no
documento. Sem razão pra mudar.

### 4.2 — A síntese corrigida do framework entra no `FRAMEWORK.md` já existente?

Ou fica em documento separado, para não misturar a visão original (as tuas
palavras, ditadas) com uma reformulação de outra sessão?

**Decidido, por mim, sem perguntar:** entra no `FRAMEWORK.md` existente, numa
seção nova, sem misturar com as citações originais dele. O `FRAMEWORK.md` já
tem essa convenção — visão dele em bloco de citação, minhas
extrações/decisões em prosa normal — e a síntese de hoje segue o mesmo
molde.
