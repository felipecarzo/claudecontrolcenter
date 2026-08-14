// Painéis de acompanhamento: telas que mostram os agentes trabalhando, aqui e
// na VPS. O Control Center sabe se cada um está no ar, sabe subir e sabe
// derrubar — e a aba "escritório" embute a tela.
//
// Por que isso não fere a VISAO ("não cria, não mata, não pausa job"): painel
// não é job. É servidor local, a mesma categoria que a aba de servidores já
// encerra hoje. O que continua proibido é mexer no agente em si.

import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { readServers } from './servers.mjs'
import { matarProcesso, ehWindows } from './platform.mjs'
import { readConfig } from './config.mjs'
import { origem } from './maquina-id.mjs'

const CHAVE_VPS = path.join(os.homedir(), '.ssh', 'id_ed25519_ahtleta')

/**
 * Os painéis conhecidos. `porta` é a identidade: é por ela que se descobre se
 * está no ar e qual processo derrubar.
 *
 * O da VPS não roda aqui — é um túnel SSH. O Pixel Agents de lá escuta só em
 * 127.0.0.1 dentro da VPS, de propósito; o túnel liga esta porta na de lá.
 * Quando `agentes.carzo.com.br` tiver DNS e certificado, este painel vira só
 * um link e o túnel deixa de ser necessário.
 */
const PADRAO = [
  {
    id: 'local',
    // O nome real entra em `readPaineis`: "meu PC" mentia rodando na VPS.
    nome: 'esta máquina',
    detalhe: 'sessões do Claude Code desta máquina',
    porta: 3101,
    cmd: 'pixel-agents',
    args: ['--host', '127.0.0.1', '--port', '3101'],
    // no Windows o binário do npm é um .cmd: sem shell, o spawn não acha
    shell: ehWindows,
  },
  {
    id: 'vps',
    nome: 'VPS',
    detalhe: 'o agente do Telegram, via túnel SSH',
    porta: 3100,
    cmd: 'ssh',
    args: [
      '-N', '-L', '3100:127.0.0.1:3100',
      '-i', CHAVE_VPS,
      '-o', 'StrictHostKeyChecking=accept-new',
      // sem isto a conexão morre calada depois de um tempo parada, e a tela
      // congela sem explicação nenhuma
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      'root@66.94.117.215',
    ],
    shell: false,
  },
]

/**
 * Permite trocar porta/host sem mexer no código: `paineis` no config.json.
 *
 * O painel `vps` só existe quando o Control Center roda FORA da VPS: ele é um
 * túnel SSH para lá. Rodando dentro dela, o túnel seria a máquina se conectando
 * a si mesma com a chave do Felipe, e o Pixel Agents local já mostra os mesmos
 * agentes. Medido em 14/08, quando a aba escritório aparecia vazia na VPS: o
 * `pixel-agents` não estava instalado e o túnel apontava para um serviço que
 * não existe. A mesma variável que o resto do projeto usa para saber que está
 * na VPS decide isto (`CC_VPS_LOCAL`, ver `vps.mjs`).
 */
function definicoes() {
  const naVps = process.env.CC_VPS_LOCAL === '1'
  const base = naVps ? PADRAO.filter((p) => p.id !== 'vps') : PADRAO
  const custom = readConfig().paineis
  if (!Array.isArray(custom) || !custom.length) return base
  return custom
    .map((c) => ({ ...PADRAO.find((p) => p.id === c.id), ...c }))
    .filter((p) => !(naVps && p.id === 'vps'))
}

/** Acha o processo que está segurando a porta, se houver. */
function processoNaPorta(porta, { force = false } = {}) {
  return readServers({ force }).find((s) => s.ports.includes(porta)) || null
}

export function readPaineis({ force = false } = {}) {
  const eu = origem()
  return definicoes().map((p) => {
    const proc = processoNaPorta(p.porta, { force })
    return {
      id: p.id,
      // CC-47: o escritório é LOCAL de cada máquina, e a tela precisa dizer
      // isso. O Pixel Agents lê `~/.claude` da máquina onde roda; federar os
      // bonecos exigiria o app aceitar dado de fora, o que ele não faz.
      nome: p.id === 'local' ? eu.nome : p.nome,
      local: p.id === 'local',
      maquina: eu,
      detalhe: p.detalhe,
      porta: p.porta,
      noAr: Boolean(proc),
      pid: proc?.pid ?? null,
      desde: proc?.startedAt ?? null,
      url: `http://localhost:${p.porta}`,
      // o que a pessoa rodaria na mão, pra poder copiar quando algo der errado
      comando: [p.cmd, ...p.args].join(' '),
    }
  })
}

export function ligarPainel(id) {
  const def = definicoes().find((p) => p.id === id)
  if (!def) throw new Error(`painel desconhecido: ${id}`)

  const jaEsta = processoNaPorta(def.porta, { force: true })
  if (jaEsta) return { ...def, jaEstava: true, pid: jaEsta.pid }

  // Destacado e sem stdio: o painel precisa sobreviver ao fim deste processo,
  // senão morre junto com o Control Center — foi exatamente assim que o túnel
  // caiu na primeira tentativa.
  const filho = spawn(def.cmd, def.args, {
    detached: true,
    stdio: 'ignore',
    shell: def.shell,
    windowsHide: true,
  })
  filho.unref()

  // Sem pid no retorno de propósito: com `shell: true` o pid é o do cmd.exe
  // que embrulha o processo, não o do servidor que abre a porta — devolver
  // aquele número seria mentir. Quem quiser o pid real consulta a lista, que
  // o descobre pela porta.
  return { id: def.id, nome: def.nome, porta: def.porta, jaEstava: false }
}

/**
 * Derruba o painel.
 *
 * Não reusa `killServer` de propósito: o túnel é um processo `ssh`, que aquela
 * função classifica como "não é servidor de desenvolvimento" e recusa — com
 * razão, no contexto dela. Aqui a trava é outra e igualmente estreita: só morre
 * quem está segurando uma porta de painel declarada aqui. Nenhum pid arbitrário
 * atravessa.
 */
export function desligarPainel(id) {
  const def = definicoes().find((p) => p.id === id)
  if (!def) throw new Error(`painel desconhecido: ${id}`)

  const proc = processoNaPorta(def.porta, { force: true })
  if (!proc) return { id: def.id, jaEstava: false }
  if (proc.protegido) throw new Error(`${proc.name} é processo do sistema e não será encerrado`)

  matarProcesso(proc.pid)
  return { id: def.id, jaEstava: true, pid: proc.pid, nome: proc.name }
}

export const _internals = { PADRAO, definicoes }
