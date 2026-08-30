---
tags: [processo]
tipo: alinhamento
atualizado: 2026-08-30
resumo: O que a sessão da VPS fez em 29 e 30/08, para a sessão do PC não refazer nem colidir. Escrito porque o canal de recados do Routia não atravessa as máquinas: `docs/.recados.json` está no `.gitignore`.
---

# Alinhamento entre a VPS e o PC, 30/08

**Quem escreve:** a sessão `670e1313`, na VPS, rota `front`.
**Para quem:** as sessões `2d4e7b74` e `73572fda`, no PC.

Ele pediu, olhando as duas pontas: *"manda pra sessão do pc tudo que você fez
pra vocês se alinharem"*.

⚠️ **Este arquivo existe porque o canal normal não serve aqui.** Os recados do
Routia moram em `docs/.recados.json`, que está no `.gitignore`: eles funcionam
entre sessões da MESMA máquina e nunca atravessam para a outra. O único canal
que atravessa é o git, então o alinhamento entre máquinas é um arquivo
versionado, não um recado.

## O que você já fez e eu NÃO vou refazer

Li o teu cartão no painel: `o contrato entre as pontas, e o roadmap inteiro
chegando na VPS`, com cinco itens fechados, entre eles **"o contrato versionado
entre PC e VPS"** e **"o pacote ficar rico: roadmap, sprints, frentes"**.

É exatamente a fatia que eu tinha planejado e não executei. **Ela é tua.** O que
eu tinha levantado, para o caso de te ser útil como conferência:

- `frameworkDaqui()` em `src/travasDaMaquina.mjs` manda hoje seis campos por
  projeto: `projeto, existe, ligado, modo, fase, perfil, modulos`;
- ficam de fora, entre outros: **`metodo`** (a fase chega sem o caminho que a
  define), `mvp`, `tituloFase`, `portaoAberto`, `pendencias`, `autorizado`,
  `pedidos`, `entrevista`, `passo`, `resumo`, `git`;
- ⚠️ **`validarPacote` em `src/federacao.mjs` DESCARTA campo fora da lista.**
  Mandar mais de um lado sem aceitar do outro dá silêncio, não erro. Os campos
  aceitos hoje estão em `federacao.mjs:136-153`;
- `frameworkDaqui` lista só projetos CITADOS NOS JOBS, não varre disco: projeto
  que ninguém abriu não existe na federação, e o único outro censo é `backlogs`.

Se o teu contrato já cobre isso, ignora a lista. Ela é o que eu mediria antes de
começar, não uma sugestão de desenho.

## O que eu mexi, e onde

Tudo já está empurrado, menos o último item, que está preparado e esperando ele
pedir. **Dá `git pull` antes de encostar em qualquer um destes.**

### Arquivos que eu toquei

| arquivo | o que mudou |
|---|---|
| `src/ui_novo.html` | o painel da RAIZ agora é este. Cartão, menu, telas |
| `src/projetos.mjs` | nome de projeto, projetos remotos, o par entre máquinas |
| `src/trabalho.mjs` | `nomeDoAgenteCom()`, exportada |
| `src/jobs.mjs` | `projectOf` passou a aceitar checagem de disco |
| `src/install.mjs` | `semRepetir()` e `apelidosDePasta()` |
| `src/nomeProjeto.mjs` | **novo**: a conta única de nome de projeto |
| `src/sintese.mjs` | **novo**: a leitura escrita pelo opencode |
| `src/armazem.mjs` | fusão de grafias na leitura |
| `src/digest.mjs` | cache de 5 minutos |
| `src/meu.mjs` | apelido de pasta na leitura das pendências |
| `src/config.mjs` | `setPastasDeProjeto()` |
| `src/web.mjs` | rotas novas, e a raiz passou a servir o painel novo |
| `src/federacao.mjs` | **⚠️ este é da tua rota `sincronia`**, ver abaixo |
| `hooks/resumo-guard.mjs` | régua de fim de turno pelo relógio do arquivo |

### ⚠️ O que eu toquei na tua rota, e o pedido de desculpa

`src/federacao.mjs` está reivindicado pela rota `sincronia`, e eu mexi sem pedir
antes. Peço desculpa pelo caminho.

O que entrou é **uma função nova e a troca de uma linha**:

- `nomeDeProjetoSeguro(nome)`, exportada;
- `pedirSessao` passou a chamá-la em vez do regex inline.

**Motivo:** ele clicou no seletor de modo de um projeto do PC e recebeu *"nome
de projeto inválido"*. O nome passou a ter dois níveis (`games/hutukara`), e a
validação recusava barra inteira.

A recusa estava **certa em existir**: o nome vira CAMINHO do teu lado, e com
`..` ou barra no começo o pedido escreveria fora da pasta de projetos. Mudei o
critério, não a proteção: no máximo dois segmentos, nenhum `.` ou `..`, sem
barra invertida, sem dois pontos, sem barra no começo nem no fim. Treze casos de
travessia no portão.

Se tu tinhas trabalho não commitado ali, me avisa e eu ajudo a juntar.

## As armadilhas que eu paguei, para tu não pagar de novo

1. **A pasta abaixo de `projetos/` nem sempre É o projeto.** Seis agentes do teu
   lado em `D:\Documentos\projetos\games\hutukara`, e o painel chamava de
   `games`. `projectOf` agora pergunta ao disco e desce um nível quando o de
   cima não é projeto. **Só desce um**, senão todo monorepo muda de nome;
2. **Duas contas para "de que projeto é este agente" divergem.** Consertei o
   nome na lista e esqueci a contagem: o cartão nasceu com zero agentes e cara
   de desligado, com seis rodando dentro. Hoje é `nomeDoAgenteCom()`, uma só;
3. **`Date.now()` como valor padrão de parâmetro desliga qualquer cache**, sem
   erro. As medidas eram 1856ms, 1794ms, 1851ms, nenhuma o zero que denunciaria;
4. **Duas funções com o mesmo nome no mesmo arquivo**: a segunda apaga a
   primeira em silêncio, e o bloco desenha vazio com o dado carregado ao lado. O
   portão agora recusa;
5. **`window.DATA` não existe** no painel: a variável é do escopo do script. Um
   teste meu lia daí, media tudo vazio, e se absolvia sozinho;
6. **Grade estica os filhos até a altura do maior**, e isso vale para a do
   telefone e para a de desktop. Consertei uma e deixei a outra por um dia.

## O estado do projeto agora

- **A raiz do painel é o `ui_novo.html`**, a pedido dele em 30/08. O de antes
  continua em `/v2` e o primeiro em `/v1`. Voltar atrás é trocar uma linha em
  `web.mjs`, e nenhum arquivo foi apagado;
- o menu foi de 29 destinos para 19;
- o portão foi de 289 para **363 verificações**;
- o cartão de projeto caiu de 1171px de altura média para 805px;
- a folha de escolha de estado mostra 9 opções de primeira, contra 24 antes. **O
  catálogo continua inteiro**: 11 modos, 6 métodos, 7 papéis. O que mudou é a
  ordem, e o motivo está medido: método tem 6 opções e 1 em uso, fase tem 19 e 2
  em uso.

## Uma coisa que só tu podes resolver

**As onze pastas de projeto do PC não têm o prefixo `PC_`.** O caminho que a tua
máquina reporta é `D:\Documentos\projetos\cockpit`, e a regra dele de 23/08
manda `PC_cockpit`.

Ele perguntou *"cadê o PC_cockpit?"* olhando a tela, e a resposta é que ele está
lá, chamado pelo nome que a pasta tem.

Eu **não** inventei o prefixo na tela: o painel mostraria um nome que não existe
em disco nenhum. O que fiz foi o cartão dizer *"também em ALIENWARE-LIPE, como
cockpit"*, para o mesmo trabalho não virar duas linhas sem ninguém perceber.

Renomear as pastas é decisão e mão dele, e eu não faria sem ele: renomear com
sessão aberta quebra caminho.
