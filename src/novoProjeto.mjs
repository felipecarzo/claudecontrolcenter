/**
 * CC-143: criar projeto novo pelo painel, com a pasta já no padrão.
 *
 * Pedido dele em 18/08:
 *
 * > *"seria bom colocarmos no Control center também pra gente criar projetos
 * > novos. precisaríamos definir a hierarquia de pasta etc pra isso ser feito
 * > sempre com um padrão e um botão, e em novos projetos ativaria os esse modo
 * > automático"*
 *
 * ## A hierarquia não se inventa aqui
 *
 * Ela já está escrita nas regras dele, e o que este arquivo faz é obedecer:
 * `apps/` para o que vai para o ar, `tools/` para ferramenta interna, `assets/`
 * para mídia crua, e `docs/` com produto, guias, diário, ROADMAP e HANDOFF.
 *
 * Junto vem a regra que limita a anterior, e é ela que decide o que nasce:
 * **"não criar pasta vazia por simetria"**. Por isso o esqueleto criado é o de
 * documentação, que todo projeto tem desde o primeiro minuto, e as pastas de
 * código nascem quando houver código. Uma árvore de sete pastas vazias parece
 * organização e é ruído: ninguém sabe quais estão em uso.
 *
 * ## O repositório na raiz, que é o problema número 1
 *
 * As regras dele abrem com isso: pasta sem `.git` próprio cai no repositório de
 * cima, e existe um caso real de 34.213 arquivos engolidos assim. Então o
 * `git init` não é enfeite, é a razão de o botão existir em vez de um `mkdir`.
 *
 * ## O modo automático
 *
 * O projeto nasce com o framework ligado, na fase de Definição, e a entrevista
 * (CC-133) começa na primeira pergunta. Criar e ser entrevistado é um gesto só,
 * que é exatamente o buraco que sobrava: a entrevista existe para o projeto que
 * ainda não existe, e só aparecia em projeto já ligado.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ligar as ligarFramework } from './frameworkDisco.mjs'
import { installInto } from './install.mjs'

/** As pastas de código, que NÃO nascem: ficam aqui para a tela poder explicar
 *  por que a pasta veio "vazia", e para quem ler saber que a omissão é
 *  deliberada e não esquecimento. */
export const PASTAS_ADIADAS = [
  { nome: 'apps/', quando: 'quando houver algo que vai para o ar' },
  { nome: 'tools/', quando: 'quando houver ferramenta interna' },
  { nome: 'assets/', quando: 'quando houver mídia crua' },
]

/**
 * Nome de pasta aceitável.
 *
 * Recusar é mais barato que consertar: o nome vira caminho de disco, aparece em
 * comando de terminal e é a chave pela qual o painel casa projeto com agente.
 * Espaço e acento funcionam no Linux e depois quebram no primeiro script que
 * não citou a variável.
 */
export function validarNome(nome) {
  const n = String(nome || '').trim()
  if (!n) return 'escreva o nome da pasta do projeto'
  if (n.length > 60) return 'nome longo demais: use até 60 caracteres'
  if (!/^[a-z0-9]/i.test(n)) return 'o nome tem que começar com letra ou número'
  if (!/^[\w.-]+$/.test(n)) return 'use só letras, números, ponto, hífen e traço baixo, sem espaço nem acento'
  if (/^\.+$/.test(n)) return 'esse nome não é uma pasta'
  return null
}

const ROADMAP = (nome) => `---
tags: [roadmap]
tipo: execucao
---

# ROADMAP — ${nome}

O que está aberto AGORA. Item concluído sai daqui e vira linha no diário: este
arquivo é execução, não histórico.

## ▶ Frente: definir o projeto

### Responder a entrevista

O painel abre a entrevista na primeira pergunta. Cada resposta escolhe a
próxima, e no fim o nome do projeto, os critérios de pronto e as verificações
ficam gravados nos campos do framework.
`

const HANDOFF = (nome, quando) => `# HANDOFF

**Sessão:** ${quando} · projeto criado pelo painel
**Branch:** \`master\`

## O que muda para quem chega agora

O projeto acabou de nascer e ainda não foi definido. A entrevista está aberta
na primeira pergunta, no painel, e é por ela que se começa.

## Próximo passo exato

Responder a entrevista de ${nome} no painel, até o portão da Definição abrir.

## Arquivos a ler

- [ROADMAP.md](ROADMAP.md) — o que está aberto
`

const GITIGNORE = `node_modules/
dist/
build/
.env
.env.*
!.env.example
*.log
.DS_Store
`

const README_DOCS = (nome) => `# Documentação de ${nome}

- \`produto/\` — o que isso é e por quê, sem data
- \`guias/\` — como funciona por dentro
- \`diario/\` — o que aconteceu, um arquivo por dia, nunca reescrito
- \`ROADMAP.md\` — o que fazer agora, só o que está aberto
- \`HANDOFF.md\` — o estado da última sessão, sobrescrito a cada encerramento

Um fato mora em um lugar só. Para repetir, aponte com \`[[link]]\` em vez de
copiar o texto.
`

/** Roda git sem derrubar a criação se ele não existir na máquina. O projeto sem
 *  repositório ainda é útil; a criação abortada não é. */
function git(raiz, ...args) {
  try {
    execFileSync('git', args, { cwd: raiz, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Cria o projeto e devolve o que foi feito, item por item.
 *
 * A lista de `passos` não é enfeite de log: é o que a tela mostra depois de
 * criar. "Criei o projeto" sem dizer o que nasceu é a mesma promessa vaga que
 * já custou caro aqui, e um passo que falhou (o `git` que não existe na
 * máquina) precisa aparecer como falha, não sumir.
 */
export function criar(base, { nome, grupo = '', descricao = '', quando = null } = {}) {
  const erro = validarNome(nome)
  if (erro) return { ok: false, erro }
  if (grupo && validarNome(grupo)) return { ok: false, erro: `grupo inválido: ${validarNome(grupo)}` }
  if (!base) return { ok: false, erro: 'não sei onde ficam os projetos desta máquina' }

  const paiDoGrupo = grupo ? path.join(base, grupo) : base
  const raiz = path.join(paiDoGrupo, nome)
  if (fs.existsSync(raiz)) return { ok: false, erro: `já existe uma pasta chamada ${nome} aí` }

  const passos = []
  const marcar = (o_que, ok = true, detalhe = null) => passos.push({ o_que, ok, detalhe })

  fs.mkdirSync(path.join(raiz, 'docs', 'produto'), { recursive: true })
  fs.mkdirSync(path.join(raiz, 'docs', 'guias'), { recursive: true })
  fs.mkdirSync(path.join(raiz, 'docs', 'diario'), { recursive: true })
  marcar('a pasta do projeto, com docs em produto, guias e diário')

  const carimbo = quando || new Date().toISOString().slice(0, 10)
  fs.writeFileSync(path.join(raiz, 'docs', 'ROADMAP.md'), ROADMAP(nome))
  fs.writeFileSync(path.join(raiz, 'docs', 'HANDOFF.md'), HANDOFF(nome, carimbo))
  fs.writeFileSync(path.join(raiz, 'docs', 'README.md'), README_DOCS(nome))
  fs.writeFileSync(path.join(raiz, '.gitignore'), GITIGNORE)
  marcar('o roadmap, o handoff e o mapa da documentação')

  /* O CLAUDE.md nasce com o bloco do protocolo do painel, não vazio: projeto
     novo sem ele é agente que trabalha sem reportar, e o painel só descobre
     depois, quando alguém estranha a ausência. */
  const cm = path.join(raiz, 'CLAUDE.md')
  fs.writeFileSync(cm, `# ${nome}\n\n${descricao ? `${descricao}\n\n` : ''}`)
  const inst = installInto(raiz, { create: true })
  marcar('o CLAUDE.md com o protocolo do painel', inst.action !== 'missing', inst.action)

  const temGit = git(raiz, 'init', '-b', 'master') || git(raiz, 'init')
  marcar('um repositório na raiz do projeto, que é a regra número 1', temGit,
    temGit ? null : 'o git não respondeu nesta máquina')
  if (temGit) {
    git(raiz, 'add', '-A')
    const commitou = git(raiz, 'commit', '-m', `chore: nasce o projeto ${nome}`)
    marcar('o primeiro commit', commitou, commitou ? null : 'o git não tem nome e e-mail configurados aqui')
  }

  /* O modo automático que ele pediu: ligado, em Definição, e com a entrevista
     esperando na primeira pergunta. `ligar` já grava o estado no disco. */
  const fw = ligarFramework(raiz)
  marcar('o framework ligado, na fase de Definição, com a entrevista aberta', fw.ok)

  return { ok: true, raiz, projeto: nome, passos, adiadas: PASTAS_ADIADAS }
}

/**
 * Os grupos que já existem na base (`CLIENTS`, `PESSOAL`, `ESTUDO`).
 *
 * Descoberto, nunca fixado no código: no PC dele os projetos moram dentro de
 * grupos, e na VPS moram direto na base. Uma lista fixa acertaria uma máquina e
 * inventaria pasta na outra. Grupo é pasta que só contém projeto, e nunca é ela
 * mesma um projeto.
 */
export function gruposDe(base) {
  if (!base) return []
  const ehProjeto = (dir) => fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'CLAUDE.md'))
  const saida = []
  let entradas = []
  try { entradas = fs.readdirSync(base, { withFileTypes: true }) } catch { return [] }
  for (const e of entradas) {
    if (!e.isDirectory() || /^[._-]/.test(e.name)) continue
    const dir = path.join(base, e.name)
    if (ehProjeto(dir)) continue
    let filhos = []
    try { filhos = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    const projetos = filhos.filter((f) => f.isDirectory() && ehProjeto(path.join(dir, f.name)))
    if (projetos.length) saida.push({ nome: e.name, projetos: projetos.length })
  }
  return saida.sort((a, b) => a.nome.localeCompare(b.nome))
}
