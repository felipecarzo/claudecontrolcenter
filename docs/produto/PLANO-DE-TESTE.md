---
tags: [qualidade, tela]
tipo: plano
atualizado: 2026-08-21
---

# Plano de teste do painel

Pedido dele em 21/08: *"mapear todo o site, funções e botões (…) de tudo que tem
que ser testavel e verificavel no site. botões, textos, descrições, etc."*, para
**usar com o `/browser-harness`** e com outras ferramentas.

Este arquivo é o **planejamento**: o que testar, em que ordem, e como saber que
passou. Ele não roda nada.

---

## As cinco dimensões, que são as dele

Ele escolheu quatro de uma lista e escreveu a quinta:

| # | dimensão | a pergunta que ela responde |
|---|---|---|
| 1 | **existe** | está na tela, abre, e o endereço responde |
| 2 | **funciona** | clicar faz o que promete, e o dado chega no servidor |
| 3 | **explica** | a palavra técnica tem explicação escrita |
| 4 | **estreito** | cabe em 390px, sem corte e sem rolagem lateral |
| 5 | **profundo** | *"que se auto descreve (os `?`) com profundidade"*: a explicação ensina, em vez de só definir |

---

## A superfície, medida em 21/08

| o que | quanto | citado em algum teste |
|---|---|---|
| telas no menu | 24 | 24 (só que abrem) |
| tipos de ação (`data-*`) | 79 | 23 |
| botões | 115 (66 nascem em execução) | não se sabe |
| endereços de dados (`/api/*`) | 65 | **6** |
| explicações escritas | 50 | 13 aparecem na tela |

**73 das 79 ações nascem em tempo de execução**, dentro de template. Ler o
arquivo não diz o que aparece em cada tela: só o navegador sabe. É por isso que
este plano é para o `/browser-harness`, e não para uma varredura de texto.

---

## ⚠️ Sete armadilhas de medição, todas medidas hoje

Leia antes de escrever o primeiro caso. Cada uma já produziu resultado falso.

1. **A largura mente por 28%.** `--window-size=390` no Chrome headless devolve
   ~500 CSS px, e 500 ainda cai no ramo estreito do CSS: a captura parece um
   celular convincente e não mede nada sobre 390. Exige
   `--force-device-scale-factor=1` **e** `Emulation.setDeviceMetricsOverride`.
2. **Conectar em `lista[0]` do CDP pega a aba errada.** Uma medição de 390 já
   aconteceu na janela de 1280 da execução anterior. Abra aba própria por
   `/json/new` e conecte pelo id dela.
3. **A régua barata da largura é a barra de baixo.** Seletor
   `.barra-baixo .bb-item`. Com 390 de verdade são 5 botões inteiros, centros em
   **39/117/195/273/351**. Se algum sai do quadro, a medida mente e nada dela
   vale.
4. **Elemento passando da borda dentro de área rolável NÃO é defeito.** Medido
   hoje: a conta ingênua acusou **255 elementos** no Cockpit e **115** na
   Trabalho, todos falsos. O funil tem colunas com rolagem horizontal própria,
   de propósito. Só conte como vazamento quando nenhum ancestral tiver
   `overflow-x` rolável de fato.
5. **Tela baixa com botão dentro não está vazia, está sob clique.** A tela
   Digest tem 33px e um botão só: o conteúdo nasce quando ele toca. Cobrar isso
   é a cobrança falsa que ensina a ignorar a medição.
6. **Não use `?static=1` para teste de interação.** Com o fluxo ao vivo
   desligado tudo passa e nada se prova: o defeito clássico deste painel é o
   redesenho de 2 em 2 segundos atropelando o estado da tela.
7. **O painel não recarrega módulo.** Mexeu no servidor, reinicie o processo, ou
   você valida código velho achando que é novo.

8. **`document.querySelector` pega a tela ERRADA.** As 24 telas coexistem no
   mesmo documento, e as ocultas devolvem retângulo `0x0`. Buscar no documento
   inteiro acha o elemento de uma tela escondida, o clique cai no vazio e o caso
   falha por motivo nenhum. Aconteceu na primeira execução real deste plano.
   **Busque sempre dentro de `#view-<tela>`, e filtre por `width > 0`.**
9. **A tela pode não estar montada quando você mede.** A Trabalho leva **quase 3
   segundos** para nascer (medido: 0 filhos até 1,5s; 234 filhos aos 3s). Sem
   espera, o caso acusa "tela vazia" que não existe. Espere o conteúdo aparecer,
   não um relógio fixo.
10. **Rolar antes de clicar.** Coordenada de `getBoundingClientRect` é relativa
    ao viewport: item abaixo da dobra tem `y` fora da tela e o clique vai parar
    noutro elemento. `scrollIntoView({block:'center'})` antes.

Bônus desta VPS: o Node 20 daqui **não tem WebSocket**, então CDP na mão exige
`node --experimental-websocket`. O Chrome é o do Playwright, em
`~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`.

Com o `/browser-harness` o caminho é outro e mais curto: `~/bh-chrome.sh` sobe o
navegador na porta 9333, e cada chamada precisa de `BU_CDP_URL` e `NO_PROXY`
apontando para 127.0.0.1, com a sandbox desligada.

---

## Primeira execução real, 21/08

Rodado com `/browser-harness` contra o painel no ar, em 390x844.

**Largura provada antes de tudo:** 390px, 5 botões da barra, centros em
39/117/195/273/351. Exatamente o previsto, então as medidas valem.

| nível | resultado |
|---|---|
| 24 telas abrem | **23 de 24 sem problema** |
| erro de execução | **zero** nas 24 |
| vazamento em 390px | **zero**, fora de área rolável |
| rolagem lateral da página | **nenhuma** tela |
| caso "tocar na tarefa mostra o que ela é" | **passou**, com clique de dedo e prova visual |
| o "?" abre e ensina | **passou**: 1789 caracteres em `trabalhando` |
| endereço próprio por tela | **passou** |

**O defeito achado:** a tela **Trabalho fica completamente vazia por quase 3
segundos**, sem nem dizer que está carregando. Não é erro, não quebra nada, e é
a família de defeito mais cara deste painel: espaço vazio não distingue "está
carregando" de "quebrou". Ele abre isso no telefone, na rua.

---

## Ordem de ataque, por valor

Ele usa o painel no telefone, quase sempre na rua. A ordem abaixo é por dor real
medida, não por facilidade.

### Nível 1: o que mente sem quebrar

**É a família de defeito mais cara deste painel**, e a que ele sempre acha
primeiro. Nenhum destes quebra a página; todos afirmam algo falso.

| caso | como verificar | passou quando |
|---|---|---|
| tela abre praticamente vazia | abrir cada uma das 24 e medir a altura do bloco | nenhuma tela com menos de 80px **e** sem botão dentro |
| erro de execução silencioso | escutar `Runtime.exceptionThrown` e `console.error` ao abrir cada tela | zero erros nas 24 |
| bloco vazio sem explicação | procurar bloco de conteúdo vazio embaixo de cabeçalho que promete algo | todo bloco vazio diz por que está vazio |
| botão que responde sem fazer | clicar e conferir o EFEITO, nunca a resposta | o estado do servidor mudou de verdade |

### Nível 2: cabe no telefone dele

| caso | como verificar | passou quando |
|---|---|---|
| as 24 telas em 390px | percorrer todas, medir vazamento fora de área rolável | zero elementos fugitivos |
| rolagem lateral da página | `scrollWidth > clientWidth` no documento | falso em todas |
| a barra de baixo | 5 botões inteiros no quadro | centros em 39/117/195/273/351 |

### Nível 3: as ações, tela a tela

Medido hoje, por tela, o que existe de verdade para clicar. **Comece pelas
quatro de cima**: elas concentram 79 dos 115 botões.

| tela | botões | ações presentes |
|---|---|---|
| `framework` | 55 | `entAbrir` `fw` `fwModo` `fwProj` `fwTodos` `mod` `modOn` `modProj` `novoProj` |
| `remoto` | 37 | `fedEnviar` `fedGerar` `fedPedir` `fedProj` `fedSalvar` `fedVer` `remotoDesligar` `remotoDir` `remotoLigar` `remotoLink` `remotoMais` |
| `servidores` | 20 | `abrir` `como` `copiar` `kill` `srvFav` `srvModo` `srvNome` `srvNota` `srvNovo` |
| `graficos` | 18 | `gEditar` `gIndice` `gNovo` `gRemover` |
| `cockpit` | 14 | `meuFeito` `retomar` `verAgente` `ajuda` `explica` |
| `notas` | 11 | `nAdd` `notaTitulo` `note` `modo` `del` |
| `bancada` | 9 | `bnCamada` `bnNivel` `bnRodar` |
| `trabalho` | 4 | `meuAbrir` `meuCheck` `todo` `trabAbrir` `ajuda` |
| `meus` | 4 | `meusApagar` `meusBloco` `meusNovo` `meusRenomear` `meusVer` |
| `custo` | 4 | `mercado` `precoAbrir` `precoBuscar` `precoUnidade` |
| `agora` | 3 | `meuAbrir` `meuAdd` `meuMarcar` `filaBuscar` `viTudo` |
| `escritorio` | 3 | `escDesligar` `escVer` |
| `agentes` | 3 | `ag` |
| `rotinas` | 3 | `rtDel` `rtSync` `rtVer` |
| `tempo` | 3 | `assinatura` |
| `vps` | 2 | `vpsAtualizar` `vpsConfig` |
| `estrutura` | 1 | `criarTodoRoadmap` `opcoes` |
| `hooks` | 1 | `hkProvar` `hkToggle` |
| `maquina` | 1 | `processosAtualizar` |
| `digest` | 1 | `digest` |
| `documentos` | 1 | `docAbrir` `docNovo` |
| `agenda` | 1 | `agSalvar` |
| `docker` | 0 | nenhuma |
| `glossario` | 0 | nenhuma |

⚠️ **Três ações são destrutivas e não entram em teste automático sem alvo
falso**: `kill` (mata processo, e a lista de protegidos inclui processos do
sistema), `remotoDesligar` e `escDesligar`. `rtDel` e `del` apagam dado dele.

### Nível 4: o texto que se explica

| caso | como verificar | passou quando |
|---|---|---|
| toda tela tem verbete | `view-x` procura `tela: x` em PALAVRAS-DA-TELA | 24 de 24 (**hoje passa**) |
| todo `?` tem corpo | o verbete existe e ensina | 24 de 24 (**hoje passa**) |
| verbete escrito e nunca usado | cruzar os 50 verbetes com `data-explica` e `ajuda()` | hoje **13 de 50** aparecem: 37 estão escritos e invisíveis |
| a explicação ensina | corpo com substância, não só a definição | régua já existe no gate (CC-229) |

### Nível 5: os 65 endereços de dados

Seis são citados em teste. Os outros 59 nunca foram exercitados.

**Ordem sugerida:** primeiro os que ESCREVEM (erro ali corrompe dado dele),
depois os de leitura. Para cada um: resposta com forma esperada, recusa com
status de erro e não sucesso disfarçado, e o caso do dado ausente.

---

## O que já é coberto hoje, para não refazer

| dimensão | quem cobre | o que ele prova |
|---|---|---|
| existe (telas) | `test-endereco.mjs` | abre as 24, escuta erro de execução, recusa tela quase vazia |
| explica | `test.mjs` | toda tela do menu tem verbete, e todo verbete tem corpo |
| estreito (parcial) | `test-estreito.mjs` | ⚠️ **mede o painel ANTIGO (`src/ui.html`)**, não o de todo dia |
| funciona (1 aba) | `test-ui.mjs` | a aba de to-dos, de ponta a ponta |

**O buraco maior é `funciona`**: 154 dos 218 itens não têm nada que prove que
fazem o que dizem.

---

## Sugestão de formato de caso, para o `/browser-harness`

Um caso é uma frase de intenção, os passos, e a prova. A prova nunca é a
resposta do botão: é o efeito.

```
CASO   trabalho / tocar na tarefa mostra o que ela é
DADO   painel no ar, 390x844, sem ?static=1
QUANDO abrir #trabalho e clicar no texto de uma tarefa de [data-meu-abrir]
ENTÃO  aparece "Por que depende de você", "Onde", "Desde", "De onde veio"
E      NÃO aparece o alerta "Marcar como resolvido?"
E      zero erro de execução no console
```

Três regras que valem para todo caso:

1. **Prova é efeito, não relatório.** Clicar em ligar e ler "ok" não prova nada:
   este painel já respondeu "ok" com o processo morto atrás.
2. **Teste que só sabe dizer "hoje passa" não vale.** Desligue a proteção e
   confirme que o defeito volta, como o `test-estreito.mjs` já faz.
3. **Nada de dado real dele.** Notas, lista de tarefas e configuração são texto
   digitado à mão e não têm outra fonte. Use `CC_HOME` apontando para uma casa
   temporária.
