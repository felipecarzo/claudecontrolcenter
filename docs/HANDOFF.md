# HANDOFF

**Sessão:** 2026-08-10 · agente Claude (Sonnet 5) · máquina ALIENWARE-LIPE
**Último commit:** `99e2fd3` — feat(servidores): nome explícito, apelido, favoritos, duplicados, subir servidor, ir pra pasta e janela flutuante
**Branch:** `master` · commit `99e2fd3` já empurrado; **cockpit desta sessão ainda não commitado** (ver abaixo)

O que aconteceu: [diario/2026-08-10.md](diario/2026-08-10.md) — tem duas
partes no mesmo dia, a aba de servidores (commitada) e o cockpit (pendente).

## Frente nova adicionada em 11/08 (planejada de fora, sessão em `inovallbond`)

O Felipe está migrando pra cá pra atacar isto. Docs escritos, zero código:

- [[produto/CONTEUDO-SOCIAL]] — visão do módulo: pipeline
  calendário+git log+diário → digest semanal → skill de rascunho (fora deste
  repo) → fila de curadoria em lote. Nasceu de ele querer parar de perder
  conteúdo postável (projetos, eventos, produção acadêmica) sem virar
  influencer nem ter que reabrir cada projeto pra escrever um post.
- `ROADMAP.md`, itens **CC-20 a CC-26** — backlog em ordem de dependência.
  **CC-20 (calendário no CC) e CC-21 (MCP do Google Calendar com escrita) são
  pré-requisito de tudo depois** — sem agenda povoada não tem gatilho de story
  nem marco pra cruzar com git log. Recomendação de início: CC-20.
- Contexto extra que não foi pra doc nenhum: dois repos do GitHub
  (`blacktwist/social-media-skills`, `charlie947/social-media-skills`) foram
  auditados e descartados — nenhum lê calendário/git/memória como gatilho,
  nenhum gera lote, todos assumem "uma invocação = um post" com fonte colada
  à mão. Só `content-repurposer-sms` (blacktwist) serve como referência de
  estrutura de derivados por plataforma, citado no CC-26.
- Não mexe com CC-17 (próxima task da sessão de 10/08, ver abaixo) nem com o
  cockpit pendente de commit — frentes paralelas, sem conflito de arquivo
  (esta só tocou `docs/`).

## Pendências de commit

O cockpit inteiro está pronto, testado, mas sem aprovação de commit ainda —
a sessão foi delegada (`/ceo`) pra implementar sem parar, não pra commitar
sem parar. Arquivos modificados desde `99e2fd3`:

```
M  CLAUDE.md
M  docs/ROADMAP.md
M  src/config.mjs
M  src/ui.html
M  src/web.mjs
M  test.mjs
?? src/docker.mjs
?? src/processos.mjs
?? src/vps.mjs
```

`npm test` passa. `cc daemon restart` já foi rodado com o backend novo — o
painel real (porta 8099) já reflete tudo isto, incluindo a VPS de produção
já configurada e lida uma vez (host `66.94.117.215`, salvo no
`control-center.json` desta máquina, fora do repositório).

## Próxima task: CC-17 — o "último pedido" no cartão não é o último

Segue sem tocar — não é isso que o Felipe pediu hoje.

A linha mistura duas fontes: `lastPrompt`, lido do transcript, e `meta.status`,
escrito pelo agente. A precedência escolhe uma e não diz qual. Decidir entre
rotular a origem ou mostrar só o que o agente declarou — e, se for a segunda,
lembrar que `subject` já é do agente, então a linha viraria redundante.

Começar por `src/ui.html`, função `cartao()`, a variável `nota`.

## O que mudou hoje — resumo dos dois pedaços

**Aba de servidores** (commitado): nome explícito por processo, apelido/nota,
favoritos, agrupar por projeto, fechar duplicados, ir pra pasta (4 formas),
subir servidor. Três bugs de detecção de projeto corrigidos — ver `CLAUDE.md`.

**Cockpit** (pendente): o Felipe pediu pra virar "ferramenta de cockpit" —
mais informação acessível sem sair do que está fazendo. Seis peças:

1. **Config do PiP** — `⚙` no topo escolhe blocos + layout. `setPip()` em
   `config.mjs`, rota `/api/pip`.
2. **Abas dentro do PiP** — cada bloco vira aba própria. "Geral" (tudo
   empilhado) é sempre a primeira e o padrão — foi correção depois que o
   Felipe testou e sentiu falta da visão de conjunto.
3. **Fita horizontal** — layout alternativo em pastilhas coloridas por faixa
   de uso, agrupadas por bloco. Redesenhada depois que o Felipe viu a
   primeira versão (texto corrido) e reclamou.
4. **Docker local** — `docker.mjs`, seção na aba servidores + bloco no PiP.
5. **Aba VPS** — organograma visual (nginx → Docker por porta, PM2 à parte)
   de `66.94.117.215`. **Só atualiza sob clique, nunca em timer** — usa a
   chave privada do Felipe. `vps.mjs`.
6. **Processos que mais consomem** — `processos.mjs`, `Get-Process`. **Medido
   19-29,3s por chamada nesta máquina (596 processos) — também só sob
   clique**, nunca timer. Bloco no PiP.

## Armadilhas que vão te pegar de novo

- **Botão com feature-detect precisa desescondar TODOS os elementos, não só
  o primeiro que lembrar.** `#pip-config-toggle` ficou `hidden` pra sempre
  porque só `#pip-toggle` recebia `hidden = false`. `getBoundingClientRect()`
  num elemento escondido dá retângulo zerado — o bug não dá erro, só some.
- **Nada caro roda em timer, mesmo que "só 10s".** VPS por SSH e processos
  por `Get-Process` são as duas exceções conscientes: clique explícito,
  nunca `setInterval`. A VALIDADE_MS de cache é pra não reler à toa dentro da
  mesma sessão de uso, não uma licença pra automatizar depois.
- **Timeout perto do tempo medido é bug, não coincidência.** `Get-Process`
  variou 19s–29,3s; um timeout de 30s quase estourou de verdade. Se o tempo
  medido chega perto do limite, o limite está errado.
- **PiP não abre via automação de browser** — `documentPictureInPicture`
  exige gesto real do usuário. Pra revisar design sem incomodar o Felipe:
  extrai o `<style>` do `ui.html`, cola numa página estática com os mesmos
  nomes de classe, tira print dessa página.
- O resto (aba de servidores, `.bin` fantasma, drive perdido, etc) segue em
  `CLAUDE.md`, seção Armadilhas — leia de cima, as de hoje estão no topo.

## Arquivos a ler antes

- `CLAUDE.md` — seção Armadilhas, tudo de hoje está no topo
- `src/vps.mjs` e `src/processos.mjs` — os dois com decisão de segurança
  (nunca timer) que não pode ser "otimizada" de volta pra automático
- `src/ui.html` → bloco "janela flutuante (resumo)" — é onde config, abas e
  fita moram juntos
- `src/ui.html` → função `cartao()`, variável `nota` — ponto de partida do
  CC-17

## Regras que não podem quebrar

- `process.platform` só aparece em `src/platform.mjs`
- `~/.claude/jobs` é somente leitura, exceto `meta.json`
- `pins.json` e `state.json` são do Claude Code — nunca escrever
- Depois de editar `src/*.mjs`, reinicie o servidor (`cc daemon restart`):
  ele não recarrega módulo. `ui.html` É lido do disco a cada request — não
  precisa restart pra mudança só nele.
- O pacote global é um LINK para este repositório: código quebrado aqui quebra
  o `cc` de todos os agentes na hora. Rode `npm test` antes de sair.
- `subirServidor()` executa comando arbitrário na máquina — trava é só a
  pasta (`pastaValida()`), de propósito sem lista fechada de comandos.
- **Novo:** `vps.mjs` e `processos.mjs` NUNCA em `setInterval`. Ver armadilhas.
- **Novo:** IP/usuário/chave da VPS ficam em `control-center.json`, nunca no
  código — o repositório é público (`felipecarzo/claudecontrolcenter`).

## Estado do ROADMAP

| Task | Estado |
|---|---|
| CC-17 último pedido ambíguo no cartão | aberto — próxima da sessão de 10/08 |
| CC-18 projeto sem ROADMAP.md fica sem mapa | aberto |
| CC-19 conferir se os agentes declaram `frente` | aberto — reavaliar em dias |
| CC-20 calendário dentro do CC | **aberto — pré-requisito da frente nova** |
| CC-21 MCP do Google Calendar com escrita | aberto — depende do CC-20 |
| CC-22 arquivo de marco manual | aberto |
| CC-23 histórico rico por projeto | aberto |
| CC-24 digest semanal entre projetos | aberto — depende do CC-20/22/23 |
| CC-25 vault Obsidian como espelho de leitura | aberto — depende do CC-23/24 |
| CC-26 skill de geração de rascunho (fora deste repo) | aberto — depende do CC-24 |
| CC-14 tray com porcentagem errada | aberto — do Felipe |
| CC-15 statusline.log com 284 MB | aberto — do Felipe |
| CC-08 macOS e Linux | aberto — precisa de máquina |
| CC-04 aviso de silêncio nunca visto | aberto — precisa de agente travado |
| CC-05 tabela do terminal ainda agrupa por projeto | aberto |

Ideias do cockpit que ficaram de fora (não pedidas de novo, mas surgiram no
meio): bandeja do sistema com tooltip é viável tecnicamente, mas é peça
separada; fixar de verdade na barra de tarefas o Windows não permite via
nenhum programa desde o Windows 10 — sem solução, só o gesto manual do
usuário.
