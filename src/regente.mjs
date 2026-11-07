/**
 * CC-1068: o modo Regente do arquiteto. Peça M1: estado, caderno de regras e a decisão no lugar dele.
 *
 * Pedido dele em 20/10: "um agente que olhe as tarefas, decida coisas, e a gente vai treinando ele para aprender a tomar
 * decisões estruturais, de segurança, de design". Plano em docs/CC-1068.md.
 *
 * Este módulo é puro: não sabe de backlog nem de painel. O arquiteto (M2) é quem chama. O modelo entra só por
 * `chamar(texto) -> Promise<string>`, e a resposta passa por `validarDecisao` antes de valer, como a proposta passa por
 * `validarProposta`. O modelo sugere, o contrato decide.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { casaClaude } from './platform.mjs'
import { resolverBinario } from './paineis.mjs'
import { limparSegredos, acharSegredos } from './segredo.mjs'

const ESTADO_PADRAO = { ligado: false, desde: null, teto: 0, risco: false, travas: [] }

export const arquivoEstado = (cwd) => path.join(cwd, '.framework', 'regente.json')

export function ler(cwd) {
  try {
    const v = JSON.parse(fs.readFileSync(arquivoEstado(cwd), 'utf8'))
    return { ...ESTADO_PADRAO, ...(v && typeof v === 'object' ? v : {}) }
  } catch { return { ...ESTADO_PADRAO } }
}

const gravar = (cwd, estado) => {
  const f = arquivoEstado(cwd)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f + '.tmp', JSON.stringify(estado, null, 2) + '\n')
  fs.renameSync(f + '.tmp', f) // escrita atômica: o timer lê esse arquivo a qualquer hora
  return estado
}

export const ligar = (cwd, { risco = false } = {}) => gravar(cwd, { ...ler(cwd), ligado: true, desde: new Date().toISOString(), risco, motivo: undefined, ultimas: [], pendente: undefined })
export const desligar = (cwd, motivo = null) => gravar(cwd, { ...ler(cwd), ligado: false, ...(motivo ? { motivo: String(motivo).slice(0, 200) } : {}) })

/* Trava de laço: as últimas 6 decisões (título da ficha, escolha, quando). Três iguais seguidas = o Regente está girando em falso. */
export const ehLaco = (ultimas, titulo, escolha) => {
  const u = (ultimas || []).slice(-2)
  return u.length === 2 && u.every((x) => x.ficha === titulo && x.escolha === escolha)
}
export const anotarDecisao = (cwd, titulo, escolha) => {
  const e = ler(cwd)
  return gravar(cwd, { ...e, ultimas: [...(e.ultimas || []), { ficha: String(titulo || ''), escolha: String(escolha || ''), quando: new Date().toISOString() }].slice(-6) })
}
/** Ficha (revisão) que ficou aberta porque o modelo estava indisponível: o próximo passo a decide, em vez de esperar o Felipe. */
export const marcarPendente = (cwd, ficha, provado = false) => gravar(cwd, { ...ler(cwd), pendente: { ficha, provado: provado === true } })
export const limparPendente = (cwd) => { const e = ler(cwd); return e.pendente ? gravar(cwd, { ...e, pendente: undefined }) : e }
/** O Regente já mandou "tentar de novo" nesta ficha? (a segunda revisão sem prova não repete) */
export const jaTentou = (ultimas, titulo) => (ultimas || []).some((x) => x.ficha === titulo && /^tenta/i.test(x.escolha))

/* Indisponibilidade do modelo: crédito esgotado, limite, rede. Não é "resposta ruim", e cair no padrão aqui gerou 18 fichas de ruído (20/10). */
export const LIMITE = /limit|usage|rate|credit|quota|overloaded|try again|resets?/i
/** Por que a chamada ao modelo não valeu como resposta, ou null. Chamada falha, saída vazia, ou aviso de limite sem JSON. */
export function motivoIndisponivel({ ok = true, out = '', err = '' } = {}) {
  const t = String(out || '').trim()
  if (!ok) return String(err || t || 'a chamada falhou').split('\n').find(Boolean)?.slice(0, 120) || 'a chamada falhou'
  if (!t) return 'saída vazia'
  if (LIMITE.test(t) && !t.includes('{')) return t.split('\n').find(Boolean).slice(0, 120)
  return null
}
export const erroIndisponivel = (motivo) => Object.assign(new Error(`regente: modelo indisponível: ${String(motivo).replace(/\s+/g, ' ').slice(0, 120)}`), { indisponivel: true })

/** Opção que pede texto dele ("escreva abaixo", "quero ajustar"): o Regente não tem o texto, então nunca a escolhe. */
export const pedeTexto = (o) => /escreva abaixo|^quero ajustar|^outra dire/i.test(String(o || '').trim())

export const arquivoRegras = (cwd) => path.join(cwd, 'docs', 'produto', 'REGENTE.md')
export const arquivoRegrasGeral = () => path.join(casaClaude(), 'regente-regras.md')

const linhasDe = (f) => {
  try { return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => l.startsWith('- ')) } catch { return [] }
}

export function regrasDe(cwd) {
  const g = linhasDe(arquivoRegrasGeral())
  const p = linhasDe(arquivoRegras(cwd))
  return `## Regras gerais\n${g.join('\n')}\n\n## Regras deste projeto\n${p.join('\n')}`.trim()
}

export function aprender(cwd, texto, { geral = false, quando = new Date() } = {}) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim()
  if ((limpo.match(/\p{L}/gu) || []).length < 8) return { ok: false, erro: 'a regra precisa de pelo menos 8 letras' }
  const arquivo = geral ? arquivoRegrasGeral() : arquivoRegras(cwd)
  const dia = `${String(quando.getDate()).padStart(2, '0')}/${String(quando.getMonth() + 1).padStart(2, '0')}`
  const linha = `- ${dia}: ${limpo}`
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  if (!fs.existsSync(arquivo)) {
    fs.writeFileSync(arquivo, `# Regras do Regente${geral ? ' (gerais, valem em todo projeto)' : ''}\n\nCada linha é uma correção dele. O Regente obedece a todas.\n\n`)
  }
  const atual = fs.readFileSync(arquivo, 'utf8')
  fs.appendFileSync(arquivo, (atual.endsWith('\n') ? '' : '\n') + linha + '\n')
  return { ok: true, arquivo, linha }
}

export function ehRegra(texto) {
  const sem = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  const m = sem.match(/^\s*(regra|geral)\s*:\s*([\s\S]*)$/i)
  if (!m) return null
  return { geral: m[1].toLowerCase() === 'geral', texto: String(texto).replace(/^\s*\S+?\s*:\s*/, '').trim() }
}

// "com o Felipe" entrou em 20/10: o ensaio da M2 achou um item assim e o Regente o pegou como se fosse dele
const SENSIVEL = /\b(conta|cadastr(o|ar)|senha|chave de api|api key|aparelho|celular (velho|dele)|iphone|root|sudo|deploy|dom[ií]nio|dns|certificado|pagar|cart[aã]o|com o felipe|pelo felipe|o felipe (precisa|decide|faz))\b/i

/** O item só o Felipe pode fazer (conta, aparelho, root, deploy...), então o Regente não manda o robô tentar. */
export function exigeDele(item) {
  if (!item) return false
  const campos = [item.intencao, item.citacao, item.pronto, item.conferir].map((x) => String(x || ''))
  if (campos.some((c) => SENSIVEL.test(c))) return true
  return /^dele:/i.test(campos[3]) && item.natureza === 'DEC'
}

export function pedidoDeDecisao(proposta, estado, regras) {
  return [
    'Você é o Regente de um projeto de software. O dono do projeto não está aqui: decida POR ELE, como ele decidiria.',
    'Critérios fixos: segurança antes de prazo; não invente necessidade; em revisão, "Está bom" só com prova do robô;',
    'em ideia, escolha a que o MVP pede e não a maior; na dúvida, a opção reversível.',
    'Se o item já aparece nos commits do projeto, não o escolha. Nunca escolha uma opção que peça texto dele ("escreva abaixo").',
    '',
    'Regras do dono (obrigatórias, aprendidas com as correções dele):',
    regras || '(nenhuma ainda)',
    '',
    'Estado do projeto:', JSON.stringify(estado ?? {}, null, 1),
    '',
    'Proposta do arquiteto:', JSON.stringify(proposta, null, 1),
    '',
    'Responda SÓ JSON, sem texto em volta:',
    '{"escolha":"<uma das opcoes, texto exato>","porque":"até 300 letras, citando a regra ou o estado"}',
    'Sem travessão em nenhum texto.',
  ].join('\n')
}

export function validarDecisao(texto, proposta) {
  const cru = String(texto || '').trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1').trim()
  let v
  try { v = JSON.parse(cru) } catch { return { ok: false, decisao: null, erros: ['a resposta não é um JSON só: responda apenas o objeto'] } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, decisao: null, erros: ['esperava um objeto'] }
  const erros = []
  const opcoes = (proposta?.opcoes || []).map((o) => String(o).trim())
  const escolha = typeof v.escolha === 'string' ? v.escolha.trim() : ''
  const porque = typeof v.porque === 'string' ? v.porque.trim() : ''
  if (!opcoes.includes(escolha)) erros.push('escolha tem de ser igual a uma das opções, com o texto exato')
  else if (pedeTexto(escolha)) erros.push('essa opção exige um texto de ajuste que você não tem: escolha outra')
  if (porque.length < 10 || porque.length > 300) erros.push('porque de 10 a 300 letras')
  if (/[—–]/.test(`${escolha}${porque}`)) erros.push('sem travessão')
  if (erros.length) return { ok: false, decisao: null, erros }
  return { ok: true, decisao: { escolha, porque }, erros: [] }
}

export function decisaoPadrao(proposta, { provado = false, jaTentou = false } = {}) {
  const ops = (proposta?.opcoes || []).filter((o) => !pedeTexto(o))
  if (!ops.length) return null
  const t = proposta.tipo
  if (t === 'pedido') return proposta.executa || null
  // revisão: "Está bom" só com prova do robô; sem prova, "tenta de novo" UMA vez por ficha, e depois a pergunta fica com ele
  if (t === 'revisao') return provado ? ops[0] : (jaTentou ? null : (ops.find((o) => /^tenta|^sim, refaz/i.test(o)) ?? null))
  if (t === 'ideia') {
    if (proposta.titulo === 'Preciso da sua direção') return ops.find((o) => /^Fazer:/i.test(o)) || null
    return ops[0]
  }
  if (t === 'melhoria') return ops.find((o) => !/\b(regra|mudar|trocar|alterar|substituir)\b/i.test(o)) || null
  return null
}

// mesmo desenho do `rodarComEntrada` do arquiteto: só lê (modo plan), sem a caixa de ponto, segredo nunca vai para o modelo
const chamarPadrao = (cwd, binario, modelo) => (texto) => new Promise((ok, falha) => {
  const bin = binario || process.env.CC_ARQUITETO_CLAUDE || resolverBinario('claude')
  const args = ['-p', '--model', modelo || process.env.CC_ARQUITETO_MODELO || 'haiku', '--permission-mode', 'plan', '--output-format', 'text']
  const p = execFile(bin, args, { cwd, timeout: 180000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CC_SEM_PONTO: '1' } }, (e, out) => (e ? falha(e) : ok(String(out || ''))))
  p.stdin.on('error', () => {})
  p.stdin.end(limparSegredos(texto))
})

export async function decidir(cwd, proposta, estado, { binario, modelo, chamar } = {}) {
  if (!proposta || !Array.isArray(proposta.opcoes) || !proposta.opcoes.length) return null
  const fala = chamar || chamarPadrao(cwd, binario, modelo)
  const corpo = pedidoDeDecisao(proposta, estado, regrasDe(cwd))
  let pedido = corpo
  for (let i = 0; i < 2; i++) {
    let saida
    // a chamada falhou ou o modelo avisou de limite: indisponível, e quem chama espera o próximo ciclo (nunca cai no padrão)
    try { saida = await fala(pedido) } catch (e) { throw erroIndisponivel(motivoIndisponivel({ ok: false, err: e?.message || e })) }
    const m = motivoIndisponivel({ out: saida })
    if (m) throw erroIndisponivel(m)
    const v = validarDecisao(saida, proposta)
    if (v.ok) return { ...v.decisao, origem: 'modelo' }
    pedido = `${corpo}\n\nSUA RESPOSTA ANTERIOR FOI RECUSADA:\n- ${v.erros.join('\n- ')}\nResponda de novo, só o JSON.`
  }
  // o modelo respondeu, mas duas vezes sem validade: aí sim a opção padrão do tipo
  const escolha = decisaoPadrao(proposta, { provado: estado?.provado === true, jaTentou: estado?.jaTentou === true })
  return escolha ? { escolha, porque: 'sem resposta válida do modelo, usei a opção padrão do tipo', origem: 'padrao' } : null
}

/* ===================================================================
   Git do Regente (20/10): não refaz o que já tem commit, commita por micro tarefa e empurra. Nunca deploy, nunca force.
   =================================================================== */
const git = (cwd, args, timeout = 30000) => new Promise((ok) => {
  execFile('git', ['-C', cwd, ...args], { timeout, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (e, out, err) => ok({ ok: !e, out: String(out || ''), err: String(err || e?.message || '') }))
})

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const palavrasDe = (t) => new Set(semAcento(t).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 5))

/** Pura: dos commits ("hash assunto"), o que fecha o item: o id dele aparece, ou o assunto repete a maior parte das palavras do título. */
export function commitQueFechaOItem(item, commits) {
  const id = String(item?.id || '')
  const alvo = palavrasDe(item?.intencao || item?.titulo)
  for (const linha of commits || []) {
    const [hash, ...resto] = String(linha).trim().split(' ')
    const assunto = resto.join(' ')
    if (id && new RegExp(`(^|[^A-Za-z0-9-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^0-9]|$)`).test(assunto)) return { hash, assunto, por: 'id' }
    const a = palavrasDe(assunto)
    if (alvo.size >= 2 && a.size) { let i = 0; for (const w of alvo) if (a.has(w)) i++; if (i / alvo.size >= 0.6) return { hash, assunto, por: 'título' } }
  }
  return null
}

/** O commit do projeto que já fez este item, ou null. `git log --all --oneline --grep=<ID>` e depois o título nos assuntos. */
export async function commitDoItem(cwd, item) {
  if (!item?.id) return null
  const porId = await git(cwd, ['log', '--all', '--oneline', '--extended-regexp', `--grep=(^|[^A-Za-z0-9-])${item.id}([^0-9]|$)`, '-n', '20'])
  const todos = await git(cwd, ['log', '--all', '--oneline', '-n', '300'])
  return commitQueFechaOItem(item, [...(porId.ok ? porId.out.split('\n') : []), ...(todos.ok ? todos.out.split('\n') : [])].filter(Boolean))
}

/**
 * Pura (com disco): a prova que o modelo deu vale? JSON com `feito` booleano e `prova` de 10 a 200 letras que cita um arquivo
 * que existe no projeto ou um commit que existe. Devolve { ok, prova } ou { ok: false, erro }.
 */
export async function validarConferencia(cwd, texto) {
  // o Sonnet costuma abrir com uma frase e pôr o JSON numa cerca: vale o objeto de dentro (medido no CM-7, 20/10)
  const cru = (String(texto || '').match(/\{[\s\S]*\}/) || [''])[0]
  let v
  try { v = JSON.parse(cru) } catch { return { ok: false, erro: 'não é JSON' } }
  if (!v || typeof v !== 'object' || typeof v.feito !== 'boolean') return { ok: false, erro: 'feito não é booleano' }
  if (!v.feito) return { ok: true, feito: false }
  const prova = typeof v.prova === 'string' ? v.prova.replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim() : ''
  if (prova.length < 10 || prova.length > 200) return { ok: false, erro: 'prova fora de 10 a 200 letras' }
  const fichas = prova.split(/[\s,;:()[\]"'`]+/).map((t) => t.replace(/[.]+$/, '')).filter(Boolean)
  for (const t of fichas) {
    if (/^[0-9a-f]{7,40}$/i.test(t) && (await git(cwd, ['cat-file', '-e', `${t}^{commit}`])).ok) return { ok: true, feito: true, prova }
    if (/[./]/.test(t) && !t.startsWith('/') && !t.includes('..') && fs.existsSync(path.join(cwd, t))) return { ok: true, feito: true, prova }
  }
  return { ok: false, erro: 'a prova não cita arquivo nem commit que existam' }
}

const diaDe = (q) => { const d = new Date(q); return Number.isNaN(+d) ? '' : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` } // dia local, não o do UTC

/**
 * Verificação barata pelo conteúdo, quando nenhum commit cita o item (CM-9, 20/10: a Fundação existia por inteiro e o Regente
 * mandou refazer). Uma chamada só leitura ao modelo. Devolve { feito: true, prova } só com prova que confere; qualquer outra
 * coisa é { feito: false, motivo } e o fluxo normal constrói. Cache por item e por dia em .framework/regente.json
 * (`conferidos`); indisponível não grava. `ensaio` não lê nem grava cache: só devolve o resultado.
 */
export async function conferirPorConteudo(cwd, item, { chamar, binario, modelo, ensaio = false } = {}) {
  if (!item?.id) return { feito: false, motivo: 'sem id' }
  if (!ensaio) {
    const c = ler(cwd).conferidos?.[item.id]
    if (c && c.em && diaDe(c.em) === diaDe(Date.now())) return { feito: false, motivo: 'cache' }
  }
  const pedido = [
    `Item ${item.id}`, `Intenção: ${item.intencao || item.titulo || ''}`, `Pronto: ${item.pronto || ''}`, '',
    'Olhe o repositório (arquivos, git log, testes). Este item já está feito?',
    'Responda SÓ JSON: {"feito": true|false, "prova": "o que no repositório mostra isso, até 200 letras, com nome de arquivo ou commit"}',
    'Sem travessão em nenhum texto.',
  ].join('\n')
  const fala = chamar || chamarPadrao(cwd, binario, modelo || 'sonnet')
  let saida
  try { saida = await fala(pedido) } catch { return { feito: false, motivo: 'indisponível' } }
  if (motivoIndisponivel({ out: saida })) return { feito: false, motivo: 'indisponível' }
  const v = await validarConferencia(cwd, saida)
  const r = v.ok && v.feito ? { feito: true, prova: v.prova } : { feito: false, motivo: v.ok ? 'não feito' : `inválida: ${v.erro}` }
  if (!ensaio) {
    const e = ler(cwd)
    gravar(cwd, { ...e, conferidos: { ...(e.conferidos || {}), [item.id]: { feito: r.feito, em: new Date().toISOString() } } })
  }
  return r
}

/** Pura: "feat(ID): título curto", sem travessão, sem quebra de linha e sem Co-Authored-By (regra dele, vale contra o harness). */
export function mensagemDeCommit(id, titulo) {
  const t = String(titulo || 'micro tarefa').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim().replace(/co-authored-by/ig, '').slice(0, 60).trim() || 'micro tarefa'
  return `feat(${String(id).replace(/[^A-Za-z0-9._-]/g, '')}): ${t}`
}

const PROIBIDO = [/(^|\/)\.env($|\.)/i, /(^|\/)node_modules\//, /(^|\/)\.git\//, /(^|\/)\.framework\//, /\.(pem|key|p12|pfx|keystore|jks)$/i, /(^|\/)id_(rsa|ed25519|ecdsa)/i, /(^|\/)(secrets?|credentials?)(\.|\/|$)/i, /^docs\/(cartas\/|[^/]+\.jsonl$|ROADMAP\.md$)/]
/** Pura: tira da lista o que nunca entra num commit do robô (segredo, dependência, arquivo de controle do painel). */
export function arquivosParaCommit(lista) {
  return [...new Set((lista || []).map((f) => String(f).replace(/\\/g, '/').replace(/^\.\//, '')).filter(Boolean))].filter((f) => !f.startsWith('/') && !f.includes('..') && !PROIBIDO.some((re) => re.test(f)))
}

/** Commita SÓ os arquivos dados (nunca `add .`), sem push. Falha devolve { ok: false, erro } e quem chama segue. */
export async function commitarArquivos(cwd, id, titulo, arquivos) {
  let lista = arquivosParaCommit(arquivos)
  const ign = await git(cwd, ['check-ignore', '--', ...lista]) // .gitignore também vale
  const ignorados = new Set(ign.out.split('\n').filter(Boolean))
  lista = lista.filter((f) => !ignorados.has(f))
  lista = lista.filter((f) => { try { return !Object.keys(acharSegredos(fs.readFileSync(path.join(cwd, f), 'utf8').slice(0, 1_000_000))).length } catch { return true } })
  if (!lista.length) return { ok: false, pulado: true, erro: 'nenhum arquivo seguro para commitar' }
  const add = await git(cwd, ['add', '-A', '--', ...lista])
  if (!add.ok) return { ok: false, erro: add.err.split('\n')[0].slice(0, 160) }
  const c = await git(cwd, ['commit', '-m', mensagemDeCommit(id, titulo), '--', ...lista])
  if (!c.ok) return { ok: false, erro: (c.err || c.out).split('\n').find(Boolean)?.slice(0, 160) || 'commit falhou' }
  const h = await git(cwd, ['rev-parse', '--short', 'HEAD'])
  return { ok: true, hash: h.out.trim(), arquivos: lista }
}

/** `git push` sem force, só com origin e upstream. Falhou, devolve o motivo curto; nunca espera. */
export async function empurrar(cwd) {
  if (!(await git(cwd, ['remote', 'get-url', 'origin'])).ok) return { ok: false, pulado: true, erro: 'sem remoto origin' }
  if (!(await git(cwd, ['rev-parse', '--abbrev-ref', '@{u}'])).ok) return { ok: false, pulado: true, erro: 'a branch não tem upstream' }
  const p = await git(cwd, ['push'], 60000)
  return p.ok ? { ok: true } : { ok: false, erro: (p.err.split('\n').find((l) => /rejected|denied|fatal|error|could not/i.test(l)) || p.err.split('\n').find(Boolean) || 'push falhou').slice(0, 140) }
}
