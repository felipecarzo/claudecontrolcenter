// CC-932: avisos de queda no celular. Web Push padrão (RFC 8291 + VAPID) e o vigia.
// Tudo em pasta temporária e com um servidor de push de mentira local: nenhum serviço de push de
// verdade é chamado, e nenhuma chave nem inscrição real é tocada.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'push-'))
process.env.COCKPIT_PUSH_DIR = path.join(casa, 'push')
process.env.COCKPIT_AUDITORIA = path.join(casa, 'auditoria.jsonl')
process.env.COCKPIT_PUSH_INSEGURO = '1' // só aqui: o servidor de mentira é http local
process.env.COCKPIT_PUSH_SUB = 'mailto:dono@exemplo.org'
const P = await import('./tools/porta-entrada/push.mjs')
const V = await import('./tools/porta-entrada/vigia.mjs')
const A = await import('./tools/auditoria/auditoria.mjs')

let n = 0
const t = async (nome, fn) => { await fn(); n += 1; console.log('  ok  ' + nome) }
const d64 = (s) => Buffer.from(s, 'base64url')
const hkdf = (ikm, sal, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, sal, info, len))

/** Decifra como o navegador faria (RFC 8291, seção 4), escrito à parte para não conferir o código com ele mesmo. */
function decifrar(corpo, uaPrivB64, uaPubB64, authB64) {
  const salt = corpo.subarray(0, 16); const idlen = corpo[20]
  const asPub = corpo.subarray(21, 21 + idlen); const cifra = corpo.subarray(21 + idlen)
  const ecdh = crypto.createECDH('prime256v1'); ecdh.setPrivateKey(d64(uaPrivB64))
  const ikm = hkdf(ecdh.computeSecret(asPub), d64(authB64), Buffer.concat([Buffer.from('WebPush: info\0'), d64(uaPubB64), asPub]), 32)
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12)
  const dec = crypto.createDecipheriv('aes-128-gcm', cek, nonce)
  dec.setAuthTag(cifra.subarray(cifra.length - 16))
  const claro = Buffer.concat([dec.update(cifra.subarray(0, cifra.length - 16)), dec.final()])
  assert.equal(claro[claro.length - 1], 2, 'o último registro termina com o delimitador 0x02')
  return claro.subarray(0, claro.length - 1).toString()
}

try {
  await t('RFC 8291, apêndice A: o corpo cifrado sai idêntico ao vetor da norma', () => {
    const uaPub = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
    const auth = 'BTBZMqHH6r4Tts7J_aSIgg'
    const corpo = P.cifrar('When I grow up, I want to be a watermelon', { p256dh: uaPub, auth }, {
      efemera: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', salt: d64('DGv6ra1nlYgDCS1FRnbzlw'),
    })
    // o cabeçalho de 86 octetos e o texto cifrado, como impressos no apêndice A (cada um codificado à parte)
    const cabecalho = d64('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8')
    const cifrado = d64('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ')
    assert.equal(cabecalho.length, 86)
    assert.equal(corpo.toString('hex'), Buffer.concat([cabecalho, cifrado]).toString('hex'))
    // e o decifrador independente lê de volta o texto da norma
    assert.equal(decifrar(corpo, 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94', uaPub, auth), 'When I grow up, I want to be a watermelon')
  })

  await t('as chaves VAPID nascem uma vez, com permissão 0600, e a pública é um ponto P-256 de 65 bytes', () => {
    const pub = P.chavePublica()
    assert.equal(d64(pub).length, 65); assert.equal(d64(pub)[0], 4)
    assert.equal(P.chavePublica(), pub, 'a segunda chamada devolve a mesma')
    const arq = path.join(process.env.COCKPIT_PUSH_DIR, 'vapid.json')
    assert.equal(fs.statSync(arq).mode & 0o777, 0o600); assert.equal(fs.statSync(process.env.COCKPIT_PUSH_DIR).mode & 0o777, 0o700)
  })

  await t('a assinatura VAPID: ES256, aud é a origem do endpoint, exp de 12 h, sub do dono, e confere com a chave pública', () => {
    const agora = Date.UTC(2026, 9, 7, 12)
    const jwt = P.assinarVapid('https://push.exemplo.org/v2/abc/def?x=1', { agora })
    const [h, c, s] = jwt.split('.')
    assert.deepEqual(JSON.parse(d64(h)), { typ: 'JWT', alg: 'ES256' })
    assert.deepEqual(JSON.parse(d64(c)), { aud: 'https://push.exemplo.org', exp: agora / 1000 + 12 * 3600, sub: 'mailto:dono@exemplo.org' })
    const pub = d64(P.chavePublica())
    const chave = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' })
    assert.ok(crypto.verify('sha256', Buffer.from(h + '.' + c), { key: chave, dsaEncoding: 'ieee-p1363' }, d64(s)), 'a assinatura vale')
  })

  // ── um serviço de push de mentira: confere cabeçalhos, decifra, e responde o que o teste mandar ──
  const recebidos = []; let responder = 201
  const servico = http.createServer((req, res) => {
    const partes = []
    req.on('data', (c) => partes.push(c))
    req.on('end', () => { recebidos.push({ url: req.url, headers: req.headers, corpo: Buffer.concat(partes) }); res.writeHead(responder); res.end() })
  })
  await new Promise((r) => servico.listen(0, '127.0.0.1', r))
  const origem = `http://127.0.0.1:${servico.address().port}`
  const aparelho = (id) => {
    const e = crypto.createECDH('prime256v1'); e.generateKeys()
    return { priv: e.getPrivateKey().toString('base64url'), pub: e.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url'), endpoint: `${origem}/push/${id}` }
  }
  const a1 = aparelho('um'); const a2 = aparelho('dois')
  const sub = (a) => ({ endpoint: a.endpoint, keys: { p256dh: a.pub, auth: a.auth } })

  try {
    await t('inscrever guarda (sem duplicar o mesmo aparelho) e recusa o que não é uma inscrição', () => {
      assert.equal(P.inscrever(sub(a1)), 1); assert.equal(P.inscrever(sub(a1)), 1, 'o mesmo endereço não duplica')
      assert.equal(P.inscrever(sub(a2)), 2)
      assert.equal(P.inscricoes().length, 2)
      assert.equal(fs.statSync(path.join(process.env.COCKPIT_PUSH_DIR, 'inscricoes.json')).mode & 0o777, 0o600)
      assert.throws(() => P.inscrever({}), /sem endereço/)
      assert.throws(() => P.inscrever({ endpoint: origem + '/x', keys: { p256dh: 'curta', auth: 'x' } }), /sem as chaves/)
      process.env.COCKPIT_PUSH_INSEGURO = '0'
      assert.throws(() => P.inscrever(sub(a1)), /https público/, 'sem o modo de teste, só https público')
      assert.throws(() => P.inscrever({ ...sub(a1), endpoint: 'https://127.0.0.1/x' }), /https público/)
      process.env.COCKPIT_PUSH_INSEGURO = '1'
    })

    await t('enviar: Authorization vapid, Content-Encoding aes128gcm, e o corpo decifra com a chave do aparelho', async () => {
      const r = await P.enviar('fora do ar: painel', 'toque para abrir o painel')
      assert.deepEqual(r, { enviados: 2, removidos: 0, falhas: 0 })
      assert.equal(recebidos.length, 2)
      for (const [i, a] of [a1, a2].entries()) {
        const q = recebidos.find((x) => x.url === '/push/' + (i ? 'dois' : 'um'))
        assert.equal(q.headers['content-encoding'], 'aes128gcm')
        assert.match(q.headers.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/)
        assert.ok(q.headers.authorization.endsWith('k=' + P.chavePublica()))
        assert.ok(Number(q.headers.ttl) > 0)
        const jwt = q.headers.authorization.match(/t=([\w.-]+),/)[1]
        assert.equal(JSON.parse(d64(jwt.split('.')[1])).aud, origem)
        assert.deepEqual(JSON.parse(decifrar(q.corpo, a.priv, a.pub, a.auth)), { titulo: 'fora do ar: painel', corpo: 'toque para abrir o painel' })
      }
    })

    await t('410 e 404 do serviço removem a inscrição; erro de servidor só conta como falha e mantém', async () => {
      recebidos.length = 0
      responder = 410
      assert.deepEqual(await P.enviar('x', 'y'), { enviados: 0, removidos: 2, falhas: 0 })
      assert.equal(P.inscricoes().length, 0)
      P.inscrever(sub(a1)); responder = 404
      assert.deepEqual(await P.enviar('x', 'y'), { enviados: 0, removidos: 1, falhas: 0 })
      P.inscrever(sub(a1)); responder = 503
      assert.deepEqual(await P.enviar('x', 'y'), { enviados: 0, removidos: 0, falhas: 1 })
      assert.equal(P.inscricoes().length, 1, 'o 503 é do serviço, não da inscrição')
      responder = 201
    })
  } finally { servico.close() }

  await t('o vigia: duas falhas seguidas avisam uma vez, a terceira não repete, a volta avisa "voltou"', async () => {
    const avisos = []; const no = { painel: true, site: true }
    const v = V.criarVigia({
      alvos: () => [{ nome: 'painel', url: 'x' }, { nome: 'site', url: 'y' }],
      medir: async (a) => no[a.nome],
      avisar: async (titulo, corpo) => { avisos.push(titulo); return { enviados: 1 } },
      registrar: A.registrar,
    })
    await v.passo(); assert.deepEqual(avisos, [], 'tudo no ar: nada a dizer')
    no.painel = false
    await v.passo(); assert.deepEqual(avisos, [], 'uma falha só: pode ser um reinício rápido')
    await v.passo(); assert.deepEqual(avisos, ['fora do ar: painel'], 'a segunda falha seguida avisa')
    await v.passo(); await v.passo(); assert.deepEqual(avisos, ['fora do ar: painel'], 'não repete antes de voltar')
    no.painel = true
    await v.passo(); assert.deepEqual(avisos, ['fora do ar: painel', 'voltou: painel'])
    await v.passo(); assert.equal(avisos.length, 2, 'voltou uma vez só')
    // falha intercalada com sucesso zera a conta: não é "duas seguidas"
    no.site = false; await v.passo(); no.site = true; await v.passo(); no.site = false; await v.passo()
    assert.equal(avisos.length, 2)
    // e uma medição que lança conta como falha, sem derrubar o vigia
    const v2 = V.criarVigia({ alvos: () => [{ nome: 'z', url: 'z' }], medir: async () => { throw new Error('boom') }, avisar: async (ti) => { avisos.push(ti); return { enviados: 0 } }, registrar: A.registrar })
    await v2.passo(); await v2.passo(); assert.equal(avisos.at(-1), 'fora do ar: z')
  })

  await t('cada aviso do vigia vira uma linha "alerta" na auditoria, também quando o push falha', async () => {
    const v = V.criarVigia({ alvos: () => [{ nome: 'loja', url: 'l' }], medir: async () => false, avisar: async () => { throw new Error('sem rede') }, registrar: A.registrar })
    await v.passo(); await v.passo()
    const L = A.ler({ ultimos: 50 }).filter((l) => l.acao === 'alerta')
    assert.ok(L.some((l) => l.alvo === 'painel' && l.ok === false && l.quem === 'vigia' && /fora do ar: painel/.test(l.detalhe)))
    assert.ok(L.some((l) => l.alvo === 'painel' && l.ok === true && /voltou: painel/.test(l.detalhe)))
    assert.ok(L.some((l) => l.alvo === 'loja' && /push falhou: sem rede/.test(l.detalhe)), 'push que falha não impede o registro')
  })

  await t('a lista de sites: só quem tem endereço público; arquivo que não existe cai no próximo', () => {
    const arq = path.join(casa, 'alvos.json')
    fs.writeFileSync(arq, JSON.stringify([{ id: 'a', nome: 'Site A', url: 'https://a.exemplo.org/' }, { id: 'b', nome: 'Sem url', url: null }, { id: 'c' }]))
    assert.deepEqual(V.lerSites([path.join(casa, 'nao-existe.json'), arq]), [{ nome: 'Site A', url: 'https://a.exemplo.org/' }])
    const reais = V.lerSites()
    assert.ok(Array.isArray(reais) && reais.every((s) => s.nome && /^https?:/.test(s.url)), 'a lista do repositório lê')
  })

  await t('medirUrl: abaixo de 500 é no ar, 500 ou conexão recusada é fora', async () => {
    let status = 200
    const s = http.createServer((q, r) => { r.writeHead(status); r.end() })
    await new Promise((r) => s.listen(0, '127.0.0.1', r))
    const url = `http://127.0.0.1:${s.address().port}/`
    try {
      assert.equal(await V.medirUrl(url), true); status = 401; assert.equal(await V.medirUrl(url), true); status = 302; assert.equal(await V.medirUrl(url), true)
      status = 502; assert.equal(await V.medirUrl(url), false)
    } finally { await new Promise((r) => s.close(r)) }
    assert.equal(await V.medirUrl(url), false, 'porta fechada')
  })

  await t('o vigia é o único temporizador e nenhum arquivo do push guarda chave privada em texto de código', () => {
    for (const f of ['push.mjs', 'vigia.mjs']) assert.ok(!/BEGIN (EC )?PRIVATE KEY/.test(fs.readFileSync(path.join('tools/porta-entrada', f), 'utf8')))
    assert.ok(!/setInterval|setTimeout/.test(fs.readFileSync('tools/porta-entrada/push.mjs', 'utf8')), 'push.mjs não tem temporizador')
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`${n} verificações do push e do vigia, todas passaram`)
process.exit(0)
