// Quanto do plano já foi usado: janela de 5 horas e janela semanal.
//
// De onde vem: o Claude Code entrega `rate_limits` no JSON que manda para o
// comando de statusLine, a cada resposta. É o número OFICIAL da conta, o mesmo
// do `/usage` — não é estimativa por custo, como faz o ccusage, e não é gasto
// de API. Por isso não há chamada de rede aqui, nem leitura de credencial.
//
// O preço disso é que o valor só anda quando o Claude Code responde alguma
// coisa. Fora de uso, o painel mostra a última leitura com a hora dela.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const USO_FILE = path.join(os.homedir(), '.claude', 'control-center-uso.json')

const janela = (j) => {
  if (!j || typeof j !== 'object') return null
  const pct = Number(j.used_percentage)
  if (!Number.isFinite(pct)) return null
  const reset = Number(j.resets_at)
  return {
    pct: Math.max(0, Math.min(100, pct)),
    // resets_at vem em segundos epoch; guardar em ms evita confusão na tela
    resetaEm: Number.isFinite(reset) && reset > 0 ? reset * 1000 : null,
  }
}

export function readUso() {
  try {
    const u = JSON.parse(fs.readFileSync(USO_FILE, 'utf8'))
    return u && typeof u === 'object' ? u : null
  } catch {
    return null
  }
}

/**
 * Grava o que veio do statusLine. Devolve `null` quando não há nada de útil —
 * `rate_limits` só aparece para quem é assinante, e só depois da primeira
 * resposta da sessão.
 */
export function gravarUso(entrada) {
  const rl = entrada?.rate_limits
  if (!rl) return null
  // Estas são TODAS as janelas que o Claude Code reporta — conferido no bundle
  // do CLI. Não existe janela do Fable: ele consome da semanal, com teto de
  // 50% dela, e mais rápido que o Opus. Por isso não há como mostrar "quanto
  // resta de Fable" sem inventar.
  const dados = {
    cincoHoras: janela(rl.five_hour),
    semana: janela(rl.seven_day),
    semanaOpus: janela(rl.seven_day_opus),
    semanaSonnet: janela(rl.seven_day_sonnet),
    em: Date.now(),
  }
  if (!dados.cincoHoras && !dados.semana) return null

  // Só grava quando algum número mudou: o statusLine roda a cada render, e
  // reescrever o arquivo a cada tecla seria I/O à toa.
  const antes = readUso()
  const chave = (d) => JSON.stringify([d.cincoHoras, d.semana, d.semanaOpus, d.semanaSonnet])
  if (antes && chave(antes) === chave(dados)) return antes

  try {
    const tmp = `${USO_FILE}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(dados))
    fs.renameSync(tmp, USO_FILE)
  } catch {
    // statusLine não pode falhar por causa disso
  }
  return dados
}
