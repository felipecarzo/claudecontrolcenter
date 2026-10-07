/**
 * APIs de IA no Coderoom: as pagas dele e as gratuitas (pedido de 01/10).
 *
 * > "eu queria colocar pra poder botar API (…) qualquer API de IA dentro do
 * > Coderoom, pra caso eu queira usar alguma IA paga (…) e uma lista de APIs
 * > gratuitas"
 *
 * Escolha dele: os dois caminhos. Uma chave cadastrada aqui serve a:
 *   1. o agente "API" do Coderoom, que fala DIRETO com o provedor (rápido, sem
 *      os 5 s de partida do opencode, sem o travamento depois de erro);
 *   2. o opencode, que recebe a mesma chave como variável de ambiente e passa
 *      a oferecer os modelos daquele provedor, para quando o trabalho é editar.
 *
 * Medido antes de desenhar (01/10): o opencode leva 5 s para ligar, a fila
 * gratuita dele recusou com "Rate limit exceeded", e depois do erro ele não
 * termina. A demora que ele sentia era isso, não SSH (não há SSH no caminho).
 *
 * Todos os provedores do catálogo falam o formato "chat/completions" (o padrão
 * que quase todo provedor aceita hoje). Por isso um caminho só serve a todos.
 *
 * ⚠️ A chave é segredo dele. Fica num arquivo só dele (modo 600), a tela só vê
 * os 4 últimos caracteres, e nada aqui escreve a chave em log ou resposta.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/* `gratis`: tem camada gratuita de verdade (com limite). `env`: a variável que
   o opencode lê para aquele provedor. Os limites gratuitos mudam com frequência,
   então a tela manda conferir na página de cada um, sem prometer número. */
export const CATALOGO = [
  { id: 'groq', nome: 'Groq', base: 'https://api.groq.com/openai/v1', gratis: true, env: 'GROQ_API_KEY', chave: 'https://console.groq.com/keys', nota: 'a mais rápida; modelos abertos (Llama, Qwen, GPT-OSS)' },
  { id: 'gemini', nome: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', gratis: true, env: 'GOOGLE_GENERATIVE_AI_API_KEY', chave: 'https://aistudio.google.com/apikey', nota: 'camada grátis do AI Studio, com limite por minuto e por dia' },
  { id: 'openrouter', nome: 'OpenRouter', base: 'https://openrouter.ai/api/v1', gratis: true, env: 'OPENROUTER_API_KEY', chave: 'https://openrouter.ai/settings/keys', nota: 'dezenas de modelos; os marcados ":free" não cobram, com cota diária' },
  { id: 'cerebras', nome: 'Cerebras', base: 'https://api.cerebras.ai/v1', gratis: true, env: 'CEREBRAS_API_KEY', chave: 'https://cloud.cerebras.ai', nota: 'muito rápida; camada grátis com limite diário' },
  { id: 'mistral', nome: 'Mistral', base: 'https://api.mistral.ai/v1', gratis: true, env: 'MISTRAL_API_KEY', chave: 'https://console.mistral.ai/api-keys', nota: 'US$ 10 de crédito por mês; usa os textos para treinar, a menos que você desligue' },
  /* 01/10, "instala todos": os gratuitos que funcionam a partir do Brasil. `fixos` é
     a lista de reserva quando o provedor não publica /models. */
  { id: 'zai', nome: 'Z.ai (GLM, China)', base: 'https://api.z.ai/api/paas/v4', gratis: true, env: 'ZHIPU_API_KEY', chave: 'https://z.ai/manage-apikey/apikey-list', nota: 'GLM Flash grátis para sempre, 1 pedido por vez; o portal internacional pede só e-mail', fixos: ['glm-4.7-flash', 'glm-4.5-flash', 'glm-4.6v-flash'] },
  { id: 'nvidia', nome: 'NVIDIA NIM', base: 'https://integrate.api.nvidia.com/v1', gratis: true, env: 'NVIDIA_API_KEY', chave: 'https://build.nvidia.com/settings/api-keys', nota: 'mais de 100 modelos abertos (DeepSeek, Qwen, Llama, Kimi); 40 pedidos/min' },
  { id: 'qwen', nome: 'Alibaba Qwen', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', gratis: true, env: 'DASHSCOPE_API_KEY', chave: 'https://modelstudio.console.alibabacloud.com/?tab=playground#/api-key', nota: '1 milhão de tokens por modelo por 90 dias, só na região Singapura; ligue "só cota grátis" no painel' },
  { id: 'huggingface', nome: 'Hugging Face', base: 'https://router.huggingface.co/v1', gratis: true, env: 'HF_TOKEN', chave: 'https://huggingface.co/settings/tokens', nota: 'milhares de modelos, mas só US$ 0,10 de crédito por mês' },
  { id: 'cohere', nome: 'Cohere', base: 'https://api.cohere.ai/compatibility/v1', gratis: true, env: 'COHERE_API_KEY', chave: 'https://dashboard.cohere.com/api-keys', nota: '1.000 chamadas por mês, só uso não comercial', fixos: ['command-a-03-2025', 'command-r-plus-08-2024'] },
  { id: 'moonshot', nome: 'Kimi (Moonshot, China)', base: 'https://api.moonshot.ai/v1', gratis: false, env: 'MOONSHOT_API_KEY', chave: 'https://platform.moonshot.ai/console/api-keys', nota: 'crédito de cadastro incerto; depois é pago' },
  { id: 'openai', nome: 'OpenAI', base: 'https://api.openai.com/v1', gratis: false, env: 'OPENAI_API_KEY', chave: 'https://platform.openai.com/api-keys', nota: 'paga' },
  { id: 'anthropic', nome: 'Anthropic (Claude)', base: 'https://api.anthropic.com/v1', gratis: false, env: 'ANTHROPIC_API_KEY', chave: 'https://console.anthropic.com/settings/keys', nota: 'paga; à parte da assinatura do Claude Code' },
  { id: 'deepseek', nome: 'DeepSeek', base: 'https://api.deepseek.com/v1', gratis: false, env: 'DEEPSEEK_API_KEY', chave: 'https://platform.deepseek.com/api_keys', nota: '5 milhões de tokens grátis no cadastro, por 30 dias; depois paga, barata' },
]

const casa = () => process.env.CC_HOME || path.join(os.homedir(), '.local', 'share', 'agent-cockpit')
export const ARQUIVO = () => path.join(casa(), 'apis-ia.json')

function ler() {
  try { return JSON.parse(fs.readFileSync(ARQUIVO(), 'utf8')) } catch { return { chaves: {} } }
}
function gravar(d) {
  fs.mkdirSync(path.dirname(ARQUIVO()), { recursive: true })
  const tmp = ARQUIVO() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, ARQUIVO())
  try { fs.chmodSync(ARQUIVO(), 0o600) } catch { /* sistema sem chmod */ }
}

export const provedor = (id) => CATALOGO.find((p) => p.id === id) || null
const final = (k) => (k ? '…' + String(k).slice(-4) : null)

/** A lista para a tela: nunca a chave, só se existe e os 4 últimos caracteres. */
export function listar() {
  const { chaves = {} } = ler()
  return CATALOGO.map((p) => ({ ...p, temChave: Boolean(chaves[p.id]), chaveFim: final(chaves[p.id]) }))
}

export function salvarChave(id, chave) {
  if (!provedor(id)) throw new Error('provedor desconhecido')
  const k = String(chave || '').trim()
  if (k.length < 8 || /\s/.test(k)) throw new Error('isso não parece uma chave de API')
  const d = ler(); d.chaves = { ...(d.chaves || {}), [id]: k }; gravar(d)
  return { ok: true, chaveFim: final(k) }
}
export function removerChave(id) {
  const d = ler(); if (d.chaves) delete d.chaves[id]; gravar(d)
  return { ok: true }
}
const chaveDe = (id) => (ler().chaves || {})[id] || null

/** As chaves cadastradas, nas variáveis que o opencode lê. */
export function envParaOpencode() {
  const { chaves = {} } = ler(); const env = {}
  for (const p of CATALOGO) if (chaves[p.id]) env[p.env] = chaves[p.id]
  return env
}

async function pedir(id, rota, corpo, { sinal } = {}) {
  const p = provedor(id); const k = chaveDe(id)
  if (!p) throw new Error('provedor desconhecido')
  if (!k) throw new Error(`sem chave cadastrada para ${p.nome}`)
  /* `CC_IA_BASE_<ID>` troca o endereço: é como o teste fala com um provedor de
     mentira, e serve também para quem usa um proxy compatível. */
  const base = process.env['CC_IA_BASE_' + id.toUpperCase()] || p.base
  return fetch(base + rota, {
    method: corpo ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json', ...(id === 'anthropic' ? { 'x-api-key': k, 'anthropic-version': '2023-06-01' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: sinal || AbortSignal.timeout(20000),
  })
}
/* O erro do provedor, sem nunca ecoar o que foi mandado (a chave vai no cabeçalho). */
async function erroDe(r) {
  let t = ''; try { t = (await r.text()).slice(0, 300) } catch { /* sem corpo */ }
  const msg = (() => { try { const j = JSON.parse(t); return j.error?.message || j.message || t } catch { return t } })()
  return new Error(r.status === 401 || r.status === 403 ? 'a chave foi recusada pelo provedor' : r.status === 429 ? 'o provedor recusou por excesso de pedidos (limite de uso); tente daqui a pouco' : `o provedor respondeu ${r.status}: ${String(msg).slice(0, 160)}`)
}

/** Os modelos do provedor. No OpenRouter, marca os gratuitos. */
export async function modelos(id) {
  const r = await pedir(id, '/models')
  // provedor que não publica a lista: a chave passou (não foi 401/403), vale a lista de reserva
  if (!r.ok && provedor(id)?.fixos && ![401, 403].includes(r.status)) return provedor(id).fixos.map((m) => ({ id: m, gratis: null }))
  if (!r.ok) throw await erroDe(r)
  const j = await r.json()
  return (j.data || j.models || []).map((m) => {
    const mid = String(m.id || m.name || '').replace(/^models\//, '')
    const gratis = id === 'openrouter' ? (/:free$/.test(mid) || (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)) : null
    return { id: mid, gratis }
  }).filter((m) => m.id)
}

/** Confere a chave: lista os modelos e mede o tempo. */
/* Medido em 01/10: NVIDIA e Hugging Face entregam a lista de modelos sem olhar a
   chave (200 com chave falsa). Para esses, o teste faz também uma conversa de 1
   token, que recusa chave errada com 401. */
const LISTA_PUBLICA = new Set(['nvidia', 'huggingface'])
export async function testar(id) {
  const t0 = Date.now()
  try {
    const ms = await modelos(id)
    if (LISTA_PUBLICA.has(id) && ms[0]) {
      const r = await pedir(id, '/chat/completions', { model: ms[0].id, messages: [{ role: 'user', content: 'oi' }], max_tokens: 1 })
      if (r.status === 401 || r.status === 403) throw await erroDe(r)
    }
    return { ok: true, modelos: ms.length, gratis: ms.filter((m) => m.gratis).length, ms: Date.now() - t0 }
  } catch (e) { return { ok: false, erro: e.message, ms: Date.now() - t0 } }
}

/**
 * Conversa em fluxo: chama `aoPedaco(texto)` a cada pedaço e devolve o total.
 * `modelo` vem como "provedor/modelo" (ex.: "groq/llama-3.3-70b-versatile").
 */
export async function conversar({ modelo, mensagens, aoPedaco = () => {}, tempoMax = 180000 }) {
  const i = String(modelo || '').indexOf('/')
  if (i < 1) throw new Error('modelo sem provedor: use "provedor/modelo"')
  const id = modelo.slice(0, i); const nome = modelo.slice(i + 1)
  const r = await pedir(id, '/chat/completions', { model: nome, messages: mensagens, stream: true }, { sinal: AbortSignal.timeout(tempoMax) })
  if (!r.ok) throw await erroDe(r)
  let total = ''; let uso = null; let resto = ''
  const dec = new TextDecoder()
  for await (const pedaco of r.body) {
    resto += dec.decode(pedaco, { stream: true })
    const linhas = resto.split('\n'); resto = linhas.pop()
    for (const l of linhas) {
      const s = l.trim(); if (!s.startsWith('data:')) continue
      const dado = s.slice(5).trim(); if (dado === '[DONE]') continue
      let j; try { j = JSON.parse(dado) } catch { continue }
      if (j.error) throw new Error(`o provedor interrompeu: ${String(j.error.message || j.error).slice(0, 160)}`)
      const t = j.choices?.[0]?.delta?.content
      if (t) { total += t; aoPedaco(t) }
      if (j.usage) uso = j.usage
    }
  }
  return { texto: total, uso }
}
