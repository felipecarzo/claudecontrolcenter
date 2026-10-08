// CC-987: cada aba do painel instalável como app próprio (nome, escopo e tela de abertura).
// Lista fechada: chave fora dela dá 404. O hash é o nome do `data-target="view-..."` do menu,
// que é o que `aplicarEndereco()` em ui_cockpit2.html resolve. `#sessoes` NÃO abre a tela
// Sessões (cai na Início), por isso ela abre por `#decisoes`.
export const ABAS = {
  inicio: { nome: 'Início', hash: 'inicio' },
  caminho: { nome: 'Caminho', hash: 'caminho' },
  sessoes: { nome: 'Sessões', hash: 'decisoes' },
  tarefas: { nome: 'Tarefas', hash: 'tarefas' },
  coderoom: { nome: 'Coderoom', hash: 'gate' },
  kanban: { nome: 'Kanban', hash: 'trabalho' },
  projetos: { nome: 'Projetos', hash: 'projetos' },
  armario: { nome: 'Armário', hash: 'armario' },
  ideias: { nome: 'Ideias', hash: 'ideias' },
}

const aba = (chave) => (Object.hasOwn(ABAS, chave) ? ABAS[chave] : null)

/** Manifesto da aba: o base com id, nome e escopo próprios, sem atalhos. null se a chave não existe. */
export function manifestoDaAba(base, chave) {
  const a = aba(chave)
  if (!a) return null
  const { shortcuts: _fora, ...resto } = base
  const raiz = `/app/${chave}`
  return { ...resto, id: raiz, name: `Ogumia ${a.nome}`, short_name: a.nome, start_url: raiz, scope: raiz }
}

/** HTML do painel para a aba: manifesto trocado e, sem hash na URL, abre na tela dela. null se a chave não existe. */
export function htmlDaAba(html, chave) {
  const a = aba(chave)
  if (!a) return null
  const script = `<script>if(!location.hash)history.replaceState(null,'','#${a.hash}')</script>`
  return html
    .replace('<link rel="manifest" href="/app.webmanifest">', `<link rel="manifest" href="/app/${chave}.webmanifest">`)
    .replace('<head>', `<head>${script}`)
}
