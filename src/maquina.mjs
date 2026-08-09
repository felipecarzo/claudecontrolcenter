// Sensores da máquina para os módulos do topo: CPU, memória e GPU.
//
// A primeira versão perguntava tudo ao WMI por PowerShell e levava 10s — só
// `Win32_PerfFormattedData_PerfOS_Processor` custava 3,2s. Medindo peça por
// peça ficou claro que quase nada disso era necessário:
//
//   CPU e RAM  → `os.cpus()` e `os.totalmem()`, do próprio Node: 3ms, e de
//                quebra funcionam em qualquer sistema
//   GPU        → `nvidia-smi`, 590ms, o único processo externo
//   temperatura de CPU/RAM → não existe no Windows sem LibreHardwareMonitor
//
// Uso de CPU não é um número que se lê: é a diferença entre duas amostras dos
// contadores acumulados. Guardar a amostra anterior é o que torna isso barato.

import os from 'node:os'
import { lerGpu, lerSensoresExtras } from './platform.mjs'

const VALIDADE_MS = 2000

let anterior = null
let cache = { em: 0, dados: null }
let emVoo = null
let extras = { em: 0, dados: null }

const somaTempos = () => {
  const total = {}
  for (const c of os.cpus()) {
    for (const [k, v] of Object.entries(c.times)) total[k] = (total[k] || 0) + v
  }
  return total
}

/**
 * Percentual de CPU desde a última chamada. A primeira devolve `null` em vez
 * de zero: sem amostra anterior não há uso a calcular, e mostrar 0% seria
 * afirmar que a máquina está parada.
 */
function usoCpu() {
  const agora = somaTempos()
  const antes = anterior
  anterior = agora
  if (!antes) return null
  const total = Object.keys(agora).reduce((s, k) => s + (agora[k] - (antes[k] || 0)), 0)
  if (total <= 0) return null
  const ocioso = agora.idle - (antes.idle || 0)
  return Math.max(0, Math.min(100, Math.round(100 * (1 - ocioso / total))))
}

function cpu() {
  const lista = os.cpus()
  return {
    nome: (lista[0]?.model || '').replace(/\s+/g, ' ').trim(),
    nucleos: lista.length,
    uso: usoCpu(),
    temp: null, // preenchido adiante, se houver quem publique sensor
  }
}

function ram() {
  const total = os.totalmem()
  const usada = total - os.freemem()
  return {
    totalGB: +(total / 2 ** 30).toFixed(1),
    usadaGB: +(usada / 2 ** 30).toFixed(1),
    uso: total ? Math.round((100 * usada) / total) : null,
    temp: null,
  }
}

/**
 * Sensores que só existem com LibreHardwareMonitor aberto.
 *
 * Custa caro de um jeito específico: a consulta passa por PowerShell e, medida,
 * segura o event loop por ~1,1s — ao contrário do `nvidia-smi`, que roda em
 * 765ms sem travar nada. Num servidor isso congela o stream dos agentes junto.
 *
 * Por isso a regra é dura: tenta UMA vez na vida do processo. Deu vazio, não
 * tenta mais — quem não tem o programa aberto não vai ter na próxima. Se o
 * Felipe instalar depois, reiniciar o painel é o que faz aparecer.
 *
 * E a tentativa nunca segura a resposta: a primeira leitura sai sem
 * temperatura, e a seguinte já vem com ela se houver.
 */
let tentouExtras = false
function sensoresExtras() {
  if (tentouExtras) return extras.dados || {}
  tentouExtras = true
  // Adiada: a travada de ~1s é inevitável, então que aconteça longe da
  // primeira carga do painel, quando ninguém está olhando a tela abrir.
  const t = setTimeout(() => {
    lerSensoresExtras()
      .then((d) => { extras = { em: Date.now(), dados: d || {} } })
      .catch(() => { extras = { em: Date.now(), dados: {} } })
  }, 8000)
  t.unref?.() // não segura o processo vivo por causa disto
  return {}
}

export async function estado({ force = false } = {}) {
  if (!force && cache.dados && Date.now() - cache.em < VALIDADE_MS) return cache.dados
  if (emVoo) return emVoo

  emVoo = (async () => {
    // Sem amostra anterior não há uso a calcular, e o módulo de CPU sumiria da
    // primeira tela. Uma espera curta aqui resolve, e só acontece uma vez.
    if (!anterior) {
      anterior = somaTempos()
      await new Promise((r) => setTimeout(r, 120))
    }
    const gpu = await lerGpu()
    const extra = sensoresExtras()
    const dados = { cpu: cpu(), ram: ram(), gpu, em: Date.now() }
    if (extra?.cpuTemp != null) dados.cpu.temp = extra.cpuTemp
    if (extra?.ramTemp != null) dados.ram.temp = extra.ramTemp
    if (extra?.fonte) dados.sensores = extra.fonte
    cache = { em: Date.now(), dados }
    emVoo = null
    return dados
  })()
  return emVoo
}

export const _internals = { usoCpu, ram, resetar: () => { anterior = null; cache = { em: 0, dados: null } } }
