/**
 * Uma skill escrita uma vez, valendo nos três agentes.
 *
 * ## O pedido
 *
 * *"quero criar um mecanismo que quando cria uma skill ja cria pros 3, teria
 * como?"*
 *
 * ## A resposta, medida contra os três programas em 21/08
 *
 * Tem como, e é mais simples do que parecia: **os três usam o mesmo formato**,
 * uma pasta por skill com um `SKILL.md` dentro, e frontmatter de `name` e
 * `description`. O que muda é só onde cada um procura.
 *
 * | agente | onde ele procura | provado? |
 * |---|---|---|
 * | Claude Code | `~/.claude/skills/<nome>/SKILL.md` | sim, apareceu na lista da sessão na hora |
 * | opencode | `~/.config/opencode/skills/<nome>/SKILL.md` | sim, anunciou "vou carregar a skill" e respondeu certo |
 * | agy | `~/.gemini/config/skills/<nome>/SKILL.md` | sim, respondeu a palavra secreta da skill de teste |
 *
 * ## As duas armadilhas do agy, as duas custaram tentativa
 *
 * 1. **É `~/.gemini/config/skills/`, e NÃO `~/.gemini/skills/`.** O binário cita
 *    os dois caminhos, e só o primeiro funciona. Com o arquivo no lugar errado
 *    ele ia procurar a resposta no código do projeto, com `grep`, e às vezes
 *    inventava. Nunca deu erro: só respondia outra coisa.
 * 2. **Ele precisa de permissão de leitura declarada.** Sem ela, o modo sem
 *    terminal recusa ler o arquivo da skill e devolve um aviso na saída de erro.
 *    O mínimo medido é `read_file(*)` em `permissions.allow`, dentro de
 *    `~/.gemini/antigravity-cli/settings.json`. Liberar comando não é preciso,
 *    e por isso não se libera.
 *
 * ## Cópia, e não link
 *
 * Link simbólico seria mais elegante e foi a primeira tentativa: não funcionou
 * no agy, e não dá para saber se cada programa segue link. Cópia sempre
 * funciona, e o preço é ter que sincronizar quando a skill muda, que é o que
 * `sincronizar()` faz.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

/**
 * Onde cada um procura. `casa` é a fonte (a do Claude Code, que é onde ele já
 * tem 39 skills escritas); os outros são destinos.
 */
export const DESTINOS = [
  { agente: 'claude', dir: () => path.join(casaClaude(), 'skills'), fonte: true },
  { agente: 'opencode', dir: () => path.join(os.homedir(), '.config', 'opencode', 'skills') },
  /* `config/skills`, e não `skills`: os dois caminhos aparecem no binário do
     agy e só este funciona. No outro ele nunca reclama, só sai procurando a
     resposta no código do projeto. */
  { agente: 'agy', dir: () => path.join(os.homedir(), '.gemini', 'config', 'skills') },
]

const fonteDir = () => DESTINOS.find((d) => d.fonte).dir()

/** O `SKILL.md` mínimo, no formato que os três leem. */
export function corpoDaSkill({ nome, descricao, corpo = '' }) {
  /* A descrição não é enfeite: é por ela que os três decidem SE usam a skill.
     Sem ela a skill existe e nunca é chamada. */
  if (!nome) throw new Error('skill sem nome')
  if (!descricao) throw new Error('skill sem descrição: é por ela que o agente decide se usa')
  return `---\nname: ${nome}\ndescription: ${JSON.stringify(descricao)}\n---\n\n${corpo || `# ${nome}\n\nEscreva aqui o que o agente deve fazer.\n`}`
}

const valido = (nome) => /^[a-z0-9][a-z0-9-]{0,48}$/.test(String(nome || ''))

/**
 * Escreve a skill nos três lugares.
 *
 * Devolve o que deu certo e o que não deu, um por agente. **Nunca falha em
 * silêncio**: um dos três pode estar sem a pasta ou sem permissão, e "criei em
 * dois de três" é uma informação que ele precisa ver.
 */
export function criar({ nome, descricao, corpo = '', sobrescrever = false }) {
  if (!valido(nome)) throw new Error(`nome inválido: use minúsculas, números e hífen (recebi "${nome}")`)
  const texto = corpoDaSkill({ nome, descricao, corpo })

  return DESTINOS.map((d) => {
    const alvo = path.join(d.dir(), nome, 'SKILL.md')
    try {
      if (fs.existsSync(alvo) && !sobrescrever) {
        return { agente: d.agente, ok: false, onde: alvo, erro: 'já existe (use sobrescrever para trocar)' }
      }
      fs.mkdirSync(path.dirname(alvo), { recursive: true })
      fs.writeFileSync(alvo, texto)
      return { agente: d.agente, ok: true, onde: alvo }
    } catch (e) {
      return { agente: d.agente, ok: false, onde: alvo, erro: String(e.message || e) }
    }
  })
}

/** As skills que existem na fonte, com onde cada uma já está e onde falta. */
export function listar() {
  let nomes = []
  try {
    nomes = fs.readdirSync(fonteDir(), { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(fonteDir(), e.name, 'SKILL.md')))
      .map((e) => e.name)
  } catch {
    /* Pasta ausente é diferente de nenhuma skill, e quem chama precisa saber
       qual dos dois. */
    return { erro: `não consegui ler ${fonteDir()}`, skills: [] }
  }
  return {
    skills: nomes.sort().map((nome) => ({
      nome,
      em: DESTINOS.filter((d) => fs.existsSync(path.join(d.dir(), nome, 'SKILL.md'))).map((d) => d.agente),
      falta: DESTINOS.filter((d) => !fs.existsSync(path.join(d.dir(), nome, 'SKILL.md'))).map((d) => d.agente),
    })),
  }
}

/**
 * Copia para os outros dois tudo o que existe na fonte e ainda não chegou lá.
 *
 * Compara o CONTEÚDO, não a data: copiar pasta renova a data do arquivo, e
 * comparar por data faria a sincronia reescrever tudo a cada vez ou pular o que
 * mudou. É a mesma armadilha que o comparador de rotinas deste projeto já
 * levou.
 */
export function sincronizar({ nomes = null } = {}) {
  const lista = listar()
  if (lista.erro) return { erro: lista.erro, feitos: [] }

  const feitos = []
  for (const s of lista.skills) {
    if (nomes && !nomes.includes(s.nome)) continue
    let texto
    try { texto = fs.readFileSync(path.join(fonteDir(), s.nome, 'SKILL.md'), 'utf8') } catch { continue }

    for (const d of DESTINOS) {
      if (d.fonte) continue
      const alvo = path.join(d.dir(), s.nome, 'SKILL.md')
      try {
        let atual = null
        try { atual = fs.readFileSync(alvo, 'utf8') } catch { /* ainda não existe */ }
        if (atual === texto) continue
        fs.mkdirSync(path.dirname(alvo), { recursive: true })
        fs.writeFileSync(alvo, texto)
        feitos.push({ skill: s.nome, agente: d.agente, acao: atual == null ? 'criada' : 'atualizada' })
      } catch (e) {
        feitos.push({ skill: s.nome, agente: d.agente, acao: 'falhou', erro: String(e.message || e) })
      }
    }
  }
  return { feitos }
}

/** Apaga a skill dos três lugares, dizendo de onde saiu de cada um. */
export function remover(nome) {
  if (!valido(nome)) throw new Error(`nome inválido: "${nome}"`)
  return DESTINOS.map((d) => {
    const alvo = path.join(d.dir(), nome)
    try {
      if (!fs.existsSync(alvo)) return { agente: d.agente, ok: false, erro: 'não estava lá' }
      fs.rmSync(alvo, { recursive: true, force: true })
      return { agente: d.agente, ok: true, onde: alvo }
    } catch (e) {
      return { agente: d.agente, ok: false, erro: String(e.message || e) }
    }
  })
}
