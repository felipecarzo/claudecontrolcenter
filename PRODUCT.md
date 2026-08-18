# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existente: HTML/CSS/JS único (`src/ui.html`), sem framework, sem build, servido por um servidor Node próprio (`src/web.mjs`) com atualização em tempo real por SSE. Decisão confirmada do projeto (não greenfield): continua vanilla. Portabilidade e partida instantânea pesam mais que ferramentas de front-end.

## Users

Um usuário só: Felipe, desenvolvedor solo que toca 4 a 5 projetos de cliente e pessoais em paralelo, cada um com vários agentes do Claude Code rodando em background ao mesmo tempo. Ele é quem despacha trabalho para os agentes e decide onde intervir, não quem executa.

Contexto de uso real, confirmado por padrão medido, não suposto: mensagens curtas (até 25 caracteres) em 17% dos casos, quer execução e silêncio; mensagens longas (500+) em 18%, é quando está descrevendo visão, não pedindo tarefa. Ele costuma estar na rua, no celular, e também usa o painel encaixado numa lateral estreita do monitor no computador. As duas situações têm a mesma largura efetiva, por isso a regra "celular primeiro" já vale para as duas telas, não só a menor.

Limite cognitivo que ele mesmo nomeou e que é decisão de produto, não só de copy: "a gente está mexendo em muita coisa que eu normalmente demoraria meses pra fazer... o meu cérebro não consegue absorver tudo". Ele não lembra nome de mecanismo interno em segundos como a IA lembra. A arquitetura da tela não pode depender da memória dele para ser usável.

## Product Purpose

Ver o estado de todos os agentes de Claude Code rodando, numa tela só, sem entrar em nenhum. Nasceu porque a única forma nativa de olhar vários agentes é navegar aba por aba no terminal, uma de cada vez, e não existe visão de conjunto.

Reposicionado em 12/08 (palavras dele): "os hooks não são o produto, o produto é o control center gerenciar isso tudo e se beneficiar dos hooks pra alimentar o cockpit dos nossos agentes." O produto não é mais só "ver dado do agente": é responder, de relance, quem está fazendo o quê, onde, e o que precisa dele agora.

Sucesso não é "impõe boa prática" (ele já rejeitou trava que só disciplina sem informar, no passado). Sucesso é: isto me faz voltar ao contexto mais rápido depois de ficar horas fora de um projeto?

## Positioning

Não é gerenciador de agentes (não cria, não mata, não pausa job: isso é do CLI). Não é log (transcrição e diff ficam no CLI; aqui cabe só o que se lê de relance). Não é ferramenta de projeto genérica tipo Linear/Jira: é peça de cockpit para UM humano operando uma frota de agentes de IA em vários repositórios ao mesmo tempo, papel que nenhum concorrente pesquisado (probity, tdd-guard, AI-SDLC, spec-kit, BMAD) resolve. Todos tratam de um repositório só, nenhum de reentrada de contexto em N projetos paralelos.

## Operating Context

Duas superfícies do mesmo dado: terminal (resposta em segundos, olho rápido) e web (ler com calma, filtrar, abrir detalhe). A tela web é a candidata a esta reforma.

Roda como painel sempre ligado, atualizando sozinho a cada poucos segundos (SSE), sem ele precisar apertar nada para os dados mudarem na tela. Isso já é ponto de atenção de design herdado: elemento com estado do sistema operacional (menu aberto, campo em edição) não pode estar dentro de bloco redesenhado por esse relógio.

Tema claro e escuro, os dois em uso real (ele mesmo confirmou testando ambos). Estrutura de container-query (`@container`, nunca `@media`), porque o painel encolhe dentro de uma lateral de tela mesmo com a janela do navegador larga.

Superfície hoje tem mais de dez seções (agora/agentes, custo, servidores, VPS, hooks/proteções, bancada, rotinas, remoto, tempo, gráficos, documentos, notas, entrevista de projeto novo...), todas dentro do mesmo shell de abas. Cresceu por acréscimo ao longo de várias semanas, uma aba nova a cada funcionalidade nova.

## Capabilities and Constraints

Dado principal: um agente é uma linha, com projeto, rota, modelo, tokens, idade e to-dos, derivado de `~/.claude/jobs/*/state.json` (só leitura, nunca escrito por este projeto) mais o que o próprio agente reporta em `meta.json` (assunto, categoria, to-dos, bloqueio).

Confirmado nesta conversa (19/08), quando perguntado qual é o maior problema de uso hoje: **"uma mistura de todos"** entre (a) função demais espalhada em aba demais, (b) o que importa não salta aos olhos rápido, e (c) a interface não parece um produto pensado para ser usado com prazer, mais parece planilha ou lista técnica.

Confirmado também, sobre o que ele quer dizer com "redistribuição de funções": **o que muda a cada segundo (agentes rodando agora) deveria estar visualmente separado do que é configuração** (hooks, rotinas, ajustes que só mudam de vez em quando). Hoje as duas categorias convivem lado a lado no mesmo nível de abas, sem hierarquia entre "o que está vivo agora" e "o que é ajuste do sistema".

Três exemplos concretos que ele deu, todos confirmados contra o código real:

1. **"Remoto" e "servidores" são usados juntos, hoje vivem separados.** Palavras dele: "eu ligo um servidor, eu posso mudar [a configuração] dele ali logo". A aba remoto liga sessão de agente numa pasta; a aba servidores mostra e controla porta que já está no ar. Na prática do dia a dia, uma ação leva direto à outra, e hoje exigem trocar de aba.
2. **Falta uma visão de backlog/sprint cruzando TODOS os projetos numa aba só, em tabela**, com cada projeto colapsável e cada sprint dentro dele também colapsável. Ele chamou isso de "muito importante e muito difícil de acessar do jeito que está agora". Já existe uma visão de planilha de tarefas (`planilhaSprint`), mas hoje ela não agrupa por projeto com dobra por projeto e por sprint do jeito que ele descreveu.
3. **Projeto ativo e projeto inativo deveriam se comportar diferente**: ativos aparecem abertos, inativos ficam recolhidos embaixo, e o que está aberto ou fechado tem que ficar **salvo no servidor**, não preso ao navegador. Verificado no código: hoje esse estado (`cartoesAbertos`, a vista de sprint escolhida) mora em `localStorage`, ou seja, é por aparelho. Trocar de celular pro computador perde a escolha.

Não pode perder: nenhuma funcionalidade das mais de dez seções, é reorganização e redesenho, não corte de recurso. Não pode quebrar: a atualização ao vivo por SSE, os dois temas, a experiência em tela estreita (celular e monitor lateral).

## Evidence on Hand

Auditoria de heurísticas de UX já rodada nesta mesma sessão (comando `critique` desta skill) sobre `src/ui.html`, achados registrados em `.impeccable/critique/`. Os 5 achados prioritários já foram corrigidos (lista que ficava toda aberta virou colapsável, sombra indicando rolagem lateral, alertas nativos do navegador trocados por aviso próprio, hierarquia de título, borda de uma etiqueta). Ele viu o resultado e disse explicitamente que não era isso que queria: queria uma direção nova de verdade, não ajuste pontual. É o motivo desta reabertura.

Print real do estado atual do painel em produção, tirado em 18/08, disponível na conversa.

## Product Principles

- **A ordem da tela é a informação, não decoração.** O que está no topo é onde ele deveria olhar primeiro; peso numérico nunca aparece, só a frase que explica.
- **O vivo se separa do configurado.** Agente rodando agora e ajuste de sistema não competem pelo mesmo nível de atenção visual (confirmado nesta conversa como a dor central).
- **Ação que anda junta na vida real mora junta na tela**, mesmo que os dados venham de fontes técnicas diferentes (o par remoto/servidores é o exemplo confirmado).
- **Estado de preferência de leitura viaja com ele, não com o aparelho.** Dobrar um projeto ou uma seção no celular tem que continuar dobrado quando ele abre no computador.
- **Celular e monitor estreito são o mesmo caso, não um caso especial.** Qualquer direção nova tem que nascer pensada pro espaço apertado, com o desktop largo herdando dali, não o contrário.
- **Zero recurso perdido.** Toda reorganização preserva as mais de dez funções existentes; o que muda é onde e como elas aparecem, não se elas existem.

## Accessibility & Inclusion

Sem requisito formal declarado. Um achado real de acessibilidade já foi corrigido nesta sessão (hierarquia de título pulava nível). Nenhum outro padrão específico (contraste mínimo, leitor de tela) foi confirmado como exigência deste projeto até aqui.
