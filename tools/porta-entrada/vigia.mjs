/**
 * CC-932: o vigia de quedas. Mora na porta de entrada (serviço sempre no ar), nunca no painel:
 * se o painel cai, quem avisa é quem continua de pé.
 *
 * A cada 60 s mede o painel e os sites com endereço público (só GET, 10 s de limite, status
 * abaixo de 500 é "no ar"). Duas falhas seguidas do mesmo alvo mandam "fora do ar: <nome>"; a
 * volta manda "voltou: <nome>". Nunca repete o aviso de queda antes de o alvo voltar.
 * Toda mensagem vira uma linha "alerta" na auditoria. COCKPIT_VIGIA=off desliga.
 *
 * É o ÚNICO temporizador permitido neste projeto. A queda da VPS inteira não é daqui: quem
 * avisa isso é um monitor externo.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const INTERVALO_MS = 60_000
export const FALHAS_PARA_AVISAR = 2

/** GET com 10 s de limite; qualquer resposta abaixo de 500 conta como no ar. Redirecionamento não é seguido. */
export async function medirUrl(url) {
  try {
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
    return r.status < 500
  } catch { return false }
}

/**
 * A lista de sites: COCKPIT_VIGIA_ALVOS, ou ~/.cockpit-vigia-alvos.json (o instalador escreve a
 * partir da lista de deploy que só o administrador lê), ou a do repositório. Só entra quem tem url.
 */
export function lerSites(arquivos = [process.env.COCKPIT_VIGIA_ALVOS, path.join(os.homedir(), '.cockpit-vigia-alvos.json'), new URL('../deploy-seguro/alvos.json', import.meta.url).pathname]) {
  for (const f of arquivos.filter(Boolean)) {
    try {
      const l = JSON.parse(fs.readFileSync(f, 'utf8'))
      return l.filter((a) => /^https?:\/\//.test(a?.url || '')).map((a) => ({ nome: String(a.nome || a.id || a.url), url: a.url }))
    } catch { /* tenta a próxima */ }
  }
  return []
}

/**
 * O vigia, com tudo injetável: `alvos()` devolve [{ nome, url }], `medir(alvo)` devolve true/false,
 * `avisar(titulo, corpo)` manda o push e `registrar` grava na auditoria. `passo()` faz uma rodada.
 */
export function criarVigia({ alvos, medir = (a) => medirUrl(a.url), avisar, registrar, intervaloMs = INTERVALO_MS }) {
  const estado = new Map() // nome -> { falhas, caido }
  let timer = null
  async function dizer(titulo, ok, nome) {
    let detalhe = titulo
    try { const r = await avisar(titulo, 'toque para abrir o painel'); detalhe += ` (push: ${r.enviados} enviado(s))` } catch (e) { detalhe += ` (push falhou: ${e.message})` }
    registrar({ acao: 'alerta', quem: 'vigia', alvo: nome, ok, detalhe })
  }
  async function passo() {
    const lista = alvos()
    const medidos = await Promise.all(lista.map(async (a) => [a, await medir(a).catch(() => false)]))
    for (const [a, no] of medidos) {
      const e = estado.get(a.nome) || { falhas: 0, caido: false }
      estado.set(a.nome, e)
      if (no) {
        e.falhas = 0
        if (e.caido) { e.caido = false; await dizer(`voltou: ${a.nome}`, true, a.nome) }
      } else if (++e.falhas >= FALHAS_PARA_AVISAR && !e.caido) {
        e.caido = true
        await dizer(`fora do ar: ${a.nome}`, false, a.nome)
      }
    }
  }
  return {
    passo, estado,
    iniciar() { if (!timer) { timer = setInterval(() => passo().catch(() => {}), intervaloMs); timer.unref?.() } },
    parar() { clearInterval(timer); timer = null },
  }
}
