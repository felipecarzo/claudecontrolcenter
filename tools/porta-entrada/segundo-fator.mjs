// CC-869: o segundo fator da porta de entrada do painel (login em aparelho novo e reinício
// de emergência), conferido pelo serviço do Deploy seguro.
//
// Desenho, decidido com ele em 02/10:
//  - o SEGREDO do autenticador mora só no serviço que roda como administrador. Aqui nunca
//    há segredo: manda-se o código de 6 números e volta "sim" ou "não";
//  - é opcional e nasce DESLIGADO. Quem liga é o comando `cockpit-auth codigo ligar`, que
//    antes testa a conexão: ligar sem o serviço de pé trancaria ele fora do painel;
//  - serviço fora do ar = recusa (falha fechada), com a causa dita na tela;
//  - quem chama confere a SENHA antes de perguntar o código, para quem não sabe a senha não
//    conseguir queimar o contador do login.
//
// Limite honesto: o arquivo que liga e desliga isto mora na pasta do usuário comum, como o
// resto da porta de entrada. Protege contra senha vazada, cookie roubado e curioso na rede;
// não contra um agente com acesso de escrita a esta pasta, que já poderia alterar a própria
// porta de entrada.
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

export const PORTA_DEPLOY = Number(process.env.COCKPIT_DEPLOY_PORT || 5193)
export const arquivoFlag = (casa = os.homedir()) => path.join(casa, '.cockpit-2fa.json')

/** Está ligado? Lido a cada pedido, como o resto da porta de entrada: ligar/desligar não reinicia nada. */
export function lerFlag(casa = os.homedir()) {
  try {
    const d = JSON.parse(fs.readFileSync(arquivoFlag(casa), 'utf8'))
    return { ativo: d.ativo === true, porta: Number(d.porta) || PORTA_DEPLOY, em: d.em || null }
  } catch { return { ativo: false, porta: PORTA_DEPLOY, em: null } }
}
export function gravarFlag({ ativo, porta = PORTA_DEPLOY }, casa = os.homedir()) {
  fs.writeFileSync(arquivoFlag(casa), JSON.stringify({ ativo: Boolean(ativo), porta, em: Date.now() }), { mode: 0o600 })
}

function chamar({ porta, caminho, metodo = 'GET', corpo = null, timeoutMs = 3000 }) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port: porta, path: caminho, method: metodo, timeout: timeoutMs,
      headers: corpo ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(corpo) } : {} }, (r) => {
      let t = ''; r.on('data', (c) => { t += c; if (t.length > 4096) r.destroy() })
      r.on('end', () => { try { resolve({ ok: true, dado: JSON.parse(t) }) } catch { resolve({ ok: false }) } })
    })
    req.on('error', () => resolve({ ok: false })); req.on('timeout', () => { req.destroy(); resolve({ ok: false }) })
    if (corpo) req.write(corpo)
    req.end()
  })
}

/** O serviço está de pé, e tem o segredo configurado? Usado antes de ligar. */
export async function sondar({ porta = PORTA_DEPLOY, timeoutMs } = {}) {
  const r = await chamar({ porta, caminho: '/api/verificar/estado', timeoutMs })
  if (!r.ok || r.dado?.ok !== true) return { ok: false, motivo: 'indisponivel' }
  if (!r.dado.configurado) return { ok: false, motivo: 'sem-segredo' }
  return { ok: true }
}

/** Pergunta ao serviço se o código vale para a finalidade. Nunca lança: erro de rede vira recusa. */
export async function verificarNoServico({ finalidade, codigo, porta = PORTA_DEPLOY, timeoutMs }) {
  const limpo = String(codigo || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(limpo)) return { ok: false, motivo: 'formato' }
  const r = await chamar({ porta, caminho: '/api/verificar', metodo: 'POST', corpo: JSON.stringify({ finalidade, codigo: limpo }), timeoutMs })
  if (!r.ok || typeof r.dado?.ok !== 'boolean') return { ok: false, motivo: 'indisponivel' }
  return r.dado
}

/** A frase que a tela mostra para cada recusa: diz a causa e o que fazer. */
export function textoDoMotivo(r, agora = Date.now()) {
  switch (r?.motivo) {
    case 'formato': return 'o código tem 6 números'
    case 'errado': return r.bloqueadoAte ? textoBloqueio(r.bloqueadoAte, agora) : 'código errado'
    case 'usado': return 'esse código já foi usado: espere o próximo (muda a cada 30 segundos)'
    case 'bloqueado': return textoBloqueio(r.bloqueadoAte, agora)
    case 'sem-segredo': return 'o autenticador não está configurado no serviço do administrador'
    case 'indisponivel': return 'o serviço do autenticador não respondeu. Tente de novo; se continuar, o administrador desliga com: cockpit-auth codigo desligar'
    default: return 'código recusado'
  }
}
const textoBloqueio = (ate, agora) => `código errado vezes demais: bloqueado por mais ${Math.max(1, Math.ceil((ate - agora) / 60000))} minuto(s)`
