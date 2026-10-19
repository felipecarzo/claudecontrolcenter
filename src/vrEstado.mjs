/**
 * CC-1063: o dado da sala de realidade virtual (docs/CC-1063.md).
 *
 * O painel lê ~474 KB a cada leitura; o Quest 2 é um celular no rosto e precisa de 72 quadros por segundo. A sala lê só
 * o que desenha: os cartões que esperam por ele, os agentes com o estado e a contagem. Função pura sobre o mesmo dado
 * do painel (cockpit2.mjs `responder()`).
 *
 * "Esperando você" segue a MESMA regra do número do painel (ui_cockpit2.html, renderViewDecisoes, CC-737, CC-950,
 * CC-957): sai quem está esquecido, quem só espera um teste dele (etiqueta "testar") e quem terminou sem pedir nada
 * (etiqueta "nada"); pergunta e permissão nunca saem. Medido na revisão de 19/10: sem isto a sala dizia 4 e o painel 2.
 * O painel calcula no navegador e não pode importar este módulo: as duas cópias da regra são conferidas em test-vr.mjs.
 */

const CORTA = (t, n) => { const s = typeof t === 'string' ? t : (t && (t.label || t.texto || t.rotulo)) || ''; const v = String(s).replace(/\s+/g, ' ').trim(); return v.length > n ? v.slice(0, n - 1) + '…' : v }

const etiqueta = (x) => (x && x.resumoIA && x.resumoIA.etiqueta) || null
const decisivo = (x) => x.rotulo === 'pergunta' || x.rotulo === 'permissão' || x.estado === 'trabalhando'
/** Só espera um teste dele: vai para QA, não para "esperando você". */
export const ehQA = (x) => etiqueta(x) === 'testar' && !decisivo(x)
/** Terminou sem pedir nada. */
export const ehNada = (x) => etiqueta(x) === 'nada' && !decisivo(x)
/** O cartão conta como "esperando você"? */
export const contaComoEsperando = (e) => Boolean(e) && e.tipo === 'agente' && !e.esquecida && !ehQA(e) && !ehNada(e)

/** Estado de um agente na sala: as mesmas palavras da tela (regra 10: cor nunca fala sozinha). */
export function estadoDoAgente(s) {
  const e = String(s?.estado || '').toLowerCase()
  if (e.includes('trabalh')) return 'trabalhando'
  if (e.includes('falh') || e.includes('erro')) return 'falhou'
  if (e.includes('espera') || e.includes('pergunt')) return 'esperando'
  return 'parada'
}

export function estadoVR(dados, { maxCartoes = 8, maxAgentes = 24 } = {}) {
  const d = dados || {}
  const espera = (d.espera || []).filter(contaComoEsperando)
  const idsComCartao = new Set((d.espera || []).filter((e) => e && e.tipo === 'agente').map((e) => e.id))
  // sessão em "espera você" sem cartão também conta, como no painel
  const semCartao = (d.conectadas || []).filter((s) => s && s.estado === 'espera você' && !idsComCartao.has(s.id) && !ehQA(s) && !ehNada(s) && !s.esquecida)
  const cartoes = espera.slice(0, maxCartoes).map((e) => ({
    id: e.id || null,
    projeto: e.projeto || e.nome || '',
    maquina: e.dispositivo || null,
    rotulo: e.rotulo || 'espera você',
    pergunta: CORTA(e.pergunta || e.resumo || e.assunto, 280),
    opcoes: (e.opcoes || []).slice(0, 4).map((o) => CORTA(o, 60)),
    conversa: e.conversa || null,
    escreve: e.escreve !== false,
  }))
  const esperandoIds = new Set(espera.map((e) => e.id))
  const agentes = (d.conectadas || []).slice(0, maxAgentes).map((s) => ({
    id: s.id || null,
    projeto: s.projeto || s.nome || '',
    maquina: s.dispositivo || null,
    estado: esperandoIds.has(s.id) ? 'esperando' : estadoDoAgente(s),
    esquecida: Boolean(s.esquecida),
    conversa: s.conversa || null,
  }))
  return {
    lidoEm: d.lidoEm || null,
    contagem: {
      esperando: espera.length + semCartao.length,
      trabalhando: agentes.filter((a) => a.estado === 'trabalhando').length,
      total: (d.conectadas || []).length,
    },
    cartoes,
    agentes,
  }
}
