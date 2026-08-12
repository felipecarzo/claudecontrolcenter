// Liga/desliga o reporte. Fica fora do repo, em ~/.claude, porque vale pra
// todos os projetos da máquina.
//
// A checagem mora aqui e não no agente de propósito: quando está desligado,
// `cc.mjs set` vira no-op silencioso. Assim um projeto com a instrução antiga
// no CLAUDE.md não quebra nem escreve sem querer.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { projectOf } from './jobs.mjs'

export const CONFIG_FILE = path.join(os.homedir(), '.claude', 'control-center.json')

const DEFAULTS = {
  enabled: true, disabledProjects: [], taxaHora: 0, taxaPorProjeto: {}, cambio: {},
  assinaturaMes: 0, graficos: null, mercado: {}, sessoes: {}, servidores: {},
  pip: { blocos: ['uso', 'agentes'], layout: 'quadrado' },
  vps: { host: '', usuario: 'root', chave: '' },
  vpsSnapshot: null,
  calendarios: [],
}

export const PIP_BLOCOS = ['uso', 'agentes', 'maquina', 'servidores', 'docker', 'processos']
export const PIP_LAYOUTS = ['quadrado', 'fita']

export function readConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeConfig(cfg) {
  const next = { ...DEFAULTS, ...cfg }
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = `${CONFIG_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2))
  fs.renameSync(tmp, CONFIG_FILE)
  return next
}

/** Sem projeto informado, responde só pelo interruptor global. */
export function isEnabled(cwd = process.cwd(), cfg = readConfig()) {
  if (!cfg.enabled) return false
  const { project } = projectOf(cwd)
  return !cfg.disabledProjects.includes(project)
}

export function setEnabled(on, { project = null } = {}) {
  const cfg = readConfig()
  if (!project) return writeConfig({ ...cfg, enabled: !!on })
  const set = new Set(cfg.disabledProjects)
  on ? set.delete(project) : set.add(project)
  return writeConfig({ ...cfg, disabledProjects: [...set].sort() })
}

/**
 * Taxa em R$/hora usada para dar preço ao tempo ativo: a do projeto quando
 * existe, senão a global. Zero é "não configurada" — a tela esconde a coluna
 * em vez de mostrar R$ 0,00, que pareceria trabalho de graça.
 */
export function taxaDe(projeto, cfg = readConfig()) {
  const doProjeto = Number(cfg.taxaPorProjeto?.[projeto])
  if (Number.isFinite(doProjeto) && doProjeto > 0) return doProjeto
  const global = Number(cfg.taxaHora)
  return Number.isFinite(global) && global > 0 ? global : 0
}

/** Zerar a taxa de um projeto o devolve para a global, em vez de gravar zero. */
export function setTaxa(valor, { projeto = null } = {}) {
  const cfg = readConfig()
  const v = Math.max(0, Number(valor) || 0)
  if (!projeto) return writeConfig({ ...cfg, taxaHora: v })
  const mapa = { ...cfg.taxaPorProjeto }
  if (v > 0) mapa[projeto] = v
  else delete mapa[projeto]
  return writeConfig({ ...cfg, taxaPorProjeto: mapa })
}

/**
 * Cotação do dólar. `manual: true` congela o valor digitado — cotação buscada
 * nunca sobrescreve escolha de quem está fechando preço. Valor zero destrava
 * a busca automática de novo.
 */
export function setCambio({ brlPorUsd, em, manual }) {
  const cfg = readConfig()
  const v = Math.max(0, Number(brlPorUsd) || 0)
  const cambio = v > 0
    ? { brlPorUsd: v, em: em || Date.now(), manual: !!manual }
    : {}
  writeConfig({ ...cfg, cambio })
  return cambio
}

/**
 * Os gráficos que o Felipe montou. `null` significa "nunca mexeu", e a tela
 * mostra os prontos — diferente de `[]`, que é "apaguei todos" e deve
 * continuar vazio. Sem essa distinção, apagar o último traria todos de volta.
 */
export function setGraficos(lista) {
  const cfg = readConfig()
  const limpa = Array.isArray(lista)
    ? lista.slice(0, 40).map((g) => ({
      id: String(g.id || '').slice(0, 40),
      nome: String(g.nome || '').slice(0, 80),
      forma: String(g.forma || '').slice(0, 20),
      dimensao: String(g.dimensao || '').slice(0, 20),
      serie: String(g.serie || 'nenhuma').slice(0, 20),
      medida: String(g.medida || '').slice(0, 20),
    }))
    : null
  writeConfig({ ...cfg, graficos: limpa })
  return limpa
}

/**
 * Faixas de mercado por senioridade. `manual: true` congela o que o Felipe
 * digitou — busca na web não sobrescreve escolha de quem vai cobrar.
 */
export function setMercado(m) {
  const cfg = readConfig()
  const faixa = (f) => ({ min: Math.max(0, Number(f?.min) || 0), max: Math.max(0, Number(f?.max) || 0) })
  const mercado = {
    junior: faixa(m.junior),
    pleno: faixa(m.pleno),
    senior: faixa(m.senior),
    fonte: String(m.fonte || '').slice(0, 60),
    em: Number(m.em) || Date.now(),
    manual: !!m.manual,
  }
  writeConfig({ ...cfg, mercado })
  return mercado
}

/**
 * Correção de nível e tempo digitado, por sessão. Fica aqui e não no meta.json
 * porque sessão não pertence a job nenhum — e o job some antes do transcript.
 * Ajuste vazio some do mapa, para o arquivo não crescer com lixo.
 */
export function setSessao(sessao, { nivel, horas }) {
  const cfg = readConfig()
  const sessoes = { ...cfg.sessoes }
  const id = String(sessao || '').slice(0, 64)
  if (!id) throw new Error('sessão obrigatória')
  const ajuste = {}
  if (['junior', 'pleno', 'senior'].includes(nivel)) ajuste.nivel = nivel
  if (Number(horas) > 0) ajuste.horas = Math.min(Number(horas), 1000)
  if (Object.keys(ajuste).length) sessoes[id] = ajuste
  else delete sessoes[id]
  writeConfig({ ...cfg, sessoes })
  return sessoes[id] || null
}

/**
 * O que o Felipe escreveu sobre um servidor: apelido, explicação de que raio
 * ele abre, e se é favorito. Guarda também de onde subir de novo (`cwd` +
 * `comando`) e quando foi visto pela última vez, que é o que alimenta os
 * "recentes".
 *
 * A chave vem de `chaveServidor()` em `servers.mjs`: caminho do projeto mais
 * porta. Não pode ser o PID — ele muda a cada `npm run dev`, e o apelido tem
 * que sobreviver ao reinício, que é justamente quando ele serve.
 *
 * Entrada que fica sem nada é apagada: o arquivo é do usuário, não pode
 * encher de registro vazio de servidor que rodou uma vez.
 */
export function setServidor(chave, patch = {}) {
  const cfg = readConfig()
  const id = String(chave || '').slice(0, 200)
  if (!id) throw new Error('chave do servidor obrigatória')

  const texto = (v, n) => (v == null ? undefined : String(v).trim().slice(0, n))
  const atual = cfg.servidores?.[id] || {}
  const proximo = { ...atual }

  if ('apelido' in patch) proximo.apelido = texto(patch.apelido, 60)
  if ('nota' in patch) proximo.nota = texto(patch.nota, 400)
  if ('favorito' in patch) proximo.favorito = !!patch.favorito
  if ('cwd' in patch) proximo.cwd = texto(patch.cwd, 400)
  if ('comando' in patch) proximo.comando = texto(patch.comando, 300)
  if ('ultimoEm' in patch) proximo.ultimoEm = Number(patch.ultimoEm) || Date.now()

  // campo vazio some em vez de virar string vazia no arquivo
  for (const k of ['apelido', 'nota', 'cwd', 'comando']) if (!proximo[k]) delete proximo[k]
  if (!proximo.favorito) delete proximo.favorito

  const servidores = { ...cfg.servidores }
  // sobrou só o carimbo de "já vi": não vale guardar
  if (!Object.keys(proximo).filter((k) => k !== 'ultimoEm').length) delete servidores[id]
  else servidores[id] = proximo

  writeConfig({ ...cfg, servidores })
  return servidores[id] || null
}

/**
 * O que a janela flutuante mostra: quais blocos, e se em cartões (quadrado,
 * um por aba) ou numa linha só (fita, tudo condensado, pra encostar num canto
 * da tela sem cobrir nada). Bloco desconhecido é ignorado em vez de rejeitado
 * — assim uma versão futura com bloco novo não quebra config antiga.
 */
export function setPip({ blocos, layout }) {
  const cfg = readConfig()
  const atual = cfg.pip || DEFAULTS.pip
  const proximo = { ...atual }
  if (Array.isArray(blocos)) {
    const limpo = [...new Set(blocos)].filter((b) => PIP_BLOCOS.includes(b))
    proximo.blocos = limpo.length ? limpo : ['uso'] // vazio deixaria a janela em branco
  }
  if (PIP_LAYOUTS.includes(layout)) proximo.layout = layout
  writeConfig({ ...cfg, pip: proximo })
  return proximo
}

/**
 * Onde entrar pra ler a VPS. Fica no config e não em `src/vps.mjs` de
 * propósito: o repositório é público, e IP + caminho de chave são específicos
 * do Felipe — não é fato do projeto, é dado da máquina de quem está rodando.
 */
export function setVpsConfig({ host, usuario, chave }) {
  const cfg = readConfig()
  const atual = cfg.vps || DEFAULTS.vps
  const proximo = {
    host: host != null ? String(host).trim().slice(0, 200) : atual.host,
    usuario: (usuario != null ? String(usuario).trim().slice(0, 60) : atual.usuario) || 'root',
    chave: chave != null ? String(chave).trim().slice(0, 400) : atual.chave,
  }
  writeConfig({ ...cfg, vps: proximo })
  return proximo
}

/** Última leitura da VPS por SSH — só grava quando o Felipe pede, nunca sozinho. */
export function setVpsSnapshot(snapshot) {
  const cfg = readConfig()
  writeConfig({ ...cfg, vpsSnapshot: snapshot })
  return snapshot
}

/**
 * Um calendário do Google, pelo endereço secreto em iCal.
 *
 * Grava UM de cada vez, em vez de receber a lista inteira como os gráficos, e
 * a razão é segurança: a URL é a credencial de leitura da agenda, então ela
 * nunca volta pro navegador. Se a página tivesse que reenviar a lista completa
 * para salvar, ela mandaria de volta os calendários sem URL nenhuma — e o
 * primeiro "salvar" apagaria todos os endereços já guardados.
 *
 * Aceita só http(s): sem isso um `file:///` transformaria o campo num leitor
 * de arquivo arbitrário da máquina.
 */
export function setCalendario({ id, nome, url, cor }) {
  const cfg = readConfig()
  const lista = [...(cfg.calendarios || [])]
  const chave = String(id || '').trim().slice(0, 40)
    || `cal${Date.now().toString(36)}`

  let endereco
  if (url != null) {
    endereco = String(url).trim().slice(0, 600)
    if (endereco && !/^https?:\/\//i.test(endereco)) throw new Error('o endereço tem que começar com http:// ou https://')
  }

  const i = lista.findIndex((c) => c.id === chave)
  const atual = i >= 0 ? lista[i] : {}
  const proximo = {
    id: chave,
    nome: (nome != null ? String(nome).trim().slice(0, 60) : atual.nome) || 'agenda',
    url: endereco !== undefined ? endereco : atual.url,
    cor: cor != null ? String(cor).trim().slice(0, 20) : atual.cor,
  }
  if (!proximo.url) throw new Error('endereço do calendário obrigatório')
  if (!proximo.cor) delete proximo.cor

  if (i >= 0) lista[i] = proximo
  else lista.push(proximo)

  writeConfig({ ...cfg, calendarios: lista.slice(0, 12) })
  return { id: proximo.id, nome: proximo.nome, cor: proximo.cor || null }
}

export function removerCalendario(id) {
  const cfg = readConfig()
  const calendarios = (cfg.calendarios || []).filter((c) => c.id !== id)
  writeConfig({ ...cfg, calendarios })
  return calendarios.map((c) => ({ id: c.id, nome: c.nome }))
}

/** Quanto a assinatura custa por mês. Zero desliga o custo real na tela. */
export function setAssinatura(valor) {
  const cfg = readConfig()
  return writeConfig({ ...cfg, assinaturaMes: Math.max(0, Number(valor) || 0) })
}

export function describe(cwd = process.cwd()) {
  const cfg = readConfig()
  const { project } = projectOf(cwd)
  return {
    global: cfg.enabled,
    project,
    projectEnabled: isEnabled(cwd, cfg),
    disabledProjects: cfg.disabledProjects,
    file: CONFIG_FILE,
  }
}
