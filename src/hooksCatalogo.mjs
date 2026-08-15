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

/**
 * CC-69: o que cada hook FAZ quando dispara, declarado num lugar só.
 *
 * O Danger tem `fail`, `warn` e `message`, e a regra diz qual usa. Aqui a
 * escolha estava certa em todos, mas **espalhada pelo código de cada um**: não
 * dava para olhar num lugar e saber o que trava e o que só fala.
 *
 * - `trava`  — recusa a ferramenta (exit 2). O agente não passa.
 * - `avisa`  — fala e deixa seguir. Todo hook de `Stop` é assim, e é obrigatório:
 *              exit 2 no `Stop` devolve o texto ao modelo e cria laço.
 * - `injeta` — põe contexto no começo da sessão, sem barrar nada.
 * - `mede`   — só registra, nunca aparece.
 */
export const NIVEIS = {
  trava: 'recusa a ferramenta — o agente não passa',
  avisa: 'fala e deixa seguir',
  injeta: 'põe contexto no início da sessão',
  mede: 'só registra, não aparece',
}

export const HOOKS = [
  {
    id: 'estilo-inicio',
    nivel: 'injeta',
    label: 'Padrão de resposta do Felipe',
    script: 'estilo-inicio.mjs',
    evento: 'SessionStart',
    descricao: 'Injeta o padrão de resposta no início de TODA sessão, em '
      + 'qualquer projeto, com o framework ligado ou desligado. Não é gate: '
      + 'hook bloqueia ferramenta, não prosa. O texto fica em '
      + '~/.claude/control-center-estilo.md e é editável.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'estilo-fim',
    nivel: 'mede',
    label: 'Padrão de resposta — mede sem reclamar',
    script: 'estilo-fim.mjs',
    evento: 'Stop',
    descricao: 'Mede tamanho e parágrafos de autodefesa da resposta que acabou '
      + 'de sair. Nunca bloqueia e nunca fala na tela: aviso a cada resposta '
      + 'seria a linha a mais que o padrão existe para cortar. Vira tendência '
      + 'no painel (cc estilo).',
    padrao: true,
    implementado: true,
  },
  {
    id: 'recados',
    nivel: 'trava',
    label: 'Método Routia — agentes do mesmo projeto se falando',
    script: 'recados.mjs',
    evento: 'PreToolUse',
    descricao: 'Entrega recado de outro agente na PRÓXIMA ferramenta, não no '
      + 'fim do turno. Interrompe uma vez por recado e libera. Falha aberta: '
      + 'roda em toda chamada de todos os agentes.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'rota-guard',
    nivel: 'trava',
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
    nivel: 'trava',
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
    nivel: 'avisa',
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
    nivel: 'injeta',
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
    nivel: 'avisa',
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
