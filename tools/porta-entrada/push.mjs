/**
 * CC-932: Web Push padrão (RFC 8030 + VAPID RFC 8292 + criptografia RFC 8291, aes128gcm),
 * sem dependência: só node:crypto, node:https e o resto do que vem com o Node.
 *
 * Mora na porta de entrada porque é ela o serviço que fica sempre no ar. Guarda dois
 * arquivos em COCKPIT_PUSH_DIR (padrão ~/.cockpit-push/, pasta 0700): as chaves VAPID,
 * geradas uma vez (0600), e as inscrições dos aparelhos (0600).
 *
 * Nunca imprime a chave privada. Quem inscreve é sempre alguém já logado na porta.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'

const dir = () => process.env.COCKPIT_PUSH_DIR || path.join(os.homedir(), '.cockpit-push')
const arqChaves = () => path.join(dir(), 'vapid.json')
const arqInscricoes = () => path.join(dir(), 'inscricoes.json')
const sub = () => process.env.COCKPIT_PUSH_SUB || 'mailto:cockpit@carzo.com.br'
// só os testes ligam: o servidor de push de mentira é http local
const inseguro = () => process.env.COCKPIT_PUSH_INSEGURO === '1'

export const b64u = (buf) => Buffer.from(buf).toString('base64url')
export const deB64u = (s) => Buffer.from(String(s), 'base64url')

function gravarSeguro(arq, texto) {
  fs.mkdirSync(path.dirname(arq), { recursive: true, mode: 0o700 })
  const tmp = arq + '.tmp-' + process.pid
  fs.writeFileSync(tmp, texto, { mode: 0o600 })
  fs.renameSync(tmp, arq)
}

// ---------- chaves VAPID ----------

function chaves() {
  try {
    const d = JSON.parse(fs.readFileSync(arqChaves(), 'utf8'))
    if (d?.jwk?.d && d.publica) return d
  } catch { /* primeira vez: gera abaixo */ }
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = privateKey.export({ format: 'jwk' })
  const publica = b64u(Buffer.concat([Buffer.from([4]), deB64u(jwk.x), deB64u(jwk.y)]))
  const d = { jwk, publica }
  gravarSeguro(arqChaves(), JSON.stringify(d))
  return d
}

/** A chave pública VAPID (ponto P-256 sem compressão, base64url): é o que o navegador pede ao inscrever. */
export const chavePublica = () => chaves().publica

/** O JWT ES256 da norma: aud é a ORIGEM do endpoint, exp 12 h (o teto da norma é 24 h). */
export function assinarVapid(endpoint, { agora = Date.now(), jwk = chaves().jwk } = {}) {
  const aud = new URL(endpoint).origin
  const parte = (o) => b64u(JSON.stringify(o))
  const dados = parte({ typ: 'JWT', alg: 'ES256' }) + '.' + parte({ aud, exp: Math.floor(agora / 1000) + 12 * 3600, sub: sub() })
  const chave = crypto.createPrivateKey({ key: jwk, format: 'jwk' })
  const assinatura = crypto.sign('sha256', Buffer.from(dados), { key: chave, dsaEncoding: 'ieee-p1363' })
  return dados + '.' + b64u(assinatura)
}

// ---------- criptografia do corpo (RFC 8291) ----------

/**
 * Cifra `corpo` para a inscrição ({ p256dh, auth }, os dois em base64url). `efemera` e `salt`
 * só existem para o teste reproduzir os vetores do apêndice A; em uso real nascem aleatórios.
 */
export function cifrar(corpo, { p256dh, auth }, { efemera, salt = crypto.randomBytes(16) } = {}) {
  const uaPub = deB64u(p256dh)
  const ecdh = crypto.createECDH('prime256v1')
  if (efemera) ecdh.setPrivateKey(deB64u(efemera)); else ecdh.generateKeys()
  const asPub = ecdh.getPublicKey()
  const segredo = ecdh.computeSecret(uaPub)
  const hkdf = (ikm, sal, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, sal, info, n))
  const ikm = hkdf(segredo, deB64u(auth), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32)
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12)
  const cifra = crypto.createCipheriv('aes-128-gcm', cek, nonce)
  // 0x02 marca o último (e único) registro; nossos avisos cabem folgados nos 4096 do registro
  const texto = Buffer.concat([cifra.update(Buffer.concat([Buffer.from(corpo), Buffer.from([2])])), cifra.final(), cifra.getAuthTag()])
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096)
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, texto])
}

// ---------- inscrições ----------

export function inscricoes() {
  try {
    const l = JSON.parse(fs.readFileSync(arqInscricoes(), 'utf8'))
    return Array.isArray(l) ? l : []
  } catch { return [] }
}

const hostPrivado = (h) => /^(localhost|\[?::1\]?|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(h)

/** Guarda a inscrição que o navegador gerou (PushSubscription.toJSON()). Lança se não for uma inscrição de verdade. */
export function inscrever(s) {
  let u
  try { u = new URL(s?.endpoint) } catch { throw new Error('inscrição sem endereço') }
  if (!inseguro() && (u.protocol !== 'https:' || hostPrivado(u.hostname))) throw new Error('o endereço do serviço de push precisa ser https público')
  const p256dh = String(s?.keys?.p256dh || ''); const auth = String(s?.keys?.auth || '')
  if (deB64u(p256dh).length !== 65 || deB64u(auth).length < 16) throw new Error('inscrição sem as chaves p256dh e auth')
  const lista = inscricoes().filter((x) => x.endpoint !== u.href)
  lista.push({ endpoint: u.href, keys: { p256dh, auth }, em: Date.now() })
  gravarSeguro(arqInscricoes(), JSON.stringify(lista, null, 1))
  return lista.length
}

function remover(endpoint) {
  gravarSeguro(arqInscricoes(), JSON.stringify(inscricoes().filter((x) => x.endpoint !== endpoint), null, 1))
}

// ---------- envio ----------

function postar(ins, corpo) {
  return new Promise((ok) => {
    const u = new URL(ins.endpoint)
    const jwt = assinarVapid(ins.endpoint)
    const req = (u.protocol === 'http:' ? http : https).request(u, {
      method: 'POST', timeout: 10000,
      headers: {
        authorization: `vapid t=${jwt}, k=${chavePublica()}`,
        'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream',
        'content-length': corpo.length, ttl: '86400', urgency: 'high',
      },
    }, (r) => { r.resume(); r.on('end', () => ok(r.statusCode)) })
    req.on('timeout', () => req.destroy(new Error('tempo esgotado')))
    req.on('error', () => ok(0))
    req.end(corpo)
  })
}

/** Manda a TODOS os aparelhos inscritos. 404 e 410 são "essa inscrição morreu": ela sai da lista. */
export async function enviar(titulo, corpo) {
  const msg = JSON.stringify({ titulo, corpo })
  const r = { enviados: 0, removidos: 0, falhas: 0 }
  for (const ins of inscricoes()) {
    let status = 0
    try { status = await postar(ins, cifrar(msg, ins.keys)) } catch { /* chave que não é um ponto P-256 de verdade: conta como falha */ }
    if (status >= 200 && status < 300) r.enviados++
    else if (status === 404 || status === 410) { remover(ins.endpoint); r.removidos++ }
    else r.falhas++
  }
  return r
}
