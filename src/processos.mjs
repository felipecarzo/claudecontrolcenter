// Top processos por CPU, RAM e VRAM — o "gerenciador de tarefas" de dentro
// do painel, pra achar rápido o que está pesando a máquina sem abrir outra
// janela. Só Windows: usa `Get-Process` (não WMI — mesma lição de
// `maquina.mjs`, WMI é caro) e `nvidia-smi` pra VRAM por processo.
//
// Sem OS suportado, `estado()` devolve `null` e a tela esconde o bloco —
// mesmo padrão de `docker.mjs` pra Docker não instalado.
//
// NUNCA em timer automático. Medido nesta máquina (596 processos): entre 19s
// e 29,3s pro `Get-Process` — varia de chamada pra chamada — e 7,6s até pro
// `tasklist` simples sem CPU nenhum. Bem acima do que cabe num poll de fundo.
// Por isso `estado()` só é chamado sob clique ou ao abrir a aba, igual a VPS:
// caro e raro, não barato e constante.

import os from 'node:os'
import { ehWindows, quietAsync } from './platform.mjs'

const VALIDADE_MS = 30000
let cache = { em: 0, dados: null }
let emVoo = null
let anterior = null // Map pid -> { cpuSeg, em } — amostra anterior, pro %CPU

// `CPU` do Get-Process é segundo-de-processador ACUMULADO desde que o
// processo começou, não percentual — precisa de duas amostras, igual o
// usoCpu() global. `-ErrorAction SilentlyContinue` porque processo do
// sistema sem permissão de leitura derrubaria a lista inteira sem isso.
const PS_PROCESSOS = `
$ErrorActionPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
Get-Process | Select-Object Id, ProcessName,
  @{n='Cpu';e={$_.CPU}}, @{n='Mem';e={$_.WorkingSet64}} | ConvertTo-Json -Compress
`

async function amostraProcessos() {
  // Medido nesta máquina: entre 19s e 29,3s pra 596 processos, variando de
  // chamada pra chamada. 30s já quase estourou uma vez — 45s dá margem real,
  // não só "parece suficiente".
  const r = await quietAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', PS_PROCESSOS], 45000)
  if (!r.ok) return null
  // `-ErrorAction`/`-WarningAction` não pegam TUDO que algum módulo do
  // Windows possa escrever no stdout antes do JSON — cortar até o primeiro
  // `[` é defesa contra isso. (O bug que de fato apareceu era outro: timeout
  // curto demais pra a variação real de 19-29s — ver acima.)
  const candidatos = [r.out.indexOf('['), r.out.indexOf('{')].filter((i) => i >= 0)
  if (!candidatos.length) return null
  try {
    const v = JSON.parse(r.out.slice(Math.min(...candidatos)))
    return Array.isArray(v) ? v : [v]
  } catch {
    return null
  }
}

/**
 * VRAM por processo. `nvidia-smi` não expõe percentual de USO de GPU por
 * processo em placa de consumo — só memória. Por isso o bloco de GPU aqui é
 * "quanto de vídeo cada um está segurando", não "quanto está processando".
 */
async function amostraVram() {
  const r = await quietAsync('nvidia-smi',
    ['--query-compute-apps=pid,used_memory', '--format=csv,noheader,nounits'], 8000)
  if (!r.ok) return new Map()
  const mapa = new Map()
  for (const linha of r.out.split('\n')) {
    const [pid, mem] = linha.split(',').map((s) => s.trim())
    const id = Number(pid)
    if (Number.isFinite(id)) mapa.set(id, Number(mem) || 0)
  }
  return mapa
}

/**
 * Junta a amostra crua do PowerShell com o VRAM e a amostra ANTERIOR de CPU
 * (guardada por fora, em `anterior`) — função pura pra poder testar a conta
 * de %CPU sem depender de `Get-Process` de verdade.
 */
function montarDados(bruto, vram, antes, agora, { totalRamBytes, nucleos }) {
  const proximo = new Map()
  const lista = bruto.filter((p) => p.Id).map((p) => {
    proximo.set(p.Id, { cpuSeg: p.Cpu || 0, em: agora })
    const ant = antes?.get(p.Id)
    // sem amostra anterior (primeira leitura, ou processo novo) não dá pra saber %
    const cpuPct = ant && agora > ant.em
      ? Math.max(0, Math.min(100, (100 * ((p.Cpu || 0) - ant.cpuSeg) * 1000) / ((agora - ant.em) * nucleos)))
      : null
    return {
      pid: p.Id,
      nome: p.ProcessName || '?',
      cpuPct,
      ramMB: Math.round((p.Mem || 0) / 2 ** 20),
      vramMB: vram.get(p.Id) ?? null,
    }
  })

  return {
    proximo,
    dados: {
      em: agora,
      temAmostraCpu: Boolean(antes), // primeira leitura do processo: lista de CPU vem vazia de propósito
      porCpu: lista.filter((p) => p.cpuPct != null && p.cpuPct > 0).sort((a, b) => b.cpuPct - a.cpuPct).slice(0, 8),
      porRam: [...lista].sort((a, b) => b.ramMB - a.ramMB).slice(0, 8),
      porVram: lista.filter((p) => p.vramMB).sort((a, b) => b.vramMB - a.vramMB).slice(0, 8),
    },
  }
}

export async function estado({ force = false } = {}) {
  if (!ehWindows) return null
  if (!force && cache.dados && Date.now() - cache.em < VALIDADE_MS) return cache.dados
  if (emVoo) return emVoo

  emVoo = (async () => {
    const [bruto, vram] = await Promise.all([amostraProcessos(), amostraVram()])
    if (!bruto) { emVoo = null; return cache.dados } // leitura falhou: mantém a última boa

    const agora = Date.now()
    const { proximo, dados } = montarDados(bruto, vram, anterior, agora, {
      totalRamBytes: os.totalmem(), nucleos: os.cpus().length || 1,
    })
    anterior = proximo
    cache = { em: agora, dados }
    emVoo = null
    return dados
  })()
  return emVoo
}

export const _internals = {
  montarDados,
  resetar: () => { anterior = null; cache = { em: 0, dados: null } },
}
