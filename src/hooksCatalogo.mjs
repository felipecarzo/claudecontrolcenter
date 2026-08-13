// Catálogo dos hooks que o Control Center conhece — o que já existe de
// verdade (Método Routia, cc check) e o que os próximos épicos do backlog de
// hooks vão criar. Dado estático, sem I/O: quem lê disco é `hooksRegistro.mjs`
// (settings.json) e `config.mjs` (o toggle).
//
// `registradoVia` existe porque nem todo hook tem script próprio registrado
// no settings.json: `cc-check` vive dentro de `cc.mjs` e é disparado por
// `todo-guard.mjs`, que faz `spawnSync` pra ele — procurar por "cc.mjs" no
// settings.json nunca acharia nada, e diria "não registrado" pra um hook que
// está rodando de verdade a cada Stop.

export const EVENTOS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest',
  'Notification', 'Stop', 'SessionStart', 'SessionEnd',
  'PreCompact', 'PostCompact', 'UserPromptSubmit',
]

export const HOOKS = [
  {
    id: 'rota-guard',
    label: 'Método Routia — trava edição sem rota',
    script: 'rota-guard.mjs',
    evento: 'PreToolUse',
    descricao: 'Bloqueia Edit/Write/MultiEdit/NotebookEdit em projeto com '
      + 'docs/ROTAS-ATIVAS.md quando a rota é de outra sessão.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'git-add-guard',
    label: 'Método Routia — trava git add em massa',
    script: 'git-add-guard.mjs',
    evento: 'PreToolUse',
    descricao: 'Bloqueia "git add ."/"-A"/"-u" e "commit -a" em projeto com '
      + 'docs/ROTAS-ATIVAS.md — evita levar mudança de rota alheia junto.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'cc-check',
    label: 'to-do aberto trava a entrega',
    script: null,
    registradoVia: 'todo-guard.mjs',
    evento: 'Stop',
    descricao: 'Avisa (e faz o agente continuar) quando o status diz '
      + '"entregue" mas ainda tem to-do aberto no meta.json.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'routia-inicio',
    label: 'Método Routia — mostra o quadro ao abrir sessão',
    script: 'routia-inicio.mjs',
    evento: 'SessionStart',
    descricao: 'Injeta o resumo de docs/ROTAS-ATIVAS.md no início da sessão, '
      + 'sem depender do agente lembrar de ler.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'routia-fim',
    label: 'Método Routia — lembra de liberar a rota',
    script: 'routia-fim.mjs',
    evento: 'Stop',
    descricao: 'Lembra (sem bloquear, sem editar sozinho) quando a sessão '
      + 'termina com uma rota 🔴 ainda marcada no seu nome — mas só fala se '
      + 'o Control Center confirmar outro agente de verdade ativo no '
      + 'projeto; sozinho, fica quieto.',
    padrao: true,
    implementado: true,
  },
]

export const hookDe = (id) => HOOKS.find((h) => h.id === id) || null
