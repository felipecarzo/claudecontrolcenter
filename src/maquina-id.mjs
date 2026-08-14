/**
 * Identidade desta máquina, para o painel federado.
 *
 * Sem isto nada mais da federação faz sentido: não há como carimbar de onde
 * veio cada agente, e o filtro "só este desktop" não teria em que se apoiar.
 *
 * Duas decisões que valem explicar, porque a alternativa óbvia é pior:
 *
 *   - **O id não é o hostname.** `vps.mjs` já registra por que hostname não
 *     serve como identidade: ele muda, repete e mente. O id é sorteado uma vez
 *     e guardado no `control-center.json`; o hostname vira apenas o palpite de
 *     NOME, que o Felipe pode trocar na tela.
 *   - **O id é por máquina, não por instância.** Duas instâncias do painel na
 *     mesma máquina (o daemon na 5180 e um teste na 8130) são a mesma origem.
 *     Por isso ele mora no config, que é único por `~/.claude`.
 */
import crypto from 'node:crypto'
import os from 'node:os'
import { readConfig, setMaquina } from './config.mjs'

/** Nome inicial, só um palpite: hostname limpo, ou algo legível se ele falhar. */
export function nomePalpite() {
  const bruto = (os.hostname() || '').split('.')[0].trim()
  return bruto || `maquina-${os.platform()}`
}

/**
 * A identidade desta máquina, criando na primeira chamada.
 *
 * Grava só quando falta algo: este módulo é chamado no caminho do snapshot, a
 * cada 2 segundos, e reescrever o config nesse ritmo seria I/O à toa.
 */
export function maquina(cfg = readConfig()) {
  const atual = cfg.maquina
  if (atual?.id && atual?.nome) return atual
  const nova = {
    id: atual?.id || crypto.randomUUID().slice(0, 8),
    nome: atual?.nome || nomePalpite(),
  }
  setMaquina(nova)
  return nova
}

/** Carimbo enxuto para acompanhar cada registro que sai desta máquina. */
export function origem(cfg = readConfig()) {
  const m = maquina(cfg)
  return { id: m.id, nome: m.nome }
}
