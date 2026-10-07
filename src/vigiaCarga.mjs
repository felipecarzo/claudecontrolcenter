// CC-857: o painel vigia a carga da máquina e alivia sozinho quando ela passa do limite.
//
// Medido em 01/10: com 6 sessões do Claude, agentes do `opencode` e Chrome sem tela, a VPS
// chegou a 98% de CPU (carga 17 em 6 núcleos) e o painel, que é um processo só, respondia
// tarde e parecia cair. Hook do Claude Code só roda quando a sessão faz algo; quem enxerga a
// máquina o tempo todo é o painel.
//
// A regra, escrita aqui para ter um lugar só:
//  - a cada 10 s lê a carga de 1 minuto (`os.loadavg()[0]`);
//  - acima de 2x os núcleos por 6 leituras seguidas (1 minuto) ENTRA em sobrecarga: baixa a
//    prioridade do Chrome sem tela e do opencode (prioridade 10) e passa a SEGURAR agente novo
//    (a rota devolve "tente em instantes", e a tela mostra o aviso);
//  - abaixo de 1,5x por 6 leituras seguidas SAI e solta o disparo. Faixa entre 1,5x e 2x não
//    muda nada (histerese): sem ela o estado piscaria ligando e desligando.
//
// O que NÃO desfaz ao sair: a prioridade baixa. Baixar o número (voltar à normal) exige
// root, que o painel não tem; processo que já cedeu a vez continua cedendo, o que é inofensivo.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const FATOR_ENTRA = 2
export const FATOR_SAI = 1.5
export const LEITURAS = 6 // 6 leituras de 10 s = 1 minuto
export const INTERVALO_MS = 10_000
export const PRIORIDADE = 10
const ALVOS = /chrome|chromium|opencode/i

const casa = () => process.env.CC_HOME || path.join(os.homedir(), '.local', 'share', 'agent-cockpit')
export const ARQUIVO_LOG = () => path.join(casa(), 'vigia-carga.jsonl')

/** O estado que o painel guarda entre uma leitura e outra. */
export const estadoInicial = () => ({ segurando: false, desde: null, acima: 0, abaixo: 0, carga: null, nucleos: null })

/**
 * Função pura: dado o estado e uma leitura, o próximo estado e o que mudou.
 * `mudou` é 'entrou', 'saiu' ou null: é o que dispara as ações e o registro.
 */
export function proximoEstado(est, carga, nucleos, agora = Date.now()) {
  const e = { ...est, carga, nucleos }
  e.acima = carga > FATOR_ENTRA * nucleos ? est.acima + 1 : 0
  e.abaixo = carga < FATOR_SAI * nucleos ? est.abaixo + 1 : 0
  let mudou = null
  if (!est.segurando && e.acima >= LEITURAS) { e.segurando = true; e.desde = agora; e.abaixo = 0; mudou = 'entrou' }
  else if (est.segurando && e.abaixo >= LEITURAS) { e.segurando = false; e.desde = null; e.acima = 0; mudou = 'saiu' }
  return { estado: e, mudou }
}

/** Processos do usuário que valem baixar: Chrome sem tela e opencode, ainda na prioridade normal. */
export function alvosDePrioridade(linhas) {
  return String(linhas).split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 3)
    .map(([pid, ni, ...cmd]) => ({ pid: Number(pid), ni: Number(ni), comando: cmd.join(' ') }))
    .filter((p) => Number.isFinite(p.pid) && p.ni < PRIORIDADE && ALVOS.test(p.comando))
}

function psDoUsuario() {
  return new Promise((resolve) => {
    execFile('ps', ['-u', String(process.getuid?.() ?? ''), '-o', 'pid=,ni=,comm='], { timeout: 5000 }, (e, out) => resolve(e ? '' : out))
  })
}

/** Registro de cada mudança, com a carga que a causou: sem isso a ação parece acaso. */
function registrar(linha) {
  try {
    fs.mkdirSync(path.dirname(ARQUIVO_LOG()), { recursive: true })
    fs.appendFileSync(ARQUIVO_LOG(), JSON.stringify(linha) + '\n')
  } catch { /* o registro nunca derruba o vigia */ }
}

let ESTADO = estadoInicial()
export const estaSegurando = () => ESTADO.segurando
export const retrato = () => ({ ...ESTADO, limiteEntra: FATOR_ENTRA * (ESTADO.nucleos || 0), limiteSai: FATOR_SAI * (ESTADO.nucleos || 0) })
export const _reiniciar = () => { ESTADO = estadoInicial() }

/**
 * Uma leitura. Tudo que toca o mundo entra por parâmetro para o teste usar de mentira:
 * `carga`, `nucleos`, `ps` (texto do ps), `baixar` (pid, prioridade) e `agora`.
 */
export async function tick({
  carga = os.loadavg()[0], nucleos = os.cpus().length, agora = Date.now(),
  ps = psDoUsuario, baixar = (pid, p) => os.setPriority(pid, p),
} = {}) {
  const { estado, mudou } = proximoEstado(ESTADO, carga, nucleos, agora)
  ESTADO = estado
  if (mudou === 'entrou') {
    let baixou = 0
    for (const a of alvosDePrioridade(await ps())) {
      try { baixar(a.pid, PRIORIDADE); baixou += 1 } catch { /* já saiu, ou sem permissão */ }
    }
    registrar({ quando: new Date(agora).toISOString(), evento: 'entrou', carga: Number(carga.toFixed(2)), nucleos, baixouPrioridade: baixou })
  } else if (mudou === 'saiu') {
    registrar({ quando: new Date(agora).toISOString(), evento: 'saiu', carga: Number(carga.toFixed(2)), nucleos })
  }
  return { mudou, estado: retrato() }
}

/** O texto que a rota devolve quando segura um disparo: diz a causa e o que fazer. */
export const motivoDeSegurar = () => `a VPS está sobrecarregada (carga ${ESTADO.carga?.toFixed(1)} em ${ESTADO.nucleos} núcleos); o agente novo espera. Tente de novo em instantes`

/** Liga o vigia: uma leitura a cada 10 s, sem segurar o processo vivo à toa. */
export function iniciar() {
  const t = setInterval(() => { tick().catch(() => {}) }, INTERVALO_MS)
  t.unref?.()
  return t
}
