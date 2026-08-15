// Servidor local: serve a página, o JSON e um stream SSE.
// Sem dependência: http + fs nativos.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJobs, summarize, writeMeta } from './jobs.mjs'
import { PROJETOS_DIR as PROJETOS_DIR_SESSOES, readSessoes } from './sessoes.mjs'
import {
  alternarRota, corDaRota, humanizar as humanizarSilencio, lerQuadro, retratoDoQuadro,
} from './presenca.mjs'
import { buscar, lerGlossario, termosDe } from './glossario.mjs'
import {
  acrescentar as acrescentarMeu, marcar as marcarMeu, remover as removerMeu, tudo as tudoMeu,
} from './meu.mjs'
import { origem as origemLocal } from './maquina-id.mjs'
import {
  LIMITE_PACOTE, enviar as enviarPacote, gravarPacote, lerPacotes, maquinasConhecidas,
  mesclar, mesclarTempo, montarPacote, validarPacote,
} from './federacao.mjs'
import { tarefas } from './tarefas.mjs'
import { arquivar, jobsHistoricos, marcosDe } from './historico.mjs'
import { readUso } from './uso.mjs'
import {
  estado as estadoMidia, acao as acaoMidia,
  volume as volumeMidia, mudo as mudoMidia,
} from './midia.mjs'
import { estado as estadoMaquina } from './maquina.mjs'
import { lerRoadmap } from './roadmap.mjs'
import { findProjects } from './install.mjs'
import { commitsDesde } from './gitlog.mjs'
import { digestTodos } from './digest.mjs'
import { enriquecerTodos } from './opencode.mjs'
import { ligar as ligarRemoto, desligar as desligarRemoto, estado as estadoRemoto, link as linkRemoto } from './remotecontrol.mjs'
import { garantirMercado } from './mercado.mjs'
import {
  readServers, killServer, duplicados, recentes, projetosLancaveis,
  subirServidor, abrirLocal, esquecerCache,
} from './servers.mjs'
import { readPaineis, ligarPainel, desligarPainel, portaDe } from './paineis.mjs'
import { readNotes, writeNotes } from './notes.mjs'
import {
  desligar as desligarFramework, gravar as gravarFramework, ler as lerFramework,
  ligar as ligarFramework, situacao as situacaoFramework,
} from './frameworkDisco.mjs'
import {
  MODOS, autorizar as autorizarFramework, avaliar as avaliarFramework,
  modoDe as modoDeFramework, resumo as resumoFramework, trocarModo as trocarModoFramework,
} from './framework.mjs'
import { resumo as resumoTempo } from './tempo.mjs'
import {
  setTaxa, setCambio, setAssinatura, setGraficos, setMercado, setSessao, setServidor, setPip,
  setVpsConfig, setCalendario, removerCalendario, hookEnabled, setHookEnabled, readConfig, setVisita,
  setMaquina, setFederacao,
} from './config.mjs'
import { agenda, esquecerCache as esquecerAgenda } from './calendario.mjs'
import { HOOKS } from './hooksCatalogo.mjs'
import { registradoTodos } from './hooksRegistro.mjs'
import { porProjeto } from './cockpit.mjs'
import { listarContainers } from './docker.mjs'
import { atualizarSnapshot, configurada as vpsConfigurada } from './vps.mjs'
import { SECOES as SECOES_VPS, veredito as veredictoVps } from './vpsSaude.mjs'
import { estado as estadoProcessos } from './processos.mjs'
import { estado as estadoRotinas, comparar as compararRotina, sincronizar as sincronizarRotina, remover as removerRotina } from './rotinas.mjs'
import { garantirCambio } from './cambio.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UI = path.join(HERE, 'ui.html')
const GRAFICOS = path.join(HERE, 'graficos.js')

/**
 * `cwd` explícito vence. Sem ele, resolve pelo nome do projeto: (1) o `cwd`
 * que algum job daquele projeto já gravou no histórico (CC-23) — preferível,
 * é o caminho que de fato gerou aquele `project`; (2) `findProjects()`,
 * casando pelo nome da pasta, pro projeto que nunca rodou um agente.
 */
function cwdDoProjeto(cwd, projeto) {
  if (cwd) return cwd
  if (!projeto) return ''
  // vivos:[] de propósito — aqui quero TODO job já visto, vivo ou não
  const doHistorico = jobsHistoricos([]).mortos.find((j) => j.project === projeto && j.cwd)?.cwd
  return doHistorico || findProjects().find((p) => path.basename(p) === projeto) || ''
}

/** Estado do framework num projeto, do jeito que a tela precisa: existe, está
 *  ligado, em que fase, e a frase do que falta. A frase vem do motor, para a
 *  tela e o hook nunca discordarem sobre o mesmo projeto. */
function retratoFramework(raiz) {
  const s = situacaoFramework(raiz)
  if (!s.existe) return s
  const a = avaliarFramework(s.estado.metodo, s.estado)
  const modo = modoDeFramework(s.estado)
  return {
    existe: true,
    ligado: s.ligado,
    modo: modo.id,
    tituloModo: modo.titulo,
    explicaModo: modo.explica,
    modoTrava: Boolean(modo.trava),
    autorizado: s.estado.autorizado || [],
    modos: Object.values(MODOS).map((m) => ({ id: m.id, titulo: m.titulo, explica: m.explica })),
    fase: a.fase,
    tituloFase: a.tituloFase,
    portaoAberto: a.portaoAberto,
    pendencias: a.pendencias,
    resumo: resumoFramework(s.estado.metodo, s.estado),
    mvp: s.estado.mvp || null,
    mudancasDeEscopo: (s.estado.historico || []).filter((h) => h.tipo === 'escopo').length,
  }
}

const snapshot = () => {
  const doBackground = readJobs()
  // O CLI apaga job antigo, e com ele a única cópia dos to-dos. Arquivar aqui
  // é barato: só grava quando algo mudou, e o painel já releu tudo mesmo.
  // Só os jobs de verdade são arquivados: sessão interativa é derivada do
  // transcrito, que o Claude Code guarda sozinho.
  arquivar(doBackground)

  // CC-51: as sessões interativas entram junto. Sem isso o painel fica cego
  // para quem trabalha pelo Remote Control (o caso da VPS, onde não existe
  // NENHUM job de background e a aba aparecia vazia com trabalho acontecendo).
  // `ignorar` evita a mesma sessão aparecer duas vezes quando ela tem job.
  const interativas = readSessoes(Date.now(), {
    ignorar: doBackground.flatMap((j) => [j.id, j.sessionId]),
  })
  const jobs = [...doBackground, ...interativas]
  // Vai junto do snapshot porque tem que aparecer em toda aba, sempre: é
  // leitura de um JSON de 200 bytes, não pesa no tique de 2s.
  //
  // `cockpit` também vem pronto do servidor, pelo mesmo motivo do `summary`:
  // é derivado dos mesmos jobs (map/sort em memória, zero I/O) e a lógica de
  // ordenação por urgência mora em `cockpit.mjs`, que o `npm test` cobre —
  // duplicá-la em JS de navegador seria ter duas verdades pra "o que é
  // urgente".
  //
  // CC-33: `visitas` e `marcosDe` vão junto — o config e o histórico já são
  // lidos em outras rotas com o mesmo custo (JSON pequeno), então entra no
  // tique de 2s sem pesar.
  const cfg = readConfig()
  const visitas = cfg.visitas

  // CC-47: as outras máquinas entram aqui. Ler os pacotes é abrir alguns JSON
  // pequenos de disco local, não é rede: quem fala rede é o empurrador, e só
  // quando está configurado.
  const eu = origemLocal(cfg)
  const pacotes = lerPacotes()
  const todos = mesclar(jobs, pacotes, eu)

  const cockpit = porProjeto(todos, { visitas, marcosDe: (p, o) => marcosDe(p, { ...o, jobs: todos }) })
  return {
    jobs: todos,
    summary: summarize(todos),
    cockpit,
    uso: usoDaConta(readUso(), pacotes),
    maquinas: maquinasConhecidas(pacotes, eu),
    maquina: eu,
    at: Date.now(),
  }
}

/**
 * O uso do plano é da CONTA, não da máquina: as janelas de 5 horas e de semana
 * são as mesmas em qualquer lugar onde o Felipe esteja logado. Então vale a
 * leitura mais recente, venha de onde vier.
 *
 * Isso conserta um buraco medido em 14/08: a statusLine **não roda em sessão
 * Remote Control**, e por isso a VPS nunca gravou `control-center-uso.json`.
 * Instrumentei a statusline com um `tee` e, depois de várias respostas, o
 * arquivo continuava sem existir. Trabalhando pelo celular, o uso do plano
 * simplesmente não é coletado aqui; o número que vem do desktop é tão válido
 * quanto, e a marca `origem` diz de onde veio.
 */
function usoDaConta(local, pacotes) {
  const candidatos = [
    local ? { ...local, origem: null } : null,
    ...pacotes.map((p) => (p.uso ? { ...p.uso, origem: p.maquina } : null)),
  ].filter(Boolean)
  if (!candidatos.length) return null
  return candidatos.sort((a, b) => (b.em || 0) - (a.em || 0))[0]
}

/**
 * O lado cliente da federação: manda o estado desta máquina para o servidor.
 *
 * Só os dados baratos vão a cada ciclo (agentes e uso, que já estão em memória
 * pelo snapshot). Tempo e histórico ficam de fora deste caminho de propósito:
 * varrer transcrito custa segundos e não pode entrar num timer curto, a mesma
 * regra que vale para as portas, a VPS e os processos.
 */
/**
 * Quando o tempo entrou no pacote pela última vez.
 *
 * Ele vai junto a cada 10 minutos, e não a cada 30 segundos como o resto:
 * `resumoTempo()` varre os transcritos, o que custa segundos e centenas de MB
 * no PC do Felipe. A mesma regra das portas, da VPS e dos processos, só que
 * aqui com um relógio em vez de um clique.
 */
let ultimoTempoEnviado = 0
const INTERVALO_TEMPO_MS = 10 * 60 * 1000

async function empurrar({ comTempo = null } = {}) {
  const cfg = readConfig()
  const { token, enviarPara } = cfg.federacao || {}
  if (!token || !enviarPara) return { ok: false, erro: 'federação não configurada' }

  const s = snapshot()
  const meus = s.jobs.filter((j) => j.origem?.id === s.maquina.id)

  const agora = Date.now()
  const mandarTempo = comTempo ?? (agora - ultimoTempoEnviado > INTERVALO_TEMPO_MS)
  let tempo = null
  if (mandarTempo) {
    try {
      // Só os totais por projeto: `dias` e `sessoes` são o que engorda o
      // resumo, e a outra ponta não usa nenhum dos dois para somar.
      const r = resumoTempo({ corteMin: 15 })
      tempo = {
        corteMin: r.corteMin,
        projetos: (r.projetos || []).map((p) => ({
          projeto: p.projeto, ativoMs: p.ativoMs, tokens: p.tokens,
        })),
      }
      ultimoTempoEnviado = agora
    } catch { /* varredura falhou: manda o resto, tempo vai na próxima */ }
  }

  const pacote = montarPacote({ maquina: s.maquina, jobs: meus, uso: s.uso, tempo })
  return enviarPacote({ enviarPara, token, pacote })
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

/** Junta o corpo, com teto contra payload absurdo, e devolve o JSON. */
const comCorpo = (req, res, max, fn) => {
  let body = ''
  req.on('data', (c) => {
    body += c
    if (body.length > max) req.destroy()
  })
  req.on('end', () => {
    try {
      send(res, 200, { ok: true, ...fn(JSON.parse(body)) })
    } catch (e) {
      send(res, 400, { ok: false, error: String(e.message || e) })
    }
  })
}

/** Igual ao `comCorpo`, para quando o que responde devolve promessa. */
const comCorpoAsync = (req, res, max, fn) => {
  let body = ''
  req.on('data', (c) => {
    body += c
    if (body.length > max) req.destroy()
  })
  req.on('end', async () => {
    try {
      send(res, 200, { ok: true, ...(await fn(JSON.parse(body))) })
    } catch (e) {
      send(res, 400, { ok: false, error: String(e.message || e) })
    }
  })
}

function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')

  if (url.pathname === '/') return send(res, 200, fs.readFileSync(UI, 'utf8'), 'text/html; charset=utf-8')
  if (url.pathname === '/graficos.js') {
    return send(res, 200, fs.readFileSync(GRAFICOS, 'utf8'), 'text/javascript; charset=utf-8')
  }
  if (url.pathname === '/api/jobs') return send(res, 200, snapshot())

  // Escrita de meta pela própria página (marcar todo, anotar).
  if (url.pathname === '/api/meta' && req.method === 'POST') {
    return comCorpo(req, res, 1e6, ({ id, patch }) => {
      if (!id || typeof patch !== 'object') throw new Error('id e patch obrigatórios')
      return { meta: writeMeta(id, patch) }
    })
  }

  // Bloco de notas da máquina. Fora de /api/jobs: nota não é agente, e o
  // stream compara os jobs pra decidir se manda evento.
  if (url.pathname === '/api/notes') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 5e6, ({ notes }) => ({ notes: writeNotes(notes) }))
    }
    return send(res, 200, { notes: readNotes() })
  }

  // Consultado só pela aba de servidores: a varredura leva ~3s e não pode
  // pesar no painel principal nem no stream.
  if (url.pathname === '/api/servers') {
    const servers = readServers()
    return send(res, 200, {
      servers,
      // só os PIDs: a página já tem a lista inteira e não precisa dela de novo
      duplicados: duplicados(servers).map((g) => ({
        project: g.project, kind: g.kind, manter: g.manter.pid, matar: g.matar.map((s) => s.pid),
      })),
      recentes: recentes(),
    })
  }

  // Apelido, explicação e favorito de um servidor. Some do cache na hora:
  // esperar os 15s da varredura pareceria que o texto não foi salvo.
  if (url.pathname === '/api/servidor' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ chave, patch }) => {
      if (!chave || typeof patch !== 'object') throw new Error('chave e patch obrigatórios')
      const salvo = setServidor(chave, patch)
      esquecerCache()
      return { servidor: salvo }
    })
  }

  // Varre o disco atrás de pastas de projeto: só o construtor de "subir" pede.
  if (url.pathname === '/api/projetos') return send(res, 200, { projetos: projetosLancaveis() })

  if (url.pathname === '/api/subir' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, (corpo) => ({ subiu: subirServidor(corpo) }))
  }

  if (url.pathname === '/api/abrir' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ dir, como }) => ({ aberto: abrirLocal(dir, como) }))
  }

  // Botão "ligar projetos": dispara `claude --remote-control` na pasta do
  // projeto (tmux no Linux, console novo no Windows — ver remotecontrol.mjs).
  // Nunca no stream de 2s: ligar/desligar spawna processo, e "pegar link"
  // lê a tela do tmux, mais caro que o resto do stream.
  if (url.pathname === '/api/remote-control') {
    if (req.method === 'POST') {
      return comCorpoAsync(req, res, 1e4, async ({ projeto, cwd, acao, mais }) => {
        if (acao === 'desligar') return desligarRemoto(projeto)
        if (acao === 'link') return linkRemoto(projeto)
        const dir = cwdDoProjeto(cwd, projeto)
        if (!dir) throw new Error(`projeto não encontrado: ${projeto}`)
        // `mais`: outro agente na mesma pasta, em vez de devolver o que já existe
        return ligarRemoto(projeto, dir, { mais: Boolean(mais) })
      })
    }
    /* GET: todo projeto conhecido (pra montar a lista de botões) + o que já
       está ligado agora.

       Duas fontes, e a segunda é rede de segurança. `findProjects()` depende de
       `projectsBase()`, que sem `CC_PROJECTS_BASE` nem config depende dos jobs
       de background — e devolve ZERO em máquina que só tem sessão interativa
       (mesma raiz do CC-53). O serviço systemd desta VPS define a variável,
       então o painel de produção sempre listou certo; quem cai no buraco é o
       `cc` rodado à mão no terminal. Os `cwd` das sessões e do histórico
       cobrem isso: toda sessão que já rodou deixou um. */
    const porDir = new Map(findProjects().map((dir) => [dir, path.basename(dir)]))
    for (const j of [...readJobs(), ...readSessoes(), ...jobsHistoricos([]).mortos]) {
      const dir = String(j?.cwd || '').replace(/[\\/]+$/, '')
      if (dir && !porDir.has(dir)) porDir.set(dir, path.basename(dir))
    }
    const projetos = [...porDir].map(([dir, nome]) => ({ nome, dir }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
    return estadoRemoto().then((ativos) => send(res, 200, { projetos, ativos }))
  }

  // Containers Docker desta máquina. Fora do stream, mesmo motivo da máquina
  // e dos servidores: `docker ps` spawna processo e não pode travar o tique
  // de 2s dos agentes.
  if (url.pathname === '/api/docker') {
    return listarContainers({ force: url.searchParams.has('force') }).then((d) => send(res, 200, d))
  }

  // Top processos por CPU/RAM/VRAM. É o mais caro dos três (PowerShell +
  // Get-Process de todos os processos), por isso o cache mais largo dentro
  // do próprio módulo — aqui só repassa.
  if (url.pathname === '/api/processos') {
    return estadoProcessos({ force: url.searchParams.has('force') }).then((d) => send(res, 200, d || { indisponivel: true }))
  }

  // "Onde eu mexo agora": projetos ordenados por urgência. Barato de
  // propósito — só relê os mesmos jobs do snapshot, sem tempo.mjs nem spawn,
  // então pode ser consultado à vontade.
  if (url.pathname === '/api/cockpit') {
    const jobs = readJobs()
    const visitas = readConfig().visitas
    return send(res, 200, {
      projetos: porProjeto(jobs, { visitas, marcosDe: (p, o) => marcosDe(p, { ...o, jobs }) }),
      at: Date.now(),
    })
  }

  // CC-33: carimbo explícito de "vi isso". Nunca automático — o Felipe olha o
  // painel o dia todo, e carimbar sozinho zeraria o delta a cada visita.
  if (url.pathname === '/api/visita' && req.method === 'POST') {
    return comCorpo(req, res, 1e3, ({ projeto }) => ({ visitas: setVisita(projeto).visitas }))
  }

  // O framework de engenharia (ver docs/produto/FRAMEWORK.md). Leitura sob
  // demanda por projeto, nunca no stream: são ~20 projetos e o tique é de 2s.
  //
  // Duas coisas que o botão NÃO faz, de propósito: não apaga a pasta
  // `.framework` (desligar preserva o MVP e o histórico de escopo; destruir
  // dado do projeto não pode ser um clique) e não registra o hook no
  // settings.json do Claude Code, que continua manual como todo hook aqui.
  // O escritório servido pelo próprio cockpit, em vez de `http://localhost:PORTA`.
  //
  // Medido em 14/08, quando o Felipe disse que o Pixel Agents não funcionava:
  // o iframe apontava para `localhost:3101`, e `localhost` é a máquina de quem
  // OLHA. No PC dele, onde o painel nasceu, isso é verdade por acaso. Abrindo
  // `cockpit.carzo.com.br` no celular, o navegador tentava a porta 3101 do
  // próprio telefone. Nunca teve chance de funcionar remotamente.
  //
  // O proxy só alcança 127.0.0.1 e só as portas declaradas em `paineis.mjs`:
  // sem essa trava, esta rota viraria um proxy aberto para a rede inteira da
  // máquina, que é o oposto de servir o painel atrás de senha.
  if (url.pathname === '/painel' || url.pathname.startsWith('/painel/')) {
    const partes = url.pathname.split('/').filter(Boolean) // ['painel', id, ...resto]
    const porta = portaDe(partes[1])
    if (!porta) return send(res, 404, { error: 'painel desconhecido' })

    const caminho = '/' + partes.slice(2).join('/') + (url.search || '')
    const req2 = http.request({
      host: '127.0.0.1', port: porta, path: caminho, method: req.method, headers: req.headers,
    }, (r2) => {
      res.writeHead(r2.statusCode || 502, r2.headers)
      r2.pipe(res)
    })
    req2.on('error', (e) => send(res, 502, { error: String(e.message || e) }))
    return req.pipe(req2)
  }

  // CC-47, o lado servidor da federação: recebe o estado de outra máquina.
  //
  // Autenticação é por token próprio, não pelo cookie do `cockpit-auth`: quem
  // fala aqui é outro painel, não um navegador. Token vazio significa "não
  // aceito federação", que é o padrão — sem isso, qualquer um que alcançasse a
  // porta escreveria no painel.
  if (url.pathname === '/api/federacao' && req.method === 'POST') {
    const cfg = readConfig()
    const esperado = cfg.federacao?.token || ''
    if (!esperado) return send(res, 403, { error: 'federação desligada nesta máquina' })
    if (req.headers['x-cc-token'] !== esperado) return send(res, 401, { error: 'token inválido' })

    return comCorpo(req, res, LIMITE_PACOTE, (bruto) => {
      const { ok, erro, pacote } = validarPacote(bruto)
      if (!ok) return { error: erro }
      gravarPacote(pacote)
      return { recebido: pacote.maquina, jobs: pacote.jobs.length }
    })
  }

  // O que chegou de fora, mais a identidade desta máquina. Serve à tela (o
  // filtro do topo) e a conferir quem está sem contato.
  if (url.pathname === '/api/federacao') {
    const cfg = readConfig()
    const pacotes = lerPacotes()
    return send(res, 200, {
      maquina: origemLocal(cfg),
      maquinas: maquinasConhecidas(pacotes, origemLocal(cfg)),
      // O token VAI para a tela, e é decisão consciente: ele precisa ser
      // copiado para a outra máquina, e quem chega aqui já passou pela senha do
      // `cockpit-auth`. O painel também só escuta em 127.0.0.1. A tela o
      // esconde atrás de um clique, para não vazar em print.
      token: cfg.federacao?.token || '',
      configurada: Boolean(cfg.federacao?.token),
      enviandoPara: cfg.federacao?.enviarPara || '',
      pacotes: pacotes.map((p) => ({
        maquina: p.maquina, jobs: p.jobs.length, em: p.em, idadeMs: p.idadeMs, semContato: p.semContato,
      })),
    })
  }

  // Configuração da federação: nome desta máquina, token e para onde empurrar.
  if (url.pathname === '/api/federacao/config' && req.method === 'POST') {
    return comCorpo(req, res, 2e3, ({ nome, token, enviarPara }) => {
      if (typeof nome === 'string' && nome.trim()) setMaquina({ nome: nome.trim() })
      if (typeof token === 'string' || typeof enviarPara === 'string') setFederacao({ token, enviarPara })
      const cfg = readConfig()
      return {
        maquina: origemLocal(cfg),
        configurada: Boolean(cfg.federacao?.token),
        enviandoPara: cfg.federacao?.enviarPara || '',
      }
    })
  }

  // Empurra agora, sob clique: serve para o Felipe testar sem esperar o ciclo.
  if (url.pathname === '/api/federacao/enviar' && req.method === 'POST') {
    return empurrar().then((r) => send(res, 200, r)).catch((e) => send(res, 200, { ok: false, erro: String(e) }))
  }

  // O glossário: os documentos reduzidos ao que cabe numa tela.
  //
  // Pedido do Felipe em 14/08: "se eu quiser lembrar o que que é a bancada que
  // eu mesmo criei há pouco tempo atrás, eu já não lembro, eu teria que
  // pesquisar pra ler. E eu não posso, toda hora que eu esquecer, ficar lendo
  // um documento gigante." Ler ~36 arquivos é I/O demais pro tique de 2s, então
  // fica aqui, sob demanda, como o roadmap e os processos.
  if (url.pathname === '/api/glossario') {
    // Sem projeto informado, o glossário é o DESTE repositório, e o caminho sai
    // do próprio módulo. `process.cwd()` não serve: o serviço systemd roda com
    // WorkingDirectory no home, e ali não existe `docs/` — a rota devolvia zero
    // verbete no painel de produção enquanto funcionava no teste local.
    const dir = cwdDoProjeto(url.searchParams.get('cwd'), url.searchParams.get('projeto'))
      || path.resolve(HERE, '..')
    const verbetes = buscar(lerGlossario(dir), url.searchParams.get('q'))
    return send(res, 200, { verbetes, termos: termosDe(verbetes), at: Date.now() })
  }

  // O que depende do FELIPE, de todos os projetos, num lugar só.
  //
  // Pedido dele no mesmo dia: as tarefas que a IA não pode fazer (cortar um
  // asset, logar uma conta, autorizar sudo, decidir) não tinham onde morar. O
  // painel só mostrava to-do de agente, que é trabalho meu, não dele.
  //
  // Sai do snapshot que já está em memória: zero I/O novo, e por isso pode ser
  // chamado à vontade.
  if (url.pathname === '/api/meu') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 4e3, ({ acao, id: alvo, texto, projeto, frente, porque, feito }) => {
        if (acao === 'marcar') return marcarMeu(alvo, feito)
        if (acao === 'remover') return removerMeu(alvo)
        return acrescentarMeu({ texto, projeto, frente, porque })
      })
    }
    const tarefas = tudoMeu(snapshot().jobs)
    return send(res, 200, { tarefas, abertas: tarefas.filter((t) => !t.feito).length, at: Date.now() })
  }

  // Todos os projetos conhecidos, com o estado do framework em cada um.
  //
  // Existe porque o botão no cartão não bastava: o cartão só aparece para
  // projeto COM agente, e o caso principal do framework é o contrário, projeto
  // novo antes de existir código. Medido em 14/08 na VPS, com zero job vivo: a
  // aba inteira ficava vazia e não havia como ligar nada.
  //
  // Sob clique, nunca no stream: são ~20 leituras de JSON pequeno, na mesma
  // regra das portas, da VPS e dos processos.
  if (url.pathname === '/api/framework/projetos') {
    const vistos = new Set()
    const lista = []
    for (const raiz of findProjects()) {
      const nome = path.basename(raiz)
      if (vistos.has(nome)) continue
      vistos.add(nome)
      lista.push({ projeto: nome, raiz, ...retratoFramework(raiz) })
    }
    lista.sort((a, b) => (b.existe ? 1 : 0) - (a.existe ? 1 : 0) || a.projeto.localeCompare(b.projeto))
    return send(res, 200, { projetos: lista, at: Date.now() })
  }

  if (url.pathname === '/api/framework') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e3, ({ projeto, cwd, acao, modo, alvo, motivo }) => {
        const raiz = cwdDoProjeto(cwd, projeto)
        if (!raiz) return { error: 'não achei a pasta deste projeto' }

        // Trocar de modo e autorizar são o que faz o modo sugestivo existir de
        // verdade: o desenho dele é "eu autorizo por clique", e sem estas duas
        // ações o clique não existe — sobraria a linha de comando, que não serve
        // para quem trabalha do celular.
        if (acao === 'modo' || acao === 'autorizar') {
          const estado = lerFramework(raiz)
          if (!estado) return { error: 'este projeto não tem framework ligado' }
          const quando = new Date().toISOString()
          const r = acao === 'modo'
            ? trocarModoFramework(estado, modo, { quando })
            : autorizarFramework(estado, { alvo: alvo || '**', motivo: motivo || null, quando })
          if (!r.ok) return { error: r.erro }
          gravarFramework(raiz, r.estado)
          return { raiz, ...retratoFramework(raiz) }
        }

        const r = acao === 'desligar' ? desligarFramework(raiz) : ligarFramework(raiz)
        if (!r.ok) return { error: r.erro }
        return { raiz, ...retratoFramework(raiz) }
      })
    }
    const raiz = cwdDoProjeto(url.searchParams.get('cwd'), url.searchParams.get('projeto'))
    if (!raiz) return send(res, 200, { existe: false, ligado: false, semPasta: true })
    return send(res, 200, { raiz, ...retratoFramework(raiz) })
  }

  // CC-23: o que aconteceu num projeto, derivado do histórico já guardado —
  // mesma barateza do /api/cockpit, sem spawn nem disco além do JSON.
  if (url.pathname === '/api/marcos') {
    const projeto = url.searchParams.get('projeto')
    const desde = Number(url.searchParams.get('desde')) || 0
    if (!projeto) return send(res, 400, { error: 'falta o parâmetro projeto' })
    return send(res, 200, { marcos: marcosDe(projeto, { desde, jobs: readJobs() }), at: Date.now() })
  }

  // Catálogo de hooks + se cada um está ligado (control-center.json) e
  // registrado de verdade (settings.json do Claude Code, só leitura).
  if (url.pathname === '/api/hooks') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ id, on }) => {
        if (!HOOKS.some((h) => h.id === id)) throw new Error(`hook desconhecido: ${id}`)
        return { ligado: setHookEnabled(id, on) }
      })
    }
    const registrados = registradoTodos(HOOKS)
    return send(res, 200, {
      hooks: HOOKS.map((h) => ({ ...h, ligado: hookEnabled(h.id), registrado: registrados[h.id] })),
    })
  }

  // Rotinas (`/comando`) copiadas dentro dos projetos. Varre disco de ~20
  // projetos, então é só sob clique, igual a processos e VPS. Nunca no stream.
  // `?dir=&nome=` traz os dois textos pra conferir antes de qualquer escrita.
  if (url.pathname === '/api/rotinas') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ dir, nome, acao }) => {
        if (acao === 'sincronizar') return sincronizarRotina(dir, nome)
        if (acao === 'remover') return removerRotina(dir, nome)
        throw new Error(`ação desconhecida: ${acao}`)
      })
    }
    const dir = url.searchParams.get('dir')
    const nome = url.searchParams.get('nome')
    if (dir && nome) return send(res, 200, compararRotina(dir, nome))
    return send(res, 200, estadoRotinas())
  }

  // O que a janela flutuante mostra. GET pra montar o painel de configurações
  // sem esperar o primeiro /api/jobs; POST grava a escolha.
  if (url.pathname === '/api/pip') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ blocos, layout }) => ({ pip: setPip({ blocos, layout }) }))
    }
    return send(res, 200, { pip: readConfig().pip })
  }

  // Config de conexão + o último retrato lido. Nunca devolve o caminho da
  // chave: não é segredo, mas não tem por que trafegar pro navegador.
  if (url.pathname === '/api/vps') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ host, usuario, chave }) => ({ vps: setVpsConfig({ host, usuario, chave }) }))
    }
    const cfg = readConfig()
    return send(res, 200, {
      // CC_VPS_LOCAL=1 conta como configurado mesmo sem host salvo: é o modo
      // local, rodando o painel dentro da própria VPS.
      configurado: vpsConfigurada(),
      host: cfg.vps?.host || null,
      usuario: cfg.vps?.usuario || 'root',
      snapshot: cfg.vpsSnapshot,
      /* O veredito vem pronto do servidor, e não é preferência: os limiares
         (disco em 85%, memória em 90%, 5 reinícios) são regra de negócio e o
         `npm test` prova cada um. Recalcular em JS de navegador daria duas
         verdades para "a VPS está bem?". */
      saude: veredictoVps(cfg.vpsSnapshot),
      secoes: SECOES_VPS,
    })
  }

  // SSH de verdade, só aqui: botão clicado pelo Felipe, nunca timer. Pode
  // demorar (rede + comando remoto), por isso o timeout mais largo.
  if (url.pathname === '/api/vps/atualizar' && req.method === 'POST') {
    return atualizarSnapshot()
      .then((snapshot) => send(res, 200, { ok: true, snapshot, saude: veredictoVps(snapshot) }))
      .catch((e) => send(res, 500, { ok: false, error: String(e.message || e) }))
  }

  // Agenda do Google, por iCal. GET traz os eventos da janela pedida; POST
  // cadastra um calendário. A resposta NUNCA inclui o endereço: ele é a
  // credencial de leitura da agenda, e uma captura de tela do painel vazaria
  // a agenda inteira do Felipe pra quem visse a imagem.
  if (url.pathname === '/api/calendario') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, (corpo) => {
        const cal = setCalendario(corpo)
        esquecerAgenda() // senão o calendário novo só apareceria 15 min depois
        return { calendario: cal }
      })
    }
    const dias = Number(url.searchParams.get('dias'))
    return agenda({
      dias: Number.isFinite(dias) ? dias : 7,
      force: url.searchParams.has('force'),
    }).then((d) => send(res, 200, d)).catch((e) => send(res, 500, { erro: String(e.message || e) }))
  }

  if (url.pathname === '/api/calendario/remover' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ id }) => {
      const calendarios = removerCalendario(id)
      esquecerAgenda()
      return { calendarios }
    })
  }

  // Idem: lê ~800MB de transcript na primeira vez. Só a aba de tempo pede, e
  // as vezes seguintes releem apenas o que mudou.
  if (url.pathname === '/api/tempo') {
    const num = (v, padrao) => (Number.isFinite(Number(v)) ? Number(v) : padrao)
    const dia = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null)
    // A cotação é buscada antes do resumo, e não em paralelo, porque o resumo
    // lê o câmbio do config: em paralelo, a primeira carga do dia sairia sem
    // real e só a segunda mostraria a coluna.
    return garantirCambio().then(() => {
      try {
        const local = resumoTempo({
          corteMin: num(url.searchParams.get('corte'), 15),
          de: dia(url.searchParams.get('de')),
          ate: dia(url.searchParams.get('ate')),
          force: url.searchParams.has('force'),
        })
        // CC-47: as horas das outras máquinas entram aqui. O corte e o recorte
        // de datas valem só para o que é local: o remoto chega já somado, com o
        // corte que a máquina de lá usou. Misturar cortes diferentes seria
        // mentira silenciosa, então a tela avisa quando o total é federado.
        send(res, 200, mesclarTempo(local, lerPacotes(), origemLocal()))
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  // Cotação digitada à mão. Grava `manual`, e a busca automática passa a
  // respeitar o número — quem fecha preço não quer o valor trocando sozinho.
  if (url.pathname === '/api/cambio' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ valor }) => ({
      cambio: setCambio({ brlPorUsd: valor, manual: Number(valor) > 0 }),
    }))
  }

  // Taxa em R$/hora, global ou por projeto. Fica no config e não no cache de
  // tempo: mudar a taxa não pode invalidar 800 MB de varredura.
  if (url.pathname === '/api/taxa' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ valor, projeto }) => ({
      config: setTaxa(valor, { projeto: projeto || null }),
    }))
  }

  if (url.pathname === '/api/graficos') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e5, ({ graficos }) => ({ graficos: setGraficos(graficos) }))
    }
    return send(res, 200, { graficos: readConfig().graficos })
  }

  if (url.pathname === '/api/assinatura' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ valor }) => ({ config: setAssinatura(valor) }))
  }

  // Preço por tarefa. Puxa o mercado antes do cálculo, pelo mesmo motivo do
  // câmbio: o cálculo lê as faixas do config e sairia sem elas na primeira vez.
  if (url.pathname === '/api/tarefas') {
    const num = (v, padrao) => (Number.isFinite(Number(v)) ? Number(v) : padrao)
    return garantirMercado({ force: url.searchParams.has('mercado') }).then(() => {
      try {
        send(res, 200, tarefas({
          corteMin: num(url.searchParams.get('corte'), 15),
          unidade: url.searchParams.get('unidade') === 'sessao' ? 'sessao' : 'todo',
        }))
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  if (url.pathname === '/api/mercado' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, (m) => ({ mercado: setMercado({ ...m, manual: true }) }))
  }

  // Correção de nível e tempo digitado. Sessão vai pro config; to-do vai pro
  // meta.json do job, mesclado item a item para não apagar as outras tarefas.
  if (url.pathname === '/api/tarefa' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ sessao, job, tarefa, nivel, horas }) => {
      if (sessao) return { ajuste: setSessao(sessao, { nivel, horas }) }
      if (!job || !tarefa) throw new Error('informe sessao, ou job e tarefa')
      const atual = readJobs().find((j) => j.id === job)
      if (!atual) throw new Error(`job ${job} não existe`)
      const niveis = { ...atual.niveis }
      const estimativas = { ...atual.estimativas }
      if (['junior', 'pleno', 'senior'].includes(nivel)) niveis[tarefa] = nivel
      else delete niveis[tarefa]
      if (Number(horas) > 0) estimativas[tarefa] = Math.min(Number(horas), 1000)
      else delete estimativas[tarefa]
      return { meta: writeMeta(job, { niveis, estimativas }) }
    })
  }

  // Mapa do projeto, lido do ROADMAP.md dele. Aceita `cwd` (de um agente vivo)
  // ou `projeto` (nome) — CC-34: projeto sem agente ativo ainda quer abrir o
  // mapa.
  if (url.pathname === '/api/roadmap') {
    const cwd = cwdDoProjeto(url.searchParams.get('cwd'), url.searchParams.get('projeto'))
    const mapa = cwd ? lerRoadmap(cwd) : null
    return send(res, 200, mapa || { vazio: true })
  }

  // CC-36: enriquecimento de to-dos pelo opencode. Uma chamada por AGENTE
  // (não por tarefa), roda em pasta neutra (nunca o cwd do projeto — todos
  // os agentes do opencode aqui têm permission:*, nenhum é read-only).
  // Pode levar até 60s (espera o processo do opencode terminar), por isso
  // sob clique explícito, nunca automático.
  if (url.pathname === '/api/enriquecer' && req.method === 'POST') {
    return comCorpoAsync(req, res, 1e4, async ({ job }) => {
      const atual = readJobs().find((j) => j.id === job)
      if (!atual) throw new Error(`job ${job} não existe`)
      const textos = (atual.todos || []).map((t) => t.text)
      const novas = await enriquecerTodos(textos)
      const explicacoes = { ...atual.explicacoes, ...novas }
      return { meta: writeMeta(job, { explicacoes }), adicionadas: Object.keys(novas).length }
    })
  }

  // CC-24: digest semanal entre projetos, cruzando histórico + git + diário +
  // roadmap. Varre ~20 projetos com spawn de git cada — sempre sob clique.
  if (url.pathname === '/api/digest') {
    const desde = Number(url.searchParams.get('desde')) || undefined
    return digestTodos({ desde, jobs: readJobs() }).then((d) => send(res, 200, d))
  }

  // CC-35: "o que mudou desde que saí", em commit de verdade — sempre sob
  // clique, nunca no stream: é spawn de git.
  if (url.pathname === '/api/git') {
    const cwd = cwdDoProjeto(url.searchParams.get('cwd'), url.searchParams.get('projeto'))
    const desde = Number(url.searchParams.get('desde')) || 0
    if (!cwd) return send(res, 200, { ok: false, motivo: 'projeto não encontrado' })
    return commitsDesde(cwd, desde).then((r) => send(res, 200, r))
  }

  // Sensores da máquina. Fora do stream pelo mesmo motivo da mídia: a leitura
  // da GPU spawna processo, e o tique de 2s dos agentes não pode depender disso.
  if (url.pathname === '/api/maquina') {
    return estadoMaquina({ force: url.searchParams.has('force') })
      .then((d) => send(res, 200, d))
      .catch((e) => send(res, 500, { erro: String(e.message || e) }))
  }

  // Mídia: consultada pela barra do player, que pergunta a cada poucos
  // segundos. Cache curto mora no módulo; aqui só se decide ler ou escrever.
  if (url.pathname === '/api/midia') {
    return estadoMidia({ force: url.searchParams.has('force') })
      .then((d) => send(res, 200, d))
      .catch((e) => send(res, 500, { erro: String(e.message || e) }))
  }

  if (url.pathname === '/api/midia/acao' && req.method === 'POST') {
    return comCorpoAsync(req, res, 1e4, ({ indice, qual }) => acaoMidia(indice, qual))
  }

  if (url.pathname === '/api/midia/volume' && req.method === 'POST') {
    return comCorpoAsync(req, res, 1e4, ({ pid, nivel, mudo }) => (
      mudo === undefined ? volumeMidia(pid, nivel) : mudoMidia(pid, mudo)
    ))
  }

  if (url.pathname === '/api/kill' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ pid }) => ({ killed: killServer(pid) }))
  }

  // Painéis de acompanhamento (aba escritório). Estado sai da mesma varredura
  // de portas da aba de servidores, então não custa consulta nova.
  if (url.pathname === '/api/paineis') {
    return send(res, 200, { paineis: readPaineis({ force: url.searchParams.has('force') }) })
  }

  // Ligar e desligar recebem `id`, nunca pid: o pid vem da porta declarada no
  // próprio módulo, então a página não consegue mandar encerrar processo
  // arbitrário mesmo se alguém mexer no JavaScript.
  if (url.pathname === '/api/paineis/ligar' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ id }) => ({ painel: ligarPainel(id) }))
  }

  if (url.pathname === '/api/paineis/desligar' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ id }) => ({ painel: desligarPainel(id) }))
  }

  /* Abrir sessão do Claude Code pelo painel. Nasceu do celular: ele trabalha
     pelo Remote Control e não tem terminal para abrir sessão em outra pasta.

     A pasta vem SEMPRE da lista de projetos que o painel já conhece, nunca do
     que a página mandar: aceitar caminho arbitrário daria ao painel o poder de
     rodar o CLI em qualquer lugar do disco. */
  /* CC-78: as rotas na tela, e clicáveis.
     A pasta vem do projeto que o painel já conhece — nunca do que a página
     mandar, senão o painel escreveria markdown em qualquer lugar do disco. */
  if (url.pathname === '/api/rotas') {
    const dir = cwdDoProjeto(url.searchParams.get('cwd'), url.searchParams.get('projeto'))
    if (!dir) return send(res, 200, { existe: false })
    const jobs = readJobs()
    const r = retratoDoQuadro(dir, {
      jobs,
      sessoes: readSessoes(Date.now(), { ignorar: jobs.map((j) => j.id) }),
      pastaProjetos: PROJETOS_DIR_SESSOES,
    })
    if (!r) return send(res, 200, { existe: false, dir })
    const texto = lerQuadro(dir) || ''
    const todas = texto.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)
      .filter((l) => l.includes('|') && (l.includes('🔴') || l.includes('🟢')) && !/\[exemplo\]/i.test(l))
      .map((l) => {
        const nome = (l.match(/`([^`]+)`/) || [])[1] || null
        const ocupada = r.ocupadas.find((o) => o.rota === nome)
        return {
          rota: nome,
          cor: corDaRota(l, ocupada?.veredito),
          quem: ocupada?.id || null,
          silencio: ocupada ? humanizarSilencio(ocupada.silencioMs) : null,
          veredito: ocupada?.veredito || null,
        }
      }).filter((x) => x.rota)
    return send(res, 200, { existe: true, dir, rotas: todas })
  }

  if (url.pathname === '/api/rotas/alternar' && req.method === 'POST') {
    return comCorpoAsync(req, res, 1e4, async ({ projeto, cwd, rota, paraOcupada }) => {
      const dir = cwdDoProjeto(cwd, projeto)
      if (!dir) return { erro: 'projeto desconhecido' }
      return { alternou: alternarRota(dir, rota, { paraOcupada: Boolean(paraOcupada), marca: 'painel' }) }
    })
  }

  // Existe pra `daemon restart` conseguir derrubar o processo antigo: o servidor
  // não recarrega módulo, então mexer no código exige reiniciar de verdade.
  if (url.pathname === '/api/shutdown' && req.method === 'POST') {
    send(res, 200, { ok: true })
    setTimeout(() => process.exit(0), 100)
    return
  }

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    })
    let last = ''
    // `remoto` entra no stream (e no fingerprint) pra ligar/desligar numa
    // aba aparecer na outra sem precisar reabrir — bug relatado em 13/08:
    // "ligado" só atualizava no aparelho que clicou. `estadoRemoto()` no
    // Linux spawna `tmux list-sessions`; barato, e só roda enquanto alguém
    // tem a aba aberta.
    const push = async () => {
      const snap = snapshot()
      const remoto = await estadoRemoto()
      const fingerprint = JSON.stringify([snap.jobs, snap.uso, remoto])
      if (fingerprint === last) return
      last = fingerprint
      res.write(`data: ${JSON.stringify({ ...snap, remoto })}\n\n`)
    }
    push()
    const timer = setInterval(push, 2000)
    req.on('close', () => clearInterval(timer))
    return
  }

  send(res, 404, { error: 'not found' })
}

/**
 * O WebSocket do escritório, encaminhado junto com o HTTP.
 *
 * O Pixel Agents monta a URL do socket a partir de `location.host`, então pelo
 * proxy ele bate em `/painel/local/...` deste servidor. Sem repassar o
 * `upgrade`, a página carrega e os bonecos ficam parados para sempre: o pior
 * tipo de defeito, porque parece que funcionou.
 *
 * O encaminhamento é cru (dois sockets colados) e não interpreta quadro nenhum:
 * é o mínimo para o upgrade completar. Só 127.0.0.1 e só as portas declaradas.
 */
function proxyUpgrade(req, socket, head) {
  const caminho = (req.url || '').split('?')[0]
  const busca = req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''

  // O Pixel Agents monta o socket como `wss://${location.host}/ws`, caminho
  // ABSOLUTO: servido dentro do iframe em `/painel/local/`, ele ainda bate na
  // raiz. Por isso `/ws` também é aceito e vai para o painel local. Conferido
  // no bundle dele em 14/08; se um dia houver dois painéis embutidos ao mesmo
  // tempo, este atalho precisa de um desempate.
  if (caminho === '/ws') {
    const p = portaDe('local')
    return p ? encaminharUpgrade(req, socket, head, p, `/ws${busca}`) : socket.destroy()
  }

  if (!caminho.startsWith('/painel/')) return socket.destroy()
  const partes = caminho.split('/').filter(Boolean)
  const porta = portaDe(partes[1])
  if (!porta) return socket.destroy()

  return encaminharUpgrade(req, socket, head, porta, '/' + partes.slice(2).join('/') + busca)
}

function encaminharUpgrade(req, socket, head, porta, destino) {
  const req2 = http.request({
    host: '127.0.0.1', port: porta, path: destino, method: req.method,
    headers: req.headers,
  })
  req2.end()

  req2.on('upgrade', (r2, socket2, head2) => {
    socket.write(`HTTP/1.1 101 ${r2.statusMessage || 'Switching Protocols'}\r\n`
      + Object.entries(r2.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')
      + '\r\n\r\n')
    if (head2?.length) socket.write(head2)
    socket2.pipe(socket)
    socket.pipe(socket2)
    // Um lado caindo tem que derrubar o outro, senão sobra socket meio-aberto
    // segurando memória do painel, que roda o dia inteiro.
    const fim = () => { socket.destroy(); socket2.destroy() }
    socket.on('error', fim); socket2.on('error', fim)
    socket.on('close', fim); socket2.on('close', fim)
  })
  req2.on('error', () => socket.destroy())
  if (head?.length) req2.write?.(head)
}

/** Sobe na primeira porta livre a partir de `port`. */
export function startWeb({ port = 8099, tries = 10 } = {}) {
  return new Promise((resolve, reject) => {
    let attempt = 0
    const server = http.createServer(handler)
    server.on('upgrade', proxyUpgrade)
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && attempt < tries) {
        attempt++
        server.listen(port + attempt, '127.0.0.1')
      } else reject(e)
    })
    server.on('listening', () => {
      // CC-47: o empurrão para a máquina servidora. Fica aqui, e não no tique
      // de 2s do stream, porque é a ÚNICA chamada de rede periódica do painel
      // e 30s já é mais rápido do que o Felipe troca de tela. Sem federação
      // configurada, o timer nem existe.
      const { token, enviarPara } = readConfig().federacao || {}
      if (token && enviarPara) {
        const timer = setInterval(() => { empurrar().catch(() => {}) }, 30_000)
        timer.unref() // não pode segurar o processo de pé sozinho
        empurrar().catch(() => {}) // um primeiro envio, para não esperar meio minuto
      }
      resolve({ server, url: `http://localhost:${server.address().port}` })
    })
    server.listen(port, '127.0.0.1')
  })
}
