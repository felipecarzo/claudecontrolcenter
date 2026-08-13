# O ciclo Felipe → IA → Felipe

Framework de colaboração calibrado pra uma cabeça específica: a do Felipe.
Não é teoria de produtividade. Cada regra aqui saiu de evidência medida no
histórico real de trabalho, e traz o número que a sustenta.

**Base**: 235 mensagens que ele digitou, extraídas dos transcritos de 5
sessões recentes (maurice 72 · pierre 71 · carzo 41 · inovallbond 31 ·
controlcenter 20), janela de 11/08 15h39 a 13/08 04h40. Mais 43 pastas de
memória, 7 diários e ~60 armadilhas já registradas.

---

## Os números que enquadram tudo

| Medida | Valor | O que significa |
|---|---|---|
| Mensagens seguidas que trocam de projeto | **67%** (158 de 234) | Ele quase nunca manda duas seguidas no mesmo lugar. Paralelismo é o estado normal, não exceção |
| Janela de atenção por projeto | **~10 min** (mediana por projeto: 8 a 20 min) | Entrega que demora mais que isso o encontra em outro projeto |
| Tamanho das mensagens | **bimodal**: 17% até 25 caracteres, 18% acima de 500 | Dois modos de operação distintos, não uma escala |
| Mensagens com pergunta | **32%** (75 de 235) | Ele pergunta muito, e quase nunca sobre sintaxe |
| Interrupções do agente | **2 em 235** | Ele não interrompe a IA. Ele interrompe a si mesmo |

---

## Padrão 1 — O loop quebra quando alguém desambigua um substantivo

**O achado de maior retorno de toda a análise.**

Três sagas longas, em três projetos, com o mesmo esqueleto: pedido descrito
com riqueza → agente entrega outra coisa → repetição → frustração curta →
troca de modelo → e a quebra vem quando **uma palavra é desambiguada**, não
quando alguém tenta uma implementação nova.

- **`pierre`, a nuvem — 1h39, 11 mensagens.** Termina com ele mesmo achando a
  causa: *"por algum motivo você não conseguiu compreender que eu falei que as
  nuvens são flutuantes ao cenário, e são parte do CHÃO, da camada CHÃO, e não
  CÉU"*, seguido de *"quando eu falo nuvem me refiro a esse objeto isolado do
  fundo do céu"*. A implementação nunca foi o problema: "nuvem" significava
  coisas diferentes nas duas cabeças.
- **`maurice`, o contorno do rosto — ~2h**, mesmo esqueleto.
- **`carzo`, a densidade do MNZS — ~5h**, mesmo esqueleto.

**Protocolo que sai disso:** na **segunda** vez que ele repetir o mesmo
pedido, parar de escrever código e perguntar o que a palavra significa. *"A
nuvem é objeto da camada chão ou pintura do céu?"* Três das quatro sagas
teriam morrido em uma mensagem.

Isso já tem irmão registrado no `inovallbond`
(`feedback_repetir_mecanica_antes_de_codar`, 13/08): quatro rodadas erradas
porque a premissa estava errada, e a lição foi *"nenhuma medição corrige uma
premissa errada"*.

---

## Padrão 2 — Ele nunca reclama sem prova, e não confia em relatório

**28 mensagens** trazem print, URL ou pedem para olhar. 25 usam imperativo
visual (olha / observe / analisa / veja).

- *"olha como fica. as partes de dentro não sumiram. **a solução é diferente
  da que você tá tomando**"* (`maurice`)
- *"em aba normal ou anônima continua sem mudanças substanciais"* (`carzo`)
- *"Pode fazer, daí sobe um túnel. E aí nesse túnel eu confiro no telefone."*

**Protocolo:** relatar "feito" sem prova visual é o gatilho nº 1 de retrabalho.
Entregar já com a imagem/URL encurta o ciclo em uma volta inteira. Se não deu
pra verificar, dizer isso com todas as letras em vez de descrever a intenção
como se fosse resultado.

Esse é o erro mais repetido de todos: gerou memória em três projetos
diferentes (`ghoscode`, `inovallbond` e `controlcenter`) e **mesmo assim não
está no CLAUDE.md global** — por isso ele se repete.

Sobre a janela de tempo: as memórias vão de **2026-03-01 a 2026-08-13**, ou
seja, cerca de **5 meses** de uso. (Uma versão anterior deste documento dizia
"3 anos", número que veio de um agente de pesquisa e foi repetido sem
conferência. O Felipe pegou o erro. Verificado pela data dos arquivos.)

---

## Padrão 3 — Quando ele nomeia o mecanismo, o mecanismo é o pedido

**12 mensagens acusatórias** em 3 projetos, sempre com a mesma construção: ele
pediu A, recebeu A' que a IA achou melhor.

- *"Eu não pedi pra serem bolinhas... Só que tinha que fazer exatamente o que
  eu pedi, **você alterou e fez bola**"* (`pierre`)
- *"eu pedi p usar linhas e não usar bolinhas. **Você simplesmente dobrou a
  aposta** e colocou mais bolinhas ao invés de linhas"* (`pierre`)
- *"**Você ignorou completamente o que eu falei**... você pegou a apresentação
  inteira anterior, trocou algumas coisas, sendo que eu pedi pra refazer"*
  (`inovallbond`)
- *"Você não colocou levemente o amarelo, **você botou tudo amarelo**"*

**Protocolo:** substituir a abordagem que ele nomeou por uma "melhor" é o erro
que ele mais reclama. Se a abordagem parecer errada, dizer isso **antes** de
trocar, não entregar a troca como fato consumado.

---

## Padrão 4 — Visão e execução são dois modos, com marcador léxico objetivo

**Execução** (curto, imperativo): *"engrosse mais, vamos testar"* · *"faz
deploy"* · *"sobe dev server"* · *"commit"*. Aqui a resposta certa é **executar
e calar**. Perguntar "quer que eu confirme antes?" numa mensagem de 15
caracteres é ruído.

**Visão** (acima de 400 caracteres, abre com gatilho): *"e se"*, *"tive uma
ideia"*, *"me deu uma ideia"*, *"proponho"*, *"poderíamos"*.

- *"**Poxa, tive uma ideia.** A gente tem um site chamado barra..."* (`pierre`)
- *"**Você me deu uma ideia**, e se a gente ao invés de usar um projetor,
  colar alguns adesivos no rosto da pessoa?"* (`maurice`)

**E ele diz o que quer que aconteça com a visão:** *"anote isso tudo antes de
considerar e organizar"* e *"salva um backlog sobre isso, e vamos voltar pra
questão anterior"*.

**Protocolo:** mensagem longa que abre com gatilho de visão = **registrar e
devolver organizado, não implementar**. Implementar visão como tarefa foi o
que produziu uma página inteira jogada fora no `carzo`.

---

## Padrão 5 — Ele interrompe a si mesmo, e a segunda mensagem substitui a primeira

Só **2 interrupções** em 235 mensagens, e as duas com a mesma assinatura: ele
manda, interrompe em menos de 2 segundos, e reenvia a versão completa poucos
minutos depois.

- `carzo` 12h29:58 manda → interrompe em 2s → 12h31:59 reenvia a mesma frase
  **mais** a mudança conceitual inteira
- `carzo` 01h37 cola 4 links → interrompe em 0,7s → 01h41 reenvia **10 links,
  cada um comentado**

**Protocolo:** se ele reenviar em menos de 5 minutos, a segunda mensagem
**substitui** a primeira, não soma. E vale esperar alguns segundos antes de
disparar trabalho pesado num pedido curto: ele frequentemente ainda está
formulando.

---

## Padrão 6 — Rajada é sinal binário

**10 rajadas** (3+ mensagens em menos de 6 minutos), com exatamente dois
contextos:

- **Correção travada (6 de 10):** *"cade a nuvem????"* às 02h49, *"não tem
  nenhum nuvem aqui"* às 02h55. Significa: **o último entregável não mudou
  nada visível**. Parar de codar, instrumentar (a ideia dele: *"coloque a nuvem
  vermelha, assim eu vejo melhor"* resolveu numa rodada o que três rodadas de
  medição não resolveram).
- **Entusiasmo de visão (4 de 10):** ir de uma pergunta solta ao desenho de um
  framework inteiro em 8 minutos. Significa: **parar de codar e anotar**.

Não existe rajada por travamento técnico. Quando trava, ele muda de projeto e
volta depois.

---

## Padrão 7 — Ele fala curto de propósito, e ditado por voz

**Brevidade é estratégia, não desleixo.** Dito por ele:

> *"eu sou analista de sistemas e sei tranquilamente configurar um server, mas
> eu sei também que às vezes se eu falar de um jeito rápido e curto você
> entende. eu comecei a entender as suas limitações e a entender que às vezes
> explicar demais é perda de tempo"*

**43 mensagens** (18%) são visão ditada por voz, reconhecíveis pelos erros
fonéticos: "o queijo tá desangulado" (queixo), "envorteses" (vórtices),
"nivem"/"nuvel" (nuvem), "o meu ouro vê" (o meu olho vê), "trações"
(travessões), "Menede"/"meeneses" (MNZS).

**Termo técnico aparece em 38 mensagens, mas quase todo de infra e processo**
(deploy, commit, branch, cache, hook). Praticamente nenhum de implementação:
ele nunca pediu "muda o alpha" ou "aumenta o blur radius". Ele pede
*"engrosse"*, *"a tinta se dilui na água"*, *"que não acaba abruptamente"*.

**Metáfora física é a unidade de especificação dele** (32 mensagens): *"como um
vídeo de oito bits contra um de doze bits"*, *"gordo, quase tátil"*, *"um filtro
no quadro, não um filtro na tela"*, *"a foto não é o limite do mundo"*.

**Protocolo:** normalizar o ditado antes de interpretar. E o formato técnico
que ele pediu literalmente é o único aceito:
> *"ao invés de falar 'border = 10' fale 'o valor numérico do parâmetro de
> borda está com o valor 10 (border = 10 de 0 a 100)'. vamos programar em
> agnostic"*

---

## Padrão 8 — O que ele pergunta (e o que nunca pergunta)

Seis tipos, por volume: **viabilidade física/técnica** (17 msgs, o maior
grupo) · estado e verificação · **explicação didática com bloqueio de
execução** (*"não execute, me explique"*) · risco e segurança · validação de
ideia dele · meta, sobre o próprio processo.

**Ele nunca pergunta sintaxe, API ou "como escrevo isso". Zero ocorrências.**
Ele pergunta se o mundo permite, não como o código faz.

E rejeita solução tecnicamente correta mas logisticamente impossível, em uma
mensagem: *"impossível eu fotografar 40-50 fotos de um cliente pra avaliar"* ·
*"colocar talco no rosto dos pacientes, nunca que isso seria viável"*.

---

## Padrão 9 — Reversibilidade antes do risco, sempre

*"quero refazer o design do site todo em uma nova branch pra gente não perder o
atual"* · *"vamos testar isso primeiro em uma página backup"* · *"podemos salvar
esse como um marco"* · *"crie uma página teste"*.

Ele nunca reclamou de trabalho jogado fora **quando havia marco salvo**.
Reclamou quando não havia.

---

## Padrão 10 — Quando ele nomeia, virou ativo

*"a gente tem que criar um nome pra essa tecnologia porque eu acho que vai ser
algo inventado nosso, e que aí eu vou ter que registrar isso tudo"* · *"vamos
programar em agnostic (vou criar essa linguagem eim)"* · *"índice maurice"*.

**Protocolo:** quando ele batiza algo, o assunto saiu de tarefa e entrou em
ativo de produto. Tratar como coisa a documentar e proteger, não como
implementação.

---

## O diagnóstico incômodo

Em **todas** as armadilhas nascidas de reclamação dele, o padrão é o mesmo:

> **A IA estava tecnicamente correta e humanamente errada.**

O texto do cartão estava certo, o campo `done` existia mesmo, o contraste era
mensurável, a subtração de custo fechava aritmeticamente. O que falhava era o
**significado para quem olha de relance sem o contexto carregado**.

E o problema hoje **não é falta de regra — é excesso de regra dispersa**:
4 seções OBRIGATÓRIO no CLAUDE.md global, ~30 memórias comportamentais
espalhadas por 15 projetos, ~60 armadilhas técnicas. Sem índice, sem
hierarquia, com contradições convivendo sem desempate.

### As regras de maior retorno estão presas no lugar errado

| Regra | Retorno medido | Onde vive hoje |
|---|---|---|
| Verificação visual obrigatória | erro mais repetido: 3 projetos, em ~5 meses de uso | memória de projeto, **não no global** |
| Repetir a mecânica antes de codar | 4 rodadas evitadas por 1 frase | preso no `inovallbond`, 2 dias de idade |
| Backlog de tudo que ele fala | perdeu spec inteira sem isso | `inovallbond` + `productVideoMaker`, não no global |
| Medir antes de agir na hipótese dele | evitou piorar o produto 2x no mesmo dia | preso no `renanMarchon` |
| Perfil cognitivo completo | — | mora em `ntz-48` e no vault, **projetos que ele não abre pra trabalhar** |

### Seis contradições que precisam de desempate (decisão dele)

1. **"Nunca pular Tester"** (regra absoluta no global) **contra a prática**: os
   diários do próprio Control Center dizem "sem Tester nem Revisor formais". O
   pipeline formal não roda no projeto pessoal, e nunca foi cobrado.
2. **"Respostas curtas, sem filler"** contra **"explicar sempre com
   profundidade, não economizar contexto"** (memória do market-tracker). As
   duas estão escritas, sem regra de desempate.
3. **"Apresentar opções com tradeoffs"** contra **"não ficar apresentando
   tradeoffs do que ele já decidiu"** (ghoscode). Falta o discriminador:
   decisão nova pede tradeoff, decisão tomada pede execução.
4. **`Co-Authored-By`**: regra absoluta proíbe, mas o `- projeto_template`
   manda usar. Todo projeto novo nasce violando o global.
5. **O template está desatualizado**: descreve `docs/essential/`, `docs/daily/`,
   estrutura que não é mais a dele. E o `CLAUDE.md` dele é o do `app_ayvu`
   inteiro, com placeholders só parcialmente aplicados.
6. **"Nunca commitar sem pedir"** tem três exceções funcionando (`/ceo`,
   `/fecha`, `/autopilot`) que não estão catalogadas ao lado da regra.

---

## Lacunas: preferência forte que nunca foi escrita

- **Voz é o canal primário dele** (perfil: voz primeiro, texto por último), e
  não existe nenhuma regra sobre o que fazer com uma leva de pedidos por áudio.
- **Nada escrito sobre o relatório final** que ele lê — apesar da memória dizer
  explicitamente "vale também para relatório em conversa, não só para tela".
- **Nada sobre o que ele considera sessão bem sucedida**, além de "entregue e
  commitado".
- **Nenhuma evidência de que o Step 0 anti-alucinação seja executado**: os
  diários não registram, e não há hook que force.

---

## O que fazer com isso

O backlog está no `ROADMAP.md`, frente "Ciclo Felipe → IA". A ordem segue o
critério do [[COCKPIT]]: **isso me faz voltar ao contexto mais rápido, ou
economiza uma volta do ciclo?**

Regra de ouro deste documento: **nenhuma regra entra aqui sem evidência
medida**. Se não houve um caso real que a justifique, é palpite — e palpite
vira a burocracia que se desliga na terceira semana.
