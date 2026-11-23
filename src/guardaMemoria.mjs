// CC-1130: o painel avisa quando a memória disponível do PC cai abaixo de um piso.
//
// Pedido dele em 23/11: "queria que tivesse um limite, que sempre ficasse sobrando um
// pouquinho de memória para não dar esses travamentos no meio do meu trabalho". Decisão
// dele: o cockpit SÓ AVISA. Não pausa, não fecha e não muda prioridade de processo nenhum.
//
// Medido em 23/11 neste PC (31,7 GB): 4,8 GB disponíveis, memória comprometida em 91% do
// limite e 260 páginas por segundo, que é o Windows usando o disco no lugar da memória.
// Quem segura é o Chrome do medialab (~5 GB em 55 processos de navegador de automação) e as
// sessões do Claude; os projetos Automate, Dark Channels e Cuboverso pesam pouco por si.
//
// A regra, escrita aqui para ter um lugar só:
//  - a cada 10 s lê `os.freemem()` (barato, sem processo externo);
//  - ao cair abaixo do piso (`memoriaPisoGB`, padrão 4), DISPARA: lê quem pesa (PowerShell
//    no Windows, `ps` nos outros, uma vez só), monta o aviso e grava o registro;
//  - rearma só depois de subir 1 GB acima do piso, e nunca avisa de novo em menos de 15 min.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ehWindows, lerMemoriaDosProcessos } from './platform.mjs'
import { readConfig } from './config.mjs'
import * as registroProjetos from './projetoRegistro.mjs'

export const PISO_PADRAO_GB = 4
export const RECARGA_GB = 1
export const SILENCIO_MS = 15 * 60_000
export const INTERVALO_MS = 10_000
const GB = 2 ** 30
const PAGINANDO = 100 // páginas por segundo a partir das quais o sistema está usando o disco no lugar da memória

// mesma casa do vigia de carga: CC_HOME isola o teste, senão o abrigo fora da pasta de config
const casa = () => process.env.CC_HOME || path.join(os.homedir(), '.local', 'share', 'agent-cockpit')
export const ARQUIVO_REGISTRO = () => path.join(casa(), 'memoria-queda.jsonl')

/** O piso em GB. A variável de ambiente existe para a instância de teste forçar o aviso. */
export function pisoGB(cfg = readConfig()) {
  const env = Number(process.env.CC_MEMORIA_PISO_GB)
  if (env > 0) return env
  const c = Number(cfg.memoriaPisoGB)
  return c > 0 ? c : PISO_PADRAO_GB
}

export const estadoInicial = () => ({ armado: true, ultimoEm: null })

/** Função pura: o próximo estado e se esta leitura DISPARA o aviso. */
export function proximoEstado(est, disponivelGB, piso, agora = Date.now()) {
  const e = { ...est }
  if (!e.armado && disponivelGB >= piso + RECARGA_GB) e.armado = true
  const dispara = e.armado && disponivelGB < piso && (e.ultimoEm == null || agora - e.ultimoEm >= SILENCIO_MS)
  if (dispara) { e.armado = false; e.ultimoEm = agora }
  return { estado: e, dispara }
}

/* ---------------------------- quem pesa ---------------------------- */

const PROGRAMAS = [
  [/^(chrome|chromium)/i, 'Chrome'], [/^msedge/i, 'Edge'], [/^firefox/i, 'Firefox'],
  [/^claude/i, 'sessões do Claude'], [/^(node|bun)$/i, 'Node'], [/^ffmpeg/i, 'ffmpeg'],
]
// projetos que ele citou; o resto vem do registro de projetos
const PROJETOS_CITADOS = { medialab: 'medialab', darkchannel: 'Dark Channels', darkchanel: 'Dark Channels', automate: 'automate', cuboverso: 'cuboverso' }
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Mapa nome normalizado -> nome de exibição, só com nomes de 5+ letras (curto demais casa com tudo). */
export function nomesDeProjetos() {
  const mapa = { ...PROJETOS_CITADOS }
  try { for (const p of registroProjetos.listar()) { for (const n of [p.id, p.nome]) if (norm(n).length >= 5) mapa[norm(n)] = p.nome || p.id } } catch { /* sem registro */ }
  return mapa
}

export function projetoDe(cmd, mapa) {
  const c = norm(cmd)
  if (!c) return null
  const achou = Object.keys(mapa).sort((a, b) => b.length - a.length).find((k) => c.includes(k))
  return achou ? mapa[achou] : null
}

/** Agrupa por programa e marca o projeto dono quando a linha de comando traz o nome dele. Ordem: mais RAM primeiro. */
export function agrupar(processos, mapa = nomesDeProjetos()) {
  const grupos = new Map()
  for (const p of processos || []) {
    const nome = (PROGRAMAS.find(([re]) => re.test(p.nome)) || [null, p.nome])[1]
    const g = grupos.get(nome) || { nome, processos: 0, ramB: 0, comprometidaB: 0, projetos: {} }
    g.processos += 1; g.ramB += p.ramB || 0; g.comprometidaB += p.comprometidaB || 0
    const dono = projetoDe(p.cmd, mapa)
    if (dono) g.projetos[dono] = (g.projetos[dono] || 0) + (p.ramB || 0)
    grupos.set(nome, g)
  }
  return [...grupos.values()].sort((a, b) => b.ramB - a.ramB)
}

/* ------------------------------ o aviso ---------------------------- */

const num = (x) => String(+(+x).toFixed(1)).replace('.', ',')
const gb = (b) => num(b / GB)

/** O texto no formato da regra 10: de onde vem (o que foi medido), o que pesa, o que ele pode fazer. */
export function montarAviso({ disponivelGB, totalGB, pisoGB: piso, grupos = [], comprometidaGB = null, limiteGB = null, paginasPorSeg = null, leituraFalhou = false }) {
  const so = ehWindows ? 'O Windows' : 'O sistema'
  const partes = [`A memória disponível caiu para ${num(disponivelGB)} GB (de ${num(totalGB)} GB), abaixo do piso de ${num(piso)} GB.`]
  const topo = grupos.filter((g) => g.ramB >= 0.2 * GB).slice(0, 4)
  if (leituraFalhou || !topo.length) partes.push('Não consegui ler quem está usando a memória desta vez.')
  else {
    partes.push('Quem mais pesa: ' + topo.map((g) => {
      const donos = Object.entries(g.projetos).filter(([, b]) => b >= 0.3 * GB).sort((a, b) => b[1] - a[1]).slice(0, 2)
        .map(([n, b]) => `${gb(b)} GB do ${n}`)
      return `${g.nome} ${gb(g.ramB)} GB (${g.processos} ${g.processos === 1 ? 'processo' : 'processos'}${donos.length ? ', dos quais ' + donos.join(' e ') : ''})`
    }).join(', ') + '.')
  }
  if (comprometidaGB != null && limiteGB) partes.push(`A memória comprometida (a que os programas já reservaram) está em ${num(comprometidaGB)} de ${num(limiteGB)} GB, ${Math.round(100 * comprometidaGB / limiteGB)}% do limite.`)
  if (paginasPorSeg != null) {
    partes.push(paginasPorSeg >= PAGINANDO
      ? `${so} está usando o disco no lugar da memória (${Math.round(paginasPorSeg)} páginas por segundo), e é isso que trava o PC.`
      : `${so} ainda não está usando o disco no lugar da memória (${Math.round(paginasPorSeg)} páginas por segundo), mas com tão pouca folga ele passa a usar, e é isso que trava o PC.`)
  }
  const acoes = []
  const nomes = topo.map((g) => g.nome)
  const nav = nomes.find((n) => ['Chrome', 'Edge', 'Firefox'].includes(n))
  if (nav) acoes.push(`fechar abas do ${nav}`)
  if (nomes.includes('sessões do Claude')) acoes.push('encerrar sessões do Claude paradas')
  if (!acoes.length) acoes.push('fechar o que você não está usando')
  partes.push(`Você pode ${acoes.join(' ou ')}.`)
  return partes.join(' ')
}

/** Uma linha do registro por acréscimo, para cruzar com a hora de uma travada depois. */
export function linhaDoRegistro({ agora, disponivelGB, totalGB, pisoGB: piso, grupos = [], comprometidaGB = null, limiteGB = null, paginasPorSeg = null, leituraFalhou = false }) {
  return {
    quando: new Date(agora).toISOString(), disponivelGB: +disponivelGB.toFixed(2), totalGB: +totalGB.toFixed(1), pisoGB: piso,
    comprometidaGB, limiteGB, paginasPorSeg, leituraFalhou,
    grupos: grupos.slice(0, 8).map((g) => ({ nome: g.nome, processos: g.processos, ramGB: +(g.ramB / GB).toFixed(2), comprometidaGB: +(g.comprometidaB / GB).toFixed(2), projetos: Object.fromEntries(Object.entries(g.projetos).map(([n, b]) => [n, +(b / GB).toFixed(2)])) })),
  }
}

function gravarLinha(linha) {
  try {
    fs.mkdirSync(path.dirname(ARQUIVO_REGISTRO()), { recursive: true })
    fs.appendFileSync(ARQUIVO_REGISTRO(), JSON.stringify(linha) + '\n')
  } catch { /* o registro nunca derruba o guarda */ }
}

/* ------------------------------ o guarda --------------------------- */

let ESTADO = estadoInicial()
let AVISO = null
export const _reiniciar = () => { ESTADO = estadoInicial(); AVISO = null }

/** Retrato para a tela. Lê a memória na hora (barato), para o número nunca ficar velho. */
export function retrato({ livreB = os.freemem(), totalB = os.totalmem(), piso = pisoGB() } = {}) {
  const d = livreB / GB
  return { disponivelGB: +d.toFixed(1), totalGB: +(totalB / GB).toFixed(1), pisoGB: piso, abaixo: d < piso, perto: d < piso + RECARGA_GB, aviso: AVISO }
}

/**
 * Uma leitura. Tudo que toca o mundo entra por parâmetro para o teste usar de mentira:
 * `livreB`, `totalB`, `piso`, `agora`, `ler` (lista de processos) e `registrar`.
 */
export async function tick({
  livreB = os.freemem(), totalB = os.totalmem(), piso = pisoGB(), agora = Date.now(),
  ler = lerMemoriaDosProcessos, registrar = gravarLinha, mapa = null,
} = {}) {
  const disponivelGB = livreB / GB
  const totalGB = totalB / GB
  const { estado, dispara } = proximoEstado(ESTADO, disponivelGB, piso, agora)
  ESTADO = estado // antes do await: uma segunda leitura não dispara de novo
  if (estado.armado) AVISO = null // subiu 1 GB acima do piso: o aviso sai da tela
  if (!dispara) return { dispara: false, aviso: AVISO }

  let leitura = null
  try { leitura = await ler() } catch { /* ainda avisa, sem a lista */ }
  const dados = {
    disponivelGB, totalGB, pisoGB: piso, leituraFalhou: !leitura,
    grupos: leitura ? agrupar(leitura.processos, mapa || nomesDeProjetos()) : [],
    comprometidaGB: leitura?.comprometidaGB ?? null, limiteGB: leitura?.limiteGB ?? null, paginasPorSeg: leitura?.paginasPorSeg ?? null,
  }
  AVISO = { quando: agora, texto: montarAviso(dados), disponivelGB: +disponivelGB.toFixed(1), totalGB: +totalGB.toFixed(1), pisoGB: piso }
  registrar(linhaDoRegistro({ agora, ...dados }))
  return { dispara: true, aviso: AVISO }
}

/** Liga o guarda: uma leitura a cada 10 s, sem segurar o processo vivo à toa. */
export function iniciar() {
  const t = setInterval(() => { tick().catch(() => {}) }, INTERVALO_MS)
  t.unref?.()
  setTimeout(() => { tick().catch(() => {}) }, 2000).unref?.() // sem esperar 10 s para a primeira leitura
  return t
}
