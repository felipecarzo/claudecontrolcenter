// Painéis de acompanhamento: telas que mostram os agentes trabalhando, aqui e
// na VPS. O Control Center sabe se cada um está no ar, sabe subir e sabe
// derrubar — e a aba "escritório" embute a tela.
//
// Por que isso não fere a VISAO ("não cria, não mata, não pausa job"): painel
// não é job. É servidor local, a mesma categoria que a aba de servidores já
// encerra hoje. O que continua proibido é mexer no agente em si.

import fs from 'node:fs'
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
 * ## CC-60 encerrado em 16/08: fica só o fork
 *
 * Existiam três Pixel Agents nesta VPS — o oficial do npm na 3101, um do
 * usuário `agente` na 3100, e o fork do Felipe em `app_escritorio`. A decisão
 * dele:
 *
 * > "eu só quero ficar com o plugin que é um fork meu no projeto app_escritorio,
 * > e eu tô fazendo ele pra mesclar todos os meus agentes, da vps ou locais, pra
 * > funcionar no cockpit"
 *
 * Os dois que saíram, e por quê:
 *
 * - **o oficial do npm (3101)**: mesmo programa, sem as sete melhorias do fork.
 *   Manter os dois é manter duas telas que discordam.
 * - **o túnel SSH para a 3100**: apontava para a instância do usuário `agente`,
 *   que nunca foi possível inspecionar (o `/home/agente/` recusa leitura). E o
 *   túnel só fazia sentido rodando FORA da VPS — dentro dela era a máquina se
 *   conectando a si mesma com a chave do Felipe.
 *
 * **A federação substituiu o túnel.** Ver os agentes do PC de dentro da VPS não
 * exige mais rede: cada máquina empurra o pacote e o `/api/escritorio` entrega a
 * lista já unida, com a origem carimbada em cada agente.
 */
const PADRAO = [
  {
    id: 'escritorio',
    // O nome real entra em `readPaineis`: "meu PC" mentia rodando na VPS.
    nome: 'escritório',
    detalhe: 'os agentes de todas as máquinas, pelo fork em app_escritorio',
    porta: 3101,
    cmd: 'pixel-agents',
    args: ['--host', '127.0.0.1', '--port', '3101'],
    // no Windows o binário do npm é um .cmd: sem shell, o spawn não acha
    shell: ehWindows,
    // onde o fork mora, para `resolverBinario` achar o dist dele antes do
    // pacote global — é o fork que tem as melhorias, não o upstream
    fork: path.join('app_escritorio', 'app', 'dist', 'cli.js'),
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

/**
 * Onde o binário do painel realmente está.
 *
 * Medido em 14/08: o botão "ligar" respondia `ok` e nada subia. O serviço
 * systemd não herda o PATH do shell, então `spawn('pixel-agents')` não achava
 * o binário instalado em `~/.npm-global/bin`, e `stdio: 'ignore'` engolia o
 * erro. Falhar calado é pior que não ter o botão: parece que funcionou.
 *
 * Procura nos lugares conhecidos do npm e devolve o comando original quando não
 * acha, para a mensagem de erro continuar dizendo o nome que a pessoa espera.
 */
export function resolverBinario(cmd, { fork = null } = {}) {
  /* O fork VENCE o pacote global, e a ordem é a decisão.
     Os dois se chamam `pixel-agents` e servem a mesma porta; o do npm é o
     upstream sem as sete melhorias do Sprint 1. Se o global viesse primeiro, o
     Felipe subiria a versão errada pelo botão e não teria como notar — as duas
     desenham a mesma sala. */
  if (fork) {
    for (const base of basesDeProjetos()) {
      const alvo = path.join(base, fork)
      try { if (fs.existsSync(alvo)) return alvo } catch { /* segue */ }
    }
  }

  // `cmd` vem de config.json, editável à mão: entrada velha ou incompleta
  // (achado em 18/08: `{id:'local'}` sem `cmd` nenhum, sobra de uma versão
  // anterior deste arquivo) não pode derrubar quem só queria saber "existe
  // este painel?" — path.join com undefined lança, e essa pergunta roda a
  // cada 2s dentro do snapshot.
  if (!cmd || typeof cmd !== 'string') return null

  const candidatos = [
    path.join(os.homedir(), '.npm-global', 'bin', cmd),
    path.join(os.homedir(), '.local', 'bin', cmd),
    `/usr/local/bin/${cmd}`,
    `/usr/bin/${cmd}`,
  ]
  for (const c of candidatos) {
    try { if (fs.existsSync(c)) return c } catch { /* segue */ }
  }
  return cmd
}

/**
 * Onde as pastas de projeto podem estar, sem fixar caminho de máquina.
 *
 * A regra do projeto é que nenhum caminho de máquina entre no código: a pasta é
 * descoberta, e `CC_PROJECTS_BASE` força quando preciso. Aqui a descoberta é
 * barata — o painel roda de dentro de um projeto, então o irmão dele é o
 * candidato natural.
 */
function basesDeProjetos() {
  const bases = []
  if (process.env.CC_PROJECTS_BASE) bases.push(process.env.CC_PROJECTS_BASE)
  bases.push(path.join(process.cwd(), '..'))
  bases.push(path.join(os.homedir(), 'projetos'))
  return [...new Set(bases)]
}

/**
 * A porta de um painel, sem varrer nada.
 *
 * O proxy do escritório precisa disto a cada requisição do iframe (dezenas por
 * carga), e `readPaineis()` chama `readServers()`, que leva segundos. Aqui só
 * se lê a declaração, que é o que a rota precisa saber para onde encaminhar.
 */
export function portaDe(id) {
  return definicoes().find((p) => p.id === id)?.porta || null
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
      // Caminho relativo, servido pelo próprio cockpit (rota `/painel/:id`).
      // Era `http://localhost:PORTA`, e `localhost` é a máquina de quem OLHA:
      // no PC dava certo por acaso, no celular o navegador procurava a porta no
      // próprio telefone. Relativo funciona nos dois, e passa pela senha do
      // `cockpit-auth` junto com o resto do painel.
      url: `/painel/${p.id}/`,
      urlLocal: `http://localhost:${p.porta}`,
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
  const filho = spawn(resolverBinario(def.cmd, { fork: def.fork }), def.args, {
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
