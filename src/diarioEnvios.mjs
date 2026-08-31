/**
 * CC-446 — o diário dos envios para a outra máquina.
 *
 * ## O pedido original dele, que ficou o dia inteiro sem resposta
 *
 * Primeira mensagem de 30/08: *"preciso que esse standalone me diga como tá a
 * conexão e os arquivos que tão passando pela conexão, tipo um log mesmo"*.
 *
 * Medido na hora: **não existia histórico nenhum.** `ultimoEmpurrao`, em
 * `src/web.mjs`, é uma variável em memória com UM registro, e ela some quando o
 * processo reinicia. A bandeja lê dela para escolher entre os quatro estados do
 * ícone, e é tudo o que havia.
 *
 * ## Por que em disco, e não em memória
 *
 * O painel reinicia: no logon, ao publicar versão nova, e sempre que ele clica
 * em reiniciar. Um log que morre em cada um desses momentos não responde
 * *"funcionou enquanto eu estava fora?"*, que é a pergunta dele.
 *
 * ## O abrigo, e ele não é opcional
 *
 * `~/.claude` é SOMENTE LEITURA dentro do sandbox da VPS, e escrita nova ali
 * falha com `EROFS` sem avisar ninguém. Já custou dois recursos que pareciam
 * funcionar e não gravavam nada. Então: tenta a casa, cai para
 * `~/.local/share/agent-cockpit/`, e quem lê junta os dois lugares.
 *
 * ## O teto, e por que 200
 *
 * Um envio a cada 30 segundos são 120 por hora. 200 cobre menos de duas horas,
 * o suficiente para "o que aconteceu agora", que é a pergunta que um log de
 * conexão responde. Histórico longo é outra coisa, e o custo dele seria um
 * arquivo crescendo para sempre num caminho que ninguém olha.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

export const TETO = 200
const NOME = 'control-center-envios.json'

/** Os dois lugares possíveis, na ordem em que se tenta escrever. O segundo é o
 *  abrigo de quando o primeiro é somente leitura. */
export function caminhos() {
  const casa = path.join(casaClaude(), NOME)
  const abrigo = process.env.CC_HOME
    ? path.join(process.env.CC_HOME, 'abrigo', NOME)
    : path.join(process.env.HOME || process.env.USERPROFILE || '.', '.local', 'share', 'agent-cockpit', NOME)
  return { casa, abrigo }
}

const lerArquivo = (arq) => {
  try {
    const v = JSON.parse(fs.readFileSync(arq, 'utf8'))
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

/**
 * Os envios guardados, do mais novo para o mais velho.
 *
 * Junta os DOIS lugares porque a máquina pode ter escrito em um e depois no
 * outro (o sandbox trancou no meio, ou a variável de casa mudou). Ler só um
 * faria metade do histórico sumir sem explicação.
 */
export function ler() {
  const { casa, abrigo } = caminhos()
  const juntos = [...lerArquivo(casa), ...lerArquivo(abrigo)]
  const vistos = new Set()
  return juntos
    .filter((e) => e && typeof e === 'object' && Number.isFinite(e.em))
    .filter((e) => { const k = `${e.em}|${e.ok}`; if (vistos.has(k)) return false; vistos.add(k); return true })
    .sort((a, b) => b.em - a.em)
    .slice(0, TETO)
}

/**
 * Guarda um envio. Nunca lança: isto roda dentro do ciclo de 30 segundos, e uma
 * exceção aqui mataria o empurrão seguinte junto.
 *
 * Devolve onde gravou, ou `null` quando não deu em lugar nenhum. Quem chama
 * pode ignorar; quem quiser avisar em voz alta tem o dado.
 */
export function registrar(envio) {
  const linha = {
    em: Number(envio?.em) || Date.now(),
    ok: Boolean(envio?.ok),
    erro: envio?.erro ? String(envio.erro).slice(0, 200) : null,
    para: envio?.para ? String(envio.para).slice(0, 120) : null,
    jobs: Number(envio?.jobs) || 0,
    /* O que ia DENTRO: é a metade da pergunta dele ("os arquivos que tão
       passando"). Sem isto o log responde "chegou" e não responde "com o quê". */
    projetos: Number(envio?.projetos) || 0,
    frentes: Number(envio?.frentes) || 0,
    comTempo: Boolean(envio?.comTempo),
    bytes: Number(envio?.bytes) || 0,
  }

  const { casa, abrigo } = caminhos()
  for (const alvo of [casa, abrigo]) {
    try {
      fs.mkdirSync(path.dirname(alvo), { recursive: true })
      const lista = [linha, ...lerArquivo(alvo)].slice(0, TETO)
      const tmp = `${alvo}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(lista))
      fs.renameSync(tmp, alvo)
      return { ok: true, onde: alvo }
    } catch { /* próximo lugar */ }
  }
  return null
}

/**
 * O retrato para a tela: como está a conexão, agora.
 *
 * `estado` é a mesma leitura que a bandeja faz pelo carimbo do último envio, e
 * de propósito: duas contas para "está no ar?" divergiriam, e este painel já
 * pagou por isso mais de uma vez.
 */
export function situacao({ agora = Date.now() } = {}) {
  const envios = ler()
  const ultimo = envios[0] || null
  const idadeMs = ultimo ? agora - ultimo.em : null

  let estado = 'nunca'
  if (ultimo) {
    if (!ultimo.ok) estado = 'falhou'
    else if (idadeMs < 45_000) estado = 'no ar'
    else if (idadeMs < 90_000) estado = 'atrasou'
    else estado = 'parou'
  }

  /* A taxa da última hora responde "isto está instável?", que o último envio
     sozinho não responde: uma falha isolada entre 120 acertos é rede, e 40
     falhas em 120 é problema. */
  const umaHora = envios.filter((e) => agora - e.em < 3_600_000)
  return {
    estado,
    ultimo,
    idadeMs,
    naUltimaHora: umaHora.length,
    falhasNaUltimaHora: umaHora.filter((e) => !e.ok).length,
    envios,
  }
}
