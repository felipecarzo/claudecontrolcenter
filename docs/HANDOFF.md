# HANDOFF

**Sessão:** 2026-08-13 · agente Claude (Sonnet 5, job de background `5805d6bb`) ·
máquina ALIENWARE-LIPE · continuação direta da sessão de 12/08 (mesmo dia
lógico, virou a madrugada)
**Último commit:** `99bce1d` — fix(remote-control): PTY de verdade,
liveness sem PID reciclado, sync entre aparelhos
**Branch:** `master`

O que aconteceu: [diario/2026-08-13.md](diario/2026-08-13.md). Resumo: CC-32
(cockpit) e o backlog que saiu dele no mesmo fôlego (CC-06, CC-23, CC-24,
CC-33, CC-34, CC-35), CC-42 (aba rotinas, 22 cópias desatualizadas limpas), e
o conserto do Remote Control (3 bugs reais de PTY/liveness/sync, mais o
login de conta que faltava no `claudedev` da VPS — pilotado por SSH,
commitado e deployado nos dois lados).

**Achado neste fechamento**: seis tasks (CC-06/23/24/33/34/35) e CC-38
estavam prontas no código havia horas, mas ainda apareciam como "Aberto" no
`ROADMAP.md` — corrigido agora. Se um HANDOFF futuro parecer desalinhado do
ROADMAP de novo, é sinal de rodar `/end-session` com mais frequência, não só
no fim do dia inteiro.

## Próxima task

**Sem task óbvia sem decisão do Felipe primeiro** — a maior parte do que
sobrou no ROADMAP está travada em escolha dele: CC-30/31 (framework de
hooks), CC-39 (o que fazer com `app/` no projeto_template), CC-40/41
(quais memórias sobem pro global, pipeline formal ou não), CC-43/44 (D1: o
painel escrever `settings.json`).

O que dá pra pegar sem esperar resposta:

1. **CC-46** (novo, achado hoje) — `estadoDe()` em `roadmap.mjs` casa por
   regex solto no título inteiro, não só no marcador de estado. Pequeno,
   isolado, sem decisão pendente.
2. **CC-21** — MCP do Google Calendar com escrita. Primeira peça da frente
   "Conteúdo social" que ainda falta (CC-20 já feito).
3. **CC-25/CC-26** — agora desbloqueados de verdade: dependiam do CC-24
   (digest), que foi feito hoje.

**Não pegar sem avisar o Felipe primeiro**: CC-36 (enriquecimento de to-dos
pelo opencode) — funciona, mas carrega o bloqueio não resolvido do `cwd` não
isolando de verdade o opencode (ver ROADMAP, "🔴 Bloqueio crítico"). Decisão
dele foi deixar em aberto e investigar pela própria VPS, não bloquear o
resto do backlog.

## Arquivos a ler antes

- `docs/ROADMAP.md` — estado real de tudo que está aberto (acabou de ser
  limpo nesta sessão, confiar nele mais que em memória de sessões antigas)
- `docs/ROTAS-ATIVAS.md` — Método Routia; `remote-control` está livre de
  novo, ticket completo com o que foi feito e testado
- `src/remotecontrol.mjs` — reescrito hoje; se for mexer em qualquer coisa
  que dispara processo de longa duração (`spawn`, `tmux`), ler os comentários
  de topo antes: PTY real é a diferença entre funcionar e falhar calado
- `CLAUDE.md` (projeto) — seção Armadilhas, ordem cronológica reversa (mais
  recente primeiro)

## Regras que não podem quebrar

Ver `CLAUDE.md`, seções "Regra de ouro" e "Armadilhas". Novidades de hoje:

- **`claude --remote-control` exige TTY de verdade.** Redirecionar stdout
  pra arquivo mata o terminal e o comando falha na hora. `tmux new-session
  -d` no Linux, console novo via `spawn()` sem stdio redirecionado no
  Windows — nunca voltar pro padrão de log em arquivo pra esse comando
  específico.
- **Liveness de processo de longa duração nunca re-testa PID isolado**
  (`process.kill(pid, 0)`) — o SO recicla PID e isso já gerou falso "ligado"
  com processo morto. Usar o sinal de verdade: evento de saída do processo
  (Windows) ou o dono real do recurso (`tmux has-session`, no Linux).
- **`cockpit daemon restart` por SSH não-interativo não reinicia o serviço
  systemd de verdade** — sobe uma instância avulsa noutra porta (8099 em vez
  da 5180 real). Pra atualizar o serviço de produção na VPS depois de um
  `git pull`: derrubar o processo real via `POST /api/shutdown` (o systemd
  tem restart automático) e conferir com `systemctl status agent-cockpit`
  que o `Main PID` mudou.
- **`docs/ROADMAP.md` só reflete o código se alguém tirar o item de lá ao
  terminar.** Marcar ✅ não é suficiente sozinho pra itens que a sessão quer
  arquivar de vez — a convenção do projeto (linha 3 do próprio ROADMAP) é
  "concluído sai daqui e vira linha no diário". Ver o achado de hoje.
