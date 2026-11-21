/**
 * CC-1104: ajudantes para qualquer agente em qualquer projeto (pedido dele: "não é só pra blender e vps, é pra qualquer
 * agente em qualquer projeto").
 *
 * Um ajudante é um `agents/<nome>.md` do repositório do cockpit, instalado em `~/.claude/agents/` pelo painel ao subir
 * (VPS e PC) ou por `cc ajudantes instalar`. O modelo, o esforço e as ferramentas vêm do tipo no catálogo
 * (`dados/tipos-de-tarefa.json`): o arquivo nunca escolhe sozinho. O nome começa pelo ajudante do tipo (`executor`,
 * `executor-blender`, `conferidor-...`), que é como `qual()` acha as especializações.
 */
import fs from 'node:fs'
import path from 'node:path'
import { catalogo, tipoDe, indicadoDoTipo } from './tipoTarefa.mjs'
import { agentesDoRepositorio } from './skills.mjs'
import { casaClaude } from './platform.mjs'

const CORPO = {
  Executar: (faz) => `Você executa uma tarefa ${faz ? `de ${faz} ` : ''}que a sessão principal já decidiu. Você não decide o desenho, não escolhe referência e não muda o escopo.

Como trabalhar:
1. Leia só o que a tarefa cita. Não explore o projeto.
2. Faça a mudança e rode, com critério de parada: a meta da tarefa, ou no máximo 5 tentativas.
3. Meça o que a tarefa pede e, se ela pedir imagem, salve um print em arquivo.

O que devolver, e só isto:
- o número ou números medidos, cada um com a unidade;
- o caminho do print, se houver;
- uma linha dizendo se a meta foi atingida e, se não, qual foi a última medida.

Se a referência é ambígua, ou a segunda tentativa falhou, pare e diga em uma frase o que está ambíguo. Quem decide é a sessão principal.
`,
  Conferir: (faz) => `Você confere uma tarefa ${faz ? `de ${faz} ` : ''}que outra sessão acabou de fazer. Você não conserta, não opina sobre o desenho e não refaz.

Como trabalhar:
1. Rode exatamente a conferência que a tarefa declara (teste, contagem, print). Nada além disso.
2. Se a tarefa manda atualizar o ROADMAP ou o painel, faça pelos comandos do projeto, nunca editando arquivo gerado.
3. Copie a saída que prova o resultado; não a resuma de memória.

O que devolver, e só isto:
- \`passou\` ou \`falhou\`;
- o número (por exemplo "13 de 13 verificações") e o caminho do print, se houver;
- se falhou, a linha de erro mais curta que decide a falha.

Se não deu para rodar a conferência (arquivo ausente, comando que não existe), diga isso com todas as letras: não responda \`passou\` sem ter rodado.
`,
}

const DESCRICAO = {
  Executar: (faz) => `Executa uma tarefa já decidida${faz ? ` de ${faz}` : ''} (rodar, ajustar até a meta, gerar, exportar, medir) e devolve só o número medido e o caminho do print. Use quando a sessão principal já decidiu o que fazer e só falta rodar. Não decide desenho nem escolhe referência.`,
  Conferir: (faz) => `Confere uma tarefa já feita${faz ? ` de ${faz}` : ''} (roda o teste, conta, monta o print) e devolve só passou ou falhou, com o número e o caminho do print. Use no fim de uma micro tarefa, no lugar de a sessão principal reler tudo. Não conserta nada.`,
}

/** O texto do `agents/<nome>.md` de um ajudante do tipo, com modelo, esforço e ferramentas do catálogo. */
export function corpoDoAjudante({ nome, tipo, faz = '' }, cat = catalogo()) {
  const t = cat.tipos[tipo]
  if (!t) throw new Error(`tipo desconhecido: "${tipo}" (os do catálogo: ${Object.keys(cat.tipos).join(', ')})`)
  if (!t.ajudante) throw new Error(`o tipo ${tipo} não tem ajudante: ele fica na ${t.onde}`)
  if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(String(nome || ''))) throw new Error(`nome inválido: use minúsculas, números e hífen (recebi "${nome}")`)
  if (nome !== t.ajudante && !nome.startsWith(t.ajudante + '-')) throw new Error(`o nome de um ajudante ${tipo} começa por "${t.ajudante}" (exemplo: ${t.ajudante}-${nome})`)
  return `---\nname: ${nome}\ndescription: ${DESCRICAO[tipo](faz)}\nmodel: ${t.modelo}\neffort: ${t.esforco}\ntools: ${t.ferramentas}\n---\n\n${CORPO[tipo](faz)}`
}

/** Grava o ajudante no repositório. Não sobrescreve sem `sobrescrever`. */
export function criarAjudante({ nome, tipo, faz = '', sobrescrever = false, origem = agentesDoRepositorio() }) {
  const texto = corpoDoAjudante({ nome, tipo, faz })
  const alvo = path.join(origem, nome + '.md')
  if (fs.existsSync(alvo) && !sobrescrever) throw new Error(`${alvo} já existe (use --sobrescrever para trocar)`)
  fs.mkdirSync(origem, { recursive: true })
  fs.writeFileSync(alvo, texto)
  return alvo
}

/** Os ajudantes que existem: no repositório e instalados na casa do Claude Code. */
export function listarAjudantes({ origem = agentesDoRepositorio(), destino = path.join(casaClaude(), 'agents') } = {}) {
  const ler = (d) => { try { return fs.readdirSync(d).filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3)) } catch { return [] } }
  const noRepo = ler(origem); const instalados = new Set(ler(destino))
  return [...new Set([...noRepo, ...instalados])].sort().map((nome) => ({ nome, noRepo: noRepo.includes(nome), instalado: instalados.has(nome) }))
}

/** Para um texto de tarefa: o tipo, o que ele manda e os ajudantes que servem (o genérico e as especializações). */
export function qual(texto, { lista = listarAjudantes(), cat = catalogo() } = {}) {
  const t = tipoDe(texto, cat)
  const ind = indicadoDoTipo(t.tipo, cat)
  const servem = ind.ajudante ? lista.filter((a) => a.nome === ind.ajudante || a.nome.startsWith(ind.ajudante + '-')) : []
  return { ...t, ...ind, servem }
}
