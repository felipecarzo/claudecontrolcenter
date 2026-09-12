# HANDOFF

**Sessão:** 2026-09-11/12 · PC (`0174a7a8`), rota `cockpit2` — dois defeitos
visuais consertados, limpeza dos pedidos parados do Routia, e o início da
mudança de arquitetura do CC-539 (framework como registro central)
**Último commit:** `4ee9785` (da sessão `56665382`, que fechou antes desta)
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

## Pendência de commit desta sessão

Nada foi commitado ainda. `git status --short` mostra:

```
 M docs/ROADMAP.md            (regenerado, `cc backlog gerar`)
 M docs/TEST-MAP.json          (regenerado, `cc testmap`)
 M docs/TEST-MAP.md
 M docs/backlog.jsonl          (CC-537, 538, 539, 540, 541-544 novos/fechados)
 M src/web.mjs                 (rotas do registro central + o forward cofre/satélite)
 M test-projeto-novo.mjs       (exceção declarada pra /api/registro/projetos)
?? assets/feedback/260911/*.png   (provas visuais dos dois bugs)
?? src/github.mjs                 (CC-541, novo)
?? src/projetoRegistro.mjs        (CC-540, novo)
?? test-github.mjs                (CC-541, novo)
?? test-projeto-registro.mjs      (CC-540, novo)
```

`src/ui_cockpit2.html` (o conserto dos dois bugs visuais) **já está
commitado** em `4ee9785`, não é meu — a sessão `56665382` levou junto ao
fechar, com autorização dele.

## O que esta sessão fechou, com prova

- **CC-537**: badge de framework sobrepunha o nome do projeto na lista
  (`ecommerce_apps` vazava 4px sobre o badge). `.c2-linha b` com
  `text-overflow:ellipsis`, coluna de badges com `flex-wrap`. Provado com
  `getBoundingClientRect()` real, antes e depois.
- **CC-538**: mensagem "este projeto não está no disco desta máquina"
  (kamilleLeal) estava errada — a pasta existe, só falta `.git`/`CLAUDE.md`.
  Mensagem trocada pela causa real.
- **17 pedidos de autorização órfãos** negados no Routia (sessões de
  semanas atrás), a pedido dele. Ficou só `06ade003` (`src/entrevista.mjs`)
  pendente de verdade.
- **CC-540 (Fase 1 do CC-539)**: o registro central de projeto.
  `src/projetoRegistro.mjs` + rota `/api/registro/projetos`. Testado ponta
  a ponta com dois servidores reais (cofre + satélite simulados).

## ⚠️ O que está pela metade — CC-541, Fase 2 do CC-539

`src/github.mjs` escrito (`criarRepo` via `gh repo create`, nunca falha
silencioso). A rota de declarar já chama isso depois de gravar no registro.
**Só a parte pura tem teste** (`repoDeUrl`, em `test-github.mjs`) — nunca
chamei `gh repo create` de verdade, porque isso cria um repositório real na
conta dele.

**Próximo passo exato**: perguntar a ele (de novo — a pergunta anterior foi
interrompida por este `/end-session`) se aprova criar um repositório de
TESTE (`gh repo create cc-teste-540-registro --private`) pra provar a Fase
2 ponta a ponta, e apagar em seguida. Se sim, rodar o teste, `npm test`
completo, fechar CC-541 com `node cc.mjs backlog fechar CC-541 --prova
"..."`. Se não, fechar mesmo assim confiando na revisão de código, deixando
registrado que o caminho `gh` real não foi provado ao vivo.

Depois: Fases 3-5 (CC-542, CC-543, CC-544) — provisionar pasta local
clonando o repo, a tela do cockpit2, e migrar os 29 projetos atuais pro
registro. Plano completo, com o desenho de cada fase, em
`~/.claude/plans/silly-bubbling-emerson.md` (fora do repositório, no
`~/.claude` do Felipe).

## Arquivos a ler

- `~/.claude/plans/silly-bubbling-emerson.md` — o plano inteiro do CC-539,
  com o "Estado em 12/09" no topo
- `src/projetoRegistro.mjs`, `src/github.mjs` — o que já existe
- `docs/backlog.jsonl` — CC-539 a CC-544, o desenho em itens
- `CLAUDE.md` (raiz do projeto) — a seção de armadilhas cresceu com o
  achado de hoje: identidade de projeto por `path.basename` é frágil,
  registro central resolve isso

## Rota (Método Routia)

Rota `cockpit2` continua marcada como minha em `docs/ROTAS-ATIVAS.md`. Não
libero: ainda vou continuar o CC-539 na próxima sessão.
