/**
 * CC-1037, pedido dele em 09/10: "uma skill que eu chamo em um projeto (...) em ahtleta corrida vamos fazer uma
 * verificação de todos os textos, ela faz estilo tinder p eu aprovar ou não e editar cada texto". E a regra: "sempre que
 * criamos algo pros projetos ele precisa ser uma ferramenta no painel".
 *
 * Três passos, todos por script:
 *   levantar   acha cada texto que o usuário lê no código do app (com a posição exata no arquivo)
 *   gravar     escreve os baralhos `textos-<área>` em docs/cartas/ (o Tinder do painel já lê) e a tabela de posições
 *   aplicar    lê os votos: onde ele escolheu "Editar" e escreveu o texto novo na nota, troca SÓ aquele trecho do arquivo
 *
 * Usa o analisador de TypeScript do PRÓPRIO projeto (node_modules/typescript), então não traz dependência para o painel.
 * Não faz commit. Nunca troca um trecho que mudou desde o levantamento: confere o original antes.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { validarDeck, votos } from './cartas.mjs'

export const OP_APROVO = 'Aprovo'
export const OP_EDITAR = 'Editar (ajuste o texto)'
export const OP_RECUSO = 'Recuso'
export const MAX_POR_BARALHO = 150
const ATTR = new Set(['title', 'label', 'placeholder', 'subtitle', 'description', 'headerTitle', 'accessibilityLabel', 'accessibilityHint', 'message', 'caption', 'heading', 'text', 'hint', 'helperText', 'errorMessage', 'tabBarLabel'])
const PROP = new Set(['titulo', 'title', 'texto', 'text', 'descricao', 'description', 'mensagem', 'message', 'label', 'rotulo', 'subtitulo', 'porque', 'explicacao', 'dica', 'resumo', 'legenda', 'frase', 'nome'])
const PULAR = /(^|\/)(node_modules|dist|dist-running|build|\.expo|__tests__|__mocks__|coverage)(\/|$)|\.(test|spec|stories)\.[jt]sx?$|\.d\.ts$/

/** Parece frase para uma pessoa ler, e não identificador, cor, caminho, endereço ou constante. */
export function pareceTexto(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length < 2 || !/\p{L}{2,}/u.test(t)) return false
  if (/^(https?:|[#/.@~]|\w+:\/\/|\d)/.test(t) || /\.(png|jpe?g|svg|json|mp3|wav|ttf|js|tsx?)$/i.test(t)) return false
  if (/^[A-Z0-9_]+$/.test(t)) return false // constante
  if (/^[a-z0-9_.:\-/]+$/.test(t)) return false // identificador, rota, chave, nome de ícone
  return /\s/.test(t) || /^\p{Lu}/u.test(t) || /[^\x00-\x7f]/.test(t)
}

function carregarTS(raiz) {
  for (const base of [raiz, process.cwd()]) { try { return createRequire(path.join(base, 'package.json'))('typescript') } catch { /* próximo */ } }
  if (process.env.CC_TYPESCRIPT) { try { return createRequire(path.join(process.env.CC_TYPESCRIPT, 'x.js'))(process.env.CC_TYPESCRIPT) } catch { /* sem */ } }
  throw new Error('não achei o TypeScript em ' + raiz + '/node_modules (rode o install do projeto primeiro)')
}

function arquivosDe(dir, acc = []) {
  let ls = []; try { ls = fs.readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of ls) {
    const p = path.join(dir, e.name)
    if (PULAR.test(p.split(path.sep).join('/'))) continue
    if (e.isDirectory()) arquivosDe(p, acc); else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) acc.push(p)
  }
  return acc
}

/** A área do arquivo, que vira o nome do baralho (cada baralho tem no máximo 200 cartas). */
export function areaDe(rel) {
  const p = rel.split(path.sep).join('/')
  if (/^src\/app\//.test(p)) return 'app'
  if (/^src\/components\//.test(p)) return 'componentes'
  if (/^src\/(data|constants)\//.test(p)) return 'dados'
  return 'motor'
}
export function telaDe(rel) {
  const p = rel.split(path.sep).join('/').replace(/\.[jt]sx?$/, '')
  if (/^src\/app\//.test(p)) return 'tela ' + p.replace(/^src\/app\//, '').replace(/\/index$/, '/')
  return p.replace(/^src\//, '')
}

/**
 * Cada texto do app, com a posição exata. `ini` e `fim` são os deslocamentos do TRECHO a trocar (sem aspas) no arquivo.
 * Texto montado em tempo de execução (`${x}`) não entra: vai na contagem `dinamicos`.
 */
export function levantar(raiz, { dirs = ['src'] } = {}) {
  const ts = carregarTS(raiz); const itens = []; let dinamicos = 0
  for (const d of dirs) for (const arq of arquivosDe(path.join(raiz, d))) {
    const rel = path.relative(raiz, arq); const src = fs.readFileSync(arq, 'utf8')
    const kind = /\.tsx$/.test(arq) ? ts.ScriptKind.TSX : /\.ts$/.test(arq) ? ts.ScriptKind.TS : /\.jsx$/.test(arq) ? ts.ScriptKind.JSX : ts.ScriptKind.JS
    const sf = ts.createSourceFile(arq, src, ts.ScriptTarget.Latest, true, kind)
    const vistos = new Map()
    const add = (tipo, texto, ini, fim, quote, direto = false) => {
      if (!pareceTexto(texto)) return
      const k = rel + '|' + texto; const n = (vistos.get(k) || 0) + 1; vistos.set(k, n)
      itens.push({ id: 'T' + crypto.createHash('sha1').update(k + '|' + n).digest('hex').slice(0, 10), tipo, texto: texto.replace(/\s+/g, ' ').trim(), arquivo: rel.split(path.sep).join('/'), linha: sf.getLineAndCharacterOfPosition(ini).line + 1, ini, fim, quote, direto, original: src.slice(ini, fim) })
    }
    const lit = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
    const doLiteral = (tipo, n, direto = false) => { add(tipo, n.text, n.getStart() + 1, n.getEnd() - 1, src[n.getStart()], direto) }
    const visita = (n) => {
      if (ts.isJsxText(n)) {
        const cru = src.slice(n.pos, n.end); const ini = n.pos + (cru.length - cru.trimStart().length); const fim = n.pos + cru.trimEnd().length
        if (fim > ini) add('jsx', src.slice(ini, fim), ini, fim, '')
      } else if (ts.isJsxExpression(n) && n.expression && lit(n.expression) && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) doLiteral('jsx-texto', n.expression)
      else if (ts.isJsxAttribute(n) && ATTR.has(n.name.getText()) && n.initializer) {
        if (lit(n.initializer)) doLiteral('atributo ' + n.name.getText(), n.initializer, true) // texto direto no atributo: o JSX não aceita barra invertida ali
        else if (ts.isJsxExpression(n.initializer) && n.initializer.expression && lit(n.initializer.expression)) doLiteral('atributo ' + n.name.getText(), n.initializer.expression)
        else if (ts.isJsxExpression(n.initializer) && n.initializer.expression && ts.isTemplateExpression(n.initializer.expression)) dinamicos++
      } else if (ts.isCallExpression(n) && n.expression.getText() === 'Alert.alert') {
        n.arguments.slice(0, 2).forEach((a, i) => { if (lit(a)) doLiteral(i === 0 ? 'alerta (título)' : 'alerta (mensagem)', a) })
      } else if (ts.isPropertyAssignment(n) && PROP.has(n.name.getText().replace(/^['"]|['"]$/g, '')) && lit(n.initializer)) doLiteral('dado ' + n.name.getText().replace(/^['"]|['"]$/g, ''), n.initializer)
      ts.forEachChild(n, visita)
    }
    visita(sf)
  }
  return { itens, dinamicos }
}

const semTravessao = (s) => String(s).replace(/\s*[—–]\s*/g, ' - ')

/** Os baralhos (um por área, até MAX_POR_BARALHO cartas) e a tabela de posições. */
export function montarBaralhos(itens, { projeto = 'app', agora = new Date() } = {}) {
  const criado = agora.toISOString(); const porArea = {}
  for (const it of itens) (porArea[areaDe(it.arquivo)] ||= []).push(it)
  const baralhos = {}; const fontes = {}
  for (const [area, lista] of Object.entries(porArea)) {
    lista.sort((a, b) => a.arquivo.localeCompare(b.arquivo) || a.ini - b.ini)
    for (let i = 0; i < lista.length; i += MAX_POR_BARALHO) {
      const parte = lista.slice(i, i + MAX_POR_BARALHO); const nome = `textos-${area}` + (i ? `-${Math.floor(i / MAX_POR_BARALHO) + 1}` : '')
      baralhos[nome] = {
        titulo: `Textos de ${projeto}: ${area}` + (i ? ` (parte ${Math.floor(i / MAX_POR_BARALHO) + 1})` : ''), criado,
        cartas: parte.map((it) => {
          const tem = /[—–]/.test(it.texto)
          fontes[it.id] = { baralho: nome, arquivo: it.arquivo, ini: it.ini, fim: it.fim, quote: it.quote, tipo: it.tipo, direto: it.direto, original: it.original }
          return {
            id: it.id, titulo: semTravessao(`${telaDe(it.arquivo)}: ${it.texto}`).slice(0, 110),
            pergunta: 'Este texto está aprovado?',
            olhe: semTravessao(`"${it.texto}"\n\n${it.tipo}, em ${it.arquivo}, linha ${it.linha}.`) + (tem ? '\nO texto tem travessão no código, e você não quer travessão: vale editar.' : ''),
            passos: ['Aprovo: o texto fica como está', 'Editar: o campo abre com o texto atual, você ajusta e envia', 'Recuso: marca para refazer, sem mexer no arquivo'],
            opcoes: [OP_APROVO, OP_EDITAR, OP_RECUSO],
            // o texto atual, para a tela abrir o campo de editar já preenchido (CC-1035); texto comprido demais não leva
            ...(semTravessao(it.texto).length <= 600 ? { editar: semTravessao(it.texto) } : {}),
          }
        }),
      }
      const e = validarDeck(baralhos[nome]); if (e.length) throw new Error(`baralho ${nome} recusado: ${e[0]}`)
    }
  }
  return { baralhos, fontes }
}

export function gravar(raiz, { baralhos, fontes }) {
  const pasta = path.join(raiz, 'docs', 'cartas'); fs.mkdirSync(pasta, { recursive: true })
  // baralho de texto antigo que não existe mais no levantamento sai (os votos dele ficam, são só leitura)
  for (const f of fs.readdirSync(pasta)) if (/^textos-[a-z0-9-]+\.json$/.test(f) && !baralhos[f.slice(0, -5)]) fs.rmSync(path.join(pasta, f))
  for (const [nome, d] of Object.entries(baralhos)) fs.writeFileSync(path.join(pasta, nome + '.json'), JSON.stringify(d, null, 2) + '\n')
  fs.writeFileSync(path.join(pasta, 'textos.fontes.json'), JSON.stringify(fontes, null, 1) + '\n')
  return Object.entries(baralhos).map(([nome, d]) => ({ nome, cartas: d.cartas.length }))
}

/** Como o texto novo entra no código sem quebrar a linguagem. Devolve `{ ok, trecho }` ou `{ erro }`. */
export function escaparPara(f, novo) {
  const t = String(novo).replace(/\s*\n\s*/g, ' ').trim()
  if (!t) return { erro: 'o texto novo está vazio' }
  if (t.length > 600) return { erro: 'o texto novo passa de 600 caracteres' }
  if (f.tipo === 'jsx') return /[{}<>]/.test(t) ? { erro: 'texto de tela não pode ter { } < >' } : { ok: true, trecho: t }
  // atributo escrito direto (placeholder="..."): em JSX a barra invertida não escapa; a aspa vira entidade
  if (f.direto) return { ok: true, trecho: t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;') }
  if (f.quote === '`') return { ok: true, trecho: t.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') }
  return { ok: true, trecho: t.replace(/\\/g, '\\\\').replace(new RegExp(f.quote, 'g'), '\\' + f.quote) }
}

/**
 * Aplica as edições votadas. Para cada voto "Editar" com texto novo na nota: acha o trecho pela tabela de posições,
 * confere que o arquivo ainda tem o original ali, troca, e confere que o arquivo continua sintaticamente válido (senão
 * desfaz). Devolve o relatório. Não faz commit.
 */
export function aplicar(raiz, { ensaio = false } = {}) {
  const ts = carregarTS(raiz); const pasta = path.join(raiz, 'docs', 'cartas')
  let fontes = {}; try { fontes = JSON.parse(fs.readFileSync(path.join(pasta, 'textos.fontes.json'), 'utf8')) } catch { throw new Error('não achei docs/cartas/textos.fontes.json: rode o levantamento antes') }
  const edicoes = []; const puladas = []
  for (const nome of new Set(Object.values(fontes).map((f) => f.baralho))) {
    for (const v of votos(raiz, nome)) {
      if (!(v.escolhas || []).some((x) => /^Editar/i.test(x))) continue // qualquer rótulo que comece com Editar (o texto do rótulo já mudou uma vez)
      const f = fontes[v.carta]; if (!f) { puladas.push({ id: v.carta, motivo: 'a carta não está na tabela de posições' }); continue }
      const e = escaparPara(f, v.nota); if (e.erro) { puladas.push({ id: v.carta, arquivo: f.arquivo, motivo: e.erro }); continue }
      edicoes.push({ id: v.carta, ...f, trecho: e.trecho, novo: String(v.nota).trim() })
    }
  }
  const porArquivo = {}; for (const e of edicoes) (porArquivo[e.arquivo] ||= []).push(e)
  const aplicadas = []
  for (const [arq, lista] of Object.entries(porArquivo)) {
    const caminho = path.join(raiz, arq); const antes = fs.readFileSync(caminho, 'utf8'); let src = antes; const feitas = []
    for (const e of lista.sort((a, b) => b.ini - a.ini)) {
      const agora = src.slice(e.ini, e.fim)
      if (agora === e.trecho) { puladas.push({ id: e.id, arquivo: arq, motivo: 'já estava aplicada' }); continue }
      if (agora !== e.original) { puladas.push({ id: e.id, arquivo: arq, motivo: 'o arquivo mudou desde o levantamento: levante de novo' }); continue }
      src = src.slice(0, e.ini) + e.trecho + src.slice(e.fim); feitas.push(e)
    }
    if (!feitas.length) continue
    const kind = /\.tsx$/.test(arq) ? ts.ScriptKind.TSX : /\.ts$/.test(arq) ? ts.ScriptKind.TS : /\.jsx$/.test(arq) ? ts.ScriptKind.JSX : ts.ScriptKind.JS
    const bom = ts.createSourceFile(arq, src, ts.ScriptTarget.Latest, true, kind)
    if (bom.parseDiagnostics && bom.parseDiagnostics.length) { for (const e of feitas) puladas.push({ id: e.id, arquivo: arq, motivo: 'a troca deixaria o arquivo com erro de sintaxe: desfeita' }); continue }
    if (!ensaio) {
      fs.writeFileSync(caminho, src)
      /* o texto novo tem outro tamanho: as posições de TODOS os textos deste arquivo andam. A tabela se atualiza, para
         rodar de novo reconhecer "já aplicada" e para uma edição seguinte cair no lugar certo. */
      const asc = [...feitas].sort((a, b) => a.ini - b.ini)
      for (const [id, fo] of Object.entries(fontes)) {
        if (fo.arquivo !== arq) continue
        const antes = asc.filter((e) => e.ini < fo.ini).reduce((t, e) => t + (e.trecho.length - (e.fim - e.ini)), 0)
        const edit = asc.find((e) => e.id === id)
        fontes[id] = { ...fo, ini: fo.ini + antes, fim: fo.ini + antes + (edit ? edit.trecho.length : fo.fim - fo.ini), original: edit ? edit.trecho : fo.original }
      }
      fs.writeFileSync(path.join(pasta, 'textos.fontes.json'), JSON.stringify(fontes, null, 1) + '\n')
    }
    for (const e of feitas) aplicadas.push({ id: e.id, arquivo: arq, de: e.original, para: e.trecho })
  }
  return { aplicadas, puladas, ensaio }
}
