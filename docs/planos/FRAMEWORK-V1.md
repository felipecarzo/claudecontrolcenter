---
tags: [plano, framework]
tipo: plano
atualizado: 2026-08-18
estado: dezesseis das dezessete etapas no ar. Só falta F12 (filtro de confidencialidade local)
resumo: O caminho para o framework de engenharia sair de gate de MVP solto e virar sistema. Nasceu de um erro real, inofensivo, em que a IA implementou sem pedido durante uma conversa de conceito.
termos:
  modo diálogo: decidimos em prosa e a IA interpreta. É o fluxo de hoje
  modo imperativo: ele não digita, segue o backlog e autoriza por clique
  modo restritivo: agente com rota travada no Routia, sem prosa, só objetivo e revisão
  gate: hook que recusa a ferramenta com exit 2 e devolve o motivo pro modelo
  gate de perguntas: o AskUserQuestion, o mecanismo por trás dos modos
  fase: onde o projeto está no método (definição, execução), decide o que trava
  ferramentas do projeto: quais camadas de verificação aquele projeto usa, escolhido na Definição
  ponto de aprovação: o lugar minúsculo onde o humano decide, para o pronto não ser auto-avaliação
---

# Framework v1: análise conceitual e backlog

## O erro que originou este plano

Em 14/08, no meio de uma conversa que o Felipe abriu dizendo **"vamos discutir
isso ainda antes de implementar"**, eu implementei o glossário e a aba de
tarefas dele. Ninguém mandou construir. O que houve foi: ele descreveu dois
problemas, eu perguntei detalhes de formato, ele respondeu escolhendo, e eu
tratei resposta de design como ordem de execução.

Palavra dele ao perceber: *"cadê o hook pra impedir você de sair fazendo isso
sem eu pedir explicitamente? [...] esse glossário por exemplo foi um dos erros
(inofensivos) que mostram o problema do sistema hoje em dia"*.

**É a prova do próprio princípio do framework**, com o custo mais barato
possível: instrução escrita é sugestão, hook é regra. A instrução existia, era
recente, era explícita, e não segurou nada.

O que foi construído fica (ele decidiu: "podemos usar o que foi feito e
melhorar mais pra frente"). O que muda é o que vem depois.

## Análise conceitual: o que o framework é, depois de três rodadas

Fechado em 14/08 e registrado em [[../produto/FRAMEWORK]]. Em cinco linhas:

1. **É um modo, não um questionário.** Ligado num projeto, tudo que roda depois
   opera sob ele (`conda activate`). Desligado, a IA é a de sempre.
2. **O artefato é para a máquina.** O humano recebe o destilado pelo cockpit,
   porque ele não vai ler documento — foi medido, não suposto.
3. **O rigor mira a definição de pronto e a integridade do escopo**, nunca a
   cerimônia. Scrum, UML e MER são ferramenta, não obrigação.
4. **Escolha de ferramenta é da IA, testada.** O que o projeto vai usar se
   decide na fase de Definição, junto do MVP.
5. **Continua útil sem IA.** Teste de toda peça: serve para um time de humanos?

### As três tensões, e onde cada uma está

| Tensão | Estado |
|---|---|
| Perguntar contra calar (regra 5 do ciclo) | Resolvida: é modo, não fluxo de perguntas |
| Escopo travado contra escopo que muda | Resolvida no código: `mudarEscopo()` exige motivo e registra. Cortar escopo funciona e deixa rastro |
| **Quem valida, se ninguém lê o artefato** | **Aberta. É o risco 1, e é o que falta para virar produto** |

### O buraco conceitual que sobrou, e é um só

**Nada no framework hoje impede a IA de avaliar o próprio trabalho.** O gate
confere se o MVP existe, nunca se ele é verdadeiro. Eu me destravei sozinho hoje
editando um JSON à mão, e um agente pode marcar critério como feito sem ter
feito.

Some-se o erro de origem deste plano: eu também decido sozinho **quando** é hora
de construir. São a mesma lacuna vista de dois ângulos — falta o ponto onde o
humano entra, e ele precisa ser minúsculo (uma tela, um sim ou não), senão ele
não usa.

## Backlog, em ordem de execução

Cada etapa entrega sozinha. A ordem é: primeiro o que impede erro novo, depois o
que dá interface, por último o que amplia.

### F1. Os modos de ativação ✅ 14/08

**Feito e provado contra mim mesmo.** Liguei o modo imperativo neste projeto e
tentei escrever um arquivo em `src/`. Fui recusado, com o MVP completo e o
portão de fase aberto — exatamente a situação em que, horas antes, nada me
impediu de construir o glossário sem pedido.

Duas coisas que o teste ensinou e que estão no código:

- **O modo precisa da própria noção de "isto é código".** A primeira versão
  reusava o `trava` da fase, e na fase de Execução esse campo é vazio: o
  imperativo não travava nada. São perguntas diferentes — a fase pergunta "esta
  etapa bloqueia este caminho?", o modo pergunta "isto é código?". Hoje existe
  `CODIGO` separado, e há teste guardando.
- **As duas travas são em série, e isso é correto.** Modo libera, fase ainda
  pode barrar (projeto sem MVP continua sem escrever código, em qualquer modo).
  Confundi as duas num teste e achei que era bug; era o desenho certo.

Trocar de modo **zera as autorizações**, de propósito: autorização dada em
diálogo não pode sobreviver à entrada no imperativo, senão trocar de modo não
muda nada e o rigor vira decoração.

### F1 (desenho original)

Desenhado pelo Felipe em 14/08, melhor do que a minha proposta de dois estados.
São **quatro modos**, mais um botão que desliga tudo:

| Modo | Como a decisão é tomada |
|---|---|
| **desligado** | A IA é a de sempre. Um botão, sempre disponível, sem exceção |
| **diálogo** | Decidimos em prosa e eu interpreto. O fluxo de hoje |
| **imperativo** | Ele não digita: segue o backlog definido, responde perguntas decisivas e **autoriza por clique** |
| **restritivo** | Para agente com rota limitada no Routia. Sem prosa: pergunta o objetivo, define backlog, executa até o fim, só revisões |

Os quatro formam uma escala de rigor crescente, e o nome diz **como a decisão é
tomada**: conversando, pelo backlog, pelo escopo travado.

Ele batizou o segundo de "permissivo" e autorizou trocar ("é o de menos").
Trocado por **diálogo** por dois motivos: "permissivo" colide com as permissões
do Claude Code (o allow/deny de ferramentas), e numa mensagem de recusa do hook
isso confundiria; e "diálogo" descreve o mecanismo em vez do grau de liberdade.

Sobre escopo, palavra dele: o framework é **global**, com **níveis de
rigorosidade** além do estilo de produção, e o botão de desligar vale para tudo.
Isso é diferente do que eu tinha proposto (modo por projeto), e a razão dele é
melhor: o ritmo é dele, não do repositório.

**O clique do imperativo resolve o risco 1 de graça.** Eu tratava "onde o humano
aprova" como peça separada; no desenho dele já é parte do modo.

**O restritivo liga Routia e framework**, que estavam soltos. O escopo do agente
já é provado mecanicamente pelo `rota-guard`: se ele só tem a rota `frontend`,
prosa sobre arquitetura é conversa que não leva a nada. Pergunta o objetivo,
monta backlog, vai até o fim.

**Objeção que levantei e como ficou:** o erro que originou este plano
aconteceria de novo no diálogo, porque foi interpretação de prosa. Decisão
dele: *"o gatilho explícito meu resolve, mas se eu não deixar explícito você
manda um gate de pergunta que nem esse"*. Ou seja, no diálogo, sem sinal
claro para construir, eu **pergunto** em vez de decidir. Não bloqueia o fluxo e
tira de mim a decisão de quando começar.

Ressalva a não esquecer no imperativo: se ele só responde e **eu** escolho o que
perguntar, eu controlo a pauta. A saída do modo tem que estar sempre à mão, sem
depender de eu oferecer a opção.

### F1b. O gate de perguntas, que é o mecanismo por trás dos modos

Pergunta dele: *"qual o nome disso e como ativa? [...] esse gate de perguntas e
respostas pode ser o segredo master do framework, manipular isso é incrível e
muito útil"*.

**Nome: `AskUserQuestion`**, ferramenta do Claude Code, não deste projeto. De 1 a
4 perguntas por vez, de 2 a 4 opções cada, sempre com resposta livre automática
(o "Other"), múltipla escolha opcional, e `preview` para comparar alternativas
lado a lado.

**Não existe comando que a ative.** É o modelo que decide chamar, e é exatamente
esse o buraco: hoje a IA decide quando perguntar, e foi por isso que não
perguntei antes de construir o glossário. Três formas de o framework tomar essa
decisão para si:

1. **Por bloqueio** (`PreToolUse` recusa e devolve "pergunte antes"). O mais
   forte e o único mecânico. Sem saída: ou pergunta, ou não escreve.
2. **Por injeção de contexto** (`SessionStart` / `UserPromptSubmit` insere a
   regra do modo). Mais leve, mas volta a ser instrução, e instrução é sugestão.
3. **Por catálogo**: as perguntas obrigatórias de cada fase vêm de arquivo, não
   da cabeça da IA. É o mais valioso, pelo motivo abaixo.

**O risco que vem junto do poder, e é o argumento decisivo a favor do catálogo:**
quem escreve as opções molda a decisão. Formular a pergunta e as três
alternativas já filtra o mundo antes de ele escolher, mesmo sem má intenção.
Aconteceu hoje: ofereci três leituras de "network", ele quis as três, e a quarta
possibilidade era eu não ter pensado nela. Catálogo tira essa alavanca da mão da
IA; a resposta livre, que ele fez questão de manter sempre, é a válvula contra a
moldura.

**Duas limitações que afetam o desenho:** só funciona em sessão interativa
(agente de background não tem a quem perguntar, para e espera ou decide sozinho),
e o teto é quatro perguntas por vez.

### F2 ✅ embutido no F1 — O ponto onde o humano aprova (risco 1)

Um lugar minúsculo, no cockpit, onde ele confirma que algo está pronto de
verdade. Sem isso, "pronto" é a IA se auto-avaliando, e este projeto já tem a
evidência de que isso falha (545 testes verdes com a tela quebrada).

Regra de desenho: um botão e uma frase. Nunca um documento para ler.

Resolvido de graça pelo desenho do F1: no modo imperativo ele autoriza por
clique, e é exatamente o botão-e-frase que este item pedia — não sobrou peça
separada para construir.

### F3. Interface de uso (`cc framework`) ✅ 14/08

Existe porque registrar MVP editando `.framework/estado.json` à mão foi como eu
me destravei do próprio gate. O arquivo é sempre livre e tem que ser (senão não
há como sair da fase); o comando não fecha esse buraco, mas tira o incentivo.

```
cc framework                      onde o projeto está e o que falta
cc framework iniciar              liga no projeto
cc framework modo [nome]          lista ou troca (desligado|dialogo|imperativo|restritivo)
cc framework autorizar [alvo]     libera escrita nos modos que travam
cc framework mvp --nome / --criterio
cc framework avancar              recusa dizendo o que falta
```

**Bug achado e corrigido no caminho, e vale para o CLI inteiro:** `--dir` não
estava na lista de flags que consomem o argumento seguinte, então o VALOR virava
posicional — `framework autorizar --dir /tmp/x` autorizava um caminho chamado
`/tmp/x`. Consertado na origem (`FLAGS_WITH_VALUE`), com as outras flags novas
registradas junto.

### F4 ✅ 14/08 (marca corrigida em 18/08) — As ferramentas do projeto entram na Definição

Decisão de 14/08: a escolha de quais camadas de verificação (Bancada) e quais
ferramentas aquele projeto usa é feita junto do MVP, não solta no meio da
execução. Consequência: o estado ganha um campo, e o gate de Execução passa a
conferir também isso.

### F5. Bancada como gate de pronto ✅ 15/08

A etapa 1 da [[../produto/BANCADA]] existe, e está ligada ao framework:
`src/bancadaCatalogo.mjs` (camadas como dado) e `src/bancada.mjs` (runner que
grava o resultado no `.framework/estado.json`). Os predicados
`verificacao-rodada` e `verificacao-limpa` já esperavam alguém preencher esse
campo.

**Começou por código nosso, e o motivo foi medido:** gitleaks, trivy, semgrep,
trufflehog e nuclei — nenhum instalado nesta VPS, e este projeto nem tem
lockfile, então nem `npm audit` roda. Uma bancada que só sabe chamar ferramenta
de terceiro nasceria inteira cinza. As camadas que o documento chamava de
diferencial são justamente as que não dependem de instalar nada.

Quatro camadas: `segredo` (conteúdo, não nome de arquivo), `dependencia`
(`npm audit`), `teste` (`npm test` do projeto) e `zona-restrita` (chama `/admin`,
`/.env` sem sessão e exige que não respondam conteúdo).

**Prova, e ela tem duas metades.** Rodar contra este repositório deu zero
achados — o que sozinho não significa nada, porque pode ser camada cega. Rodei
então contra um projeto semeado e ela pegou **5 de 5**: chave da AWS, token do
GitHub, senha em URL, chave privada e o JWT com `service_role`, que era a camada
mais valiosa do documento. Só aí o zero do repositório vira informação.

**O ciclo completo, ponta a ponta:** na fase de Verificação o gate cobrou "falta
rodar: segredo"; depois de rodar e achar uma chave, passou a recusar avançar com
"verificação acusou problema em: segredo". Segurança virou gate, não
recomendação.

Falta da Bancada, e não bloqueia o framework: job assíncrono para camada longa,
instalar/desinstalar em projeto de terceiro (Playwright), a aba própria, e as
camadas que dependem de ferramenta externa.

Ver [[../produto/BANCADA]]. "Pronto" passa a exigir pelo menos a camada de
segredo rodada. Depende da Bancada existir (etapa 1 dela).

### F6 ✅ 14/08 (marca corrigida em 18/08) — Segundo método

`entrega-cliente` existe em `src/framework.mjs` ao lado de `mvp-basico`, com
número de fases diferente — a prova de que método é dado, não código, já está
no gate (`dois métodos convivem, com número de fases diferente`).

### F7. Painel do framework

Fase de cada projeto, o que falta para o próximo portão, quantas vezes o escopo
mudou. É a camada de insight que justifica todo o registro embaixo.

### F8. A entrevista inicial ✅ 14/08

O que faz o framework **conduzir** em vez de só recusar. Duas peças:

- `PERGUNTAS` em `src/framework.mjs`: catálogo, cada verbete amarrado ao
  predicado que ele resolve. Predicado satisfeito, pergunta some — a entrevista
  termina sozinha em vez de virar formulário fixo.
- `hooks/framework-inicio.mjs` (`SessionStart`): injeta onde o projeto está, com
  que tom falar, e a próxima pergunta a fazer, com as opções do catálogo.

**Uma pergunta por vez, de propósito.** Quatro juntas viram formulário, e
formulário é o que ele não lê.

**Injeta em vez de bloquear**, e isso é coerente: `SessionStart` não tem
ferramenta para recusar. A trava já existe do outro lado — se eu ignorar a
pergunta e for escrever código, o `framework-guard` me recusa. Um conduz, o
outro segura.

**O catálogo é o ponto, não detalhe de implementação.** Se eu inventasse a
pergunta e as alternativas na hora, teria filtrado o mundo antes de ele
escolher — o risco que ele mesmo nomeou ao chamar isso de "segredo master". A
resposta livre do `AskUserQuestion` é automática e fecha a brecha que sobra.

Prova: projeto novo devolve "O que este projeto entrega, numa frase?" com duas
opções; com o nome preenchido, passa para os critérios; com tudo resolvido, fica
em silêncio. Projeto sem framework não imprime nada.

### F13. Tom, separado do modo ✅ 14/08

`TONS` e `TOM_RECOMENDADO`: dois tons (direto, explicativo), um recomendado por
modo para a escolha rápida, e tom escolhido à mão vence o recomendado. Tom
inválido cai no recomendado em vez de quebrar. O hook de início injeta o tom
junto do modo.

### F8 (desenho original)

A inversão da visão: o framework demanda ao Felipe, começando por "o que é o
projeto". Hoje o gate só recusa, ainda não conduz.

### F12. Filtro de confidencialidade local

Vem do documento "Arquitetura de Hábitos", que o Felipe escreveu para **outro
produto** (ver abaixo), e é a peça que ele decidiu trazer para cá em 14/08.

Substituir dado sensível por token antes de sair da máquina, e remontar na
volta: `[CLIENTE_1]`, `[CHAVE_2]`. Hoje o problema é resolvido por proibição —
o `segredo-guard` me bloqueou várias vezes nesta sessão, inclusive no `.env` do
Pixel Agents. Bloquear é a solução tosca: eu simplesmente não leio o arquivo.
Substituir é a solução boa: eu leio a estrutura sem ver o segredo.

Encaixa como camada do framework e conversa direto com a [[../produto/BANCADA]]
(as sondas de segredo já sabem achar o que precisa ser mascarado).

### F13. Tom, separado do modo

Decisão dele em 14/08, corrigindo o desenho que eu tinha proposto: **tom e modo
são eixos independentes**, não a mesma escala.

O modo diz **o que trava** (desligado, diálogo, imperativo, restritivo). O tom
diz **como eu falo**: curto e direto, ou explicando o porquê. Palavra dele: "eu
acho que eles podem ficar separados [...] eu posso mudar o tom de qualquer um
também".

Cada modo tem um tom **recomendado** (imperativo pede resposta curta, diálogo
pede explicação), para a escolha rápida ser um clique só, mas qualquer
combinação é válida. Vem do documento dele, e é melhor do que o nosso desenho:
hoje o modo só liga e desliga gate, não muda como eu converso.

### F14. Ponte com outras ferramentas ✅ registrada em 15/08 (visão, não agora)

Roo Code, Antigravity, IDE local. Escrita por inteiro no `docs/ROADMAP.md`, na
frente do framework, junto com o F9 — é lá que ele olha, e visão que só existe
num plano de execução é visão perdida.

Em uma linha: o motor já é portável (puro, e o estado mora em
`.framework/estado.json` dentro do projeto), o gatilho não é (são hooks do
Claude Code). Ponte é dar um gatilho próprio a cada ferramenta, lendo o mesmo
arquivo. Vira frente quando ele trabalhar de verdade em outra ferramenta.

### F16. PDF ✅ 15/08 — extrator próprio, sem os 34 MB

**Resolvido, e a decisão foi da medição, não de gosto.** `src/extrairPdf.mjs`,
~200 linhas, só com o `zlib` que já vem no Node. Nos 3 contratos reais em PDF o
mascarador acha **exatamente o mesmo conjunto de dados pessoais** que acha no
`.txt` equivalente: 16/16, 8/8 e 12/12 valores, nenhum escapando. O texto sai
com 10 caracteres de diferença num contrato de 2.900.

Três coisas que custaram tempo e estão no cabeçalho do arquivo, porque são
armadilhas de PDF que qualquer um repetiria:

1. **`N 0 obj` aparece por acaso dentro dos dados binários da fonte.** Indexar
   os objetos por número fazia um match espúrio sobrescrever o objeto real, e
   **metade do contrato sumia sem erro nenhum** — 1201 de 2386 caracteres,
   cortando no meio de uma frase. É o pior tipo de defeito para este recurso:
   silencioso, e do lado de "protegi menos do que disse". Hoje as faixas
   `stream…endstream` são mapeadas primeiro e todo candidato lá dentro é
   descartado. Tem teste guardando (o contrato 06, que é o de 2 páginas).
2. **O texto de um PDF não são letras, são números de glifo.** Fonte `Type0` com
   `Identity-H` escreve `<0026>` onde há um "C". O mapa de volta é o
   `/ToUnicode`, texto comprimido dentro do próprio arquivo.
3. **O Chrome emite um `Td` por caractere.** A regra ingênua "`Td` quebra linha"
   devolvia o contrato inteiro em coluna, uma letra por linha. O que quebra
   linha é a coordenada Y mudar.

E uma quarta, que decidiu um valor escapando: **o PDF quebra linha por layout**.
`(11) 98123-\n4567` é um telefone só, partido pela largura da página, e sem
juntar o detector não o encontra. Duas junções conservadoras resolvem, e linha
terminada em `.` ou `:` fica intacta, preservando a separação entre cláusulas.

**O que continua bloqueado, de propósito:** PDF escaneado (imagem não tem
texto), PDF cifrado e `/ObjStm` (objeto dentro de objeto comprimido, comum em
PDF do Word). Nesses o extrator devolve pouco ou nada, e o piso de 40 caracteres
faz o hook bloquear. Extrair 3 linhas de um contrato de 3 páginas e chamar de
protegido seria pior do que recusar.

`.doc` binário antigo, `.odt` e `.rtf` seguem opacos. Sair dessa lista exige
extrator **e** medição contra arquivo real, nessa ordem.

### F16 (histórico) — como a pergunta dele achou o buraco

Pergunta do Felipe em 15/08, e ela achou um buraco meu: *"mas se o PDF não lê,
no Pierre ele também não lê contrato em PDF?"*.

**Não. O Pierre lê PDF e DOCX** (`extrair.ts`, com `pdfjs-dist` e `mammoth`).
Eu tinha portado só o detector e deixado o extrator para trás, então o
mascarador bloqueava justamente o formato em que contrato costuma chegar.

**DOCX foi resolvido no mesmo dia, sem dependência:** `src/extrairDocx.mjs` lê
o ZIP com o `zlib` do Node e tira o texto do XML. Umas 50 linhas contra 2 MB de
biblioteca. Provado contra contrato real (`assets/contratos-exemplo` do
inovallbond): 12 valores mascarados, nenhum nome vazando.

**PDF ficou resolvido no mesmo dia** (ver acima). O quadro abaixo é o que estava na mesa antes da medição, e explica por que o terceiro caminho era o único honesto sem ela:

| Caminho | Custo |
|---|---|
| Trazer `pdfjs-dist` | 34 MB e o fim da regra de zero dependência de runtime |
| Escrever à mão | PDF tem fonte embutida, codificação própria e texto em ordem de desenho. Sairia um extrator ruim disfarçado de solução |
| Deixar bloqueado | Contrato em PDF simplesmente não passa pelo mascarador |

O segundo caminho ganhou, e só porque foi medido: o receio de "extrator ruim
disfarçado de solução" era legítimo, e a resposta não foi argumentar, foi rodar
contra contrato real e comparar com o `.txt`.

### F15 ✅ 18/08 — Achado em projeto alheio se registra NO GIT dele

Regra que o Felipe formulou em 15/08, olhando o caso acontecer: *"isso é uma
regra pro framework, o registro em outros projetos, ficaria no git? assim eles
se comunicam"*.

O caso: trabalhando no cockpit, portei o `anonimizar.ts` do Pierre e descobri um
defeito **no Pierre**. Registrar só aqui seria enterrar o achado no repositório
errado — quem abrir o Pierre amanhã não veria nada.

**A regra:** achado sobre outro projeto vira ticket no `docs/` **daquele**
projeto, no formato que ele já usa, commitado e enviado. O git é o canal.

**E isso não contradiz "o Git é ruim como canal", que ele mesmo disse em 14/08.**
São dois usos diferentes, e a distinção é o que vale guardar:

| | Estado vivo (rota ocupada agora) | Achado durável (bug, decisão) |
|---|---|---|
| Precisa de | latência baixa | sobreviver a máquina desligada |
| Git serve? | não, exige commit/pull e conflita | **sim, é o ideal** |
| Canal | federação (CC-47) | git do projeto dono |

**Três limites, e vieram do caso real:**

1. **Só `docs/`, nunca código.** Consertei? Não. O `anonimizar.ts` registra que
   cada linha saiu de medição contra contrato real, e os contratos estão lá.
   Corrigir de fora troca defeito conhecido por desconhecido.
2. **Commit próprio, com a origem escrita.** Quem achou, de onde, e por quê. Sem
   isso o ticket aparece órfão e ninguém sabe a quem perguntar.
3. **A árvore de lá tem que estar limpa.** Se houver trabalho não commitado de
   outra sessão, o ticket espera: misturar é o problema que o `git-add-guard`
   existe para evitar.

**✅ Feito em 18/08.** `cc framework ticket <projeto> "<texto>"` existe
(`src/ticket.mjs` + `cc.mjs`): acha o projeto pelo nome entre os que o cockpit
conhece, exige árvore limpa (senão recusa e explica por quê), escreve em
`docs/TICKETS-EXTERNOS.md` do ALVO — nasce sozinho na primeira vez — e commita
só esse arquivo, com a origem na mensagem. Provado contra repositório git de
verdade (não simulado): três limites testados em `test.mjs`, e uma rodada de
ponta a ponta fora do teste, com commit real conferido pelo `git log`.

### F9. Perguntas em rede ✅ registrada em 14/08 (visão, não agora)

As três leituras que ele escolheu juntas: pergunta viaja entre máquinas pela
federação, respostas viram rede de decisões com memória, agentes repassam
decisão entre si. Frente própria, depois do resto. Escrita no `docs/ROADMAP.md`,
na frente do framework.

### F10. Gate de documentação ✅ 14/08

`hooks/roadmap-guard.mjs`, no evento `Stop`. Avisa quando há item concluído
parado no ROADMAP, listando quais.

**Avisa em vez de bloquear, e o motivo é estrutural:** `Stop` com `exit 2`
devolve o texto pro modelo e o manda continuar. Num gate de documentação isso
criaria laço — o fim da sessão é justamente quando se escreve o diário, e para
arrumar o ROADMAP eu preciso poder terminar o turno. O `todo-guard` usa o mesmo
tom no mesmo evento, pelo mesmo motivo.

**Já pegou dois itens meus na primeira execução** (CC-63 e CC-64, escritos horas
antes), e eu obedeci ao próprio hook movendo os dois para o diário. Depois
disso ele ficou em silêncio.

### F7. Painel do framework ✅ 14/08 (parcial)

O que faltava para o imperativo **existir de verdade**: o desenho dele é
"autorizo por clique", e o clique não existia — sobrava o CLI, que não serve
para quem trabalha do celular.

No cartão de cada projeto agora tem um seletor de modo (os quatro) e, nos modos
que travam, o botão `autorizar` com confirmação. O retrato da rota passou a
devolver modo, se ele trava, e as autorizações em vigor.

Falta ainda a parte de leitura que o F7 previa: quantas vezes o escopo mudou por
projeto e o histórico de autorizações numa tela. Hoje isso está no arquivo, não
na tela.

### F10 (desenho original)

Recusar fechar a sessão com concluído parado no ROADMAP. É irmão do F1 e sai
barato junto: mesmo mecanismo, hook que lê um estado e recusa.

A regra existe escrita há semanas ("concluído sai daqui e vira linha no
diário", linha 3 do próprio ROADMAP) e não foi seguida por ninguém, inclusive
por mim, dez vezes em 14/08. É o segundo caso de teste do princípio do
framework, e o mais barato de provar.

### F11. Redesign das abas ✅ 15/08

De 15 abas numa fileira para **quatro portas**, agrupadas pela pergunta que ele
faz — critério dele, não por tipo de dado:

| Porta | Abas |
|---|---|
| **agora** | cockpit, agentes, to-dos, meu, escritório |
| **custo** | tempo, gráficos, preço |
| **controle** | servidores, VPS, hooks, rotinas, remoto |
| **saber** | glossário, agenda |

Os dois primeiros agrupamentos são os que ele nomeou; os outros seguem a mesma
lógica.

**A aba continua sendo a unidade real.** `tab` guarda o id de sempre, `?tab=`
continua valendo (a captura de tela depende disso) e o `localStorage` de quem já
usava não muda de lugar. O grupo é **derivado** da aba ativa, nunca guardado:
dois estados poderiam discordar, e aí o painel abriria num grupo que não contém
a aba marcada.

Hierarquia visual de propósito: o grupo é a decisão grande (maior, sublinhado),
a aba é o detalhe (menor, pastilha). Com o mesmo peso seriam 19 botões iguais em
vez de 15, o oposto do objetivo.

**Faxina que veio junto:** a lista de "o que carregar ao abrir a aba" estava
duplicada entre o clique e o boot, e o grupo seria a terceira cópia. Virou
`trocarAba()` mais `carregarDaAba()`, chamadas das três portas de entrada.

**Teste no gate** (`test.mjs`): toda aba precisa morar em algum grupo e nenhum
grupo pode apontar para aba inexistente. Sem isso, acrescentar aba nova a
deixaria **invisível** — existiria em `TABS` sem aparecer em porta nenhuma, e
nenhum outro teste pegaria, porque o JS continua válido. Confirmei que o teste
pega o erro simulando uma aba órfã.

Decidido em 14/08 e pendente desde então. Cresceu de urgência: eram 12 abas, são
**14 agora**, e duas delas nasceram no erro que originou este plano.

Os dois agrupamentos que ele nomeou, e que valem como estão: **tempo, gráficos e
preço** (a mesma pergunta: quanto custou e quanto vale) e **servidores, VPS,
hooks e remoto** (o que está ligado e o que eu ligo ou desligo).

Critério para o resto, dado por ele: agrupar por **pergunta que ele faz**, nunca
por tipo de dado. Isso leva a quatro portas em vez de quatorze — o que exige
decisão agora, quanto custou, o que está ligado, o que a máquina está fazendo.

Vem depois do F1 de propósito: construir os modos dentro da estrutura nova, em
vez de mexer duas vezes na navegação.

## Antes de usar de verdade: o que falta resolver

Levantado em 15/08 a pedido dele. Separado por quem consegue resolver, porque
metade disto não depende de código.

### Depende dele (está na aba `meu` do painel)

| O quê | Por quê |
|---|---|
| Ligar o PC na federação | A VPS já é servidor e está esperando. Sem isso o painel só enxerga uma máquina |
| Registrar o hook no `settings.json` do PC | O gate chega pelo `git pull` mas não liga sozinho lá, e o caminho é `D:/`, não o da VPS |
| Autorizar `sudo` para `KillMode=process` | É o que impede escritório e corrida longa de morrerem a cada restart do painel |

| Olhar o Pixel Agents do Telegram (CC-60) | Porta 3100, usuário `agente`, no ar há dias, dono desconhecido |

### Depende de código, e nenhum bloqueia o uso

| O quê | Estado |
|---|---|
| `cc framework ticket <projeto>` | A regra F15 existe, o comando não. Procedimento manual é sugestão |
| Painel do framework, parte de leitura | Falta mostrar histórico de escopo e autorizações na tela; hoje só no arquivo |
| CC-56: `cockpit set` em sessão interativa | Da VPS não dá para reportar to-do; o painel enxerga a sessão mas ela não escreve |
| CC-53: `npm test` não roda inteiro na VPS | **Melhorou em 15/08.** O `npm test` agora encadeia quatro gates, e o `test.mjs` (o único que exige job de background com transcrito) ficou por último de propósito: nesta VPS os outros três passam antes de ele falhar, então quem trabalha pelo celular deixou de estar sem gate nenhum. Falta o `test.mjs` em si funcionar sem job real |
| Bancada: job assíncrono e aba própria | As camadas rápidas funcionam; camada longa (Sandyaa) precisa de progresso e cancelamento |
| ~~F9 e F14~~ | ✅ Registradas no `docs/ROADMAP.md` em 15/08, com o gatilho que faz cada uma virar frente. Sem trabalho previsto agora, e é assim que devem ficar |

### Resolvido no mesmo dia (15/08)

**O regex de endereço do Pierre.** Ele engolia o texto depois da vírgula, então
`"Avenida Paulista 1000, doravante CONTRATADA"` virava uma etiqueta só. Não é
vazamento, é o oposto: mascara demais, e come justamente o que diz qual parte é
qual num contrato.

Consertado nos dois lados, e a ordem importa: primeiro no Pierre, que é a
origem (commit `46999be` do inovallbond, na branch `site/redesign-pierre`),
depois trazido para o port daqui. Fazer só aqui seria consertar a cópia e
deixar o original doente, que é o pior dos dois mundos.

Correção honesta ao meu diagnóstico anterior, que exagerou a gravidade: nos 6
contratos reais de `assets/contratos-exemplo` o defeito **não aparecia** — lá o
endereço vem seguido de CEP (já excluído) ou de complemento de verdade. É caso
de texto corrido. Os 5 endereços dos contratos saem byte a byte idênticos antes
e depois, incluindo `"Avenida das Nacoes 1200, conjunto 71"`.

Junto veio um buraco maior que o defeito: **o port não tinha gate nenhum**. O
`test.mjs` não mencionava anonimização, num arquivo que decide o que sai da
máquina dele. Agora existe `test-anonimizar.mjs`, e ele roda os 35 casos do
Pierre contra o port em vez de copiá-los — se alguém consertar um lado só, o
gate quebra. Máquina sem o inovallbond clonado pula essa parte e roda o mínimo
próprio.

### Higiene

- `~/projetos/teste_framework` na VPS é descartável, pode apagar
- O `~/cockpit-auth.mjs` **não está em repositório nenhum** (CC-61), e é a porta
  de entrada do painel inteiro

## Verificação

O de sempre neste projeto, e vale lembrar por que: **prova na tela antes de
"feito"**. Para o F1 especificamente, o teste é auto-referente e é o melhor
possível — ligar o modo conversa e confirmar que **eu** sou recusado ao tentar
editar `src/`, do mesmo jeito que o gate de MVP me recusou em 14/08.
