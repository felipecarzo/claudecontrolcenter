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

/**
 * M2: o que a sala sabe responder neste cartão, com o que a rota do painel precisa (as mesmas rotas, nada novo):
 * - pergunta de UMA questão de escolha única: /api/decisao/responder { conversa, id, respostas: [{ opcao }] };
 * - permissão do terminal: /api/decisao/permitir { conversa, id, decisao: 'sim' | 'nao' | 'sempre' };
 * - escolha do Coderoom: a mesma rota, decisao 'escolha:<texto>'.
 * Pergunta com várias questões ou de várias escolhas fica para o painel (o cartão diz isso), até a sala ter teclado.
 */
export function acaoDoCartao(e, { daqui = true } = {}) {
  if (!e) return null
  if (e.grupo) return { tipo: 'no-painel', motivo: e.itens.length + ' sessões juntas: responda uma por uma no painel' }
  // a pergunta do arquiteto tem rota própria, que a sala ainda não fala (revisão do M2)
  if (e.arquiteto) return { tipo: 'no-painel', motivo: 'pergunta do arquiteto: responda no painel' }
  const r = e.responder
  if (r && r.id && r.conversa && Array.isArray(r.perguntas) && r.perguntas.length) {
    const q = r.perguntas[0]
    if (r.perguntas.length === 1 && !q.multipla && Array.isArray(q.opcoes) && q.opcoes.length) {
      // opção cortada não se escolhe: mais de 4, ou rótulo que não cabe no botão, vai para o painel (achado 11)
      if (q.opcoes.length > 4 || q.opcoes.some((o) => CORTA(o, 999).length > 48)) return { tipo: 'no-painel', motivo: 'opções longas demais para a sala: responda no painel' }
      return { tipo: 'pergunta', conversa: r.conversa, id: r.id, opcoes: q.opcoes.map((o) => CORTA(o, 48)), descricoes: (q.descricoes || []).slice(0, 4).map((x) => CORTA(x, 120)) }
    }
    return { tipo: 'no-painel', motivo: r.perguntas.length > 1 ? 'são ' + r.perguntas.length + ' perguntas: responda no painel' : 'várias escolhas: responda no painel' }
  }
  /* As mesmas condições dos botões do painel (ui_cockpit2.html, perto de `perm-botoes`): a escolha do Coderoom só
     daqui; a permissão daqui ou de outra máquina; as duas com conversa e id. A pergunta do Coderoom chega com rótulo
     "pergunta" e `escolhas` (cockpit2.mjs, pedidos do gancho), por isso as escolhas vêm antes do rótulo. */
  if (e.permissaoId && Array.isArray(e.escolhas) && e.escolhas.length) {
    if (!daqui || !e.conversa) return { tipo: 'no-painel', motivo: 'responda no ' + (e.dispositivo || 'outro computador') }
    if (e.escolhas.length > 4 || e.escolhas.some((o) => String(o).length > 48)) return { tipo: 'no-painel', motivo: 'opções longas demais para a sala: responda no painel' }
    return { tipo: 'escolha', conversa: e.conversa, id: e.permissaoId, opcoes: e.escolhas.map((o) => String(o)) }
  }
  if (e.rotulo === 'permissão' && e.permissaoId) {
    if (!(daqui || e.deOutraMaquina) || !e.conversa) return { tipo: 'no-painel', motivo: 'responda no ' + (e.dispositivo || 'outro computador') }
    // sem ler o comando inteiro não se permite: comando longo vai para o painel (revisão do M2, achado 2)
    if (String(e.comando || '').length > COMANDO_MAX) return { tipo: 'no-painel', motivo: 'o comando é longo demais para ler aqui: confira no painel' }
    return { tipo: 'permissao', conversa: e.conversa, id: e.permissaoId, sempre: Boolean(e.sempre) }
  }
  if (e.rotulo === 'pergunta') return { tipo: 'no-painel', motivo: 'pergunta sem opções: responda no painel' }
  return null
}
export const COMANDO_MAX = 220

/* O agrupamento da tela (ui_cockpit2.html, `c2Juntar` e `c2DecisoesVisiveis`): 3 ou mais cartões iguais viram um
   cartão só. Sem ele a sala dizia 3 onde o painel diz 1 (revisão do M2, achado 7). */
const GRUPO_MIN = 3
function juntar(lista, pode, chave, extra) {
  const conta = new Map()
  for (const e of lista) if (pode(e)) conta.set(chave(e), (conta.get(chave(e)) || 0) + 1)
  const grupos = new Map(), saida = []
  for (const e of lista) {
    const k = chave(e)
    if (!pode(e) || conta.get(k) < GRUPO_MIN) { saida.push(e); continue }
    if (!grupos.has(k)) { const g = { grupo: true, chave: k, nome: e.nome, dispositivo: e.dispositivo, itens: [], ...(extra ? extra(e) : {}) }; grupos.set(k, g); saida.push(g) }
    grupos.get(k).itens.push(e)
  }
  return saida
}
export function decisoesVisiveis(d) {
  const agentes = ((d && d.espera) || []).filter((e) => e && e.tipo === 'agente')
  const paradas = juntar(agentes, (e) => (e.rotulo === 'parou' || e.rotulo === 'parou sem perguntar') && e.sessao !== 'coderoom', (e) => (e.nome || '') + '|' + (e.dispositivo || ''))
  return juntar(paradas, (e) => !e.grupo && e.rotulo === 'pergunta' && !!e.pergunta,
    (e) => (e.nome || '') + '|' + (e.dispositivo || '') + '|' + String(e.pergunta).trim().toLowerCase(),
    (e) => ({ rotulo: 'pergunta', pergunta: e.pergunta }))
}

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
  const visiveis = decisoesVisiveis(d)
  // grupo conta 1 mesmo só com QA, como no número do painel
  const espera = visiveis.filter((e) => !e.esquecida && (e.grupo || (!ehQA(e) && !ehNada(e))))
  const idsComCartao = new Set(visiveis.flatMap((e) => (e.grupo ? e.itens.map((x) => x.id) : [e.id])))
  // sessão em "espera você" sem cartão também conta, como no painel: fora a pasta pessoal e o "para depois"
  const pessoal = new Set((d.projetos || []).filter((p) => p && p.pastaPessoal).map((p) => p.chave))
  const depois = new Set((d.ocultas || []).filter((o) => o && o.oculta === 'depois').map((o) => o.id))
  const semCartao = (d.conectadas || []).filter((s) => s && s.estado === 'espera você' && !pessoal.has(s.projeto) && !idsComCartao.has(s.id) && !depois.has(s.id) && !ehQA(s) && !ehNada(s) && !s.esquecida)
  const local = (d.dispositivos || []).find((x) => x && x.local)
  const daqui = (e) => !local || e.dispositivo === local.nome || String(e.conversa || '').startsWith('gate:')
  const cartoes = espera.slice(0, maxCartoes).map((e) => {
    const perm = e.rotulo === 'permissão'
    return {
      id: e.grupo ? 'grupo:' + e.chave : e.id || null,
      projeto: e.projeto || e.nome || '',
      maquina: e.dispositivo || null,
      rotulo: e.rotulo || 'espera você',
      pergunta: CORTA(e.grupo ? e.itens.length + ' sessões: ' + (e.pergunta || 'paradas sem pergunta') : e.pergunta || e.resumo || e.assunto, 280),
      // a permissão leva o que o painel mostra antes do botão: a ferramenta, o comando e as marcas de perigo
      ferramenta: perm ? e.ferramenta || null : null,
      comando: perm && e.comando ? String(e.comando).slice(0, COMANDO_MAX + 1) : null,
      perigos: perm && Array.isArray(e.raio) ? e.raio.filter((f) => f && f.perigo).slice(0, 2).map((f) => CORTA(f.texto, 90)) : [],
      acao: acaoDoCartao(e, { daqui: daqui(e) }),
    }
  })
  const esperandoIds = new Set(espera.flatMap((e) => (e.grupo ? e.itens.map((x) => x.id) : [e.id])))
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
