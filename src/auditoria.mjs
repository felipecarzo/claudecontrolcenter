/**
 * CC-941: o auditor das perguntas do arquiteto. Pedido dele em 06/10: "cria travas para você ter certeza que está
 * seguindo as regras que a gente está combinando". Cada pergunta que chegaria a ele é conferida contra as regras:
 *
 *   redundante   pede aprovação de algo que JÁ está no backlog que ele escolheu (devia rodar sozinho)
 *   fora         propõe construir algo que não está no backlog (por que não está?)
 *   repetida     quase igual à pergunta anterior (ele já respondeu)
 *   tecnica      pergunta de detalhe técnico, não de produto
 *   print        revisão cujas fotos só mostram a tela de entrada
 *
 * A mesma conta serve de trava (antes de a pergunta sair) e de relatório (sobre o histórico de um projeto).
 */
import path from 'node:path'
import * as B from './backlog.mjs'

const palavras = (t) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 5))
/* Quanto do item curto aparece no pedido. Medido em 07/10: "Lançar gasto rápido" (3 palavras) casou com "Criar área de
   compromissos... separada do lançamento de gasto do dia a dia" por 2 de 3 palavras, e o robô construiu dizendo que era o
   CN-15. Item curto precisa casar INTEIRO; item longo, 3/4 das palavras e no mínimo 3. */
const cobre = (curto, longo) => {
  const a = palavras(curto), b = palavras(longo); if (a.size < 2) return 0
  let i = 0; for (const w of a) if (b.has(w)) i++
  const precisa = a.size <= 3 ? a.size : Math.max(3, Math.ceil(a.size * 0.75))
  return i >= precisa ? i / a.size : 0
}
const jaccard = (x, y) => { const a = palavras(x), b = palavras(y); if (!a.size || !b.size) return 0; let i = 0; for (const w of a) if (b.has(w)) i++; return i / (a.size + b.size - i) }
const TECNICA = /\b(stack|framework|biblioteca|banco de dados|postgres|sqlite|mysql|next\.?js|react|endpoint|api\b|rota|middleware|cookie|json|npm|deploy|commit)/i

/** O item que a IA APONTOU (daFila) confere pelo conteúdo? Mais solto: ela tem o contexto, o programa só checa que não é outra coisa (40% das palavras, no mínimo 2). */
export function bateSolto(proposta, item) {
  const a = palavras(item?.intencao || item?.titulo), b = palavras(`${proposta?.titulo || ''} ${proposta?.pedido || ''} ${proposta?.pergunta || ''}`)
  if (a.size < 2) return false
  let i = 0; for (const w of a) if (b.has(w)) i++
  return i >= 2 && i / a.size >= 0.4
}

/** O item do backlog que ELE escolheu (origem felipe, aberto) e que este pedido executa, ou null. */
export function itemDoBacklog(proposta, itens) {
  // apontado pela IA e conferido pelo conteúdo (solto); senão, o programa procura sozinho (rígido)
  const apontado = proposta?.daFila && itens.find((x) => x.id === proposta.daFila && x.origem === 'felipe' && !x.pai && B.estaAberto(x))
  if (apontado && bateSolto(proposta, apontado)) return apontado
  const alvo = `${proposta?.titulo || ''} ${proposta?.pedido || ''}`
  const deles = itens.filter((x) => x.origem === 'felipe' && !x.pai && B.estaAberto(x))
  let melhor = null, nota = 0
  for (const x of deles) {
    /* o título do item é curto ("Contas fixas separadas"): quanto dele aparece no pedido. Medido em 06/10: a entrevista
       grava várias funções num item só ("Lançar gasto com foto, Contas fixas separadas, Ver quanto sobra"), então cada
       parte conta sozinha. */
    for (const parte of String(x.intencao || x.titulo || '').split(/[,;]| e (?=[A-ZÀ-Ú])/)) {
      const n = cobre(parte, alvo)
      if (n > nota) { nota = n; melhor = x }
    }
  }
  return nota > 0 ? melhor : null
}

/** As violações de UMA proposta, dado o que já existe. Lista vazia = pode sair. */
export function violacoes(proposta, { itens = [], anteriores = [], fotos = null } = {}) {
  const v = []
  if (!proposta) return v
  // "Faltou parte": o programa refazendo o que ele já aprovou, não é pedido novo
  if (proposta.tipo === 'pedido' && !/^Faltou parte/i.test(proposta.titulo || '')) {
    const it = itemDoBacklog(proposta, itens)
    if (it) v.push({ regra: 'redundante', motivo: `o pedido executa ${it.id} ("${String(it.intencao || '').slice(0, 60)}"), que já está no backlog escolhido por ele: devia rodar sozinho` })
    else v.push({ regra: 'fora', motivo: 'o pedido não corresponde a nenhum item do backlog dele: ou falta o item, ou é ideia nova e devia vir como ideia' })
  }
  const ant = anteriores.at(-1)
  if (ant && ant.tipo === proposta.tipo && proposta.tipo !== 'revisao' && jaccard(ant.pergunta, proposta.pergunta) >= 0.6) v.push({ regra: 'repetida', motivo: `quase igual à pergunta anterior (${ant.id}: "${String(ant.pergunta).slice(0, 60)}")` })
  if (proposta.tipo !== 'entrevista' && TECNICA.test(`${proposta.pergunta} ${(proposta.opcoes || []).join(' ')}`)) v.push({ regra: 'tecnica', motivo: 'pergunta de detalhe técnico: quem decide é o arquiteto, não ele' })
  if (proposta.tipo === 'revisao' && Array.isArray(fotos) && fotos.length && fotos.every((f) => /(^|[\\/])\d+-(login|entrar|entrada)\b/i.test(f))) v.push({ regra: 'print', motivo: 'as fotos só mostram a tela de entrada' })
  return v
}

/** Relatório do histórico de um projeto: cada pergunta que chegou a ele, com as violações. */
export function auditarProjeto(cwd) {
  const itens = B.ler(B.caminhoPadrao(cwd)).itens
  const perguntas = itens.filter((x) => x.origem === 'arquiteto' && x.proposta && x.proposta.tipo !== 'entrevista')
  const linhas = [], anteriores = []
  for (const x of perguntas) {
    const p = { ...x.proposta, pergunta: x.decisao || x.proposta.pergunta }
    const antes = itens.filter((y) => Number(y.id.split('-')[1]) < Number(x.id.split('-')[1]))
    const viol = violacoes(p, { itens: antes, anteriores })
    linhas.push({ id: x.id, tipo: p.tipo, pergunta: p.pergunta, automatico: Boolean(x.automatico), escolha: x.escolha || null, violacoes: viol })
    anteriores.push({ id: x.id, tipo: p.tipo, pergunta: p.pergunta })
  }
  const chegaram = linhas.filter((l) => !l.automatico)
  const conta = {}; for (const l of chegaram) for (const v of l.violacoes) conta[v.regra] = (conta[v.regra] || 0) + 1
  return { projeto: path.basename(cwd), perguntas: linhas.length, chegaramAEle: chegaram.length, limpas: chegaram.filter((l) => !l.violacoes.length).length, conta, linhas }
}
