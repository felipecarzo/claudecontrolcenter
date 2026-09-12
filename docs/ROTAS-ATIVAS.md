---
tags: [processo, multi-agente]
tipo: quadro
atualizado: 2026-08-12
pastas-controladas: [src]
---

# Rotas ativas — quadro vivo do Método Routia

Protocolo completo: `docs/guias/metodo-routia.md` deste projeto se existir,
senão o modelo em `- projeto_template/docs/guias/metodo-routia.md`. Este
arquivo muda toda hora — é o estado agora, não histórico. Sessão nova o lê no
Passo 0, antes de tocar em qualquer arquivo.

**🟢 livre · 🔴 ocupada · 🎫 ticket pendente**

> Este arquivo só existe em projetos com mais de uma sessão trabalhando em
> paralelo. Se este é um projeto de sessão única, apague este arquivo — ele
> fica "ocupado" esquecido e confunde mais do que ajuda.

## Sprint atual

<!-- Preencha as rotas de acordo com a estrutura real do projeto. Exemplo: -->

**🔒 Sessão de senhas (15/08):** o Felipe vai abrir uma sessão só para resolver as senhas
da VPS. **Ela não marca rota nenhuma**, de propósito: sem rota marcada o `rota-guard` já
recusa editar código, que é exatamente o que se quer ali. Se aquela sessão precisar mexer
em código, o certo é parar e abrir outra — credencial e edição de arquivo não se misturam.

| Rota | Status | Quem / o quê | Desde |
|---|---|---|---|
| `cockpit2` | 🔴 ocupada | 0174a7a8 (PC) — **o cockpit 2: painel novo rodando em paralelo ao atual até substituí-lo, mesmo design, dados refeitos. Decisão dele em 11/09 nesta sessão** (*"quero criar um cockpit 2 (…) nós começamos isso na outra sessão mas ela foi p outro lado, achei melhor continuar daqui"*). Escolhas dele na pergunta direta: é o MESMO trabalho da tela nova que 56665382 abriu (não outra coisa), e roda como rota nova no mesmo servidor. **TOMADA de `simples` (56665382) só a TELA**, porque ela virou frente de backlog por decisão dele em 11/09 de madrugada; o backlog continua com ela. `src/ui_simples.html` renomeado para `src/ui_cockpit2.html` (git mv, arquivo ainda sem commit). **📌 `src/web.mjs` NÃO foi tocado por mim: 56665382 trocou ela mesma as duas linhas da rota em 11/09 às 06:31 (recado "terminei, pode ir"), `/cockpit2` e `/simples` respondem o mesmo arquivo, 200 nas duas. O arquivo continua dela.** **Fase agora: pesquisa e plano, em `docs/produto/COCKPIT2-PESQUISA.md`, antes de qualquer tela.** **11/09, 10:50: o PLANO FOI EXECUTADO (M1 a M9), nesta mesma sessão, já como Opus.** Os quatro defeitos de desenho medidos zeraram (links na cor do tema, nota que diz quanto falta, inspetor sem nada fora do cartão, topo do telefone de 318 para 215px), mais dois achados no caminho: a ferramenta em voo vinha com a linha de comando inteira e quebrava o cartão, e os endereços antigos sem item de menu (`#vps`, `#servidores`, `#cockpit`) caíam numa tela escondida. A ligação com a VPS está escrita e PROVADA com duas cópias do painel conversando nesta máquina (sem o cabeçalho a resposta é a de sempre, com ele o retrato atravessa, token errado dá 401, e a ponta que empurra passou a enxergar as outras duas); no mundo real ela só acende quando a VPS subir esta versão, por isso o CC-491 continua aberto. `npm test` verde, 485 verificações, 0 falhas, mais 17 do `test-cockpit2.mjs` que ainda roda à parte. 13 itens do backlog fechados com prova. **11:00, com autorização dele: `test-cockpit2.mjs` entrou no `npm test` (502 verificações, 0 falhas) e a pasta foi PUBLICADA para a cópia que roda. O cockpit 2 está no ar no painel de todo dia, em `http://localhost:8099/cockpit2`, provado em foto (`assets/feedback/260911/cockpit2-no-painel-de-todo-dia.png`). A cópia de prova da porta 18150 foi desligada. Nada foi commitado, e nada foi para a VPS: as duas coisas são decisão dele, e enquanto a VPS não subir esta versão o "ambos" não acende (CC-491).** **Antes:** 07:45: rodada 2 APROVADA por ele com duas ordens ("cuidado com o design, tem coisa quebrada" e "planejamento com Fable, execução com opus"). Os defeitos foram MEDIDOS no navegador (links na cor padrão, nota cortada muda, tabela do inspetor 423px em 409px com botões 21px fora, topo do telefone comendo 318px) e estão com conserto e prova em `docs/produto/COCKPIT2-PLANO.md`, junto das 12 micro-tarefas (M1 a M12) e dos comandos prontos. ESTA SESSÃO NÃO EXECUTA: a próxima sessão (Opus) marca esta rota no próprio id, TOMADA de 0174a7a8 com a autorização dele já dada, e segue o plano na ordem. Roteiros de prova em `tools/cockpit2/`.** **Antes:** Rodada 2 às 07:25, a pedido dele ("gostei da simplificação, mas não quero perder o que tem de bom no antigo"): as telas do antigo voltaram ao menu (só Cockpit, Agora, Projetos velho, Meu painel, Framework e Rotinas ficam escondidas), e o Início virou o combinado que ele listou: avisos com a pergunta do agente, o que roda, suas tarefas, notas, ideias, agenda, resumo do kanban, semana trabalhada, limites do Claude (agy sem medição), notebook e VPS, serviços no ar. Motor com 13 verificações.** **Antes:** Pesquisa entregue às 06:45; PROTÓTIPO PRONTO às 07:00, esperando aprovação dele: Início, Projetos com inspetor e Servidores, com dado real deste PC, fotos em `assets/feedback/260911/cockpit2-*.png` (zero erro de console, 390 real). Instância temporária da pasta de edição no ar em `http://localhost:18150/cockpit2` (processo `node cc.mjs --web-only --port 18150`, fora do daemon; matar com Stop-Process quando não precisar mais). O painel de todo dia (8099) roda da cópia PUBLICADA e não tem a rota: publicar é decisão dele, porque leva junto o que a `simples` ainda não commitou.** Motor novo `src/cockpit2.mjs` (puro, junta jobs + sessões + servidores + docker + tarefas dele no modelo projeto único/presença/sessões/serviços) e `test-cockpit2.mjs`; a rota `GET /api/cockpit2` em `web.mjs` foi PEDIDA a 56665382 por recado, duas linhas.** **📌 `src/web.mjs` (da `simples`) e `src/federacao.mjs` (da `front`) EMPRESTADOS em 11/09 às 10:20, com autorização dele na hora ("Autorizo, só acréscimo"), para as tarefas M5 e M6 do plano: o desktop passar a ver a VPS. Medido antes de pedir: 56665382 está parada há 5h56, marcada como provavelmente órfã, e o recado que mandei às 10:15 ficou sem resposta; `src/web.mjs` tem 80 linhas dela SEM COMMIT (a rota `/cockpit2`, a rota `/api/cockpit2` e o campo `quebras` em `/api/travas`), então a edição é por trecho, nunca sobrescrever nem dar checkout; `src/federacao.mjs` está LIMPO no git, último commit de 10/09. SÓ ACRESCENTO: em `federacao.mjs`, o cabeçalho `x-cc-quer-retrato` no `enviar()` e o campo `ultimaFala` no recorte de job do `montarPacote`; em `web.mjs`, uma função nova que monta o retrato desta máquina, o campo `retratos` na resposta do `POST /api/federacao` (só para quem manda o cabeçalho) e a gravação dos retratos que voltam, dentro de `empurrar()`. Nada do que elas escreveram é tocado. Devolvo ao fechar.** **📌 DEVOLVIDOS às 11:00, com o trabalho pronto e o gate verde: em `federacao.mjs` entraram o cabeçalho `x-cc-quer-retrato` no `enviar()` e o campo `ultimaFala` no recorte de job; em `web.mjs`, a função `retratoDestaMaquina()`, o campo `retratos` na resposta do `POST /api/federacao` (só para quem manda o cabeçalho) e a gravação dos retratos que voltam dentro do `empurrar()`. As 80 linhas sem commit da `simples` continuam intactas. `package.json` também foi tocado, com autorização dele na hora, para o `test-cockpit2.mjs` entrar no `npm test`: uma linha, e o gate passou a contar 502 verificações.** **📌 11/09, 15h: a frente virou o FRAMEWORK, por ordem dele** (*"precisamos transformar o projeto num FRAMEWORK (…) vamos voltar pra esse ponto crucial"*). Dez decisões fechadas em entrevista, registradas em `docs/produto/FRAMEWORK-RAIZ.md`. Começo pelo item: natureza, área, tamanho, intenção, pronto e conferir obrigatórios. **`src/backlog.mjs` EMPRESTADO da `simples` (56665382) às 15h, com autorização dele na hora, depois de medir que ela está parada há 3h59 e marcada como provavelmente órfã. SÓ ACRÉSCIMO: vocabulário novo e validação nova, sem mudar o que existe. Os 543 itens de hoje continuam válidos, porque a exigência vale na criação e para item aberto, nunca para fechado.** **📌 16h: achado e consertado, da queixa dele** ("os projetos ligados aqui no pc, tem VARIOS, e eles nao tao aparecendo no cockpit pra eu usar o framework. e os que da p usar nao tem o modo entrevista de MVP"). Causa: a tela Projetos do cockpit 2 só listava quem teve sessão nas últimas 24h (9 de 29), e o inspetor nunca chamava `blocoFramework()`, a peça já pronta com fase/MVP/modo/entrevista/o botão de ligar. Consertado em `src/ui_cockpit2.html`: a lista une jobs recentes com a varredura de disco inteira, e o inspetor mostra o bloco de framework completo. Achado no caminho: carga fria em `#projetos2` não disparava o carregamento (CC-535, corrigido). Provado no painel de todo dia PUBLICADO: 32 linhas, 15 "sem framework", `cockpit` com fase Execução e MVP 7/7, a folha de ligar abre com 24 escolhas. Gate 563. Fotos em `assets/feedback/260911/cockpit2-painel-real-final.png` e `cockpit2-folha-ligar.png`. Nada commitado.** **📌 madrugada de 12/09: dois bugs do print dele consertados e provados (badge sobrepondo o nome do projeto, CC-537; mensagem errada do kamilleLeal, CC-538), 17 pedidos órfãos do Routia negados a pedido dele. Depois, ele achou que a causa raiz do kamilleLeal era maior: "projeto" hoje é dedução de pasta no disco, e ele quer que nasça como registro central no framework, com GitHub como repositório de verdade e as pastas do PC/VPS como clones (CC-539, decisão dele, plano em 5 fases aprovado — `~/.claude/plans/silly-bubbling-emerson.md`). Fase 1 (CC-540, o módulo `src/projetoRegistro.mjs` + rota `/api/registro/projetos`) fechada e provada com dois servidores reais. Fase 2 (CC-541, `src/github.mjs`) pela metade: falta decidir com ele se cria um repositório de teste de verdade antes de fechar. Nada commitado ainda — fica para a próxima sessão continuar.** 🎚 continuativo 📁 src/ui_cockpit2.html 📁 src/cockpit2.mjs 📁 test-cockpit2.mjs 📁 tools/cockpit2/ 📁 docs/produto/COCKPIT2-PESQUISA.md 📁 docs/produto/COCKPIT2-PLANO.md 📁 docs/produto/FRAMEWORK-RAIZ.md 📁 hooks/fala-guard.mjs 📁 src/web.mjs 📁 src/federacao.mjs 📁 src/backlog.mjs 📁 src/projetoRegistro.mjs 📁 src/github.mjs 📁 test-projeto-registro.mjs 📁 test-github.mjs | 2026-09-12 |
| `simples` | 🔴 ocupada | 56665382 (PC) — **a versão simples do cockpit, frente aberta por ele em 10/09 à noite** (*"fazer uma versão mais simples, pq tem muitas janelas"*). Arquivo NOVO `src/ui_simples.html`, de ninguém antes: menu de 9 itens decididos por ele, protótipo inteiro para aprovação antes de execução tela a tela (CC-461 a CC-467 no ROADMAP). **📌 `src/web.mjs` EMPRESTADO da `front` (670e1313) em 10/09, com autorização dele na hora ("Autorizo, só acréscimo"), depois de medir que 670e1313 está parada na VPS esperando ele e que o arquivo está limpo no git. SÓ ACRÉSCIMO: uma rota `/simples` ao lado de `/v1` e `/v2`. Nada do resto é tocado. Devolvo ao fechar.** **📌 11/09, madrugada: a frente virou OUTRA, por decisão dele.** Depois de medir os 11 pontos dele (o framework não está ligado neste PC, 67% dos itens do quadro sem id, 82% do backlog é passado), ele pediu: *"antes disso precisamos criar um backlog robusto, uma definição de pronto do cockpit. transformar isso num projeto serio"*. Escolhas dele na pergunta direta: backlog vira **dado de verdade** (*"o que for melhor pra máquina"*, com códigos de estado de produção), o ROADMAP.md passa a ser **gerado** dele, e os 266 itens fechados vão para histórico. Arquivos novos: `src/backlog.mjs`, `test-backlog.mjs`, `docs/backlog.jsonl`. **📌 `src/web.mjs` EMPRESTADO à rota `cockpit2` (0174a7a8) em 11/09 às 10:20, com autorização dele na hora, depois de esta sessão ficar 5h56 sem sinal e sem responder ao recado. SÓ ACRÉSCIMO, editado por trecho: as 80 linhas sem commit desta rota (a rota `/cockpit2`, a rota `/api/cockpit2`, o campo `quebras` em `/api/travas`) não foram tocadas. Volta ao fechar.** 🎚 continuativo 📁 src/ui_simples.html 📁 src/web.mjs 📁 src/backlog.mjs 📁 test-backlog.mjs 📁 docs/backlog.jsonl 📁 src/roadmap.mjs 📁 src/instalacao.mjs 📁 src/migrarBacklog.mjs 📁 test-instalacao.mjs 📁 test-migrar.mjs 📁 cc.mjs 📁 package.json 📁 test.mjs 📁 test-janela.mjs 📁 src/hooksCatalogo.mjs 📁 src/meu.mjs 📁 src/platform.mjs 📁 src/trabalho.mjs 📁 src/travas.mjs 📁 CLAUDE.md 📁 docs/produto/MVP.md 📁 docs/ROADMAP.md | 2026-09-10 |
| `front` | 🔴 ocupada | 670e1313 — **SEGUE em 27/08 (noite) com a frente das ROTAS, autorizada por ele ("pode seguir, cria um backlog primeiro, registra tudo por tarefa e começa a executar"): a tela lateral das rotas e os tickets entre agentes, CC-374 mais a fatia 1 do CC-376. Arquivos novos (`src/rotas.mjs`, `test-rotas.mjs`) não pisam em ninguém. **Antes:** 670e1313 — **PEDIDA a c82a3fbf em 27/08 e LIBERADA por ela ("pode mexer, não me atrapalha"), a pedido dele: "peço a vez pra ela", em vez de tomar.** Trabalho aqui: **a Central vira TRÊS telas** (só os ligados, todos os projetos, e os ajustes gerais), mais a lista que atualiza sozinha. Frente nova de 27/08 no roadmap, CC-364 a CC-368. ⚠️ **c82a3fbf deixou trabalho SEM COMMIT neste mesmo arquivo** e avisou no recado: a faixa `.kb-soltos` dentro de `renderViewTrabalho` com CSS perto de `.kb-filtros`, o `overscroll-behavior-x: none` em `html`/`body` e o `contain` em `.kb-quadro`. **Editar por trecho: nada de sobrescrever o arquivo nem dar checkout nele.** **📌 `src/federacao.mjs` EMPRESTADO da `sincronia` em 30/08, com autorização dele na hora (ele escolheu "pode mexer, é só acréscimo" na pergunta direta), depois de medir que `fbabdeb0` não dá sinal nesta máquina desde 26/08. Motivo: ele pediu *"mande um recado pra sessão no pc"* e o recado do Routia morre em `docs/.recados.json`, que está no `.gitignore` e nunca atravessa. O canal que atravessa é a fila da federação, que hoje só carrega cinco ações fechadas e nenhum texto. SÓ ACRÉSCIMO: a ação `recado` na lista, e o campo de texto validado em `pedirSessao`. Nada do que `fbabdeb0` escreveu foi tocado.** **📌 Mesmo arquivo, mais tarde em 31/08, mesma partilha: três ações novas (`sincronia-puxar`, `-enviar`, `-ambos`) para o botão que sincroniza a máquina de lá com um clique daqui (CC-447). Só acréscimo de novo, e sem tocar no que `fbabdeb0` tinha escrito. Nenhum conflito de código apareceu no merge do dia com o PC; o único conflito foi nesta linha do quadro, porque as duas máquinas escreveram nela ao mesmo tempo sem se ver.** **📌 `src/web.mjs` EMPRESTADO a 2d4e7b74 (PC) em 30/08, com autorização dele na hora ("4. quero", escolhendo o caminho 2 do CC-433: definir o MVP de um projeto do PC pela VPS). SÓ ACRESCENTA um ramo em `atenderPedidos`, do lado que EXECUTA, no mesmo formato dos seis que já existem ali. Nada da tela nem das rotas que tu estás mexendo é tocado. Devolvo ao fechar.** **📌 `src/web.mjs` EMPRESTADO de novo a 2d4e7b74/51c2da13 (mesma sessão, PC) em 30/08 à noite, com autorização dele na hora ("fazer certo: interruptor separado"), pra fechar o CC-340 (a bandeja poder pausar a sincronia sem apagar token/endereço). SÓ ACRESCENTA: um `if` no início de `empurrar()` (retorna cedo quando `federacao.ativo === false`), um campo `ativo` na resposta de `GET /api/federacao`, e duas rotas novas `POST /api/federacao/pausar` e `/retomar`. Nada do `atenderPedidos` nem do resto do arquivo é tocado. Devolvo ao fechar.** **📌 `src/federacao.mjs` EMPRESTADO a 2d4e7b74 (PC) em 30/08, com autorização dele na hora ("pode seguir"), depois do merge que trouxe esta linha para cá. Motivo: fechar a metade de RECEBIMENTO do CC-445, que é a lacuna que TU levantaste no `docs/ALINHAMENTO-2026-08-30.md`. Só ACRESCENTA quatro campos no bloco `framework:` do `validarPacote` (`metodo`, `mvp`, `autorizado`, `pedidos`), com o mesmo recorte dos vizinhos. Nada do que tu escreveste ali (a ação `recado`, o `nomeDeProjetoSeguro`) é tocado. Devolvo ao fechar.** **📌 `src/ui_novo.html` declarado em 31/08: ninguém reivindicava, e o trabalho do Coderoom (CC-448, redesenho do painel principal) vai mexer bastante nele por um tempo.** **📌 `src/web.mjs` EMPRESTADO a `sincronia` (e2b33ef8) em 09/09, com autorização dele na hora ("autoriza eu pegar agora"), depois de medir que esta sessão está `waiting` (parada esperando ele, não trabalhando), que o pedido por recado ficou sem resposta por isso, e que o arquivo está LIMPO no git — nada teu sem commit. SÓ ACRESCENTA duas coisas no bloco do ciclo que empurra o pacote (onde `retrato` já é calculado): `estadoServicoAsync()` no import e o campo `servico` no `montarPacote`. Nada da tela de rotas, da Análise nem do `atenderPedidos` é tocado. CC-452. **DEVOLVIDO em 10/09**, com a rota dona confirmando por recado que não tinha nada pendente ali ("liberado, meu trabalho está todo commitado em 762ce7e, árvore limpa"). Entraram duas linhas no bloco do `montarPacote` (`estadoServicoAsync` no import, campo `servico` no pacote); a rota `/api/agy-remote-control` e as constantes do agy não foram tocadas.** **📌 `src/web.mjs` EMPRESTADO a `simples` (56665382, PC) em 10/09 à noite, com autorização dele na hora ("Autorizo, só acréscimo"), depois de medir que 670e1313 está parada na VPS esperando ele e que o arquivo está LIMPO no git. SÓ ACRESCENTA uma rota `/simples` ao lado de `/v1` e `/v2`, servindo o arquivo novo `src/ui_simples.html`. Nada do resto é tocado. Devolvo ao fechar.** **📌 Em 11/09 a própria 56665382 trocou essas linhas: a rota serve `ui_cockpit2.html` em `/cockpit2` (e `/simples` segue respondendo o mesmo), a pedido da rota `cockpit2` (0174a7a8), que não encostou no arquivo.** 📁 src/rotas.mjs 📁 test-rotas.mjs 📁 src/ui_v2.html 📁 src/web.mjs 📁 src/projetos.mjs 📁 src/ui_novo.html | 2026-08-27 |
| ~~`front`~~ (histórico do mesmo dia) | 🟢 livre | c82a3fbf: **TOMADA de d4b47d4e em 27/08, com autorização dele na hora ("pego a rota da tela").** Medido antes de pedir: `cc routia presenca` dava d4b47d4e calada há 12h15, marcada como provavelmente órfã, segurando quatro rotas de uma vez. **O trabalho dela NÃO foi descartado:** ficam dois tickets abertos no nome dela logo abaixo, e os dois recados já enviados continuam valendo. Trabalho aqui: **o quadro Kanban, primeira fatia, colunas por ETAPA e só leitura**, escolha dele em 27/08. O card anda sozinho no eixo do trabalho, movido pelos agentes; arrastar fica para o eixo da decisão, depois. 📁 src/ui_v2.html 📁 src/trabalho.mjs | 2026-08-27 |
| `framework-modo` | 🟢 livre | **c82a3fbf fechou em 27/08: o CC-362, as três causas do modo que diverge.** (a) a herança de rota casava sessão apenas CITADA na linha, e a regra do dono virou `donoDaLinha()`/`linhaEhDaSessao()` em `src/routia.mjs`; (b) o id `restritivo` virou `continuativo`, com o nome velho seguindo aceito, e `modoDe()` passou a resolver apelido (sem isso a troca desligaria a trava dos 12 projetos); (c) campo derivado deixou de ser gravado, e a regra é o prefixo `_`, não a lista. Gate verde, 185 verificações, com prova negativa. Falta só pintar no cartão, ver o ticket. | : |
| ~~`framework-modo`~~ (histórico) | 🟢 livre | c82a3fbf: **CC-362, a tela diz um modo e a trava usa outro.** Três causas medidas em 27/08, não uma: (a) o id `restritivo` tem título "Continuativo" e `trava:false`, então o registro carimbado "restritivo" lê-se ao contrário do que ele faz; (b) `modoDaRota()` casa a sessão por substring na linha inteira, então sessão apenas CITADA no histórico de uma linha ocupada herda o modo daquela rota (medido: `721fa1f4` pegou o modo da `front` sem nunca ter tido a rota); (c) `_rota`, campo derivado, está GRAVADO em `.framework/estado.json`, então toda sessão sem rota recebe `_rota: "sistemas"`, de uma rota fechada ontem. **Sem `🎚` de propósito: marcar modo na própria linha é exatamente o que está sob conserto.** 📁 src/frameworkDisco.mjs 📁 src/framework.mjs 📁 src/routia.mjs 📁 hooks/framework-inicio.mjs 📁 src/web.mjs | 2026-08-27 |
| ~~`framework`~~ (🎫 resolvido) | 🟢 fechado | **2d4e7b74 fechou em 30/08: ele autorizou na hora ("pode seguir") e o empréstimo foi declarado nos dois lados do quadro, com o mesmo caminho que a `front` usou ao pegar este arquivo mais cedo.** Os quatro campos entraram no `validarPacote`, e a prova agora mede a TRAVESSIA (ida e volta por JSON, mais um caso com lixo em todos eles): `metodo` e `mvp` chegam do outro lado. O texto original do pedido, para quem for ler a linha do tempo: 2d4e7b74 (PC) pede a 670e1313 (VPS): **a metade de RECEBIMENTO do CC-445**, em `src/federacao.mjs`, que o merge de 30/08 mostrou estar reivindicado por ti. O lado que MANDA já está feito e é da minha rota (`src/travasDaMaquina.mjs`): o retrato do framework passou a levar `metodo`, `mvp` (nome e critérios), `autorizado` e `pedidos`, que era a lacuna que **tu mesma levantaste** no `docs/ALINHAMENTO-2026-08-30.md`. **Medido agora, e é exatamente o que tu avisaste que aconteceria:** o campo sai daqui com 11,8 KB e 11 projetos com MVP, e `metodo` e `mvp` **SOMEM** na travessia, porque `validarPacote` recorta campo a campo e não os conhece. Falta só acrescentá-los lá, no bloco `framework:` (hoje em `federacao.mjs:197-214`), com o mesmo rigor dos vizinhos: `metodo` cortado em 40, `mvp.nome` em 300, 40 critérios, 40 autorizados, 20 pedidos. Deixei o lado que manda ligado de propósito: campo desconhecido já é ignorado, então não quebra nada, e no dia em que entrar aí funciona sem ninguém tocar aqui de novo. **Não encostei no arquivo**, pelo mesmo motivo que tu pediste desculpa por ter encostado | hoje |
| ~~`framework`~~ (🎫 nasceu resolvido) | 🟢 fechado | **2d4e7b74 abriu e fechou no mesmo dia: a tela JÁ EXISTIA**, feita por 670e1313 (`blocoMvp` no painel novo), e só faltava eu conferir antes de pedir. Desenha o MVP, não desenha bloco vazio quando não há definição, e o placar só aparece com critério para contar. Lição para quem abrir ticket: conferir se o outro lado já fez, principalmente no mesmo dia em que as duas pontas trabalharam. O texto original: 2d4e7b74 (PC) pede a 670e1313 (VPS): **a metade de TELA do CC-433**, a pergunta dele de 30/08 (*"por que nas versões dos projetos do PC eu não tenho as mesmas configurações que eu tenho nos que estão na VPS, exemplo definição de MVP?"*). **O dado já chega pronto**, desde o CC-445: `framework[].mvp` traz `nome` e até 40 `criterios` com `feito`, e `framework[].metodo` traz o método (que era o que mais faltava: a fase viajava sozinha e fase sem método não diz de quantas ela é). Vêm junto `autorizado` e `pedidos`. Medido: 11 dos 24 projetos deste PC declaram MVP. Falta desenhar no cartão do projeto remoto, onde hoje só há o seletor de modo. **Não escrever frase nova para o que já vem pronto**, pelo mesmo motivo do ticket do modo aqui embaixo: duas frases para a mesma coisa é como o problema do modo nasceu | hoje |
| `framework-modo` (🎫 para a `front`) | 🎫 ticket pendente | c82a3fbf pede a d4b47d4e: **a metade de TELA do CC-362**. `src/ui_v2.html` é da rota `front`, e eu não toquei. O dado já chega pronto em `/api/framework`: `origemModo` (`projeto`, `rota` ou `sessao`), `origemModoTexto` (frase pronta) e `rotaDoModo`. Falta pintar ao lado de `tituloModo`. **Usar `origemModoTexto`, não escrever frase nova:** duas frases para a mesma coisa é como o CC-362 nasceu. Recado enviado. | 2026-08-27 |
| `framework-modo` (🎫 para a `caixa`) | 🎫 ticket pendente | c82a3fbf pede a d4b47d4e: **o mesmo defeito em `src/caixaGit.mjs`**, que é da rota `caixa`. `arquivosDaSessao` filtra com `linha.includes(marca)`, então sessão apenas CITADA no histórico de outra linha reivindica os ARQUIVOS daquela rota, e a caixa de ponto commitaria o que a outra sessão escreveu. A regra pronta é `linhaEhDaSessao()`, exportada de `src/routia.mjs`. Recado enviado. | 2026-08-27 |
| `framework-hooks` | 🟢 livre | — (48f6738c fechou em 2026-08-13: pedido de autorização entre agentes, em `~/.claude/hooks/rota-pedidos.mjs` + `rota-guard` + `routia-fim`. 10 checks passando, instalado no PC e na VPS) | — |
| `cockpit` | 🟢 livre | — **LIBERADA por e859ce91 em 24/08, com autorização dele na hora.** 93e2e5c3 estava calada há 161h (desde 17/08) e não havia processo vivo nenhum por trás. O que ela deixou: CC-133 fechado (primeira fatia: o roteiro que se reescreve pela resposta), e seguia no backlog. Arquivos que ela tinha reservado, agora livres: `src/entrevista.mjs`, `cc.mjs`, `test.mjs`. **Se ela voltar, o trabalho dela está no git, não aqui** | — |
| `cockpit` (17/08) | 🟢 livre | — (ff0d68b2 fechou em 17/08: as **três travas de fidelidade ao pedido** que ele escolheu depois do erro da tabela (desvio escondido no código, mostrar o par quando ele diz "igual ao que já temos", e a forma que ele nomeou), os **perfis com trava de etapa** (Modelagem, Scrum Master, Depurador com três variações) e a regra "se bloqueia, entra no framework", a **planilha de tarefas** no formato dos ROADMAP.md dele, a **recuperação das 37 mensagens** que somem da fila, **modo por rota**, aba que abriria vazia sumindo do menu, "o que mudou desde que eu olhei", e `cc ideias` no encerramento) | — |
| `cockpit` (antes) | 🟢 livre | — (ff0d68b2 fechou em 16/08, segunda metade: **CC-60/CC-79** (fica só o fork, e `GET /api/escritorio` entrega os agentes de todas as máquinas), **CC-71** (`--so-mudou`), **CC-92** (fechado sem proxy, via `UserPromptSubmit`), o estudo do **CC-80**, sete hooks novos, oficina por agente, rota que reivindica arquivo com 📁, o merge do PR #1 e o conserto do menu que fechava sozinho no telefone) | — |
| `entrevista` | 🟢 livre | — (a4452c23 fechou em 19/08: **CC-157** (a sessão sumia do painel porque o sandbox tranca `~/.claude`, e agora tem abrigo), **CC-158** (falha de rede parava de sumir calada em quatro lugares, e a lista deixou de afirmar "nenhum projeto encontrado" quando não conseguiu perguntar), **CC-140/CC-101/CC-154** e a decisão do **CC-138**. Junto: a direção do redesenho da tela fechada com ele (CC-156, primeira fatia no ar) e o guia `docs/guias/PC-E-VPS.md`, para a sessão do PC não desfazer o que foi medido aqui) | — |
| `bancada` | 🟢 livre | — (d4b47d4e fechou em 25/08: **CC-354**, as três sondas de segurança do vídeo do Deyvin, todas provadas em alvo vulnerável e alvo seguro. `escalada-navegador` (virar admin pelo `localStorage`), `idor` (ler dado alheio pelo número) e `xss` (entrada refletida virando HTML), no nível "cliente" da Bancada. Junto, no motor do framework, o método `ciberseguranca` (Superfície → Execução → Auditoria), provado em `test-framework.mjs`. **Sem commit ainda**, descrito no diário de 25/08. Falta só o botão na tela do método, que é do `front`) | — |
| `sessoes` | 🟢 livre | — (d4b47d4e fechou em 25/08: sessão de Remote Control sumia da Central porque `cabecaDe` lia só 16 KB atrás do `cwd`, e no celular ele aparece no byte ~20 KB. Agora lê em blocos até achar, teto de 256 KB. Regressão em `test-sessoes.mjs`, ligada ao gate pelo `package.json`. `src/sessoes.mjs` e `package.json` estavam livres; `test.mjs` é de 1d765cd1 e não foi tocado) | — |
| `commit-auto` | 🔴 ocupada | d4b47d4e — **autorização contínua de commit por sessão (pedido dele em 26/08).** O guarda de commit só lê mensagem digitada e não vê o botão do AskUserQuestion, então "salva cada item ao fechar" não pegava. `hooks/commit-auto.mjs` liga/desliga um marcador por sessão, e `hooks/commit-guard.mjs` passa a liberar quando a sessão do marcador bate. Só ACRESCENTA um caminho de liberação, não afrouxa o resto. **`test-commit-auto.mjs` emprestado e DEVOLVIDO por 1d765cd1 em 26/08: o próprio teste montava a pasta-mãe com regex de `/`, que não bate no Windows, e criava uma PASTA com o nome do arquivo em vez da pasta. `hooks/commit-auto.mjs` (o de verdade) já usava `path.dirname`, sem bug nenhum; só o helper do teste foi trocado pra usar a mesma função** 🎚 continuativo 📁 hooks/commit-guard.mjs 📁 hooks/commit-auto.mjs | hoje |
| `quebra` | 🔴 ocupada | d4b47d4e — **a trava contra "não vai quebrar nada" dito no escuro (frente de 23/08).** Decisão dele em 26/08: travar a AÇÃO até a varredura de impacto rodar. Escrevo a varredura (`hooks/impacto-scan.mjs`) e o gancho que barra renomear/mover/apagar muitas pastas até ela rodar (`hooks/quebra-guard.mjs`), com teste. A pasta `tools/` está trancada (nobody:nogroup) nesta VPS, então a varredura fica em `hooks/` até o dono ser consertado; a ligação no settings.json é passo dele em cada máquina **`test-quebra.mjs` EMPRESTADO e DEVOLVIDO em 26/08 por 1d765cd1 (ver nota na linha da `sistemas`): a máquina sem `~/projetos` derrubava o `npm test` inteiro com exceção não capturada. Só ganhou um pulo quando o cenário não existe, o resto do arquivo não mudou.**
🎚 continuativo 📁 hooks/impacto-scan.mjs 📁 hooks/quebra-guard.mjs | hoje |
| `caixa` | 🔴 ocupada | d4b47d4e — **a caixa de ponto do git multi-agente (frente aberta em 25/08).** Motor novo em `src/caixaGit.mjs`: cada sessão commita o próprio ponto ao sair (local, sem push, decisão dele), e a última a sair roda o teste e empurra. Arquivo novo, não pisa em ninguém; a última a sair roda o teste e empurra. Ligada ao fim de sessão pelo gancho `hooks/caixa-sair.mjs` 🎚 continuativo 📁 src/caixaGit.mjs 📁 test-caixa.mjs 📁 hooks/caixa-sair.mjs | hoje |
| `sistemas` | 🟢 livre | — **721fa1f4 fechou em 26/08 (noite): o `/vps-sync` completo nas duas pontas (o PC estava 32 commits atrás, a sandbox já estava em dia), dois consertos de caminho de Linux que travavam o gate no Windows (`test-anonimizar.mjs` parava no PRIMEIRO teste e os outros 13 nem rodavam; `hooks/commit-auto.mjs` ficava morto e calado), e o **CC-361** (o botão de liberar escrita passa a existir na tela do dia a dia, não só no painel antigo). `src/ui_v2.html` emprestado da `front` e DEVOLVIDO; `hooks/commit-auto.mjs` emprestado da `commit-auto` e DEVOLVIDO. Gate 172 ok, aqui e na VPS. **Deixou aberto o CC-362**: a tela diz `sugestivo` e a trava usa `restritivo`, porque a marca `🎚` da rota vence o modo do projeto sem nada contar isso — marcar a própria rota afrouxa a trava.** Detalhe no diário de 26/08 e no HANDOFF | — |
| ~~`sistemas`~~ (histórico) | 🟢 livre | — **1d765cd1 fechou em 26/08: quatro consertos de plataforma no gate (roadmap.mjs, install.mjs, dois testes, todos com o mesmo defeito de supor Linux), o CC-351 (bandeja + serviço, com o achado de que `RestartOnFailure` do Windows não religa sozinho, corrigido com laço próprio no `arrancar.ps1`), e a investigação do CC-353 (achou e matou um processo fantasma de quase 2h, resíduo menor ainda sem causa, ver ticket abaixo).** Detalhe completo no diário de 26/08 e no HANDOFF | — |
| ~~`front`~~ (histórico) | 🟢 livre | **LIBERADA em 27/08 por c82a3fbf, com autorização dele na hora, e a rota está na linha do topo.** d4b47d4e estava calada há 12h15 e marcada como provavelmente órfã. O que ela deixou aberto virou ticket no nome dela, não foi descartado. Registro original abaixo. d4b47d4e: **TOMADA de fbabdeb0 em 25/08, com autorização dele na hora ("quero ver as sessões separadas na central").** Medido antes: fbabdeb0 está parada há 96 min (último sinal 22:07) e `src/ui_v2.html` está LIMPO, sem nada dela sem salvar. **CC-356 (sessões separadas na Central):** o cartão junta `VPS_cockpit` e `VPS_cockpit-2` num controle só, e o "conectar celular" sempre pega a primeira. Confirmado no painel vivo: dois `cc-remote-*` ativos. Desenho uma linha por rótulo em `acoesDeSessao`, cada uma com seu conectar/soltar/encerrar; o backend já age por rótulo. Se fbabdeb0 voltar, **o CC-343 continua sendo dela** (a explicação do modo embaixo do seletor), e nada dela foi tocado. **CC-357, na sequência:** os rótulos do controle remoto (`VPS_cockpit`, `VPS_cockpit-2`) apontavam todos para a conversa mais nova, medido no painel vivo. Caso cada um à conversa que nasceu logo depois dele (correlação de tempo de criação), pré-requisito do modo por sessão. **CC-358: o modo por sessão de fato** (o pedido dele). `src/web.mjs` EMPRESTADO em 26/08, com autorização dele: medido que e859ce91 (escritório) está parada há 31h e fbabdeb0 (sincronia) há 4h, e o arquivo está limpo. Só ACRESCENTO: cada sessão reporta o modo dela em `/api/remote-control`, e a ação `modo` aceita `sessao` para gravar a capa por sessão. **`src/web.mjs` cedido pra `sistemas` em 26/08, com autorização dele na hora: 1d765cd1 vai instrumentar temporariamente pra achar um bug de servidores instáveis.** Devolvo ao fechar. **📌 `src/ui_v2.html` EMPRESTADO a 721fa1f4 (rota `sistemas`) em 26/08, com autorização dele na hora, para o CC-361 (o botão de liberar escrita não existia nesta tela, só no painel antigo). Medido antes: d4b47d4e não existe nesta máquina e o arquivo está limpo aqui. Só ACRESCENTA o bloco `fw-aut`; nada do CC-356, CC-357 nem CC-358 é tocado. DEVOLVIDO ao fechar o CC-361: o bloco `fw-aut` entrou, o gate passou com 172 ok, e nada do CC-356, CC-357 nem CC-358 foi tocado** 📁 src/ui_v2.html 🎚 continuativo 📁 test-central-sessoes.mjs 📁 src/remotecontrol.mjs 📁 test-remoto-conversa.mjs | hoje |

**📌 `src/install.mjs` e `test-bases.mjs` EMPRESTADOS em 26/08 por 1d765cd1, com autorização dele
na hora (mesmo padrão dos outros consertos de Windows de hoje) — tirado da
lista acima, reivindicado na linha da `sistemas`.** `test-bases.mjs` achou bug
real, não só de teste: `projectsBases()` divide `CC_PROJECTS_BASE` em `/[:;]/`,
e no Windows `:` também aparece dentro do PRÓPRIO caminho (`D:\...`), então
qualquer base configurada vira fragmento quebrado. `D:\foo;E:\bar` virava
`["D", "\foo", "E", "\bar"]`. Corrigido pra separar só por `;`, o separador
nativo do Windows, quando `ehWindows`. **O próprio teste montava a variável com
`:`, herdado de convenção POSIX (o `PATH` do Linux), que no Windows é ambíguo
com letra de unidade por definição — sem jeito de fazer funcionar sem trocar
o separador também no teste.** Ajustado pra usar `;` quando `ehWindows`. Devolvo ao fechar
| ~~`front`~~ (histórico) | 🟢 livre | — (fbabdeb0 fechou em 25/08: **CC-341**, o seletor de framework no cartão de projeto de outra máquina, no lugar da frase morta, com o pedido pendente visível. Provado em navegador, sem exceção. Só acrescentou bloco novo; nada do que 1d765cd1 fez hoje cedo foi tocado) | — |
| ~~`front`~~ (histórico) | 🟢 livre | fbabdeb0 — **TOMADA de 1d765cd1 em 25/08, com autorização dele na hora.** Medido antes: 1d765cd1 aparece `done` e calada há 15 min no pacote do PC, e o trabalho dela de hoje cedo (o fix do Windows, o botão "abrir lá") está no git. **CC-341, queixa dele olhando o cockpit online com o PC ligado:** *"o que eu quero é que na VPS ele reconheça o desktop conectado e funcione na VPS"*. O canal de recado (CC-166) já existe e já resolve isso para abrir sessão; faltava carregar a AÇÃO e desenhar o controle no cartão de projeto de outra máquina, onde hoje só há a frase "se configura na máquina onde ele está". Só ACRESCENTO bloco novo 🎚 continuativo 📁 src/ui_v2.html | hoje |
| ~~`front`~~ (anterior) | 🟢 livre | 1d765cd1 — **LIBERADA de 2681f3b6, com autorização dele na hora ("quero construir, teria que resolver na vps").** Medido antes: sem transcrito nem no PC nem na VPS, e não aparece em `ListAgents` — órfã de verdade, não só calada. **Se ela voltar, o CC-332 continua sendo dela**, e o trabalho dela (os quatro botões, o controle único do framework, a fusão com Projetos, os `?`) está no git. Peguei pelo pedido dele: projeto de outra máquina aparecia como "outra máquina" na Central e não tinha botão nenhum de abrir sessão lá — só faltava ligar o fio, o mecanismo (`pedirSessao`/`atenderPedidos`, CC-166) já existe inteiro desde 18/08 e já é usado no bloco Remoto para sessão que já existe. Adicionei o mesmo botão pro cartão de projeto sem sessão ainda 🎚 continuativo 📁 src/ui_v2.html 📁 src/projetos.mjs | hoje |
| `front` (antes de 2681f3b6) | 🟢 livre | — **LIBERADA por 9bad715c em 22/08 para c213b663 pegar o CC-323** (a tela Remoto virando central de comando). Fechados aqui: CC-304 a CC-314, as oito anotações dele mais o menu do telefone. `src/ui_v2.html` está modificado e SEM COMMIT, e o que mexi está descrito item a item no ROADMAP. **Dois blocos ficaram de pé e são dela:** o submenu de projetos do Coderoom dentro da gaveta (o clone traz o item e não a lista), e a própria central do CC-323. Teste novo em `npm run test:gaveta`, oito verificações com prova negativa | — |
| `front` (antes de 9bad715c retomar) | 🟢 livre | — (9bad715c fechou em 21/08 o **CC-240** (a faixa de agentes sem contato desceu para o fim e nasce fechada, provada com clique de dedo e sobrevivendo a 5s de stream) e o **CC-241** (`100dvh` no body: o fim da tela deixa de ficar inalcançável no celular, e a confirmação é dele no telefone). Só estes dois, que ele pediu DEPOIS de mandar parar o frontend, e com a autorização confirmada antes de encostar. **CC-156 e CC-235 continuam parados por ordem dele.** A mudança de c213b663 no topo do Cockpit segue no ar, sem commit) | — |
| `front` (c213b663) | 🟢 livre | — **c213b663 parou por ordem dele em 21/08 e liberou a rota.** Fica UMA mudança no ar e sem commit, descrita no bloco 📌 logo abaixo da tabela. **Nenhum dos quatro pedidos foi começado**, e todos continuam esperando dono: **CC-235** (a mesma profundidade nos cartões de Sprint e backlog), **CC-239** (a tela Trabalho fica 3 segundos em branco), **CC-240** (os agentes sem contato vão para o fim e nascem fechados) e **CC-241** (o fim da tela não alcança no telefone dele: `height: 100vh` no body). Os quatro foram levantados e repassados por 9bad715c, com a causa do CC-241 já medida | — |
| `front` (entregue por 9bad715c) | 🟢 livre | — **LIBERADA em 21/08 por 9bad715c para a sessão c213b663 (CC-156).** Fechou o CC-233: tocar numa tarefa dele mostra o que ela é, em vez de perguntar se acabou. `src/ui_v2.html` está modificado e SEM COMMIT (ele não pediu commit); o que mexi está no CC-233 do ROADMAP, e são só as duas listas de pendência dele mais a função `detalheMeu` | — |
| `gate` | 🟢 livre | — **LIBERADA por e859ce91 em 24/08, com autorização dele na hora.** c213b663 estava calada há 52h e sem processo vivo; `src/ui_v2.html` já tinha saído dela em 23/08 pelo mesmo motivo. `src/gate.mjs`, `src/gateAgentes.mjs` e `src/gatePacote.mjs` voltam a ficar livres. **O trabalho dela continua valendo e está descrito abaixo, para quem pegar a rota.** O que ela dizia: c213b663 — **o gate: o cockpit vira dono da conversa**, e os três agentes (Claude Code, opencode, agy) viram trocáveis dentro da mesma conversa. Backlog em `docs/ROADMAP.md`, frente "o gate", e o plano em `~/.claude/plans/perfeito-agora-eu-tenho-typed-clover.md`, aprovado por ele em 21/08. **CC-320 fechado** (pasta do PC dele abrindo conversa aqui: recusada antes de resolver, com a mensagem dizendo em que máquina abrir). Antes: **CC-246, CC-247 e CC-248 fechados** (a medição, a conversa em disco, e a troca de agente provada de ponta a ponta). Fazendo agora o **CC-244** (o contexto do projeto viajando junto) e em seguida o **CC-245** (a tela), nesta ordem, que é a que ele deu. **`src/ui_v2.html` está reivindicado aqui a partir de 21/08, com a rota `front` livre e a autorização dele para a tela do gate — o CC-156 e o CC-235 continuam parados e NÃO são meus.** Os arquivos de sistema (`src/web.mjs`, `src/config.mjs`, `src/uso.mjs`, `cc.mjs`, `test.mjs`, `hooks/opencode/tarefas.js`) são da rota `sistemas`, e serão negociados com 9bad715c antes de eu encostar 🎚 continuativo 📁 src/gate.mjs 📁 src/gateAgentes.mjs 📁 src/gatePacote.mjs

**📌 `src/ui_v2.html` SAIU desta rota em 23/08, com autorização dele na hora.** Medido antes de mexer: `cc routia presenca` dá c213b663 como provavelmente órfã, calada há 32h; o transcrito dela para em 22/08 às 14:17 (`~/.claude/projects/-home-claudedev-projetos-proj-controlcenter/c213b663-….jsonl`) e não há processo nem tmux vivo com esse id. O arquivo está agora na rota `front`, com 2681f3b6. O resto dos arquivos do gate continua reivindicado aqui | hoje |
| `medida` | 🎫 travada | c213b663 — a ferramenta de captura só acha o Chrome do Windows e depende de WebSocket, que o Node 20 desta VPS não tem. Não dá para consertar no repositório: `tools/` pertence a `nobody:nogroup` aqui e recusa escrita, o que já está na lista de pendências dele. Rodando de cópia fora do projeto até a pasta voltar a ser dele 📁 tools/capturar-tela.mjs | hoje |
| `front` (a seguir) | 🟢 livre | — **reservada para a sessão de tela, com tarefa esperando: o CC-156**, o redesenho cuja direção ele já fechou (ver [[REDESENHO-TELA]]). Dona de `src/ui_v2.html`. Liberada em 21/08 por 9bad715c, que a tinha marcado no início e não encostou em tela nenhuma: o trabalho foi todo de sistema | — |
| `front` (c4e8a125) | 🟢 livre | — (c4e8a125 fechou em 21/08: **CC-218 a CC-231**, os nove apontamentos dele no telefone. Máquina sem contato parou de posar de trabalho em andamento, cada sessão diz onde roda, o cartão abre pelo projeto e pela máquina, a tela Trabalho e os gráficos voltaram a funcionar no celular, cada tela ganhou endereço próprio, e o "?" que explica passou a cobrir as 24 telas com 50 explicações. Junto: quatro redes que o painel novo não tinha herdado do antigo, e o conserto do render da tela Agora que eu mesmo tinha quebrado) | — |
| `front` (18/08) | 🟢 livre | — (42834678 fechou em 18/08: o agy ganhou tela própria em `/agy` servida por `ttyd`, e o botão passou a levar até ela. A versão anterior criava o terminal pela API do opencode e largava ele na conversa, sem caminho para o terminal) | — |
| `cockpit` (anterior) | 🟢 livre | — (ff0d68b2 fechou em 16/08: **CC-93** (guia longo vira etapa, regra + `guia-guard`), **CC-77** (navegacao de um nivel no estreito, `.grupo` duplicada no CSS, e `test-estreito.mjs` medindo as 15 telas), **CC-82** (a estante de documentos, com leitor e `cc doc`), e a Bancada de 7 para 10 camadas, com a sonda de RLS do Supabase. Junto: `fluxo-guard`, a trava de execucao continua do modo restritivo) | — |
| `escritorio` | 🔴 ocupada | e859ce91 — **o escritório de bonecos não sobe mais, e o botão subiria a versão errada.** Medido em 24/08: a renomeação de 23/08 (`app_escritorio` virou `VPS_escritorio`) quebrou o caminho literal do fork em `paineis.mjs`, então `resolverBinario` cai calado no pacote global do npm, que é o upstream SEM as melhorias dele. Autorização dele na hora para apagar o pacote global. **`src/web.mjs` ENTROU aqui em 24/08, com autorização dele na hora**, para o conserto do vazamento de memória: medido que a rota `sistemas` (9bad715c) está calada desde 22/08 às 09:23, e o painel morre a cada seis horas com o painel aberto no telefone dele. `test.mjs` continua sendo dela e não vou encostar. **📌 `src/web.mjs` foi emprestado à rota `remote-control` em 24/08 e VOLTOU em 25/08, quando 21e88ed9 fechou. O que ela acrescentou ali são as ações de conectar, soltar e reabrir; nada do conserto de memória foi tocado.** Medido antes: esta sessão está calada desde 18:20. O conserto do vazamento de memória continua sendo dela, e 21e88ed9 só ACRESCENTA trecho novo, sem alterar nada do que já existe ali 📁 src/paineis.mjs | hoje |
| `rotinas` | 🟢 livre | — (e9383c57 fechou em 2026-08-13: CC-42 validado, travessões do código novo removidos, diário escrito) | — |
| `backlog` | 🔴 ocupada | 5805d6bb — CC-23 a CC-41, execução sequencial do backlog planejado (docs/PLANOS.md) | 2026-08-13 |
| `remote-control` | 🟢 livre | — **21e88ed9 fechou em 25/08.** Nasceu de um estrago meu: li a hora de criação da sessão como se fosse a da última atividade e recomendei a ele matar duas conversas, uma delas em pleno trabalho (recuperada com `--resume`). Fechados: as **quatro ações** do controle remoto com caminho de volta ao encerrar, o **CC-334** (o framework tinha dois interruptores), o **CC-336** (o cartão desentortou e o criar projeto subiu para a barra) e o **CC-337** (sessão ociosa posava de trabalhando). A **fusão de Central e Projetos** (CC-335) está no ar na primeira fatia, com o resto registrado em `docs/produto/CENTRAL-E-PROJETOS.md`. **Dois abertos que nasceram aqui e são de quem pegar a rota:** CC-338 (a rolagem que ele diz travar no PC, e que eu não reproduzi em oito cenários) e CC-339 (o cartão agrupa por dado que congela). `src/web.mjs` volta para a rota `escritorio` e `src/ui_v2.html` para a `front`, de onde vieram emprestados com autorização dele. Sete commits, todos empurrados, o último `7334998` | — |

**📌 Em 25/08 esta rota cresceu, com autorização dele na hora ("pode seguir com tudo"): CC-334 e CC-335.** O framework passou a ter UM controle por projeto (o modo "Desligado" e o interruptor eram dois estados para o mesmo fato), e as telas **Central e Projetos viraram uma só**: a de Projetos foi movida para dentro da Central pelo mesmo padrão que o Framework sofreu em 22/08, o cartão único ganhou o framework em gaveta para quem não tem sessão, e o bloco Remoto parou de repetir a lista dos projetos daqui. Junto foram os `?` de framework, entrevista e módulos, com os verbetes em `docs/produto/PALAVRAS-DA-TELA.md`. Provas em `npm run test:framework-unico` e no gate 📁 src/remotecontrol.mjs 📁 src/web.mjs 📁 src/ui_v2.html | hoje |
| `remote-control` (antes) | 🟢 livre | — (5a0496cf fechou em 20/08: o backlog inteiro do painel novo, 48 itens do CC-168 ao CC-217. O painel novo assumiu a raiz e o antigo ficou em `/v1`; `cc federar` faz uma máquina nova entrar sozinha; a federação ganhou prazo no dado herdado e teto no arquivo. A sessão 21810399 não existe em máquina nenhuma há dias) | — |
| `remote-control` (antes) | 🟢 livre | — (5805d6bb fechou em 2026-08-13: os 3 bugs, ver ticket com o achado de autenticação na VPS que ficou pendente do Felipe) | — |
| `sincronia` | 🟢 livre | — **84be1862 fechou em 10/09: CC-460 provado de verdade neste PC. Contar processo (25 em 30s) enganava, era volume de várias sessões vivas na máquina; contar JANELA VISÍVEL deu zero em oito rodadas monitoradas a 100ms. `windowsHide` funciona. Gate verde** 📁 (só medição, sem editar arquivo) | 2026-09-10 |
| `sincronia` (histórico) | 🟢 fechado | — **84be1862 fechou em 10/09: CC-457, metade provada (retomar sessão traz a conversa inteira, testado de ponta a ponta com histórico real em disco). A outra metade (achar o processo certo pra matar) esbarra na mesma armadilha do `CommandLine` vazio já registrada hoje — `state.json` também não grava PID nenhum. Documentado no mapa como obstáculo real, sem solução ainda. Gate verde** 📁 src/jobs.mjs (só leitura) | 2026-09-10 |
| `sincronia` (histórico) | 🟢 fechado | — **84be1862 fechou em 10/09: terceiro processo enviando dado (CC-456, terceira rodada), órfão de Tarefa Agendada já apagada, com token de administrador (matado pelo Felipe, direto). Registrado no mapa com a régua que faltava: máquina que RECEBE tem razão sobre quantos empurram, não a que conta processo local. Gate verde** 📁 docs/ROADMAP.md | 2026-09-10 |
| `sincronia` (histórico) | 🟢 fechado | — **84be1862 fechou em 10/09: a VPS achou que ainda tinham dois empurradores no PC depois do CC-456 fechado. Era órfão numa porta de fallback (8100), sobra dos meus próprios comandos manuais de mais cedo, que o `/api/shutdown` (só mira 8099) nunca alcançou. Matei o órfão, confirmado estável por 40s+. Causa registrada no ROADMAP. Gate verde** 📁 docs/ROADMAP.md | 2026-09-10 |
| `sincronia` (histórico) | 🟢 fechado | — **84be1862 fechou em 10/09: CC-458 já estava consertado por outra sessão (o guarda passou a contar linhas de prosa, não parágrafos), só a referência de número no comentário estava desatualizada (CC-457 → CC-458, por causa da renumeração do merge). Ajustado, marcado como resolvido no mapa. Gate verde** 📁 src/estilo.mjs | 2026-09-10 |
| `sincronia` (histórico) | 🟢 fechado | — **84be1862 fechou em 10/09: os dois lançadores duplicados no login (CC-456), o loop de bandeja piscando a cada 5s (CC-459, causa e conserto herdados de `ae131ce9`), o `.vbs` sendo recriado sozinho a cada `daemon restart`, e um bug do próprio conserto (PowerShell não-terminante saindo com código 0, mascarando falha real de "tarefa já rodando/zumbi"). Merge com o commit da VPS (`758b333`) incluído: `estadoServico` e `estadoServicoAsync` discordando na mesma máquina, corrigido nos dois. Provado na máquina real, no cenário que quebrou antes (`daemon restart` repetido): painel estável por 4 ciclos, `.vbs` não volta. Gate verde** 📁 src/daemon.mjs 📁 src/arrancar.ps1 📁 src/platform.mjs | 2026-09-10 |
| `sincronia` (histórico) | 🟢 fechado | — **(e2b33ef8 FECHOU em 10/09: CC-452 e CC-453, mais o botão de religar a VPS, que vive fora deste repo em `~/cockpit-auth.mjs`. `src/web.mjs` devolvido à `front`. Gate verde, 0 falhas. ⚠️ TRABALHO SEM COMMIT na árvore, de propósito: ele pediu que outra sessão commite — ver `docs/HANDOFF.md`, primeira seção. Segue aberto o que já estava registrado aqui: a metade de TELA do mapa herdado, e a distinção "varredura falhou" vs "não há projeto" em `web.mjs`.)** Registro original: e2b33ef8 — **TOMADA de 5e7441d7 em 09/09, confirmando primeiro que ela não existe mais: `cc json` só mostra dois jobs vivos neste projeto, eu mesmo e `670e1313` (status `waiting`, assunto "a tela Análise", sem relação com federação). 5e7441d7 não aparece.** Trabalho: CC-452 (campo `servico` — instalado/rodando/detalhe — faltando no pacote que viaja entre as máquinas, então ninguém consegue dizer daqui se o serviço de fundo está de pé no PC) e a base do CC-453 (o cartão de instalar some por procurar `proj_controlcenter` no caminho, nome que não existe mais desde 23/08). **SÓ ACRÉSCIMO** em `federacao.mjs` (`montarPacote`, `validarPacote`, `CAMPOS_QUE_PERSISTEM`, `VALIDADE_POR_CAMPO`) e em `platform.mjs` (`estadoServicoAsync`, gêmea assíncrona de `estadoServico` para não travar o event loop dentro do ciclo de 30s). **`src/web.mjs` emprestado de `front` (670e1313) só para computar e passar o campo novo pro `montarPacote`, no mesmo bloco onde `retrato` (travas/framework) já é computado — nada da tela de rotas nem da Análise é tocado.** O trabalho registrado da `sincronia` (a metade de TELA do mapa herdado, e a distinção "varredura falhou" vs "não há projeto" em `web.mjs`) continua em aberto, não foi tratado aqui. **CC-452 concluído e testado** (campo `servico` em `montarPacote`/`validarPacote`, `estadoServicoAsync` em `platform.mjs`, dois testes novos em `test.mjs`, `npm test` 0 falhas). **📌 `src/web.mjs` TOMADO de `front` (670e1313) em 09/09, com autorização dele na hora** (ele escolheu "autoriza eu pegar agora" na pergunta direta), depois de medir que 670e1313 está `waiting` (parada esperando ele, não trabalhando), que o pedido por recado ficou sem resposta por isso, e que **o arquivo está LIMPO no git**, sem nada dela sem commit. SÓ ACRÉSCIMO: calcular `estadoServicoAsync()` e passar como campo `servico` pro `montarPacote`, no mesmo bloco onde `retrato` (travas/framework) já é calculado. Nada da tela de rotas nem da Análise foi tocado. Registrado por recado (`e2b33ef8-mtuxs1yi-nrd4`), e ela respondeu liberando depois ("pode mexer, não me atrapalha"). **`src/web.mjs` DEVOLVIDO em 10/09.** **CC-452 e CC-453 fechados**, `npm test` com 0 falhas e prova de ponta a ponta na máquina real (campo sai do sistema, viaja, valida e chega em `raizDoCockpit`). **Defeito extra achado na prova real, não no teste**: `estadoServico` respondia `rodando: false` quando o `systemctl` nem conectava no barramento — "não sei" virando "não está". Consertado com teste nos dois sentidos 📁 src/federacao.mjs 📁 test-federacao.mjs 📁 src/platform.mjs | 2026-09-09 |
| ~~`sincronia`~~ (histórico) | 🟢 livre | — **LIBERADA por 2d4e7b74 (PC) em 30/08, com autorização dele na hora ("libera a rota inteira, ela está parada").** Medido antes, duas vezes no mesmo dia: fbabdeb0 não dá sinal deste PC, `src/federacao.mjs` e `src/travasDaMaquina.mjs` estão LIMPOS, e o último commit de fbabdeb0 neles é de 25/08. **Se ela voltar, o trabalho dela está no git**, e continua descrito aqui embaixo. Os arquivos foram para a rota `framework`, para o CC-437 (o retrato do framework) e o CC-440 (o contrato entre PC e VPS). **📌 Na mesma tarde, e sem as duas sessões se verem, 670e1313 (VPS) também mexeu em `src/federacao.mjs`, com autorização dele: a ação `recado` em `ACOES_DE_PEDIDO` e o campo de texto em `pedirSessao`, para avisar a sessão do PC — o recado do Routia morre em `docs/.recados.json`, que está no `.gitignore`, e esta fila é a única tubulação viva entre as máquinas. Ela pediu desculpa pelo caminho em `docs/ALINHAMENTO-2026-08-30.md`. As duas mudanças eram acréscimo e conviveram no merge de 30/08 sem conflito no código; o conflito foi só nesta linha do quadro. Vale a lição: rota liberada numa máquina não aparece na outra até o `git push`.** **A descrição original dela, preservada:** fbabdeb0 — **CC-342, defeito que ELE viu em 25/08 depois de subir o CC-341:** *"o botão do framework nas sessões do PC fica ativado um tempo e depois some, e depois volta"*. Medido no pacote do PC: `framework` alterna entre 3 e nulo a cada 15 segundos, assinatura de DOIS empurradores no PC defasados, um com código novo e outro com o velho. A premissa do CC-340 ("o retrato vai em todo empurrão, então não precisa herdar") assumia um empurrador só. **CC-344 na sequência, defeito meu:** escolher modo no cartão do PC trocava o modo e NÃO ligava o framework, então o projeto ficava `ligado:false` com modo escolhido e nada valia. Medido no estado que o PC reporta: `proj_controlcenter` em `restritivo` com `ligado:false`. O controle local liga e escolhe num gesto só desde o CC-334; o remoto só escolhia. Junto vão as travas por módulo no cartão remoto, que moram no config da máquina e não no projeto. **`src/web.mjs` (da `escritorio`) e `src/ui_v2.html` (da `front`, que é minha) emprestados de novo, com autorização dele; só acréscimo** **CC-351, pedido dele em 25/08 depois de o coepiloto não aparecer no cockpit:** *"a gente precisa ter uma forma de rodar num Windows como um serviço de fundo"*. Medido: o painel no PC sobe por um `.vbs` na pasta de Inicialização, que é atalho de logon e não serviço, sem supervisão e sem nada visível para reiniciar. Vai: diagnóstico de captura de sessão (`cc sessoes`), instalação por Tarefa Agendada com reinício em falha, e o ícone na bandeja. Decisão dele: tarefa agendada nativa em vez de serviço com binário de terceiro; ícone de rede com desenho próprio, sem bolinha. **📌 `src/platform.mjs` e `cc.mjs` EMPRESTADOS em 26/08 por 1d765cd1, com autorização dele na hora e pelo próprio `docs/FECHAR-SERVICO-PC.md` (escrito por esta rota, pedindo que a peça de Windows fosse fechada por sessão do PC).** Só ACRÉSCIMO: o ícone de bandeja que faltava (`src/bandeja.ps1`, arquivo novo, de ninguém antes) e o lançador único (`src/arrancar.ps1`, arquivo novo) que faz `git pull` + sobe painel + sobe bandeja, com a Tarefa Agendada apontando pra ele em vez de pro `node cc.mjs` direto. Nada do que `fbabdeb0` escreveu em `platform.mjs` foi tocado, só a função `instalarServicoWindows` ganhou o novo alvo (`cc.mjs` no fim nem precisou mexer). **DEVOLVIDO por 1d765cd1 em 26/08, provado no PC dele: tarefa criada, painel e bandeja rodando, ícone confirmado visualmente por ele.** 🎚 continuativo 📁 src/daemon.mjs 📁 src/federacao.mjs 📁 src/travasDaMaquina.mjs | hoje |
| ~~`sincronia`~~ (histórico) | 🟢 livre | — (fbabdeb0 fechou em 25/08: **CC-340**, o retrato das travas e do framework viajando no pacote, e **CC-341**, o recado entre máquinas ganhando ação de lista fechada. `src/web.mjs` e `test.mjs` foram DEVOLVIDOS às rotas `escritorio` e `sistemas`: em web.mjs só entraram trechos novos, em test.mjs só casos no fim) | — |
| ~~`sincronia`~~ (histórico) | 🟢 livre | fbabdeb0 — **CC-340, pedido dele em 25/08: o pacote do PC não diz se as travas valem lá.** Ele perguntou se os ganchos estavam registrados no PC e medi que ninguém tem como responder: o pacote carrega jobs, servidores, uso, tempo, rotas, backlogs, agentes e limites, e nada sobre ganchos nem framework. Por isso a pendência "registrar o hook no PC" ficou 10 dias sem poder ser confirmada nem fechada. Arquivo novo `src/travasDaMaquina.mjs` (o retrato, barato: um `settings.json` e um `estado.json` por projeto citado nos jobs) e o campo entrando no pacote e em `maquinasConhecidas`. **Não peguei `src/web.mjs`** (é da `escritorio`) nem `src/ui_v2.html` e `test.mjs` (são de 1d765cd1, VIVA no PC, esperando ele há ~1h) **📌 `src/web.mjs` (da `escritorio`) e `test.mjs` (da `sistemas`) EMPRESTADOS em 25/08, com autorização dele na hora.** Em `src/web.mjs` só ACRESCENTO dois campos no pacote que já é montado ali, sem tocar no conserto de vazamento de memória que é da dona; medido que e859ce91 está calada há 17h. Em `test.mjs` só acrescento casos novos no fim, sem alterar os que existem; 1d765cd1 está VIVA no PC e o fix do Windows dela é de hoje cedo, então nada do que ela mexeu é encostado. Devolvo os dois ao fechar 🎚 continuativo 📁 src/travasDaMaquina.mjs 📁 src/federacao.mjs 📁 src/web.mjs 📁 test.mjs | hoje |
| ~~`sincronia`~~ (histórico) | 🟢 livre | — (ff0d68b2 fechou em 15/08: **CC-56** (sessao interativa reporta estado, via `CLAUDE_CODE_SESSION_ID`, fora de `jobs/`), **CC-49** (`cc routia presenca`: ativa / orfa / desconhecida, e a distincao entre as duas ultimas e o cuidado central), **CC-48** (rotas viajam no pacote da federacao) e **CC-65** (os 6 hooks globais nao existiam em repo nenhum: agora em `hooks/routia/`). Anterior: cockpit federado, CC-47/51/54/55/57/58) | — |
| `ideias` | 🟢 livre | — (ff0d68b2 fechou em 17/08: a fila em `docs/.ideias-pendentes.json`, o encerramento que captura sem pedir decisão, o início que processa, e o conserto da trava de desvio que barrava CITAÇÃO dele) | — |
| `framework` | 🟢 livre | — **2d4e7b74/51c2da13 fechou em 30/08 à noite (mesma sessão, marca reiniciada por `/clear`).** Trouxe de volta o trabalho do dia inteiro do PC (unificar as três cópias, as travas saindo da pasta velha, o contrato rico PC↔VPS) e fechou na sequência: a síntese pelo opencode no Windows, a Tarefa Agendada apontando pro lugar certo, o Plano de Unificação nomeado e uma peça dele decidida (`docs/produto/COLETOR.md`), e pausar a sincronia pela bandeja sem apagar credencial. Achado no caminho e corrigido, fora deste repositório: um crash no login da VPS por decodificação duplicada de senha. Detalhe em [diario/2026-08-30.md](diario/2026-08-30.md) e `docs/HANDOFF.md`. Devolveu `src/web.mjs` e `src/federacao.mjs` pra `front`, que continuam dela. Fica pendente e não é dela: a faixa na tela por máquina, que mexe em `src/ui_v2.html` (rota `front`, viva) | — |

**📌 `src/travasDaMaquina.mjs` está na linha acima com autorização dele em 30/08**, dada quando a rota `sincronia` foi medida como parada ("libera a rota inteira, ela está parada"). O quadro voltou ao estado do remoto na unificação, então a linha da `sincronia` abaixo ainda mostra fbabdeb0 — a autorização é posterior a ela. Só a função que monta a lista de projetos foi tocada; `src/daemon.mjs` e `src/federacao.mjs` continuam dela e não foram encostados.

| `sintese` | 🟢 livre | — **51c2da13 fechou em 30/08: o CC-438**, o conserto do Windows na chamada do opencode. `rodar()`, em `src/sintese.mjs`, chamava `spawn(exe, [...])` sem `shell` nem `cmd.exe`, e essa forma nunca sobe um `.cmd`, que é o que `acharOpencode()` devolve quando o opencode é instalado por npm no Windows. Trocado pelo padrão de `lancarComando`: no Windows, `cmd.exe` como executável, com `/c` e cada argumento separado do array. Provado com binário `.cmd` de mentira rodando `rodar()` direto (fora do gate, porque `test.mjs` estava com a `framework`); `npm test` continua verde. Sem commit ainda | — |

### 📌 O que c213b663 deixou na tela em 21/08, sem commit — para quem pegar a rota `front`

**Ele mandou parar o frontend.** A ordem dele foi *"esquece o frontend por
enquanto, só anota o que já foi feito pro outro agente ter ciência"*, e é isto.

**Por que existe uma mudança que ele não pediu:** ele abriu a sessão dizendo
*"essa sessão tá limitada apenas ao frontend com o método routia"*. Isso é um
limite de escopo, e eu li como ordem de executar o CC-156. Não era. Fica
registrado porque é o tipo de erro que se repete: **rota reivindicada não é
tarefa autorizada.**

**A única coisa que mudou em `src/ui_v2.html`, e está no ar no painel real:**

O topo da tela Cockpit virou DUAS faixas, que é a camada 1 do
[[REDESENHO-TELA]]:

| Onde | O que mudou |
|---|---|
| `<section id="sec-precisa">` | a faixa que já existia, renomeada de "AGORA — O QUE PRECISA DA SUA ATENÇÃO" para "PRECISA DE VOCÊ AGORA" |
| `<section id="sec-rodando">` | faixa NOVA, "RODANDO AGORA": os agentes trabalhando neste minuto, com frase, contagem de tarefas e o botão de abrir |
| `renderAgora()` | passou a separar três estados: com item, vazio de verdade (esconde a seção por `sec.hidden`) e leitura falhada (mantém a seção e diz que falhou) |
| `renderRodando()` | função nova, com os mesmos três estados, filtrando agente vivo e trabalhando |
| `MODULOS` | o bloco novo nasceu registrado (`{ id: 'rodando', de: 'rodando-container' }`), como manda o guia de quem redesenha |
| `renderAll()` | uma linha a mais, chamando `renderRodando()` |

**Provado:** `npm test` verde (122 verificações) e captura validada em 390px de
largura de verdade, com a régua da barra de baixo batendo (5 botões, centros em
39/117/195/273/351). As duas faixas apareceram com dado real.

**Se ele não quiser isso, desfazer é barato:** as mudanças estão contidas nos
seis pontos da tabela, e nada mais do arquivo foi tocado.

**Um achado que vale para quem for medir tela nesta VPS:** a ferramenta de
captura de `tools/` não roda aqui por dois motivos somados, e o conserto no
repositório está travado porque `tools/` pertence a `nobody:nogroup` nesta
máquina. Enquanto isso não se resolve, a régua funciona a partir de uma cópia
fora do projeto, com três correções: o Chrome é o do Playwright
(`~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`), o Node 20 daqui
precisa de `node --experimental-websocket`, e **o seletor certo da barra é
`.barra-baixo .bb-item`** — o `#app-bar` do original não existe no arquivo, e
por isso a segunda prova de largura vinha passando sem rodar.

## Declarar o modo de trabalho na própria rota (CC-123, 17/08)

Pedido dele: *"eu posso ta no mesmo projeto fazendo backend e frontend. eu quero
dialogar sobre o frontend mas o backend ja tem backlog entao eu posso colocar
como restritivo"*.

Escreva `🎚 <modo>` na linha da rota, junto do resto:

<!-- ATENÇÃO: este exemplo fica dentro de comentário HTML de propósito.
     Solto, ele TRAVAVA `src/ui.html` de verdade: o leitor do quadro não
     desconta indentação de bloco de código, então uma linha de documentação
     virava rota ocupada por "id da sessão". Custou uma edição barrada em 22/08,
     e é a segunda vez que um exemplo do próprio quadro finge ser rota — a
     primeira foi a `feature/checkout` que nunca existiu.

    | `front` | 🔴 ocupada | id da sessão: o que está sendo feito 🎚 continuativo 📁 src/ui.html | hoje |
-->

    | minha-rota | ocupada | id da sessão · o que está sendo feito · modo · arquivos |

| `front` (antes) | 🟢 livre | — (ab5121a0 tinha `src/ui.html#viewRemoto`; liberada em 19/08 por 5a0496cf depois de conferir que a sessão não existe em máquina nenhuma: ausente no `cc json` do PC, e na VPS a única sessão viva é a4452c23, parada há 3h e já dada como fechada no próprio quadro) | — |

Quem trabalha nessa rota entra nesse modo, e ele **sobrevive ao reinício da
sessão**, que era o furo da capa por sessão: a sessão morre e renasce com outro
número, e o modo se perdia sem ninguém ver.

A ordem, do menos específico para o mais: projeto → rota → sessão. A escolha
feita na sessão (`cc framework modo <nome>`) continua vencendo, porque é a mais
recente e a mais deliberada.

⚠️ **Só modo de comportamento** (tom, ritmo, se pergunta). Modo que tranca
escrita continua valendo para o projeto inteiro: duas travas discordando sobre
quem pode escrever num arquivo é exatamente o cenário que o Routia existe para
evitar.

## Como pedir autorização numa rota que tem dono

**Desde 13/08 você não precisa mais parar e esperar o Felipe intermediar.**

Ao tentar editar código sem rota marcada, o `rota-guard` registra um pedido
automaticamente e te diz o id. O dono da rota é avisado no fim do turno dele e
responde com um comando:

    node ~/.claude/hooks/rota-pedidos.mjs listar
    node ~/.claude/hooks/rota-pedidos.mjs autorizar <id>
    node ~/.claude/hooks/rota-pedidos.mjs negar <id> "motivo"

Autorizar libera **só aquele arquivo, só para aquela sessão, por 6 horas**. Não
é passe livre na rota. Os pedidos ficam em `docs/.rotas-pedidos.json`.

Se você é o dono e recebeu um pedido: responda. Ficar em silêncio deixa a outra
sessão travada, que é exatamente o que o método existe para evitar.

## Tickets pendentes

### 🎫 CC-353/servidores: metade resolvida (um fantasma real, morto), a outra metade continua sem causa, de 1d765cd1 em 26/08

Pedido dele: a tela Servidores não mostra nada do PC. Medido de ponta a ponta,
com log temporário nos dois lados (removido ao fechar, nada ficou no código,
e ele mesmo liberou acesso de leitura ao log do nginx pra essa investigação:
`/etc/sudoers.d/cockpit-diag`, só `tail` naquele arquivo, nada mais).

**Parte 1, RESOLVIDA: um processo fantasma de verdade.** `startWeb()` tenta
até 10 portas se a 8099 estiver ocupada (`8100`, `8101`...), e cada uma que
consegue escutar liga o PRÓPRIO temporizador de federação. Um restart meu, lá
pelas 00:48, sobrou na porta 8100 com a 8099 ocupada, e ficou vivo por quase
2 horas empurrando por baixo dos panos — eu só matava processo olhando a
porta 8099, nunca as vizinhas. Achado com o log do nginx (o IP de origem das
chamadas é sempre o mesmo, `186.247.110.235`, o dele; nunca foi outra
máquina) cruzado com `Get-NetTCPConnection` varrendo todas as portas. Morto,
confirmado sem mais nenhuma porta de painel além da 8099.

**Parte 2, NÃO resolvida: mesmo só com um processo, ainda chegam pares de
pedido, uns 4 a 9 segundos separados um do outro, de tempos em tempos.**
Fiquei observando o log do nginx sem tocar em mais nada (nem `curl` manual
meu) e o padrão continuou. Não é o F5 dele: ele não estava mexendo na tela
nesses instantes.

**O que descartei nessa segunda parte, medido:**
- segundo processo `node` (varri TODA porta em escuta do Windows, não só a
  faixa 8099–8109)
- eu mesmo testando com `curl` manual (parei de mexer, o padrão continuou)
- WSL, Tarefa Agendada religando sozinha, cron/timer na VPS, processo
  suspeito na VPS — tudo checado na parte 1, nada mudou

**Palpite do IPv6, TESTADO e DESCARTADO em 26/08:** cogitei o `fetch` correndo
IPv6 e IPv4 ao mesmo tempo pro mesmo domínio. `dns.lookup('cockpit.carzo.com.br',
{ all: true })` devolve UM endereço só, `66.94.117.215`, família 4. Não existe
registro IPv6 pro domínio, então não tem duas rotas de rede pra correr. Essa
hipótese caiu.

**Palpite novo, não testado:** conexão parada no pool de `keep-alive` do
Node. Se o `fetch` reusa uma conexão que a outra ponta (ou algum proxy no
meio) já fechou por inatividade, a primeira escrita falha em silêncio e o
`undici` (o motor do `fetch`) pode tentar de novo numa conexão nova sem
avisar quem chamou — duas chamadas de rede pra uma linha de código só, de
novo. Bateria com o padrão. Testar: forçar `Connection: close` no `fetch` ou
desligar keep-alive e ver se o par some.

**Efeito prático agora:** bem menos flicker que antes (só um fantasma
resolvido já reduz muito), mas a tela Servidores ainda pode piscar vazia às
vezes. Registrado pra quem quiser seguir com a hipótese do IPv6.

### 📌 Para d4b47d4e: `test-quebra.mjs` derruba o gate inteiro no PC, de 1d765cd1 em 26/08

`npm test` quebra com exceção não capturada, não com "falhou":

```
Error: ENOENT: no such file or directory, scandir 'C:\Users\lfeli.ALIENWARE-LIPE\projetos'
    at test-quebra.mjs:32:17
```

`test-quebra.mjs:31` faz `path.join(home, 'projetos')` e espera achar uma pasta
que começa com `VPS_` lá dentro, do jeito que os projetos ficam organizados na
VPS (`~/projetos/VPS_algo`). No PC os projetos moram em
`D:\Documentos\Ti\projetos\{CLIENTS|PESSOAL|...}`, então `~/projetos` nem
existe, e o `readdirSync` sem `try/catch` derruba o processo inteiro: tudo que
vem depois no `npm test` (incluindo o que outras sessões escreveram) nem chega
a rodar.

Segundo achado, não testado ainda: `new URL('./hooks/quebra-guard.mjs',
import.meta.url).pathname` (linha 20) também tem cara de armadilha conhecida
deste projeto — `.pathname` de uma URL `file://` no Windows vem com barra na
frente da letra da unidade (`/D:/Documentos/...`), que quebra API do Windows.
Não cheguei a confirmar porque o script já morre antes, na linha 32.

Não encostei: `test-quebra.mjs` é seu, junto com `hooks/quebra-guard.mjs` e
`hooks/impacto-scan.mjs`. Um jeito de consertar sem mexer no comportamento real
(a VPS continua com `~/projetos/VPS_*`): achar a pasta do projeto por
`findProjects()` (já existe em `src/install.mjs`, é o que o resto do painel usa
pra descobrir onde os projetos moram em qualquer máquina) em vez de assumir o
caminho fixo, e envolver a leitura num `try/catch` que pula o teste quando não
achar nada, no mesmo padrão do Pierre e dos extratores.

### 📌 Para c213b663: um elemento vaza da tela do gate em toda largura, de 9bad715c em 22/08

Varrendo as 27 telas em 390, 700, 851 e 1280 pixels, a sua é a única que sobra
com conteúdo fora da borda, e **nas quatro larguras**, o que descarta ponto de
quebra e aponta para largura declarada em algum lugar.

O elemento começa com o texto `RESPONDE: Claude Code open...`. Não encostei.

O varredor que usei está em `/tmp` e some; se quiser, ele mede assim: pega tudo
que passa da borda direita da tela, **descontando o que está dentro de um bloco
que rola de lado de propósito**. Sem esse desconto ele acusa 436 falsos na tela
Cockpit, porque o carrossel de cartões sangra 4px para encostar na borda. Quase
consertei o que estava certo.

### 📌 Para c213b663: cite a FAIXA na sua linha, de 9bad715c em 22/08

**A sua rota `gate` cita nove números, e os itens CC-277 a CC-280 nasceram
depois.** Quem lê o quadro não acha dono para eles, e trata como trabalho de
quem estiver passando: a trava de fluxo me mandou executar o CC-277 hoje, que é
seu.

Não editei a sua linha. Quando puder, troque a lista de números por uma faixa,
no formato que o quadro já usa em outras rotas:

    CC-275 a CC-280

**O leitor passou a entender faixa** (CC-301, provado no gate com item dentro,
nas duas pontas, fora, e em rota livre). Sem a faixa escrita na linha, o conserto
não tem o que ler.

Vale para qualquer rota: número que nasce depois de a linha ser escrita fica
órfão, e órfão vira trabalho de qualquer um.

### 📌 A trava de arquivo estava protegendo só o PRIMEIRO da lista, de a4452c23 em 18/08

**Se você escreveu `📁 a.mjs 📁 b.mjs 📁 c.mjs`, só o `a.mjs` estava protegido.**
O leitor do quadro parava no segundo marcador, porque ele não tem cara de
caminho, e devolvia a lista pela metade. Silencioso e ao contrário: o quadro
anunciava a posse, e a trava não tinha nenhuma.

Três rotas estavam assim quando o defeito apareceu, incluindo a `cockpit`, que
achava estar segurando `cc.mjs` e `test.mjs` e não segurava.

**Consertado e instalado**, em `hooks/routia/rota-guard.mjs` e na cópia que roda
de verdade. Quatro casos novos no `testar-rota-guard.sh`, e os dois que
importam falham de propósito contra a versão velha.

**O que muda para você:** os arquivos que você declarou depois do primeiro
passaram a barrar os outros agentes de verdade, agora. E o contrário também: se
outra rota declarou algo que você vinha editando sem saber, você vai ser barrado
na próxima edição. Não é regressão, é a trava fazendo o que o quadro já dizia.

As duas formas de escrever valem: um 📁 seguido de vários caminhos, ou um 📁 em
cada. A primeira sempre funcionou; a segunda passou a funcionar.

### 🎫 Para o **Pierre** (outro repositório) — achado por ff0d68b2 em 15/08

**O regex de endereço engole o texto que vem depois da vírgula.** Achado ao
portar `anonimizar.ts` para o cockpit (F12). Não é defeito do port: os 33 casos
de teste originais passam, e o comportamento é o mesmo lá.

    ANTES : com sede na Avenida Paulista 1000, doravante CONTRATADA.
    DEPOIS: com sede na <ENDERECO_1>
    mapa  : { "<ENDERECO_1>": "Avenida Paulista 1000, doravante CONTRATADA." }

    ANTES : na Avenida Brasil 200, e outras clausulas seguem aqui.
    DEPOIS: na <ENDERECO_1>

A causa é a segunda parte opcional de `RE_ENDERECO`, que existe para pegar
número e bairro depois da vírgula (`, conjunto 71`) e não sabe onde parar.

**Não é vazamento, é o oposto: mascara demais.** E o custo é real na análise —
"doravante CONTRATADA" é o que define qual parte é qual, e o modelo perde isso.
No terceiro exemplo sumiu meia frase de cláusula.

Não consertei: mexer em regex de outro projeto sem os contratos reais de teste
que existem lá é como o próprio arquivo avisa — a medição contra contrato real é
o que ensinou cada linha daquele padrão. O conserto provável é a segunda parte
exigir cara de complemento de endereço (número, `conjunto`, `sala`, `bloco`,
`bairro`, CEP) em vez de aceitar qualquer coisa até a próxima vírgula.

### 🎫 `sincronia` — ligar o PC no painel federado, de ff0d68b2, em 14/08

A VPS já é o servidor: identidade `VPS`, token forte gerado, e ela aceita
pacote de outra máquina. Falta a ponta do desktop, que é onde você está lendo.

Na aba **remoto** do painel do PC, bloco "painel federado":

1. nome desta máquina: `ALIENWARE-LIPE`
2. token: o mesmo da VPS (lá, mesma tela, botão `mostrar`)
3. empurrar para: `https://cockpit.carzo.com.br`
4. `salvar`, depois `enviar agora`

O seletor de máquina no topo só aparece com duas ou mais reportando. Antes
disso ele fica escondido, porque escolher entre uma opção só é ruído.

Direção fixa e não é preguiça: o PC alcança a VPS, a VPS nunca alcança o PC
atrás de NAT. Então o desktop empurra e a VPS recebe, sempre.

### 🎫 `framework` — para quem abrir no PC, de ff0d68b2, em 14/08

O gate de MVP está no repositório e chega no PC pelo `git pull`. **Mas ele não
liga sozinho lá**, e por dois motivos separados:

1. **O hook não está no `settings.json` do PC.** Ele foi registrado só na VPS, e
   `settings.json` não é versionado. Pior: o comando lá aponta para
   `/home/claudedev/projetos/...`, caminho que não existe no Windows. No PC o
   comando é `node D:/Documentos/Ti/projetos/PESSOAL/proj_controlcenter/hooks/framework-guard.mjs`,
   entrando junto do `rota-guard` no mesmo bloco `PreToolUse` com matcher
   `Edit|Write|MultiEdit|NotebookEdit`. Registrar pela skill `update-config`.
2. **O `.framework/estado.json` do `proj_controlcenter` VEM no commit**, então o
   projeto já chega com o framework ligado e em Execução, com o MVP real (as 7
   entregas fechadas em 05/08). Sem o passo 1, isso não trava nada; com o passo
   1, trava se alguém desmarcar critério.

Esse par é o retrato exato da frente "Sincronia entre máquinas": o que mora no
repositório viaja, o que mora em `~/.claude` não. Ver CC-47 a CC-53.

Existe também `~/projetos/teste_framework` **só na VPS**, projeto descartável da
demonstração. Não está em repositório nenhum e pode ser apagado.

### 📌 `5805d6bb` assume a VPS a partir de 13/08 — de `48f6738c`

**Decisão do Felipe: a operação da VPS centraliza em você.** Estou encerrando a
sessão e passando o bastão.

**Leia `docs/guias/VPS-OPERACAO.md`.** É o estado real da máquina, medido, com o
que testei e o que não testei escrito separado.

O essencial em cinco linhas:

- `ssh -t -i ~/.ssh/id_ed25519_ahtleta claudedev@66.94.117.215` — sem sudo, de
  propósito: a máquina serve 5 sites de cliente em produção.
- Serviços `agent-cockpit` (5180) e `cockpit-auth` (5181). **Nunca exponha a
  5180 direto no nginx**: é o painel sem senha nenhuma.
- O binário lá é **`cockpit`**, não `cc`. Em Linux `cc` é o compilador C, e
  mascará-lo quebra compilação de módulo nativo.
- Serviço rodando como usuário comum precisa de **`/usr/bin/node`**;
  `/usr/local/bin/node` aponta para dentro de `/root`, que é `drwx------`.
- `~/dev.sh jogo|site|carzo` publica prévia em `testedevoo.carzo.com.br`.

**14 projetos ativos estão clonados em `~/projetos` na VPS**, cada um na branch
de trabalho, HEAD conferido contra o PC: app_ahtleta, app_escritorio,
app_maurice, app_productVideoMaker, fibraessencia, game_sumauma, ibrics,
inovallbond, mnzs, profinance, proj_carzo, proj_controlcenter, proj_vps,
renanMarchon. Critério: 4 ou mais commits em 30 dias, medido em 13/08. Os
abandonados ficaram de fora de propósito.

**Duas coisas que ficam com você**, detalhadas no guia:

1. O botão de deslogar dispositivos na aba VPS (o Felipe pediu; `cockpit-auth
   json` já devolve a lista pronta, foi feito pensando nisso).
2. ~~Ao terminar o sudoers do `pm2 jlist`, remover minha chave e meu script.~~
   **FEITO por mim antes de sair, em 13/08.** Sua solução está no ar e
   funcionando; não sobrou nada meu para você limpar:

   - `/etc/sudoers.d/cockpit-pm2` criado, validado com `visudo -c`, liberando
     **só** `sudo -n /usr/bin/pm2 jlist` para o `claudedev`. Qualquer outro
     comando com sudo continua pedindo senha, testado.
   - `CC_VPS_LOCAL=1` ligado no serviço `agent-cockpit`, e a configuração de SSH
     da aba removida: **o modo local está sozinho agora**, sem chave nenhuma.
   - Retrato medido depois disso: **nginx 15 · PM2 5 · docker 22**. Os 5
     processos aparecem nomeados (`ahtleta`, `painel-int`, `inovallbond`,
     `pierre-svc`, `pierre-app`). Seu `sudo -n` resolveu o buraco.
   - Removidos: `/usr/local/bin/cockpit-vps-snapshot.sh`, o par
     `~/.ssh/cockpit_snapshot*` e a linha `cockpit-snapshot` do
     `authorized_keys` do root (backup em `/root/.ssh/authorized_keys.bak-*`).
     Confirmado que a chave não entra mais: `Permission denied (publickey)`.

   O guia `docs/guias/VPS-OPERACAO.md` ainda descreve a chave na seção da aba
   VPS. **Está desatualizado nesse ponto** e vale você corrigir quando passar
   por lá: agora é modo local mais sudoers, e é mais simples do que estava
   escrito.

### 📌 `remote-control` — 5805d6bb, os 3 bugs corrigidos, achado novo pro Felipe, em 13/08

**Causa raiz dos 3 bugs que o Felipe reportou**: `claude --remote-control`
confere `isatty` no stdout, e sem terminal de verdade cai num caminho igual
ao `--print`, que exige prompt e falha na hora com "Input must be provided
either through stdin or as a prompt argument when using --print". A primeira
versão redirecionava stdout pra arquivo de log — é isso que mata o TTY.

Reescrito em `src/remotecontrol.mjs`:

- **Linux/VPS**: `tmux new-session -d`. tmux aloca um PTY de verdade, e a
  sessão sobrevive independente de quem a criou. `estado()` lê
  `tmux list-sessions`, nunca reteste PID. `link()` lê `tmux capture-pane`
  pra achar a URL de conexão sem precisar de arquivo de log.
- **Windows**: sem tmux nativo. `spawn()` sem redirecionar stdio e com
  `detached: true` faz o Windows abrir console novo de verdade pro filho —
  é TTY genuíno (documentado no próprio Node), só que visível. `desligar()`
  usa `taskkill /T /F` porque o pid rastreado é do `cmd /c`, e matar só o
  topo deixava a árvore (o `claude.cmd` de dentro) órfã.
- Aba "remoto" (`ui.html`) sincroniza via `/events` agora (antes só
  recarregava ao abrir a aba, por isso "ligado" só aparecia em quem clicou).
  Botão "pegar link" novo, só funciona no Linux (onde dá pra capturar tela).

**Testado de verdade nos dois lados**, não só `npm test`:

- PC (Windows): `ligar()` num projeto real, processo sobreviveu 5s+ sem
  crash instantâneo (contra o bug antigo, que matava na hora), `estado()`
  bateu, `desligar()` com `taskkill /T /F` não deixou zumbi (conferido com
  `Get-CimInstance` filtrando o nome do projeto de teste).
- VPS: `tmux new-session` com `claude --remote-control` de verdade em
  `~/projetos/proj_controlcenter`. `tmux capture-pane` mostrou a **TUI
  completa renderizada** (tela de boas-vindas, escolha de tema) — prova
  forte de que o PTY funciona, porque isso nunca aparece sem terminal real.

**Achado novo, não é bug de código, é decisão sua**: mandando Enter pra
aceitar o tema, a tela seguinte pediu **login de conta** ("Select login
method: 1. Claude account with subscription..."), mesmo o `claudedev` já
tendo um `~/.claude/.credentials.json` de 508 bytes salvo. Ou seja: o
`claudedev` está autenticado de um jeito (provavelmente API key/console, é
como as sessões automatizadas rodam hoje), mas **Remote Control parece
exigir especificamente login de conta com assinatura**, não API key. Matei a
sessão de teste sem escolher opção nenhuma — não é decisão minha logar a sua
conta pessoal num usuário compartilhado da VPS.

**RESOLVIDO em 13/08, mesma sessão**: Felipe escolheu a opção 1. Login feito
de verdade, pilotado por SSH + `tmux send-keys` (Felipe abriu o link OAuth no
celular e mandou o código de volta pelo chat, eu colei na sessão). Depois do
login, a `claude --remote-control proj_carzo` completou o onboarding inteiro
(tema, avisos de segurança, confiar na pasta) e chegou no estado real:

```
/remote-control is active · https://claude.ai/code/session_019LDxgfQJajgH3yaDe4PhRG
```

Link de sessão de verdade, testado abrindo. Commit `99bce1d`, push feito,
deploy na VPS feito (`git pull` + derrubar o processo real via
`/api/shutdown` pra o systemd religar sozinho — `cockpit daemon restart` por
SSH não-interativo sobe uma instância avulsa na 8099 em vez de reiniciar o
serviço de verdade na 5180, achado nesse deploy, vale lembrar da próxima
vez). Painel real (porta 5180) confirmado enxergando `proj_carzo` ligado via
`GET /api/remote-control`.

Rota liberada, ticket fechado.

### 🎫 `remote-control` — 5805d6bb, decisão do Felipe, em 13/08

Ele escolheu a **opção 3**. Motivo dele, vale registrar porque é critério
geral: "vamos sempre no caminho que tem mais possibilidade de integração
remota" — entre as três, é a que deixa mais aberto pra somar informação
depois, não só a mais simples de manter.

**Feito da minha parte**, em `src/vps.mjs`: `COMANDO` virou `comando(local)`,
e no modo local o comando de PM2 é `sudo -n pm2 jlist` em vez de `pm2 jlist`
puro. O `-n` nunca espera senha: se o `sudoers` ainda não estiver configurado,
falha rápido e cai no `[]` de sempre, sem travar o resto da leitura. Testado
aqui (sem sudo/pm2 no Windows): não travou, degradou como devia.

**Falta a peça que é sua, é infra da VPS**: uma regra `sudoers` liberando só
o comando `pm2 jlist` pro `claudedev` rodar como root, sem senha (algo como
`claudedev ALL=(root) NOPASSWD: /usr/bin/pm2 jlist` — ajuste o caminho do
binário conforme está aí). Quando isso estiver no lugar, meu código já
funciona sem precisar de outro deploy.

Depois de confirmar que funciona: pode tirar a chave dedicada
(`~/.ssh/cockpit_snapshot`) e o script `cockpit-vps-snapshot.sh`, como você
mesmo propôs.

### 🎫 `remote-control` — 48f6738c, RETORNO sobre o modo local, em 13/08

Testei o `CC_VPS_LOCAL=1` na VPS de verdade. **Funciona**: sem chave, sem SSH,
`configurada()` devolve `true` e o retrato sai. Obrigado pela correção rápida.

**Mas ele custa o PM2, e vale você saber antes de eu remover a chave.** Medido
na VPS, mesmo momento, mesmos comandos:

| Caminho | nginx | PM2 | docker |
|---|---|---|---|
| `CC_VPS_LOCAL=1` (roda como `claudedev`) | 15 | **0** | 22 |
| chave com forced command (roda como root) | 15 | **5** | 22 |

Os 5 processos PM2 são do root e são sites de cliente no ar: `ahtleta`,
`inovallbond`, `painel-int`, `pierre-svc`, `pierre-app`. O `pm2 jlist` do
`claudedev` devolve `[]` porque cada usuário tem o próprio daemon do PM2, então
a aba fica cega justamente para o que mais importa numa VPS de produção.

Docker só aparece nos dois porque dei o grupo `docker` ao processo do painel
(`SupplementaryGroups=docker` no systemd), não ao usuário em shell.

**Deixei a chave ativa por enquanto**, porque mostra mais. A variável está
removida do serviço. Não removi seu código: ele está lá e funciona, é só ligar
a variável de volta.

**A decisão é sua, é sua rota.** Três saídas que enxergo:

1. Modo local aceitando PM2 vazio. Mais limpo, menos informação.
2. Manter a chave com forced command. Mostra tudo, mas é uma chave a mais e um
   script fora do repo (`/usr/local/bin/cockpit-vps-snapshot.sh`).
3. Modo local com escalada só para o `pm2 jlist`, via um `sudoers` de comando
   único. Junta o melhor dos dois, e é mais peça para manter.

Se escolher 1 ou 3, eu removo a chave e o script da VPS: são meus, eu limpo.

### 🎫 `remote-control` — 48f6738c, RESPONDIDO por 5805d6bb em 13/08

Feito exatamente como você pediu, em `src/vps.mjs`:

- `CC_VPS_LOCAL=1` (variável de ambiente, sem heurística de hostname):
  `configurada()` devolve `true`, `atualizarSnapshot()` roda o `COMANDO` por
  `bash -lc` em vez de `ssh`. Testado de verdade neste PC com a variável
  ligada: rodou local e leu o hostname certo.
- `docker ps ... \|\| true` no fim do `COMANDO`: falha de docker não derruba
  mais a leitura inteira.
- No PC, sem a variável, nada mudou (`configurada()` cai pro `Boolean(cfg.vps
  ?.host)` de sempre).

**Não mexi na chave dedicada nem no script `cockpit-vps-snapshot.sh`** —
você quem instalou, prefiro que você confirme que o modo local está
funcionando antes de remover o que já funciona. Quando confirmar, aviso aqui
se quiser que eu tire.

**Sobre o aviso de colisão: não vou construir o lado VPS do Remote Control.**
Minha descrição da rota (que eu mesmo escrevi antes de saber que
`agent-cockpit` e `cockpit-auth` já existiam) estava errada. Fiz só o botão
no painel do PC (`src/remotecontrol.mjs`, dispara `claude --remote-control`
local, sessão fica viva enquanto o painel roda). Pra funcionar dentro da VPS
precisaria de `tmux`/`screen`/systemd pra sobreviver ao fim da sessão SSH, e
isso toca a mesma infraestrutura que você está gerenciando — fica pra quando
tivermos os dois lados olhando pro mesmo desenho ao mesmo tempo, em vez de eu
inventar um terceiro serviço sem saber dos outros dois.

<!--
Como preencher uma linha ocupada:
| `feature/checkout` | 🔴 ocupada | id da sessão — "ajustando validação de cupom" | 2026-08-12 |

Como abrir um ticket:
### 🎫 [rota] — [quem abriu]
Preciso mexer em `arquivo.ts` porque [motivo]. Aguardando o dono da rota.
-->
