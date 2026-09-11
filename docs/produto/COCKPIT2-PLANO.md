---
tags: [produto, cockpit2, plano, execucao]
tipo: plano
para: a sessão que EXECUTA (Opus), lendo antes de encostar em código
atualizado: 2026-09-11
---

# Cockpit 2: plano de execução

Pesquisa e decisões: [[COCKPIT2-PESQUISA]] (`docs/produto/COCKPIT2-PESQUISA.md`).
Este arquivo é o que sobra dela em forma de tarefa. Foi escrito pela sessão
Fable `0174a7a8` em 11/09, por ordem dele: *"crie o planejamento antes todo
com pensamentos de Fable. Daí a gente executa com opus"*. **Quem lê isto não
pesquisa de novo: executa na ordem, prova cada passo, e para só no que é
decisão dele.**

---

## Estado da execução (11/09, sessão Opus, mesma marca `0174a7a8`)

| tarefa | estado | prova |
|---|---|---|
| M1 links na cor do tema | feita | `coresDosLinks` só `rgb(59,130,246)/none` (era `rgb(0,0,238)` sublinhado em 10 lugares) |
| M2 nota que continua | feita | `notaCortadaSemAviso: false`; o que não coube virou "mais N linha(s) nesta nota" |
| M3 inspetor sem tabela | feita | `botoesForaDoInspetor: []` (eram 4, 21px fora) e `celulasComMaisDeDuasLinhas: 0` (eram 24) |
| M4 topo do telefone | feita | primeiro bloco começa em 215px (era 318); o topo caiu de 190 para 87 |
| extra: ferramenta em voo | feita | o rótulo vinha com a linha de comando inteira e quebrava o cartão em 4 linhas; cortado em 60 no motor, com teste |
| M5 a VPS devolve o retrato | feita | duas cópias do painel conversando nesta máquina: sem o cabeçalho a resposta é a de sempre (`ok, recebido, jobs, pedidos`), com ele vêm 2 retratos, token errado dá 401 |
| M6 o desktop guarda o retrato | feita | na mesma prova, a máquina que empurra passou a enxergar as outras duas, e uma delas só existia do outro lado |
| M7 motor federado | feita | `dispositivos` da rota do cockpit 2 foi de 1 para 3 na prova; 2 testes novos (projeto único com duas presenças, e máquina calada que não vira presença nem cobrança) |
| M8 "ambos" na tela | feita | `c2Presenca`: uma máquina mostra o nome, duas ou mais mostram `ambos` com os nomes na dica |
| M9 menu conferido | feita | os 17 endereços abrem a tela certa com conteúdo; `#vps` caía na tela Cockpit e agora abre Máquinas; a tela de chegada padrão deixou de ser uma tela escondida |
| M10 teste no gate | **falta a linha** | `npm test` verde com 485 verificações e 0 falhas depois de tudo isto, mas `test-cockpit2.mjs` (17 verificações) ainda roda à parte: entrar no `npm test` é uma linha em `package.json`, que é de outra rota |
| extra: serviço de sistema na lista | consertado | ao juntar as duas máquinas, a federação carimba origem em TODA linha; o filtro passou a deixar entrar `mDNSResponder` e `wslrelay` e a lista foi de 10 para 33. Agora "veio de fora" compara o id da máquina, com teste |
| extra: o mapa gerado | regerado | fechar 13 itens do backlog deixou o `docs/ROADMAP.md` velho, e o gate acusou: regerado com `cc backlog gerar` |
| M11 publicar | **decisão dele** | leva junto o que a outra sessão não commitou |
| M12 substituir a raiz | **decisão dele** | quando ele disser que o cockpit 2 é o painel dele |

**O que a M5 e a M6 ainda NÃO fazem no mundo real:** a VPS roda a versão
publicada lá, que não conhece o cabeçalho. Enquanto ela não receber este
código, o desktop pede o retrato e não vem nada, e a tela continua mostrando
uma máquina só. Não quebra nada (servidor antigo ignora cabeçalho que não
conhece), mas "ambos" só aparece depois que a VPS subir esta versão. É por
isso que o CC-491 continua aberto no backlog.

**Defeito achado e consertado no caminho, que não estava no plano:** os
endereços antigos sem item de menu (`#vps`, `#servidores`, `#cockpit`,
`#agora`, `#ligados`) caíam na tela padrão, e a tela padrão era a Cockpit, que
o cockpit 2 esconde. Resultado: link escrito dentro do próprio painel levava a
uma tela que a barra lateral não mostra. Agora há uma lista de apelidos e a
tela de chegada é o Início.

## 0. Como usar este plano (leia inteiro antes da primeira tarefa)

1. **Rota.** Marque em `docs/ROTAS-ATIVAS.md` a rota `cockpit2` no seu id:
   TOMADA de `0174a7a8`, com a autorização dele já registrada (ele pediu que a
   execução fosse noutra sessão). Arquivos da rota: `src/ui_cockpit2.html`,
   `src/cockpit2.mjs`, `test-cockpit2.mjs`, `tools/cockpit2/*`,
   `docs/produto/COCKPIT2-*.md`. **`src/web.mjs`, `src/federacao.mjs`,
   `package.json`, `cc.mjs`, `test.mjs` NÃO são da rota**: cada toque neles é
   pedido por recado ao dono (hoje `simples` = 56665382 para `web.mjs`,
   `package.json`, `cc.mjs`, `test.mjs`; `front` = 670e1313 para
   `federacao.mjs`). O recado que funciona: tipo `vou_mexer`, dizendo as linhas
   exatas e "só acréscimo". As duas responderam em minutos em 11/09.
2. **Uma tarefa por vez**, na ordem da seção 4. Cada uma cabe numa linha do
   painel (`cc set` com `todos`, `cc done` ao fechar) e termina com a prova
   escrita na própria tarefa. Sem prova, não fecha.
3. **Prova é foto ou número**, nunca "deve funcionar". Os roteiros de prova
   estão prontos em `tools/cockpit2/` (seção 8).
4. **Nunca abra janela de navegador na cara dele**: todo comando que sobe o
   painel vai com `CC_SEM_NAVEGADOR=1`. O navegador de prova é o da skill
   `navegador` (porta 9333, perfil próprio).
5. **O painel de todo dia (porta 8099) roda da cópia PUBLICADA**
   (`AppData/Local/AgentCockpit`), não da pasta de edição. Mexer em `src/` não
   muda nada lá até `cc versao publicar` (tarefa M11). Para ver o que você
   editou, suba uma instância própria (seção 8.1).
6. **Sem travessão** em texto nenhum, sem crase em comentário dentro de
   template no HTML, sem `style="grid-template-columns:…"` inline (o gate
   recusa). Commit só quando ele pedir.
7. **Decisão dele vai no `AskUserQuestion`**, nunca em prosa. O que é decisão
   dele está marcado como **[decisão dele]** abaixo. O resto você decide.

---

## 1. Estado de partida (11/09, 07:40)

### 1.1 O que existe

| peça | onde | estado |
|---|---|---|
| a tela do cockpit 2 | `src/ui_cockpit2.html` (renomeado de `ui_simples.html`, ainda sem commit) | cópia byte a byte do painel de todo dia (`ui_novo.html`) mais os blocos abaixo |
| o motor | `src/cockpit2.mjs` | puro: `montar()`, `semanaDe()`, `falaDasLinhas()`, `avisoDoAgente()`, `ultimaFalaDoAgente()`; e `responder()`, que junta tudo para a rota |
| o teste | `test-cockpit2.mjs` | 13 verificações, `node test-cockpit2.mjs`. **Ainda fora do `npm test`** (M10) |
| a rota | `GET /api/cockpit2` em `src/web.mjs` | 3 linhas, feitas por 56665382 em 11/09; importa `./cockpit2.mjs` e responde `await m.responder()`, 500 com a mensagem se falhar |
| a rota da tela | `/cockpit2` (e `/simples`, mesmo arquivo) em `src/web.mjs` | feita por 56665382 |
| os roteiros de prova | `tools/cockpit2/prova.js`, `prova-design.js`, `inventario.mjs` | seção 8 |
| as fotos aprovadas | `assets/feedback/260911/cockpit2-*.png` | rodada 2, aprovada por ele com ressalva de desenho |
| instância de prova | `http://localhost:18150/cockpit2` (`node cc.mjs --web-only --port 18150`, fora do daemon) | pode estar viva ou não; subir de novo é a seção 8.1 |

### 1.2 Onde cada bloco mora dentro de `src/ui_cockpit2.html`

Procure pelo TEXTO, nunca pelo número da linha (o arquivo tem 15 mil linhas e
muda).

- **o menu escondido por CSS**: comentário `A VERSÃO SIMPLES: 20 itens de menu
  viram 10.` e, logo abaixo, `Cockpit 2, rodada 2 (11/09)`. Hoje escondem 6:
  `view-meus`, `view-framework`, `view-rotinas`, `view-cockpit`, `view-agora`,
  `view-projetos`.
- **o CSS do cockpit 2**: bloco `/* ===== Cockpit 2: Início, Projetos com
  inspetor, Servidores federado ===== */`, antes de `</style>`. Classes
  `c2-*`.
- **os itens de menu novos**: `data-target="view-inicio"`,
  `data-target="view-projetos2"`, `data-target="view-servidores2"`, dentro do
  grupo `O DIA A DIA`.
- **as seções**: `<!-- COCKPIT 2: as três telas que mudam de verdade` com
  `id="view-inicio"` (container `#c2-inicio`), `id="view-projetos2"`
  (`#c2-lista` e `<aside id="c2-insp">`), `id="view-servidores2"`
  (`#c2-serv`).
- **os títulos**: em `PAGE_METADATA`, chaves `view-inicio`, `view-projetos2`,
  `view-servidores2`.
- **a barra de baixo do telefone**: `const BARRA_PADRAO = ['view-inicio',
  'view-projetos2', 'view-trabalho', 'view-servidores2']`.
- **o código**: bloco `/* ===================== COCKPIT 2 =====================`
  no fim do script. Funções `c2Buscar`, `c2Extras`, `c2Render`,
  `c2RenderInicio`, `c2RenderProjetos`, `c2Inspetor`, `c2RenderServidores`,
  `c2Aviso`, `c2Bloco`, `c2Barra`. Lê `/api/cockpit2` a cada 5s enquanto uma
  das três telas está aberta, e no Início mais `/api/trabalho` (60s),
  `/api/notes`, `/api/vps` (30s), `/api/maquina` (10s), `/api/calendario`
  (5min). Usa as funções da tela antiga que já existem: `pintar`, `esc`,
  `age`, `seloDe`, `post`, `PAGE_METADATA`, `DATA.uso`.

### 1.3 O formato da rota `/api/cockpit2` (o que a tela consome)

```
{ dispositivos:[{id,nome,local,contato}],
  projetos:[{chave,nome,presenca:[nomes],espera:[aviso],sessoes:[...],servicos:[...],
             frenteEmCurso,pendencias:[...],horasHoje,ultimos7:[7],raiz,vivas}],
  espera:[aviso],           // agentes parados + pendências dele, os mais antigos primeiro
  rodando:[sessao+projeto], servicos:[...], semana:{disponivel,totalMs,dias:[7],porProjeto},
  ideias:[{projeto,nome,texto,em}], resumo:{...}, lidoEm, custoMs }
aviso = { tipo:'agente'|'pendencia', id, projeto, nome, frente, dispositivo, rotulo:
          'pergunta'|'travado'|'parou'|'parou sem perguntar', pergunta, opcoes:[], quantas,
          desdeMs, acao:'responder'|'destravar'|'abrir'|'feito', assunto, porque }
```

Medido em 11/09 com 18 agentes: 150 a 170ms com os caches quentes; 2,1s na
primeira chamada (varredura de portas).

---

## 2. As decisões dele que governam (palavras dele)

- *"o design do cockpit antigo pode ficar (…) ele tá muito bom, o problema dela
  é que as informações jogadas acabam perdendo o sentido"* (10/09). Cores,
  cartões, tipografia, barra de baixo: **não mudam**.
- *"gostei da simplificação, mas (…) não quero perder o que tem de bom no
  antigo, só quero que as informações redundantes sumam"* (11/09). Menu do
  antigo fica, menos o redundante.
- *"o framework é o cockpit na real, quero que seja o nome do método e do
  cockpit futuramente"* (11/09). Nos textos, framework = o sistema inteiro.
- *"quero que o desktop veja a vps tbm, o framework precisa criar essa
  conexão, mesmo que de forma barata, mas que tenha segurança, consistência e
  qualidade"* (11/09). É a M5+M6.
- *"vps_inovallbond e pc_inovallbond são o mesmo projeto (…) fica escrito
  alienware ali ou outro nome do pc, se for VPS fica escrito vps, e se for
  ambos beleza, fica escrito ambos"* (11/09). É a M7+M8.
- *"cuidado com o design, nos prints que você mandou tem coisa quebrada"*
  (11/09). É a seção 3, e vem ANTES de tudo.
- Backlog em dado: itens CC-482 a CC-499 (`node cc.mjs backlog`), frente
  `cockpit 2`. Feche com `node cc.mjs backlog fechar CC-nnn --prova "..."`.

---

## 3. Defeitos de desenho MEDIDOS (11/09, `tools/cockpit2/prova-design.js`)

Números, não impressão. Cada um tem conserto e prova.

| id | o que foi medido | conserto | prova |
|---|---|---|---|
| **D1** | os 9 links do Início saem na cor padrão do navegador, `rgb(0,0,238)` sublinhado; o acento do tema é `#3B82F6`. Mesmo em Servidores (`abrir ↗`) e no inspetor (`kanban · rotas · tempo`) | regra no CSS do cockpit 2: `.c2-bloco a, .c2-insp a, #c2-serv a, #c2-lista a { color: var(--accent); text-decoration: none; } …:hover { text-decoration: underline; }` | `prova-design.js`: `coresDosLinks` só com a cor do acento |
| **D2** | a nota é cortada no meio da linha (`scrollHeight > clientHeight`) sem nada dizer que continua | mostrar até 6 linhas e, se sobrar, uma linha `+N linha(s)` como link para `#notas`; ou degradê no fim mais o link. Nunca corte mudo | `notaCortadaSemAviso: false` |
| **D3** | no inspetor de projeto (409px) a tabela de sessões tem 423px; 4 botões `abrir` ficam 21px fora do cartão; 24 células com mais de duas linhas | trocar as duas `<table class="c2-tab">` do inspetor por linhas de cartão (`div`), duas linhas cada: `tipo · máquina · estado · modelo` e `há X · [abrir]`; no telefone continua igual, sem rolagem lateral | `botoesForaDoInspetor: []`, `celulasComMaisDeDuasLinhas: 0` |
| **D4** | no telefone (390×844) o topo herdado (chips `18 AGENTES`, `33 PRECISAM DE VOCÊ`, `modos`, avatar) mede 190px e o primeiro bloco do Início começa em 318px: 38% da tela antes do conteúdo | no Início e só no estreito, esconder as chips do topo (elas repetem o que o Início já mostra). A regra vai na media query do cockpit 2, escopada em `#view-inicio.active ~` ou por classe no `body` que o `c2Render` liga/desliga. Não tocar no cabeçalho das outras telas | `ondeComecaOPrimeiroBloco < 200` |
| **D5** | a régua `---- // resumo // ----` aparecia como fala do agente | **já consertado** em `cockpit2.mjs` (`semMarcadores`), com teste | teste 4 do `test-cockpit2.mjs` |
| **D6** | o título do topo ficava `Cockpit` na tela Início | **já consertado** em `c2Render` | `titulo: "Início"` nas fotos |

O que NÃO é defeito e não se mexe: a altura desigual dos blocos quando um lado
tem 1 cartão e o outro 4 (é o dado); o retrato da VPS de 20/08 (é verdade, e a
tela diz a data); "agy sem medição" (é verdade).

---

## 4. Micro-tarefas, na ordem

Formato: **objetivo · arquivos · o que fazer · prova · tamanho**. "Tamanho" é
o que cabe numa linha do painel: P (minutos), M (uma hora), G (quebrar em duas
se passar de uma linha).

### M1. Links e cores (D1) · P
- `src/ui_cockpit2.html`, bloco CSS `c2-*`.
- Acrescentar a regra de D1. Conferir também `.c2-mini a`.
- Prova: `node tools/cockpit2/prova-design.js` → `coresDosLinks` só com
  `rgb(59, 130, 246)/none`. Foto nova de `#inicio` em 1280.

### M2. Nota que continua (D2) · P
- `src/ui_cockpit2.html`, em `c2RenderInicio`, bloco `notas`.
- Contar as linhas do texto; mostrar 6; se houver mais, `+N linha(s)` com link
  `#notas`. Tirar o `max-height` que corta mudo, ou manter com o link visível
  fora do corte.
- Prova: `notaCortadaSemAviso: false` na medição; foto.

### M3. Inspetor sem tabela (D3) · M
- `src/ui_cockpit2.html`, função `c2Inspetor`.
- Sessões e serviços viram linhas de cartão (`div.c2-kv` empilhado ou um
  `div` por linha com duas linhas de texto), sem `<table>`. O botão `abrir`
  fica na segunda linha, alinhado à direita, DENTRO do cartão. Mesmo desenho
  serve ao telefone (hoje a tabela precisa de rolagem lateral).
- Prova: `botoesForaDoInspetor: []` e `celulasComMaisDeDuasLinhas: 0` em 1280;
  em 390, `scrollX` da tela = 390 e o inspetor sem rolagem lateral. Fotos das
  duas larguras.

### M4. Topo do telefone (D4) · P
- `src/ui_cockpit2.html`: media query do cockpit 2 e `c2Render`.
- `c2Render` liga `document.body.classList.toggle('c2-no-inicio', v ===
  'view-inicio')`; a media query esconde as chips do topo com
  `body.c2-no-inicio .<classe das chips> { display: none }` (descobrir a classe
  pelo DOM: é o bloco que contém `AGENTES` e `PRECISAM DE VOCÊ`; procurar por
  `precisam de você` no HTML). Só no estreito.
- Prova: `ondeComecaOPrimeiroBloco < 200` em 390; as outras telas continuam
  com o topo (foto de `#trabalho` em 390 igual à de antes).

### M5. A carona de volta leva o retrato da VPS · M · [pede recado: `web.mjs` é da `simples`, `federacao.mjs` é da `front`]
Hoje o desktop empurra o pacote para a VPS a cada 30s (`POST /api/federacao`,
token no cabeçalho `x-cc-token`, HTTPS) e a VPS responde `{recebido, jobs,
pedidos}`. Essa resposta é o único canal VPS→desktop que existe (a VPS não
alcança o desktop atrás do NAT), e já é usada para os pedidos (CC-166). É por
ela que o retrato viaja. Nada de rota nova, porta nova, chave nova.
- **Lado servidor (a VPS), em `src/web.mjs`, dentro do `if (url.pathname ===
  '/api/federacao' && req.method === 'POST')`**: a resposta ganha
  `retratos: [...]` SÓ quando o pedido trouxe o cabeçalho
  `x-cc-quer-retrato: 1` (cliente antigo continua recebendo o de sempre).
  `retratos` = o pacote da própria VPS mais os pacotes que ela guarda de
  OUTRAS máquinas (`lerPacotes()` filtrando `maquina.id !== pacote.maquina.id`
  do remetente). O pacote da própria VPS sai da MESMA função que o desktop usa
  para montar o dele: extrair de `empurrar()` a montagem
  (`montarMeuPacote()`), sem mudar o que `empurrar()` faz. Cada retrato é o
  formato de `montarPacote` (contrato 1), então `validarPacote` já sabe ler.
  Limite: se a soma passar de `LIMITE_PACOTE` (2 MB), manda só o da VPS.
- **Lado servidor, em `src/federacao.mjs`**: nada muda de formato. Se
  `montarMeuPacote()` for morar aqui em vez de `web.mjs`, é só acréscimo.
- Segurança e consistência, que foram exigência dele: mesmo token, mesmo
  HTTPS, mesmo `validarPacote` campo a campo, mesmo `LIMITE_PACOTE`, e o
  retrato só sai para quem já provou o token no mesmo pedido.
- Prova: `curl -s -X POST https://cockpit.carzo.com.br/api/federacao -H
  "x-cc-token: <token>" -H "x-cc-quer-retrato: 1" -H "content-type:
  application/json" -d @pacote.json | jq '.retratos | length'` ≥ 1, e
  `.retratos[0].maquina.nome` = o nome da VPS. Sem o cabeçalho, a resposta é a
  de antes (prova negativa). Teste em `test-federacao.mjs` (é da `sincronia`,
  livre): a resposta com e sem cabeçalho.

### M6. O desktop guarda o retrato · M · [pede recado: `web.mjs`]
- `src/web.mjs`, em `empurrar()`: o `enviar()` já devolve o corpo da resposta
  espalhado (`{ok, status, pedidos, ...}`). Acrescentar: mandar o cabeçalho
  `x-cc-quer-retrato: 1` (em `enviar()`, `federacao.mjs`, um campo no
  `headers`), e ao voltar, para cada `r.retratos[]`: `validarPacote` →
  `gravarPacote`. `gravarPacote` já grava em
  `control-center-federacao/` e `lerPacotes()` já lê de lá com validade por
  campo. **Não regravar o próprio pacote** (filtrar `maquina.id === eu`).
- Consequência automática: `/api/jobs` (`mesclar(jobs, pacotes, eu)`),
  `/api/servers` (`mesclar(..., 'servidores')`), `/api/projetos/painel`
  (`tambemEm`), `/api/tempo` (`mesclarTempo`) passam a enxergar a VPS no
  desktop, sem mexer em tela nenhuma delas.
- Prova: no desktop, `curl -s localhost:8099/api/federacao | jq
  '.maquinas | length'` = 2 (hoje é 1) e `.maquinas[1].nome` = VPS;
  `curl -s localhost:8099/api/jobs | jq '[.jobs[].origem.nome] | unique'`
  com as duas máquinas. Bandeja e tela Ajustes continuam iguais.

### M7. Motor federado: dispositivo = de onde veio · M
- `src/cockpit2.mjs`, `responder()` e `montar()`.
- `responder()`: `jobs = mesclar(todosOsJobs(agora), lerPacotes(), origem())`
  (de `federacao.mjs` e `maquina-id.mjs`, como `web.mjs` faz em `snapshot()`),
  e `servers = mesclar(readServers(), pacotes, origem(), 'servidores')`.
- `montar()`: `dispositivo` de cada sessão e serviço passa a ser
  `j.origem?.nome || local.nome` (hoje é sempre o local); `presenca` vira o
  conjunto desses nomes; `dispositivos[]` lista todas as máquinas conhecidas
  (`maquinasConhecidas(pacotes, ...)`) com `contato` = `!semContato`. Ideias e
  transcrito continuam só locais (o arquivo não viaja): para sessão remota,
  `falaDe` devolve `null` e o cartão diz "parou sem perguntar" com a máquina.
  **[decisão dele, se chegar aqui]**: a pergunta do agente da VPS só existe se
  o pacote levar a última fala; hoje não leva. Perguntar se ele quer que o
  campo `ultimaFala` entre no pacote (custo: ler a cauda de cada sessão
  parada, no empurrão de 30s; barato, mas é campo novo no contrato).
- Prova: `test-cockpit2.mjs` ganha 3 casos: sessão com `origem.nome:'vps'`
  dá `presenca:['alienware','vps']` no mesmo projeto; máquina sem contato não
  entra; serviço remoto sai com o dispositivo dele. Com a M6 no ar, a rota real
  devolve `dispositivos.length === 2`.

### M8. "ambos" na tela · P
- `src/ui_cockpit2.html`: `c2Linha` e `c2Inspetor` já desenham
  `presenca.map(c2disp)`. Acrescentar a palavra: 2 ou mais dispositivos com
  contato → chip `ambos` antes dos selos (é a palavra dele). A faixa do Início
  já lista `dispositivos`. Em Servidores, o filtro por dispositivo já existe.
- Prova: foto de Projetos com um projeto `ambos`; `prova.js` mede o texto.

### M9. Menu: fechar o que a rodada 2 decidiu · P
- CC-477 (herdado da `simples`: as telas escondidas virarem gaveta) vira **KO
  com motivo**: ele decidiu que as telas do antigo voltam ao menu; sobram 6
  escondidas por serem substituídas ou vazias. `node cc.mjs backlog` tem o
  comando de estado.
- Conferir que `view-infra` (Máquinas) continua no menu e que `#infra`,
  `#notas`, `#agenda`, `#vps`, `#trabalho`, `#tempo`, `#rotas`, `#analise`
  (os links do Início) abrem a tela certa: `prova.js` com esses hashes, ou
  clique no navegador.
- Prova: lista dos 8 hashes com `ativa` certa.

### M10. Gate · P · [pede recado: `package.json` é da `simples`]
- `package.json`: `test-cockpit2.mjs` entra no `npm test` como os outros
  `test-*.mjs` (ver como `test-backlog.mjs` entrou).
- `test-projeto-novo.mjs` (rota consumida por prefixo): `/api/cockpit2` é
  consumida por `ui_cockpit2.html`; conferir que o gate olha esse arquivo ou
  registrar a exceção com motivo.
- `npm test` verde inteiro, e o número de verificações no relatório.

### M11. Publicar · P · [decisão dele: quando]
- O painel de todo dia roda da cópia publicada. `node cc.mjs versao` mostra as
  duas versões; `node cc.mjs versao publicar` copia a pasta de edição para lá.
  **Leva junto tudo que está na árvore**, inclusive o que a `simples` ainda
  não commitou: publicar é com a árvore commitada ou com ele autorizando.
- Depois: `CC_SEM_NAVEGADOR=1 cc daemon restart`, e a prova: `curl -s -o
  /dev/null -w "%{http_code}" http://127.0.0.1:8099/cockpit2` = 200, mais as
  fotos na 8099.
- Matar a instância de prova da 18150 quando não precisar mais
  (`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.CommandLine -like '*--port 18150*' } | ForEach-Object { Stop-Process -Id
  $_.ProcessId -Force }`).

### M12. Substituir a raiz · P · [decisão dele]
- Quando ele disser que o cockpit 2 já é o painel dele: `/` passa a servir
  `ui_cockpit2.html` e o antigo fica em `/v3` (hoje `/`, `/novo` e `/v3`
  servem `ui_novo.html`). É mudança de uma linha em `web.mjs` (dono:
  `simples`/`front`), e a bandeja e o atalho continuam apontando para `/`.

### Depois (registrado, sem data)
- Uso do agy: não existe fonte; o bloco diz isso. Se um dia o agy expuser
  cota, é um campo em `uso.mjs`.
- Agenda: configurar o iCal dele pela tela Agenda; o Início já mostra quando
  existir.
- Retrato da VPS mais fresco: com a M5, o pacote da VPS pode levar
  `maquina` (CPU/RAM) e a saúde dela, e o bloco VPS do Início deixa de
  depender do clique por SSH. É acréscimo no `montarMeuPacote()` da VPS.

---

## 5. Ordem, dependências e paralelismo

```
M1 → M2 → M3 → M4        (só tela; 1 sessão; ~2 linhas do painel cada)
M5 → M6 → M7 → M8        (a federação; M5 e M6 pedem recado; M7 tem teste)
M9, M10                  (podem correr a qualquer hora, são curtas)
M11                      (depois de M1..M10 e com a árvore commitada)
M12                      (só com ele)
```

Uma sessão só faz tudo em um dia. Duas sessões: uma na tela (M1 a M4, M8), outra
no motor e na federação (M5 a M7), sem arquivo em comum além do que já está
partilhado por recado.

---

## 6. Definição de pronto do cockpit 2 (o que ele aprova no fim)

1. `/cockpit2` no painel de todo dia (8099), publicado.
2. Início com os 11 blocos, todos dizendo "não deu para ler" quando a fonte
   falha, e nunca vazio mudo.
3. Projetos: um projeto por linha, `alienware`, `vps` ou `ambos` ao lado;
   inspetor sem nada fora do cartão em 1280, sem rolagem lateral em 390.
4. Servidores: lista única com a coluna dispositivo, as duas máquinas.
5. Nenhum link na cor padrão do navegador; nenhum bloco cortado sem aviso.
6. `npm test` verde com `test-cockpit2.mjs` dentro.
7. Fotos de prova das 3 telas em 1280 e 390 em `assets/feedback/<data>/`.
8. Os itens CC-482 a CC-499 fechados com `--prova`, ou KO com motivo.

---

## 7. O que NÃO fazer

- Não mudar cor, tipografia, cartão, barra de baixo (palavra dele).
- Não tocar `ui_novo.html`, `ui_v2.html`, `projetos.mjs`, `trabalho.mjs`,
  `meu.mjs`, `travas.mjs`: são de outras rotas.
- Não pôr leitura cara no tique de 5s (o kanban custa 2,4s: fica nos 60s).
- Não chamar SSH em timer (decisão registrada no `vps.mjs`).
- Não inventar texto para o cartão de aviso: o texto é a fala do agente.
- Não esconder tela nova por CSS: ou entra no menu, ou não existe.
- Não publicar com trabalho alheio não commitado sem ele autorizar.

---

## 8. Comandos prontos (cada um explicado, como ele pede)

### 8.1 Subir uma instância de prova da pasta de edição

```powershell
$env:CC_SEM_NAVEGADOR='1'; Start-Process -FilePath node -ArgumentList 'cc.mjs','--web-only','--port','18150' -WorkingDirectory 'D:\Documentos\projetos\cockpit' -WindowStyle Hidden
```
- `$env:CC_SEM_NAVEGADOR='1'` = variável de ambiente que impede o painel de
  abrir janela de navegador (regra da casa: nunca abrir na cara dele).
- `Start-Process` = inicia um processo separado, que continua vivo depois do
  comando terminar. `-FilePath node` = o programa (Node.js).
- `-ArgumentList 'cc.mjs','--web-only','--port','18150'` = os argumentos:
  `cc.mjs` (a entrada do painel), `--web-only` (só o servidor web, sem a tabela
  do terminal), `--port 18150` (a porta; **8101 a 8300, 8426 a 8725 e 7937 a
  8036 são reservadas pelo Windows nesta máquina** e dão `EACCES`).
- `-WorkingDirectory` = a pasta onde o comando roda (a de edição).
- `-WindowStyle Hidden` = sem janela de console.
- Como saber que deu certo: `curl -s -o /dev/null -w "%{http_code}"
  http://127.0.0.1:18150/cockpit2` imprime `200`.
- **A instância guarda em memória o `cockpit2.mjs` da hora em que subiu**
  (o servidor não recarrega módulo). Mexeu no motor, mate e suba de novo. A
  tela (`.html`) é relida a cada pedido, mas o navegador pode ter cache: use
  `?v=<qualquer número>` no endereço.

### 8.2 As fotos das telas, com medição

```bash
node tools/cockpit2/prova.js "D:/Documentos/projetos/cockpit/assets/feedback/260911" "http://127.0.0.1:18150/cockpit2"
```
- `node tools/cockpit2/prova.js` = o roteiro que abre o navegador da skill
  `navegador` (porta 9333, perfil próprio, sem pedir autorização).
- primeiro argumento = a pasta onde as fotos são gravadas (criar antes; usar a
  data do dia).
- segundo argumento = o endereço da instância.
- Saída: uma linha `medido <foto> {…}` por tela, com `erros` (tem que ser
  `[]`), `scrollW` (tem que ser igual à largura), `centrosBarra` (em 390, os
  cinco botões da barra de baixo: `39,117,195,273,351` prova que a largura é
  real), e as fotos `cockpit2-*.png`.

### 8.3 A medição dos defeitos de desenho

```bash
node tools/cockpit2/prova-design.js
```
- Abre as telas em 1280 e 390 na instância da porta 18150 e imprime:
  `coresDosLinks`, `notaCortadaSemAviso`, `botoesForaDoInspetor`,
  `celulasComMaisDeDuasLinhas`, `ondeComecaOPrimeiroBloco`. São os números da
  seção 3; M1 a M4 estão prontas quando eles zeram.

### 8.4 O teste do motor

```bash
node test-cockpit2.mjs
```
- Roda as verificações do motor puro (13 em 11/09). Última linha: `N ok, 0
  falhas (cockpit2)`. Qualquer outra coisa é falha.

### 8.5 O inventário das rotas do painel (se precisar conferir um formato)

```bash
node tools/cockpit2/inventario.mjs
```
- Bate em ~50 rotas do painel da porta 8099 e imprime o formato real de cada
  resposta, com tamanho e tempo. É como a pesquisa mediu o que existe.
