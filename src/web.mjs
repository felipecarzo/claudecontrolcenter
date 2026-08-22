// Servidor local: serve a página, o JSON e um stream SSE.
// Sem dependência: http + fs nativos.

import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJobs, summarize, writeMeta } from './jobs.mjs'
import { PROJETOS_DIR as PROJETOS_DIR_SESSOES, readSessoes } from './sessoes.mjs'
import { perdidasDeTodas as perdidasDeTodasAsSessoes } from './fila.mjs'
// `casaClaude()` e não `os.homedir()`: é o único lugar que resolve a pasta
// `.claude`, e é o que faz `CC_HOME` isolar o painel de teste do real.
import { casaClaude, caminhoAutostart } from './platform.mjs'
import { estadoGit } from './git.mjs'
import { mapear as mapearAvenidas, resumo as resumoAvenidas } from './avenidas.mjs'
import { mapear as mapearDependencias } from './dependencias.mjs'
import { mapear as mapearEstrutura, historicoDeCommits } from './estrutura.mjs'
import {
  alternarRota, corDaRota, humanizar as humanizarSilencio, lerQuadro, retratoDoQuadro,
} from './presenca.mjs'
import { buscar, lerGlossario, lerPalavrasDaTela, termosDe } from './glossario.mjs'
import {
  acrescentar as acrescentarMeu, marcar as marcarMeu, remover as removerMeu, tudo as tudoMeu,
} from './meu.mjs'
import { origem as origemLocal } from './maquina-id.mjs'
import {
  LIMITE_PACOTE, enviar as enviarPacote, gravarPacote, lerPacotes, maquinasConhecidas,
  mesclar, mesclarTempo, montarPacote, validarPacote, pedirSessao, pegarPedidos, resumirBacklogs,
} from './federacao.mjs'
import { tarefas } from './tarefas.mjs'
/* O gate. Importado no TOPO, e não por `import()` dentro do handler: o handler
   de rota não é async, e `await` ali derruba o painel inteiro com erro de
   sintaxe, com o systemd reiniciando em laço. Custou uma tarde hoje, na rota
   vizinha. */
import {
  listar as listarGate, criar as criarGate, remover as removerGate, acrescentar as acrescentarGate, guardarAnexo as guardarAnexoGate,
  deOutraMaquina as deOutraMaquinaGate,
  gravarCabecalho as gravarCabecalhoGate, reconciliar as reconciliarGate,
} from './gate.mjs'
import { responder as responderGate, parar as pararGate, conversaAoVivo as conversaAoVivoGate } from './gateTurno.mjs'
import { vivo as vivoGate, todosOsModelos as todosOsModelosGate } from './gateAgentes.mjs'
import { arquivar, jobsHistoricos, marcosDe, mudouDesde } from './historico.mjs'
import { readUso, lerChamada as lerChamadaStatusline } from './uso.mjs'

/* CC-269: carregado uma vez, usado nas duas rotas de sincronia. Fica como
   promessa e não como `await` no topo, para o arranque do painel não esperar
   por ele. */
const sincronia = import('./sincronia.mjs')

/* CC-262: o resultado da última revisão das pendências dele, por id.
   Vive em memória e é preenchido por `revisarPendencias()` a cada minuto: as
   provas rodam comando de sistema, e a aba Trabalho não pode pagar isso. */
let REVISAO_PENDENCIAS = {}
import {
  estado as estadoMidia, acao as acaoMidia,
  volume as volumeMidia, mudo as mudoMidia,
} from './midia.mjs'
import { estado as estadoMaquina } from './maquina.mjs'
import { lerRoadmap, ordenar as ordenarRoadmap } from './roadmap.mjs'
import { findProjects, projectsBase } from './install.mjs'
import { situacaoRotas } from './routia.mjs'
import { commitsDesde } from './gitlog.mjs'
import { digestTodos } from './digest.mjs'
import { enriquecerTodos } from './opencode.mjs'
import { ligar as ligarRemoto, desligar as desligarRemoto, estado as estadoRemoto, link as linkRemoto } from './remotecontrol.mjs'
import { garantirMercado } from './mercado.mjs'
import {
  readServers, killServer, duplicados, recentes, projetosLancaveis,
  subirServidor, abrirLocal, esquecerCache,
} from './servers.mjs'
import {
  readPaineis, ligarPainel, desligarPainel, portaDe, falhaAoLigar,
  resolverBinario, _internals as paineisInternals,
} from './paineis.mjs'
import { readNotes, writeNotes } from './notes.mjs'
import * as docs from './documentos.mjs'
// estáticos, não `await import` dentro da rota: a função que trata a requisição
// não é async, e o `await` ali quebrou o servidor inteiro por erro de sintaxe —
// com o `npm test` passando, porque o gate não carregava este arquivo
import * as bancada from './bancada.mjs'
import * as bancadaCatalogo from './bancadaCatalogo.mjs'
import { montar as montarEscritorio } from './escritorio.mjs'
import { montar as montarTrabalho, carregar as carregarProjetos, projetosDe } from './trabalho.mjs'
import { todas as todasSiglas } from './siglas.mjs'
import { arquivosDeclarados } from './oficinas.mjs'
import {
  desligar as desligarFramework, gravar as gravarFramework, ler as lerFramework,
  ligar as ligarFramework, situacao as situacaoFramework,
} from './frameworkDisco.mjs'
import {
  MODOS, PERFIS, autorizar as autorizarFramework, avaliar as avaliarFramework,
  faltaNoPerfil, modoDe as modoDeFramework, perfilResolvido, perfisEmArvore,
  resumo as resumoFramework, trocarModo as trocarModoFramework,
} from './framework.mjs'
import {
  ROTEIRO as ROTEIRO_ENTREVISTA, aplicaveis as aplicaveisEntrevista, desfazer as desfazerEntrevista,
  progresso as progressoEntrevista, proxima as proximaEntrevista, responder as responderEntrevista,
  respostasDe as respostasEntrevista, textoDaPergunta,
} from './entrevista.mjs'
import { criar as criarProjeto, gruposDe } from './novoProjeto.mjs'
import { log as logRecados, TIPOS as TIPOS_RECADO } from './recados.mjs'
import { resumo as resumoTempo } from './tempo.mjs'
import {
  setTaxa, setCambio, setAssinatura, setGraficos, setMercado, setSessao, setServidor, setPip,
  setVpsConfig, setCalendario, removerCalendario, hookEnabled, setHookEnabled, readConfig, setVisita,
  setMaquina, setFederacao, moduloLigado, setModuloProjeto, setPaineisMeus,
  CHAVE_TUDO, visitaGeral, setVisitaGeral, setTelaAberto, lerTelaAberto,
} from './config.mjs'
/* CC-243: os pedidos de autorização passam a chegar no painel, para ele decidir
   na tela.

   Importado no TOPO. A primeira versão usou `await import` dentro do handler de
   `/api/rotas`, que não é async, e derrubou o painel inteiro com
   `SyntaxError: Unexpected reserved word`. Importar aqui é seguro porque o
   comando de linha do módulo só roda quando ele é o arquivo chamado
   (`process.argv[1]`), nunca quando é importado. */
import {
  pendentes as pendentesDeRota, responder as responderPedidoDeRota,
} from '../hooks/routia/rota-pedidos.mjs'
import { agenda, esquecerCache as esquecerAgenda } from './calendario.mjs'
import { HOOKS, MODULOS as MODULOS_HOOKS } from './hooksCatalogo.mjs'
import { rodar as provarHooks, testeDe as provaTesteDe } from './hooksProva.mjs'
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
const UI_V2 = path.join(HERE, 'ui_v2.html')
const GRAFICOS = path.join(HERE, 'graficos.js')
/* O alvo quando ninguém escolheu projeto no filtro.
   `process.cwd()` NÃO serve: como serviço do systemd o painel roda de outro
   diretório, e a bancada respondia "o framework está desligado aqui" sobre uma
   pasta que não era projeto nenhum. A raiz do próprio código é estável em
   qualquer forma de subir o painel. */
const RAIZ_DO_PAINEL = path.join(HERE, '..')

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
    // CC-91 parte 3: o que eu pedi e ele ainda não liberou
    pedidos: s.estado.pedidos || [],
    modos: Object.values(MODOS).map((m) => ({ id: m.id, titulo: m.titulo, explica: m.explica })),
    /* Os perfis (17/08): a tela mostra a PROFISSÃO, porque é o que ele reconhece
       de relance. Cada um leva o que exige e o que desliga, para a escolha não
       ser um nome bonito sem consequência declarada. */
    perfil: s.estado.perfil || null,
    /* Em ÁRVORE: ele corrigiu em 17/08 que Perito, Pesquisador e Revisor são
       variações do Depurador, não papéis soltos. `falta` diz o que este papel
       está exigindo agora, para a escolha não parecer decorativa. */
    perfis: perfisEmArvore().map((p) => {
      const monta = (x) => {
        const r = perfilResolvido(x.id)
        return {
          id: x.id, titulo: x.titulo, contrataria: x.contrataria, entrega: x.entrega || null,
          exige: r.exige, desliga: r.desliga, teto: r.teto,
        }
      }
      return { ...monta(p), subs: p.subs.map(monta) }
    }),
    faltaPerfil: faltaNoPerfil(s.estado),
    fase: a.fase,
    tituloFase: a.tituloFase,
    portaoAberto: a.portaoAberto,
    pendencias: a.pendencias,
    resumo: resumoFramework(s.estado.metodo, s.estado),
    mvp: s.estado.mvp || null,
    mudancasDeEscopo: (s.estado.historico || []).filter((h) => h.tipo === 'escopo').length,
  }
}

/**
 * CC-133, segunda fatia: a entrevista do jeito que a TELA precisa.
 *
 * A primeira fatia entregou o roteiro que se reescreve pela resposta, e só pela
 * linha de comando. Ele não trabalha na linha de comando: trabalha no celular,
 * olhando o painel. Uma entrevista que só existe no terminal é, na prática, uma
 * entrevista que não existe.
 *
 * O que vai para a tela é o mesmo que o terminal vê — pergunta da vez, opções,
 * progresso — mais uma coisa que só a tela precisa: **o que já foi respondido**,
 * com o texto de cada resposta. No terminal a conversa fica na rolagem; na
 * página, sem essa lista, cada pergunta chega sem passado e ele não tem como
 * conferir o que disse antes de decidir voltar atrás.
 *
 * O progresso é sobre o roteiro APLICÁVEL, nunca sobre as 12 perguntas: a lista
 * cresce e encolhe conforme ele responde, e "3 de 12" quando o roteiro dele tem
 * 6 seria uma barra que anda para trás sozinha.
 */
export function retratoEntrevista(raiz) {
  const estado = lerFramework(raiz)
  if (!estado) return { existe: false, ligado: false }
  const respostas = respostasEntrevista(estado)
  const respondidas = aplicaveisEntrevista(respostas)
    .filter((p) => respostas[p.id] !== undefined)
    .map((p) => ({
      id: p.id,
      header: p.header,
      /* O texto da pergunta é recalculado, não guardado: ele depende das
         respostas atuais, e uma resposta trocada depois reescreve a frase. Ler
         a versão congelada faria a lista contar uma conversa que não aconteceu. */
      pergunta: textoDaPergunta(p, respostas),
      texto: respostas[p.id].texto,
      valor: respostas[p.id].valor || null,
    }))
  return {
    existe: true,
    ligado: estado.ligado !== false,
    proxima: proximaEntrevista(estado),
    ...progressoEntrevista(estado),
    respondidas,
    terminou: estado.entrevista?.terminou || null,
    roteiro: ROTEIRO_ENTREVISTA.length,
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
    /* CC-121: o que ESTA máquina tem, para a navegação não oferecer tela que
       abre vazia. No telefone, cinco das dezessete levavam a lugar nenhum.

       **Tudo aqui custa microssegundos, e essa é a regra do campo.** Estas telas
       são caras justamente quando ABREM (varrer portas leva segundos, ler
       roadmap de vinte projetos idem), então a navegação não pode perguntar a
       elas: perguntaria a cada 2 segundos. O que entra aqui é config já lida e
       existência de arquivo, nunca varredura.

       `vps` sai de `vpsConfigurada()` e não do host escrito no config: nesta VPS
       o painel roda em modo local, sem host nenhum, e a aba funciona. Olhar só o
       host esconderia a tela exatamente onde ela tem dado.

       `escritorio` pergunta se o programa existe nesta máquina, não se ele está
       no ar: painel parado continua sendo painel que dá para ligar, e a tela
       serve para isso. */
    tem: {
      vps: vpsConfigurada(),
      escritorio: paineisInternals.definicoes()
        .some((p) => Boolean(resolverBinario(p.cmd, { fork: p.fork }))),
    },
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
  /* CC-261: por que ESTA máquina não tem número próprio.
     Sem isso a tela só sabe dizer que o dado é de outra máquina, e não POR QUE
     o daqui não existe. São dois motivos com consertos diferentes: a barra de
     status nunca ter sido chamada (o caso do Remote Control, sem terminal), ou
     ter sido chamada e não trazer `rate_limits`. */
  const chamada = lerChamadaStatusline()
  const diagnostico = local ? null : (!chamada
    ? 'a barra de status nunca rodou nesta máquina'
    : (chamada.comDado
      ? 'a barra rodou e trouxe o número, mas ele não foi gravado'
      : `a barra rodou ${chamada.vezes}x aqui e nunca trouxe o número do plano`))
  if (!candidatos.length) return diagnostico ? { semDadoPorque: diagnostico } : null
  return { ...candidatos.sort((a, b) => (b.em || 0) - (a.em || 0))[0], semDadoLocalPorque: diagnostico }
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

/* CC-165: o retrato do último empurrão, para a tela poder responder "está
 * mesmo sendo enviado?".
 *
 * Pergunta dele, e ela não tinha resposta na tela: *"como garantimos que tá
 * tudo sendo vigiado e enviado pro cockpit na VPS?"*. O timer engole o erro
 * de propósito (`.catch(() => {})`), senão uma queda de rede derrubaria o
 * painel — mas engolir sem registrar é o mesmo defeito do `total: 0` do
 * CC-124: silêncio com cara de sucesso. Agora o erro fica guardado aqui e
 * aparece na tela.
 *
 * Memória do processo, não disco: é estado do processo vivo, e a pergunta que
 * ele responde ("está funcionando AGORA") não sobrevive a um reinício mesmo. */
let ultimoEmpurrao = null

/* CC-263: exportada para o modo `cc reportar`, que empurra sem levantar tela.
   É o coração do serviço do Windows: a mesma função que o painel já usava no
   timer de 30s, agora alcançável de fora. */
export async function empurrar({ comTempo = null } = {}) {
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
    } catch { /* varredura falhou: manda o resto, tempo vai na próxima */ }
  }

  /* CC-165: o backlog de cada projeto vai junto, a cada ciclo.
     Medido antes de entrar: ler o roadmap dos 23 projetos custa 14ms, três
     ordens de grandeza abaixo da varredura de tempo, então não precisa do
     relógio próprio que as horas precisaram. Só o RESUMO viaja: o arquivo em
     si é do git, e duas cópias do mesmo ROADMAP.md em canais diferentes seria
     duas verdades. */
  let backlogs = null
  try {
    backlogs = resumirBacklogs(findProjects().map((raiz) => ({
      projeto: path.basename(raiz),
      mapa: lerRoadmap(raiz),
    })))
  } catch { /* varredura falhou: o resto do pacote continua valendo */ }

  /* CC-263: o pacote leva também a lista DELE desta máquina e o que as outras
     ferramentas estão fazendo aqui. Cada leitura é protegida: uma falha em
     qualquer delas não pode impedir o envio do resto, senão a máquina inteira
     some do painel por causa de um campo. */
  let meuDaqui = null
  try {
    const M = await import('./meu.mjs')
    meuDaqui = M.ler().tarefas.filter((t) => !t.feito)
  } catch { meuDaqui = null }

  /* Quais das três ferramentas existem NESTA máquina. Lido do catálogo do gate,
     que já é a fonte de quem é quem; aqui só se acrescenta se o binário está
     instalado, que é o que muda de máquina para máquina.
     `null` continua sendo "não sei dizer", e é o que sai quando o catálogo não
     pode ser lido. */
  let agentesDaqui = null
  try {
    const { AGENTES_GATE } = await import('./gateAgentes.mjs')
    /* `resolverBinario` mora em `paineis.mjs`, e não em `platform.mjs`: ele
       nasceu para o botão do escritório, quando um binário instalado por npm
       global não estava no PATH do serviço systemd e o botão respondia "ok" sem
       subir nada. O mesmo problema vale aqui. */
    const { resolverBinario } = await import('./paineis.mjs')
    agentesDaqui = Object.entries(AGENTES_GATE).map(([id, a]) => ({
      id,
      rotulo: a.rotulo,
      paga: a.paga,
      instalado: typeof resolverBinario === 'function' ? Boolean(resolverBinario(a.binario)) : null,
    }))
  } catch { agentesDaqui = null }

  const pacote = montarPacote({
    maquina: s.maquina, jobs: meus, uso: s.uso, tempo, backlogs,
    meu: meuDaqui, agentes: agentesDaqui, limites: null,
  })
  const r = await enviarPacote({ enviarPara, token, pacote })
  /* CC-208: o relógio das horas só anda quando o envio CHEGA.
   *
   * Antes ele era carimbado assim que a varredura terminava, ainda dentro do
   * `try`. Envio que falhava (rede caída, VPS reiniciando, token errado)
   * jogava fora uma varredura de centenas de MB e, pior, marcava a hora como
   * enviada: os próximos dez minutos de empurrões iam sem `tempo`, e a outra
   * ponta ficava esse tempo todo sem saber as horas. É o mesmo defeito que o
   * CC-205 conserta do outro lado, e aqui na origem.
   *
   * Custo de tentar de novo: uma varredura a cada 30s enquanto a rede estiver
   * caída. Aceitável, e some sozinho no primeiro envio que passar. */
  if (tempo && r?.ok) ultimoTempoEnviado = agora
  ultimoEmpurrao = {
    em: Date.now(),
    ok: Boolean(r?.ok),
    erro: r?.ok ? null : (r?.erro || `resposta ${r?.status || 'sem status'}`),
    jobs: meus.length,
    comTempo: Boolean(tempo),
    para: enviarPara,
  }
  if (r?.ok && r.pedidos?.length) await atenderPedidos(r.pedidos)
  return r
}

/**
 * CC-166: os pedidos que voltaram na carona da resposta.
 *
 * A trava é uma só, e é a que ele escolheu entre três desenhos: **o pedido
 * carrega um NOME de projeto, e `cwdDoProjeto` só resolve o que esta máquina
 * já conhece**. Nome que não bate com projeto nenhum não vira caminho, não
 * vira comando, não faz nada. Com comando livre no lugar disso, quem
 * escrevesse na fila do servidor rodaria qualquer coisa no PC dele.
 *
 * Nunca lança: isto roda dentro do timer de 30s, e uma exceção aqui mataria o
 * empurrão seguinte junto.
 */
async function atenderPedidos(pedidos) {
  for (const p of pedidos.slice(0, 3)) { // teto por ciclo: fila estranha não vira enxame de sessões
    try {
      const dir = cwdDoProjeto(null, p.projeto)
      if (!dir) {
        console.error(`[federação] pedido recusado, projeto desconhecido: ${p.projeto}`)
        continue
      }
      await ligarRemoto(p.projeto, dir, { mais: false })
      console.error(`[federação] sessão aberta a pedido de ${p.de || 'outra máquina'}: ${p.projeto}`)
    } catch (e) {
      console.error(`[federação] pedido falhou (${p.projeto}): ${e?.message || e}`)
    }
  }
}

const CACHE_PROJETOS = { em: 0, dado: null }

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

  /* CC-176 / CC-186: o painel novo assume a raiz.
   *
   * O antigo NÃO foi apagado, e a diferença importa: ele continua inteiro em
   * `/v1`, servido pelo mesmo processo, e voltar atrás é trocar duas linhas
   * aqui. Apagar o arquivo seria a única parte irreversível desta troca, e
   * essa é decisão dele, não consequência automática de uma rota mudar de
   * lugar. `/v2` continua respondendo para não quebrar link salvo, atalho do
   * telefone nem captura de tela antiga.
   */
  if (url.pathname === '/' || url.pathname === '/v2') {
    return send(res, 200, fs.readFileSync(UI_V2, 'utf8'), 'text/html; charset=utf-8')
  }
  if (url.pathname === '/v1') return send(res, 200, fs.readFileSync(UI, 'utf8'), 'text/html; charset=utf-8')
  if (url.pathname === '/graficos.js') {
    return send(res, 200, fs.readFileSync(GRAFICOS, 'utf8'), 'text/javascript; charset=utf-8')
  }

  /* CC-283: as peças que fazem o painel virar aplicativo instalável.
   *
   * Ele salvou o cockpit na tela do telefone e virou atalho de navegador, com
   * barra de endereço: *"quando eu salvo ele abre como um site só, nao como
   * app"*. Faltavam três coisas, e são estas.
   *
   * O trabalhador de fundo é servido da RAIZ de propósito: ele só governa o
   * caminho de onde foi servido, e num subcaminho o painel inteiro ficaria de
   * fora do escopo do aplicativo. */
  if (url.pathname === '/app.webmanifest') {
    return send(res, 200, fs.readFileSync(path.join(HERE, 'app.webmanifest'), 'utf8'), 'application/manifest+json; charset=utf-8')
  }
  if (url.pathname === '/sw.js') {
    return send(res, 200, fs.readFileSync(path.join(HERE, 'sw.js'), 'utf8'), 'text/javascript; charset=utf-8')
  }
  if (url.pathname === '/icone.svg') {
    return send(res, 200, fs.readFileSync(path.join(HERE, 'icone.svg'), 'utf8'), 'image/svg+xml; charset=utf-8')
  }
  if (url.pathname === '/icone-192.png' || url.pathname === '/icone-512.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' })
    return res.end(fs.readFileSync(path.join(HERE, url.pathname.slice(1))))
  }
  /* A face condensada do boletim, hospedada aqui e não na Google.
     Fonte de sistema como voz do produto é o que o piso de qualidade recusa, e
     Bahnschrift só existe no Windows: em qualquer outra máquina a tela perdia
     o caráter sem ninguém notar. 18 KB servidos do próprio disco mantêm a
     promessa de funcionar offline, que buscar na rede quebraria.
     Cache longo porque o arquivo é imutável: muda de nome se mudar de face. */
  /* Vale para qualquer face do projeto, não só a primeira: o nome vem do
     caminho, mas só o nome-base, para que `/../` não vire leitura de disco
     fora daqui. */
  if (url.pathname.endsWith('.woff2')) {
    const f = path.join(HERE, path.basename(url.pathname))
    if (!fs.existsSync(f)) return send(res, 404, { error: 'fonte ausente' })
    res.writeHead(200, {
      'content-type': 'font/woff2',
      'cache-control': 'public, max-age=31536000, immutable',
    })
    return res.end(fs.readFileSync(f))
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

  // CC-82, a estante. Separada de /api/notes pela mesma razao que separa os
  // dois recursos: nota grava a cada tecla e vem inteira no payload; documento
  // e peca fechada, e a lista nao carrega o corpo de cada um — 500 documentos
  // no stream seriam megabytes por tique.
  if (url.pathname === '/api/docs') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 5e6, (b) => {
        if (b?.apagar) return docs.apagar(b.apagar)
        if (b?.acrescentar) return docs.acrescentar(b.acrescentar, b.linha || '')
        if (b?.publicar) return docs.publicar(b.publicar, b.projeto || process.cwd())
        return docs.gravar({ id: b?.id || null, titulo: b?.titulo, texto: b?.texto, fonte: b?.fonte })
      })
    }
    const id = url.searchParams.get('id')
    if (id) {
      const doc = docs.ler(id)
      return send(res, doc ? 200 : 404, doc || { erro: 'documento não existe' })
    }
    return send(res, 200, { docs: docs.listar() })
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
    /* CC-129: a pasta pessoal desta máquina, para a tela poder oferecer uma
       sessão avulsa ali. Ela não é projeto e nunca aparece em `projetos`, e o
       navegador não tem como descobrir o caminho sozinho. */
    return estadoRemoto().then((ativos) => send(res, 200, { projetos, ativos, casa: os.homedir() }))
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
      /* CC-166: a resposta do empurrão é a carona de volta.
         A VPS não alcança o PC atrás do NAT, então este é o único momento em
         que dá para entregar alguma coisa a ele: ele pergunta de 30 em 30
         segundos, e leva junto o que ficou guardado no nome dele. Nenhuma
         porta nova, nenhum serviço novo. */
      return {
        recebido: pacote.maquina,
        jobs: pacote.jobs.length,
        pedidos: pegarPedidos(pacote.maquina.nome),
      }
    })
  }

  /* CC-166: enfileira "abra uma sessão no projeto X" para outra máquina.
     Só o NOME do projeto viaja: quem executa confere contra a própria lista e
     recusa o que não conhecer. Ver `pedirSessao` para o porquê. */
  if (url.pathname === '/api/federacao/pedir' && req.method === 'POST') {
    return comCorpo(req, res, 2e3, ({ maquina, projeto }) =>
      pedirSessao({ paraMaquina: maquina, projeto, de: origemLocal().nome }))
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
      /* CC-165: as duas perguntas dele sobre confiabilidade, respondidas com
         dado e não com promessa. `empurrando` é o resultado do último envio
         de verdade (null antes do primeiro); `autostart` diz se este painel
         volta sozinho quando a máquina reinicia, que é o que separa "está no
         ar agora" de "fica no ar". */
      empurrando: ultimoEmpurrao,
      autostart: fs.existsSync(caminhoAutostart()),
      pacotes: pacotes.map((p) => ({
        maquina: p.maquina, jobs: p.jobs.length, em: p.em, idadeMs: p.idadeMs, semContato: p.semContato,
        /* CC-165: o backlog que a outra máquina reportou. Vai aqui e não numa
           rota nova porque quem pergunta "o que a outra máquina tem para
           fazer?" já está olhando esta tela. */
        backlogs: p.backlogs || [],
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
    /* CC-229: as explicações longas viajam junto, na mesma rota. Rota nova
       significaria dois pedidos para a mesma pergunta ("o que é isto?"), e o
       arquivo é pequeno o bastante para não pesar. */
    return send(res, 200, {
      verbetes, termos: termosDe(verbetes), palavras: lerPalavrasDaTela(dir), at: Date.now(),
    })
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
    // CC-227: a pendência sai daqui já dizendo de qual máquina ela é
    const tarefas = tudoMeu(snapshot().jobs, { maquinaLocal: origemLocal(readConfig())?.nome || null })
    return send(res, 200, { tarefas, abertas: tarefas.filter((t) => !t.feito).length, at: Date.now() })
  }

  /* CC-118: as mensagens que ele digitou e a fila descartou. Rota SEPARADA e só
     sob clique: ler o registro inteiro custa meio segundo em 43 MB, e no stream
     de 2 segundos isso travaria o painel (a armadilha do transcrito, de novo). */
  if (url.pathname === '/api/fila-perdida') {
    /* TODAS as sessões, não a mais recente. Ele pegou o defeito na primeira
       versão: "só tá aparecendo uma, não eram 74?" — a rota escolhia a sessão de
       sinal mais novo, que naquele instante era a do app_escritorio, com UMA
       mensagem perdida. Escolher sessão por conta própria, quando a pergunta é
       "o que EU digitei", é adivinhar. */
    try {
      const lista = perdidasDeTodasAsSessoes(path.join(casaClaude(), 'projects'))
      return send(res, 200, { existe: true, perdidas: lista, at: Date.now() })
    } catch (e) {
      return send(res, 200, { existe: true, perdidas: [], erro: String(e.message || e) })
    }
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
    const cfgModulos = readConfig() // uma leitura para a lista toda, não uma por projeto

    /* CC-164: quais projetos têm sessão viva AGORA, e de qual máquina.
     *
     * Ele viu a lista inteira da máquina e reclamou com razão: *"não faz
     * sentido aparecer um monte de projeto desativado, tudo com framework
     * desativado porque nem no remoto tá ligado"*. Projeto sem ninguém
     * trabalhando nele é ruído entre os que importam.
     *
     * Sai do snapshot, que já mescla as máquinas da federação — então um
     * projeto ativo NA VPS aparece marcado aqui também, com a origem dele,
     * que é o que ele pediu ao falar em separar por onde está hospedado. */
    const ativos = new Map()
    for (const j of snapshot().jobs) {
      if (!j.project) continue
      const onde = j.origem?.nome || null
      const ja = ativos.get(j.project) || new Set()
      if (onde) ja.add(onde)
      ativos.set(j.project, ja)
    }

    for (const raiz of findProjects()) {
      const nome = path.basename(raiz)
      if (vistos.has(nome)) continue
      vistos.add(nome)
      // CC-115: a mesma lista carrega os módulos todos — framework, rotas e
      // os grupos de proteção com o interruptor por projeto
      const modulos = {}
      for (const m of Object.keys(MODULOS_HOOKS)) modulos[m] = moduloLigado(m, nome, cfgModulos)
      const onde = ativos.get(nome)
      lista.push({
        projeto: nome,
        raiz,
        ...retratoFramework(raiz),
        rotas: situacaoRotas(raiz),
        modulos,
        ativo: Boolean(onde),
        maquinas: onde ? [...onde].sort() : [],
      })
    }
    /* Ativo primeiro, depois quem tem framework, depois alfabético: a ordem
       responde "onde estou trabalhando" antes de "o que existe nesta pasta". */
    lista.sort((a, b) => (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0)
      || (b.existe ? 1 : 0) - (a.existe ? 1 : 0)
      || a.projeto.localeCompare(b.projeto))

    /* CC-161: o estado do git de cada projeto, que é o que decide se o backlog
     * daqui é o mais novo.
     *
     * **Só para os que a tela mostra**, e a razão é medida: 23 projetos custam
     * 1905ms (83ms cada), e isso não pode estar numa rota que a tela chama. Os
     * que aparecem por padrão são os ativos e os com framework, uns 4 aqui, o
     * que dá ~330ms. Quem revelar o resto paga o preço do resto, e paga uma
     * vez, no clique.
     *
     * **Avisa, nunca puxa.** Decisão registrada quando o item nasceu: `git
     * pull` automático por cima de mudança não commitada é o tipo de coisa que
     * este projeto já aprendeu a não fazer sem perguntar. */
    for (const p of lista) {
      if (!(p.ativo || (p.existe && p.ligado))) continue
      p.git = estadoGit(p.raiz)
    }
    return send(res, 200, { projetos: lista, catalogoModulos: MODULOS_HOOKS, at: Date.now() })
  }

  // CC-115: liga e desliga um grupo de proteções num projeto. Só o
  // desligamento fica gravado; religar apaga a entrada e o padrão é ligado.
  if (url.pathname === '/api/modulos' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ projeto, modulo, ligado }) => {
      if (!MODULOS_HOOKS[modulo]) return { error: `módulo desconhecido: ${modulo}` }
      if (!projeto) return { error: 'sem projeto' }
      return { projeto, modulo, ligado: setModuloProjeto(projeto, modulo, !!ligado) }
    })
  }

  /* A Bancada pela tela. Fora do stream de propósito: rodar uma camada leva de
     segundos a minutos e fala com servidor de verdade — no `/api/jobs` isso
     viraria varredura a cada 2 segundos, contra o projeto dele. */
  if (url.pathname === '/api/bancada') {
    const B = bancada
    const C = bancadaCatalogo

    if (req.method === 'POST') {
      // `comCorpoAsync`, não `comCorpo`: rodar camada devolve promessa, e o
      // síncrono responderia o objeto pendente em vez do resultado
      return comCorpoAsync(req, res, 1e4, async ({ projeto, cwd, acao, nivel, camada }) => {
        const raiz = cwdDoProjeto(cwd, projeto) || RAIZ_DO_PAINEL
        const estado = lerFramework(raiz)
        if (!estado) return { error: 'este projeto não tem framework ligado' }

        if (acao === 'nivel') {
          if (!C.NIVEIS[nivel]) return { error: `nível desconhecido: ${nivel}` }
          gravarFramework(raiz, { ...estado, nivelBancada: nivel })
          return { ok: true, nivel }
        }
        if (acao === 'rodar') {
          const r = camada
            ? await B.rodar(raiz, camada, estado.bancadaCfg || {})
            : await B.rodarNivel(raiz, nivel || estado.nivelBancada || 'rascunho', estado.bancadaCfg || {})
          return r.erro ? { error: r.erro } : r
        }
        return { error: 'ação desconhecida' }
      })
    }

    /* Sem projeto escolhido no filtro, o alvo é a pasta onde o painel roda.
       A alternativa seria a tela vazia com "não achei a pasta deste projeto",
       que é o que aparecia — e é confuso, porque o filtro em "todos os
       projetos" é o estado NORMAL de quem abre o painel. Verificação de
       segurança é sempre de UM projeto: não existe rodar em todos de uma vez. */
    const raiz = cwdDoProjeto(url.searchParams.get('cwd'), url.searchParams.get('projeto')) || RAIZ_DO_PAINEL
    const estado = lerFramework(raiz)
    const nivel = estado?.nivelBancada || 'rascunho'
    const s = B.situacao(raiz, estado?.bancadaCfg || {})
    return send(res, 200, {
      raiz,
      ligado: Boolean(estado && estado.ligado !== false),
      nivel,
      declarado: Boolean(estado?.nivelBancada),
      niveis: Object.values(C.NIVEIS),
      camadas: s.camadas,
      veredito: C.avaliarNivel(nivel, s.camadas),
      at: Date.now(),
    })
  }

  if (url.pathname === '/api/framework') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e3, ({ projeto, cwd, acao, modo, perfil, alvo, motivo }) => {
        const raiz = cwdDoProjeto(cwd, projeto)
        if (!raiz) return { error: 'não achei a pasta deste projeto' }

        /* Perfil pelo clique (17/08): é o que ele escolhe de verdade, porque
           "Designer" ele reconhece e "desenho mais sugestivo" ele teria que
           decorar. Guarda o perfil E o modo base, para quem lê o arquivo sem
           passar pelo framework continuar entendendo o que está valendo. */
        if (acao === 'perfil') {
          const estado = lerFramework(raiz)
          if (!estado) return { error: 'este projeto não tem framework ligado' }
          if (!perfil || perfil === 'nenhum') {
            const semPerfil = { ...estado }
            delete semPerfil.perfil
            gravarFramework(raiz, semPerfil)
            return { raiz, ...retratoFramework(raiz) }
          }
          const r = perfilResolvido(perfil)
          if (!r) return { error: `perfil desconhecido: ${perfil}` }
          gravarFramework(raiz, { ...estado, perfil, modo: r.base.id })
          return { raiz, ...retratoFramework(raiz) }
        }

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
    /* CC-161: o git vai junto aqui, e não só na lista de módulos. Esta rota é
       de UM projeto, sob clique (~85ms), e é ela que alimenta a faixa dentro
       do projeto ativo — que é onde ele olha. Na lista, o mesmo dado custa o
       número de projetos vezes isso, e por lá só os visíveis pagam. */
    return send(res, 200, { raiz, ...retratoFramework(raiz), git: estadoGit(raiz) })
  }

  /* CC-143: criar projeto novo pelo painel.

     GET diz ONDE os projetos desta máquina moram e que grupos existem lá, para
     a tela nunca precisar chutar caminho: a base é descoberta, e no PC dele os
     projetos ficam dentro de grupos que na VPS não existem. */
  if (url.pathname === '/api/projeto/novo') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ nome, grupo, descricao }) => {
        const base = projectsBase()
        const r = criarProjeto(base, { nome, grupo, descricao })
        if (!r.ok) return { error: r.erro }
        /* O retrato do framework vai junto porque o projeto nasce ligado e a
           tela abre a entrevista na sequência: sem isso ela faria duas voltas
           ao servidor para mostrar o que já é sabido aqui. */
        return { ...r, framework: retratoFramework(r.raiz), entrevista: retratoEntrevista(r.raiz) }
      })
    }
    const base = projectsBase()
    return send(res, 200, { base, grupos: gruposDe(base), at: Date.now() })
  }

  /* CC-133, segunda fatia: a entrevista pela tela.
     Rota separada do `/api/framework` de propósito. A lista de módulos lê o
     retrato de ~20 projetos de uma vez, e carregar a conversa inteira de cada
     um ali dentro seria pagar por 19 que ninguém abriu. Aqui é sob clique, de
     um projeto só, como a bancada e as portas. */
  if (url.pathname === '/api/entrevista') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ projeto, cwd, acao, id, texto }) => {
        const raiz = cwdDoProjeto(cwd, projeto)
        if (!raiz) return { error: 'não achei a pasta deste projeto' }
        const estado = lerFramework(raiz)
        if (!estado) return { error: 'este projeto não tem framework ligado' }

        if (acao === 'desfazer') {
          const r = desfazerEntrevista(estado, id)
          if (!r.ok) return { error: r.erro }
          gravarFramework(raiz, r.estado)
          /* As órfãs voltam na resposta porque apagar uma resposta apaga junto
             o que só existia por causa dela, e isso tem que aparecer na tela.
             Sumir em silêncio é como a decisão de login ficaria órfã no resumo
             sem ninguém ver. */
          return { raiz, orfas: r.orfas, ...retratoEntrevista(raiz) }
        }

        const r = responderEntrevista(estado, id, texto)
        if (!r.ok) return { error: r.erro }
        gravarFramework(raiz, r.estado)
        /* O retrato sai do DISCO, não do estado em memória: é a mesma regra da
           troca de modo, em que a tela dizia "salvo" sobre um arquivo que não
           tinha mudado. O que a tela mostra é o que ficou gravado. */
        return { raiz, ...retratoEntrevista(raiz) }
      })
    }
    const raiz = cwdDoProjeto(url.searchParams.get('cwd'), url.searchParams.get('projeto'))
    if (!raiz) return send(res, 200, { existe: false, ligado: false, semPasta: true })
    return send(res, 200, { raiz, ...retratoEntrevista(raiz) })
  }

  /* CC-134: o que os agentes conversaram entre si, registrado e visível.
     Pedido dele em 15/08, antes de duas sessões trabalharem juntas de verdade:
     um log "por projeto, por hora, poder ver em ordem crescente, decrescente,
     separar por projeto, separar por agentes". A ordenação e os filtros são
     do lado do navegador (a mesma regra da tabela de jobs, que já ordena por
     clique); aqui só a varredura, que é o lado caro.

     Sem `projeto`, varre TODOS os conhecidos, igual à aba de servidores: são
     leituras de JSON pequeno, uma por projeto, nunca no tique de 2s. */
  if (url.pathname === '/api/recados') {
    const alvo = url.searchParams.get('projeto')
    const raizes = alvo
      ? [cwdDoProjeto(url.searchParams.get('cwd'), alvo)].filter(Boolean)
      : findProjects()
    const todos = []
    for (const raiz of raizes) {
      const nome = path.basename(raiz)
      for (const r of logRecados(raiz, 300)) todos.push({ ...r, projeto: nome })
    }
    todos.sort((a, b) => b.em - a.em)
    return send(res, 200, { recados: todos, tipos: TIPOS_RECADO, at: Date.now() })
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
      // dir nulo: a aba de hooks mostra o interruptor global; o cwd do painel
      // é um projeto por acaso e não pode colorir a resposta (CC-115)
      hooks: HOOKS.map((h) => ({
        ...h,
        ligado: hookEnabled(h.id, undefined, null),
        registrado: registrados[h.id],
        // CC-103: tem teste escrito? Leitura de disco barata, sem rodar nada.
        teste: Boolean(provaTesteDe(h.id)),
      })),
    })
  }

  /* CC-103: rodar as travas sob demanda, o que faltava do `pre-commit
     run --all-files`. Fora do stream por definição: são ~28 processos e leva
     dezenas de segundos, então só acontece com o clique dele. */
  if (url.pathname === '/api/hooks/provar' && req.method === 'POST') {
    return comCorpoAsync(req, res, 1e4, async ({ ids }) => {
      const alvos = Array.isArray(ids) ? ids.filter((id) => HOOKS.some((h) => h.id === id)) : null
      return provarHooks(alvos, {})
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
  /* CC-178/179: os painéis que ele monta.
     Mesma casa do `pip` e pela mesma razão: é preferência de leitura, mora no
     config e não em `~/.claude/jobs`. O teto de 9 painéis não é técnico, é a
     tecla: a troca é pelas teclas 1 a 9, e o décimo não teria como ser
     chamado. Cada painel guarda só nome e ids de bloco. */
  if (url.pathname === '/api/paineis-meus') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e5, ({ paineis }) => ({ paineis: setPaineisMeus(paineis) }))
    }
    return send(res, 200, { paineis: readConfig().paineisMeus || [] })
  }

  /**
   * CC-156: o que está aberto ou fechado na tela, guardado no servidor.
   *
   * Pedido dele: abrir uma seção no celular e encontrar ela aberta no PC. Hoje
   * isso mora no navegador de cada aparelho, e o painel federado já é um só.
   *
   * A chave é OPACA (`proj:inovallbond`, `sprint:...`): quem decide o que é
   * seção é a tela. O erro vai no corpo com status 400 em vez de virar mapa
   * vazio, porque vazio por erro parece "nunca abri nada" — e essa confusão é
   * a família de defeito mais cara deste painel.
   */
  /**
   * CC-269: o estado de sincronia de todos os projetos, e as duas ações.
   *
   * Pedido dele: *"um botão e resolve"*. Rota separada e só sob clique, porque
   * `git fetch` fala com a rede: no tique de 2 segundos isso seria a terceira
   * chamada de rede do painel, multiplicada por 18 projetos.
   */
  if (url.pathname === '/api/sincronia') {
    /* Este handler não é async, então `await` solto aqui quebra o arquivo
       inteiro: aconteceu hoje mais cedo, com `SyntaxError: Unexpected reserved
       word`, e o painel ficou reiniciando em laço. */
    const buscar = url.searchParams.get('buscar') === '1'
    sincronia
      .then((S) => S.estadoDeVarios(findProjects().filter(S.ehRepo), { buscar }))
      .then((lista) => send(res, 200, { projetos: lista, consultado: buscar, at: Date.now() }))
      .catch((e) => send(res, 500, { error: String(e.message || e) }))
    return
  }

  if (url.pathname === '/api/sincronia/acao' && req.method === 'POST') {
    /* `comCorpoAsync` porque estas ações demoram: um envio com gate pode levar
       minutos, e o `comCorpo` comum devolveria antes de terminar. */
    return comCorpoAsync(req, res, 4e3, async ({ projeto, acao, semGate }) => {
      const S = await sincronia
      const dir = findProjects().filter(S.ehRepo).find((p) => path.basename(p) === projeto)
      if (!dir) return { erro: `não achei o projeto "${projeto}"` }
      if (!['puxar', 'enviar', 'tudo'].includes(acao)) return { erro: 'ação precisa ser puxar, enviar ou tudo' }
      const r = acao === 'puxar' ? await S.puxar(dir)
        : acao === 'enviar' ? await S.enviar(dir, { semGate: Boolean(semGate) })
          : await S.sincronizar(dir, { semGate: Boolean(semGate) })
      return { resultado: r }
    })
  }

  if (url.pathname === '/api/tela') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 4e3, ({ chave, aberto, valor }) => {
        /* CC-309: `valor` numérico entra para a largura da barra lateral, que
           é estado de tela como os outros e não tinha onde morar. Sem ele, o
           painel gravaria `true` e a largura voltaria sempre no padrão. */
        const r = setTelaAberto(chave, (typeof valor === 'number' || typeof valor === 'string') ? valor : aberto)
        /* LANÇA em vez de devolver `{erro}`: `comCorpo` carimba `ok: true` em
           tudo que ele retorna, então a recusa sairia como sucesso com um erro
           pendurado do lado. Lançando, a resposta é 400 com `ok: false`, que é
           o que "falhar em voz alta" quer dizer aqui. */
        if (r.erro) throw new Error(r.erro)
        return r
      })
    }
    return send(res, 200, { aberto: lerTelaAberto(), at: Date.now() })
  }

  if (url.pathname === '/api/pip') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ blocos, layout }) => ({ pip: setPip({ blocos, layout }) }))
    }
    return send(res, 200, { pip: readConfig().pip })
  }

  /* ==================== O GATE: a conversa é do painel ====================
   *
   * Ele fala com Claude Code, opencode e agy numa conversa só, e troca de agente
   * no meio dela. O histórico, as regras e o estado do projeto ficam AQUI, e por
   * isso o agente novo continua de onde o anterior parou.
   *
   * As rotas são casca fina de propósito: quem guarda é `gate.mjs`, quem chama
   * agente é `gateAgentes.mjs`, quem monta o contexto é `gatePacote.mjs`, e quem
   * sabe a ordem é `gateTurno.mjs`.
   *
   * **A resposta NUNCA é esperada dentro da requisição.** Ela leva minutos, e o
   * navegador dele penduraria: no telefone, na rua, isso é a tela morrendo. O
   * POST devolve assim que o agente sobe, e a tela lê o que já foi gravado.
   */
  if (url.pathname === '/api/gate/conversas') {
    return send(res, 200, { conversas: listarGate(), at: Date.now() })
  }

  /* CC-276: o modo de trabalho do projeto desta conversa, para trocar sem sair
     dela. Pedido dele: *"poder mudar o framework ali pelo chat"*.
     Só LÊ: a troca continua indo pela rota que já existe, para não haver dois
     caminhos gravando a mesma coisa de jeitos diferentes. */
  if (url.pathname === '/api/gate/modo') {
    const cwd = url.searchParams.get('cwd')
    if (!cwd) return send(res, 400, { erro: 'preciso da pasta do projeto' })
    /* Caminho de outra máquina não resolve aqui, e resolver por engano é como o
       backlog de um projeto vira o de outro sem erro nenhum. */
    if (deOutraMaquinaGate(cwd)) return send(res, 200, { existe: false, deOutraMaquina: true })
    try {
      /* `retratoFramework` já monta tudo o que a tela de framework usa: o modo
         de agora, o título legível, os modos possíveis e os perfis. Montar de
         novo aqui daria duas contas para a mesma coisa, que é como as duas
         telas passariam a discordar. */
      return send(res, 200, retratoFramework(path.resolve(cwd)))
    } catch (e) {
      /* Falha de leitura diz que falhou, nunca vira "não tem framework": os
         dois pareceriam iguais na tela e são opostos. */
      return send(res, 200, { erro: String(e.message || e) })
    }
  }

  /* Os modelos de cada agente. Rota própria e não dentro da lista de conversas:
     ela pergunta ao binário de dois deles, leva segundos na primeira vez, e a
     lista de conversas é pedida a cada dois segundos. */
  if (url.pathname === '/api/gate/modelos') {
    return todosOsModelosGate()
      .then((modelos) => send(res, 200, { modelos, at: Date.now() }))
      .catch((e) => send(res, 200, { modelos: {}, erro: String(e.message || e) }))
  }

  if (url.pathname === '/api/gate/conversa') {
    const id = url.searchParams.get('id')
    const c = id ? conversaAoVivoGate(id) : null
    if (!c) return send(res, 404, { erro: 'conversa não encontrada' })
    return send(res, 200, c)
  }

  if (url.pathname === '/api/gate/nova' && req.method === 'POST') {
    return comCorpo(req, res, 4e3, ({ projeto, cwd, titulo }) => {
      /* A pasta é obrigatória e recusada fora da base de projetos. **Esta é a
         trava principal do recurso inteiro**: ele autorizou o agente a agir
         livre, e uma conversa apontada para o lugar errado seria comando
         arbitrário na pasta errada. Sem `cwd`, cai na pasta do próprio painel,
         que é conhecida e está dentro da base. */
      /* CC-326: era `process.cwd()`, e isso abria a pasta pessoal INTEIRA.
       *
       * O comentário abaixo dizia que sem `cwd` a conversa cai "na pasta do
       * próprio painel, que é conhecida e está dentro da base". A frase é
       * verdadeira quando alguém roda `node cc.mjs` de dentro do repositório, e
       * FALSA em produção: o serviço do sistema sobe a partir de
       * `/home/claudedev`, medido em 22/08. Então `ehOPainel` passava a valer
       * para a casa inteira, com `.ssh`, `.claude` e os arquivos de senha do
       * cockpit dentro dela, e uma conversa sem pasta ganhava tudo isso.
       *
       * `RAIZ_DO_PAINEL` sai do caminho DESTE arquivo, então não depende de
       * onde alguém chamou o processo. Achado indo conferir outra coisa: uma
       * conversa real na lista dele estava com `cwd: /home/claudedev`. */
      const alvo = path.resolve(cwd || RAIZ_DO_PAINEL)
      /* `projectsBase()` é a mesma conta que o resto do painel usa, e ela é
         descoberta, nunca caminho fixo de máquina. Quando a descoberta falha,
         a pasta do próprio painel ainda vale: ela é conhecida e é um projeto
         dele. O que nunca vale é uma pasta arbitrária. */
      let base = null
      try { base = path.resolve(projectsBase() || '') } catch { base = null }
      const dentroDaBase = base && (alvo === base || alvo.startsWith(base + path.sep))
      const ehOPainel = alvo === path.resolve(RAIZ_DO_PAINEL)
      if (!dentroDaBase && !ehOPainel) throw new Error(`a pasta ${alvo} está fora da base de projetos`)
      return criarGate({ titulo, projeto: projeto || path.basename(alvo), cwd: alvo })
    })
  }

  if (url.pathname === '/api/gate/mensagem' && req.method === 'POST') {
    /* 100 KB: ele dita mensagem longa por voz, e cortar o pedido dele calado
       seria a pior forma de economizar. */
    return comCorpo(req, res, 1e5, ({ id, texto, agente, modelo, esforco, anexos }) => {
      if (!id || !String(texto || '').trim()) throw new Error('preciso da conversa e do texto')
      return responderGate(id, {
        texto: String(texto), agente: agente || 'claude',
        modelo: modelo || null, esforco: esforco || null,
        anexos: Array.isArray(anexos) ? anexos : [],
      })
    })
  }

  if (url.pathname === '/api/gate/parar' && req.method === 'POST') {
    return comCorpo(req, res, 1e3, ({ id }) => pararGate(id))
  }

  /* Apaga uma conversa. Devolve `achou: false` quando não havia nada, em vez de
     dizer que apagou: "apaguei" sem ter apagado é a mentira mais fácil de
     contar aqui, porque some justamente o que se usaria para conferir. */
  if (url.pathname === '/api/gate/apagar' && req.method === 'POST') {
    return comCorpo(req, res, 1e3, ({ id }) => {
      if (!id) throw new Error('preciso saber qual conversa')
      pararGate(id)
      return removerGate(id)
    })
  }

  /* Escreve um aviso do PAINEL na conversa, sem chamar agente nenhum.
     Existe porque registrar "o modo mudou" pela rota de mensagem dispararia um
     turno, e ele pagaria um agente para ler um recado do próprio painel. */
  if (url.pathname === '/api/gate/nota' && req.method === 'POST') {
    return comCorpo(req, res, 4e3, ({ id, texto }) => {
      if (!id || !String(texto || '').trim()) throw new Error('preciso da conversa e do texto')
      return { evento: acrescentarGate(id, { tipo: 'sistema', texto: String(texto) }) }
    })
  }

  /* CC-277: recebe um arquivo que ele mandou e devolve o caminho no disco.
     O teto é 12 MB porque print de celular moderno passa de 3 MB, e cortar o
     que ele mandou seria o mesmo que não aceitar. */
  /* Serve um anexo já gravado, para a conversa mostrar o print que ele mandou.
     Só entrega o que está DENTRO de uma pasta de anexos do próprio gate: sem
     essa trava, o caminho vindo do navegador leria qualquer arquivo da
     máquina. */
  if (url.pathname === '/api/gate/anexo' && req.method === 'GET') {
    const caminho = path.resolve(url.searchParams.get('caminho') || '')
    if (!/[/\\][a-z0-9-]+\.anexos[/\\]/i.test(caminho) || !fs.existsSync(caminho)) {
      return send(res, 404, { erro: 'anexo não encontrado' })
    }
    const tipos = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
    const tipo = tipos[path.extname(caminho).toLowerCase()] || 'application/octet-stream'
    res.writeHead(200, { 'content-type': tipo, 'cache-control': 'private, max-age=3600' })
    return res.end(fs.readFileSync(caminho))
  }

  if (url.pathname === '/api/gate/anexo' && req.method === 'POST') {
    return comCorpo(req, res, 12e6, ({ id, nome, dados }) => {
      if (!id || !dados) throw new Error('preciso da conversa e do arquivo')
      return guardarAnexoGate(id, { nome, dados })
    })
  }

  if (url.pathname === '/api/gate/rascunho' && req.method === 'POST') {
    return comCorpo(req, res, 1e5, ({ id, texto }) => {
      gravarCabecalhoGate(id, { rascunho: String(texto || '') })
      return { gravado: true }
    })
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
  /**
   * CC-287: a tela da zona inteligente.
   *
   * Duas rotas, e a divisão é o ponto: **ler é barato, colher é caro.** A
   * leitura abre o arquivo do armazém e devolve; a colheita varre 173 MB de
   * conversa e leva segundos.
   *
   * Por isso a colheita fica atrás de um POST, disparado por clique, e nunca
   * entra no fluxo de 2 em 2 segundos. É a mesma regra da varredura de portas e
   * da leitura da VPS, e ela existe porque já custou o painel inteiro travar.
   */
  /**
   * CC-297: o log das travas, ao vivo.
   *
   * Leitura barata de propósito: só a cauda de cada conversa, com cache por
   * tamanho e data. Medido em 22/08: 134 ms na primeira chamada, 2 ms nas
   * seguintes. É o que permite esta rota viver perto do fluxo de 2 em 2
   * segundos, ao contrário da colheita da zona inteligente, que leva 17 s e por
   * isso mora atrás de um botão.
   */
  if (url.pathname === '/api/travas' && req.method === 'POST') {
    return import('./travas.mjs').then((T) => comCorpo(req, res, 1e5, ({ id, valor }) => {
      /* `valor` nulo desmarca: marcar por engano tem que ter volta. */
      const r = T.julgar(id, valor === undefined ? null : valor)
      return { ok: true, ...r, placar: T.placar() }
    }))
  }

  /* A carga completa: varre as conversas inteiras, ~2 s. Fica atrás de um
     clique pelo mesmo motivo da colheita da zona inteligente. */
  if (url.pathname === '/api/travas/recolher' && req.method === 'POST') {
    return import('./travas.mjs').then((T) => {
      try { send(res, 200, { ok: true, ...T.recolherTudo() }) }
      catch (e) { send(res, 500, { error: String(e.message || e) }) }
    })
  }

  if (url.pathname === '/api/travas') {
    /* `async` no handler não é estilo: sem ele, o `await import` lá dentro é
       erro de sintaxe e derruba o servidor inteiro na hora de carregar. Já
       aconteceu duas vezes neste arquivo. */
    return import('./travas.mjs').then(async (T) => {
      try {
        const limite = Math.min(300, Number(url.searchParams.get('limite')) || 80)
        const lista = T.eventos({
          limite,
          trava: url.searchParams.get('trava') || null,
          projeto: url.searchParams.get('projeto') || null,
        })
        const julgamentos = T.lerJulgamentos()
        const amplo = T.eventos({ limite: 1000 })

        /* CC-300: o "?" de cada regra. Pedido dele: *"coloque '?' em todas as
           regras explicando o que são, como se ativam e até o prompt"*.
           Vai TUDO junto no mesmo pedido, e não numa rota por regra: são 38
           entradas pequenas, e uma ida à rede por toque abriria um buraco de
           espera bem no gesto de querer entender. */
        const H = await import('./hooksCatalogo.mjs')
        const nomes = [...new Set([
          ...(H.HOOKS || []).map((h) => h.id),
          ...amplo.map((e) => e.trava).filter(Boolean),
        ])]
        const regras = await Promise.all(nomes.map((n) => T.explicar(n, amplo)))

        send(res, 200, {
          eventos: lista.map((e) => ({ ...e, julgamento: julgamentos[e.id]?.valor || null })),
          placar: T.placar(amplo),
          /* Ordenadas pelas que mais dispararam. As que nunca dispararam vão
             para o fim, e a tela as separa: são regras vigiando algo que ainda
             não aconteceu, e isso é diferente de regra inativa. */
          regras: regras.sort((a, b) => b.vezes - a.vezes),
          /* Quantos eventos a cauda alcança, para a tela não afirmar que este é
             o histórico inteiro. Ela vê as últimas horas de cada conversa, não
             tudo o que já aconteceu. */
          alcance: amplo.length,
          /* CC-315: o log lê os transcritos DESTA máquina, então tudo aqui é
             daqui. Dizer isso é a mesma regra do resto do painel. */
          maquina: origemLocal(readConfig())?.nome || null,
          projetos: [...new Set(amplo.map((e) => e.projeto).filter(Boolean))].sort(),
        })
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  if (url.pathname === '/api/armazem' && req.method === 'POST') {
    return import('./coletores.mjs').then(async (C) => {
      const A = await import('./armazem.mjs')
      const { findProjects } = await import('./install.mjs')
      const desde = url.searchParams.get('desde') || null
      try {
        const { registros, transcritos } = await C.coletarTranscritos({ desde })
        const { registros: doGit } = await C.coletarGit(findProjects(), { desde })
        const r = A.gravar([...registros, ...doGit])
        /* `onde` volta para a tela de propósito: cair no abrigo em silêncio é
           exatamente como o dado parece sumir. */
        send(res, 200, { ok: r.ok, gravados: r.gravados, onde: r.onde, transcritos })
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  if (url.pathname === '/api/armazem') {
    return import('./armazem.mjs').then(async (A) => {
      const C = await import('./coletores.mjs')
      try {
        /* Só o que o catálogo conhece hoje.
           O armazém é append-only e guarda tudo o que já foi gravado, inclusive
           medida que mudou de nome: `permissões negadas` virou duas em 22/08, e
           sem este filtro a tela mostraria as três, a antiga congelada no dia
           em que parou de ser gravada. Dado velho não é apagado, só sai da
           vitrine; `cc armazem estado` continua listando as órfãs. */
        const ms = A.medidas().filter((m) => C.CATALOGO[m.medida])
        const projeto = url.searchParams.get('projeto') || null
        const series = {}
        const alarmes = []
        /* O dia de referência é o último dia FECHADO, nunca o de hoje.
           Medido em 22/08, às 3 da manhã: o dia em curso tinha 103 ferramentas
           usadas contra uma média de 900, e três medidas apareciam vazias
           porque ainda não houve commit. Comparar um dia pela metade com uma
           média de dias inteiros dá sempre "abaixo do normal", o que enterra o
           alarme, e uma medida vazia ao lado de uma média cheia parece leitura
           que falhou. As duas leituras erradas pelo mesmo motivo.
           A série continua mostrando hoje: quem olha o desenho quer o que está
           acontecendo agora. Quem lê o julgamento precisa de um dia completo. */
        const hoje = A.hojeISO()
        const dias = [...new Set(A.ler().map((r) => r.dia))].sort()
        const fechados = dias.filter((d) => d < hoje)
        const ultimo = fechados.length ? fechados[fechados.length - 1] : (dias[dias.length - 1] || '')
        const emCurso = Boolean(dias.length) && dias[dias.length - 1] === hoje
        /* CC-288: o grão do tempo, pedido dele. O recorte `de`/`ate` vem da
           navegação por setas: quem anda no tempo pede uma janela, e mandar a
           série inteira a cada passo seria carregar um ano para mostrar uma
           semana. */
        const grao = ['dia', 'semana', 'mes', 'ano'].includes(url.searchParams.get('grao'))
          ? url.searchParams.get('grao') : 'dia'
        const diaValido = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null)
        const de = diaValido(url.searchParams.get('de'))
        const ate = diaValido(url.searchParams.get('ate'))

        const canais = {}
        for (const m of ms) {
          const bruta = A.serie(m.medida, { projeto, desde: de, ate })
          series[m.medida] = A.agregar(bruta, grao, C.agregacaoDe(m.medida))
          /* O canal roda sobre a série AGREGADA: em grão de mês, o normal de um
             mês se compara com os meses anteriores, nunca com dias. */
          canais[m.medida] = A.canal(series[m.medida], grao === 'dia' ? 14 : 6)
          alarmes.push({ ...A.faixa(m.medida, { projeto, dia: ultimo }), rotulo: C.rotuloDaMedida(m.medida) })
        }

        /* CC-289: o calendário é sempre por DIA, mesmo quando a curva está em
           mês. São duas perguntas diferentes: a curva mostra a tendência, o
           calendário mostra em que dias houve trabalho. */
        const emFoco = url.searchParams.get('medida') || (ms[0]?.medida ?? null)
        const diario = emFoco ? A.serie(emFoco, { projeto }) : []

        const projetos = [...new Set(A.ler().map((r) => r.projeto).filter(Boolean))].sort()
        send(res, 200, {
          medidas: ms.map((m) => ({
            ...m,
            rotulo: C.rotuloDaMedida(m.medida),
            ajuda: C.CATALOGO[m.medida]?.ajuda || null,
            agregacao: C.agregacaoDe(m.medida),
          })),
          series,
          canais,
          grao,
          de,
          ate,
          emFoco,
          diario,
          alarmes: alarmes.sort((a, b) => (b.fora === a.fora ? 0 : b.fora ? 1 : -1)),
          projetos,
          projeto,
          dia: ultimo || null,
          emCurso,
          /* Os extremos do que existe: a navegação por setas usa isto para não
             deixar ele andar para um vazio sem fim. */
          primeiroDia: dias[0] || null,
          ultimoDia: dias[dias.length - 1] || null,
          vazio: ms.length === 0,
        })
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  if (url.pathname === '/api/armazem/cruzar') {
    return import('./armazem.mjs').then((A) => {
      const a = url.searchParams.get('a')
      const b = url.searchParams.get('b')
      if (!a || !b) return send(res, 400, { error: 'faltam as duas medidas' })
      try {
        send(res, 200, A.cruzar(a, b, { por: url.searchParams.get('por') || 'projeto' }))
      } catch (e) { send(res, 500, { error: String(e.message || e) }) }
    })
  }

  /* A planilha sai pelo mesmo lugar que a tela, e é o pedido dele de
     "disponibilizar em outros formatos". `attachment` para o navegador salvar
     em vez de mostrar texto cru. */
  if (url.pathname === '/api/armazem/csv') {
    return import('./armazem.mjs').then((A) => {
      try {
        res.writeHead(200, {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="cockpit-medidas.csv"',
        })
        res.end(A.paraCSV())
      } catch (e) { send(res, 500, { error: String(e.message || e) }) }
    })
  }

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
  /* A tela que abre o painel: "em que pé está o trabalho?"
     Junta o backlog de cada projeto, os agentes trabalhando e o que só ele
     resolve. Fora do stream de 2s: lê o roadmap de cada projeto e chama git
     para as idades, o que é caro demais para um tique. */
  /**
   * CC-304: a tela Projetos.
   *
   * Duas rotas, e a divisão é a mesma que este painel já aprendeu três vezes:
   * **ler barato para todos, ler caro para um, sob clique.**
   *
   * `painel` responde os vinte projetos com o que já está em memória ou custa
   * uma leitura curta. `um` responde o resto de um projeto só, e existe porque
   * ler o git custa ~83ms: multiplicado por vinte seriam 1,6s a cada abertura
   * de tela, dentro de um painel que se atualiza de 2 em 2 segundos.
   */
  if (url.pathname === '/api/projetos/painel') {
    return import('./projetos.mjs').then(async (P) => {
      try {
        /* Cache curto, e o prazo sai da medida: ler os roadmaps dos 20
           projetos custa 468ms e a rota inteira 0,5s. Aceitável ao ABRIR a
           tela, caro demais para clique repetido ou para dois painéis olhando
           ao mesmo tempo. 15s é o mesmo prazo da varredura de portas, pelo
           mesmo motivo. `?force=1` pula, para o botão de atualizar. */
        const agora = Date.now()
        if (CACHE_PROJETOS.dado && agora - CACHE_PROJETOS.em < 15_000 && !url.searchParams.has('force')) {
          return send(res, 200, { ...CACHE_PROJETOS.dado, doCache: true })
        }
        const s = snapshot()
        const lista = projetosDe(s.jobs, findProjects)
        const projetos = carregarProjetos(lista)
        const pendencias = tudoMeu(s.jobs, {
          projetos,
          maquinaLocal: origemLocal(readConfig())?.nome || null,
        })

        /* O backlog é contado DIRETO do roadmap de cada projeto, e não de
           `montarTrabalho`.
           Medido em 22/08: aquela rota devolve os mesmos 6 cartões e as mesmas
           145 fechadas para cinco projetos diferentes, inclusive dois que não
           têm roadmap nenhum. Lendo `lerRoadmap` por projeto, cada um traz o
           seu: fibraessencia 3 frentes, controlcenter 151, renanMarchon e
           ibrics zero, porque não têm arquivo. O defeito daquela tela fica
           registrado à parte; esta não o herda. */
        const trabalho = {
          grupos: projetos.map(({ projeto, mapa }) => {
            const frentes = (mapa?.grupos || []).flatMap((g) => g.frentes || [])
            const abertas = frentes.filter((f) => f.estado !== 'feito')
            return {
              projeto,
              cartoes: abertas,
              /* Grupo sem frentes ainda conta itens soltos, que é como os
                 roadmaps mais simples são escritos. */
              soltos: (mapa?.grupos || []).reduce((n, g) => n + Math.max(0, (g.itens || 0) - (g.feitos || 0)), 0),
            }
          }),
        }

        /* O tempo entra com o cache que já existe. `force` fica de fora de
           propósito: reler 800 MB de transcrito não pode acontecer ao abrir
           uma tela. */
        let tempo = null
        try { tempo = resumoTempo({ corteMin: 15 }) } catch { /* segue sem as horas */ }

        /* As conversas do Coderoom: `null` quando a leitura falha, nunca lista
           vazia. A tela precisa distinguir "não há" de "não consegui ler". */
        let conversas = null
        try { conversas = (await import('./gate.mjs')).listar?.() ?? null } catch { conversas = null }

        const dado = {
          ...P.retrato({
            jobs: s.jobs,
            trabalho: { ...trabalho, pendencias },
            tempo,
            /* `estadoRemoto()` é assíncrono e é a MESMA fonte que a tela
               Remoto usa. Duas contas para "que sessão está no ar" acabariam
               discordando um dia, e o painel já tem caso registrado disso. */
            sessoesAtivas: await estadoRemoto().catch(() => ({})),
            conversas,
          }),
          /* CC-315: o nome desta máquina viaja com o dado.
             Ele abriu a tela nova, viu 23 cartões sem etiqueta e perguntou onde
             estava dito em qual máquina cada projeto mora. A regra é dele, de
             20/08, e vale para TODO quadro que mostra projeto. */
          maquina: origemLocal(readConfig())?.nome || null,
          at: Date.now(),
        }
        CACHE_PROJETOS.em = agora
        CACHE_PROJETOS.dado = dado
        send(res, 200, dado)
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  /**
   * CC-318: a visão de pastas de um projeto.
   *
   * Pedido dele: *"podemos criar uma janela pro cockpit ter uma espécie de
   * visão de pastas dos projetos?"*
   *
   * Uma leitura só, sem carregar por pedaço: medido em 22/08, 2ms no
   * proj_controlcenter e 67ms no inovallbond com quatro níveis. `node_modules`
   * e companhia não entram, e é por isso que é barato.
   */
  if (url.pathname === '/api/projetos/pastas') {
    const projeto = url.searchParams.get('projeto')
    if (!projeto) return send(res, 400, { error: 'falta o projeto' })
    const dir = cwdDoProjeto(url.searchParams.get('cwd'), projeto)
    if (!dir) return send(res, 404, { error: `não achei a pasta de ${projeto}` })

    return import('./pastas.mjs').then((P) => {
      try {
        const fundo = Math.min(5, Math.max(1, Number(url.searchParams.get('fundo')) || 3))
        send(res, 200, { projeto, maquina: origemLocal(readConfig())?.nome || null, ...P.retrato(dir, { fundo }) })
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  /**
   * CC-319: o conteúdo de um arquivo dentro de um projeto.
   *
   * **É a rota mais perigosa deste painel**, e por isso a recusa mora no
   * módulo, não aqui: caminho que sai da pasta do projeto, arquivo que guarda
   * senha, binário e arquivo grande demais são recusados por `pastas.mjs`,
   * cada um com o motivo dito.
   *
   * A trava que mais importa é a primeira: sem ela, `../../.ssh/id_rsa`
   * entregaria a chave privada dele pela rede.
   */
  if (url.pathname === '/api/projetos/arquivo') {
    const projeto = url.searchParams.get('projeto')
    const rel = url.searchParams.get('caminho')
    if (!projeto || !rel) return send(res, 400, { error: 'falta o projeto ou o caminho' })
    const dir = cwdDoProjeto(url.searchParams.get('cwd'), projeto)
    if (!dir) return send(res, 404, { error: `não achei a pasta de ${projeto}` })

    return import('./pastas.mjs').then((P) => {
      try {
        const r = P.ler(dir, rel)
        /* Recusa é 200 com `ok:false`, não erro de rede: a tela precisa MOSTRAR
           o motivo, e um 403 viraria "falhou" genérico na mão dele. */
        send(res, 200, { projeto, caminho: rel, ...r })
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  if (url.pathname === '/api/projetos/um') {
    const projeto = url.searchParams.get('projeto')
    if (!projeto) return send(res, 400, { error: 'falta o projeto' })
    const dir = cwdDoProjeto(url.searchParams.get('cwd'), projeto)
    if (!dir) return send(res, 404, { error: `não achei a pasta de ${projeto}` })

    return (async () => {
      /* Cada leitura falha por conta própria e a resposta diz qual falhou. Uma
         exceção aqui deixaria o cartão inteiro vazio por causa de um pedaço,
         e bloco vazio não distingue "não há" de "a leitura quebrou". */
      const parte = async (nome, fn) => {
        try { return { ok: true, dado: await fn() } }
        catch (e) { return { ok: false, erro: String(e.message || e), nome } }
      }
      const [git, framework, rotinas, roadmap] = await Promise.all([
        parte('git', async () => (await import('./sincronia.mjs')).estado(dir)),
        parte('framework', async () => retratoFramework(dir)),
        parte('rotinas', async () => {
          const R = await import('./rotinas.mjs')
          const todas = R.estado()
          return (todas?.projetos || []).find((x) => path.resolve(x.dir) === path.resolve(dir)) || null
        }),
        parte('roadmap', async () => (await import('./roadmap.mjs')).lerRoadmap(dir)),
      ])
      send(res, 200, { projeto, dir, git, framework, rotinas, roadmap, at: Date.now() })
    })().catch((e) => send(res, 500, { error: String(e.message || e) }))
  }

  if (url.pathname === '/api/trabalho') {
    const s = snapshot()
    const lista = projetosDe(s.jobs, findProjects)
    const projetos = carregarProjetos(lista)
    /* CC-262: a revisão entra na ABA TRABALHO, em "o que só você resolve", que
       foi onde ele pediu: *"na aba de trabalho, em o que só você resolve, você
       poderia checar o que não precisa mais ser resolvido?"*.
       O resultado vem do mapa que `revisarPendencias()` mantém noutro ritmo:
       as provas rodam comando de sistema (`ss`, `systemctl`) e não podem entrar
       numa rota que ele abre a toda hora. */
    const pendencias = tudoMeu(s.jobs, { projetos, maquinaLocal: origemLocal(readConfig())?.nome || null })
      .map((p) => (REVISAO_PENDENCIAS[p.id] ? { ...p, ...REVISAO_PENDENCIAS[p.id] } : p))
    /* CC: as siglas vão junto do trabalho, não numa rota à parte. A tela mostra
       o mesmo código em quatro lugares; se cada um resolvesse o nome sozinho,
       seriam quatro contas para a mesma pergunta, e um dia discordariam. */
    const siglas = todasSiglas(projetos.map((x) => x.raiz), s.jobs)

    return send(res, 200, {
      ...montarTrabalho({
        projetos,
        jobs: s.jobs,
        pendencias,
        ordem: url.searchParams.get('ordem') === 'tempo' ? 'tempo' : 'importancia',
      }),
      siglas,
      /* CC-122: "o que mudou desde que eu olhei", em UMA resposta.
         Estava partida em três telas (o "vi isso" por projeto, o resumo da
         semana e o "o que mudou" do mapa), e ele trabalha do telefone, onde
         atravessar três telas para montar a resposta na cabeça é o mesmo que
         não ter. Sai daqui porque esta é a tela que abre. */
      desdeQueOlhei: (() => {
        const em = visitaGeral()
        if (em == null) return { em: null, marcos: [] }
        return { em, marcos: mudouDesde(em, { jobs: s.jobs }) }
      })(),
    })
  }

  /* Marca "olhei tudo". Separada da visita por projeto de propósito: são duas
     perguntas diferentes, e ele responde uma sem responder a outra. */
  if (url.pathname === '/api/vi-tudo' && req.method === 'POST') {
    return comCorpo(req, res, 1e3, () => ({ em: setVisitaGeral().visitas[CHAVE_TUDO] }))
  }

  if (url.pathname === '/api/roadmap') {
    const cwd = cwdDoProjeto(url.searchParams.get('cwd'), url.searchParams.get('projeto'))
    const mapa = cwd ? lerRoadmap(cwd) : null
    if (!mapa) return send(res, 200, { vazio: true })
    /* CC-98: as duas ordens vão JUNTO do mapa, não numa rota separada.
       Quem abre o mapa quer as duas perguntas respondidas na mesma tela — "o
       que fazer agora" e "o que está encalhado" —, e o custo é uma leitura de
       git de ~280ms que só acontece quando alguém pede o mapa. */
    let ordens = null
    try { ordens = ordenarRoadmap(cwd, mapa) } catch { /* sem git, fica sem ordem */ }

    /* CC-80: para cada frente, os arquivos que ela mais toca — derivado do
       texto dos commits, nunca escrito à mão. Mesma janela de custo que as
       ordens (~50ms medido em 19/08 neste projeto), então entra no mesmo
       lugar em vez de virar rota própria. */
    let estrutura = null
    try {
      const commits = historicoDeCommits(cwd)
      estrutura = mapearEstrutura({ grupos: mapa.grupos, commits, jobs: readJobs() })
    } catch { /* sem git, fica sem a camada de arquivos */ }

    return send(res, 200, { ...mapa, ordens, estrutura })
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
  /* CC-191: subir é assíncrono, e a resposta precisa esperar o suficiente para
     saber se deu errado. O `spawn` devolve na hora e a falha (`EFTYPE`,
     `ENOENT`) chega num evento alguns milissegundos depois: respondendo antes
     dela, a rota diz `ok` e a tela mostra "no ar" com nada no ar. 250ms é o
     bastante para o evento de erro chegar, e é imperceptível para quem clicou. */
  if (url.pathname === '/api/paineis/ligar' && req.method === 'POST') {
    return comCorpoAsync(req, res, 1e4, async ({ id }) => {
      const painel = ligarPainel(id)
      if (painel.jaEstava) return { painel }
      await new Promise((r) => setTimeout(r, 250))
      const erro = falhaAoLigar(id)
      if (erro) throw new Error(`não subiu: ${erro}`)
      return { painel }
    })
  }

  if (url.pathname === '/api/paineis/desligar' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ id }) => ({ painel: desligarPainel(id) }))
  }

  /* Abrir sessão do Claude Code pelo painel. Nasceu do celular: ele trabalha
     pelo Remote Control e não tem terminal para abrir sessão em outra pasta.

     A pasta vem SEMPRE da lista de projetos que o painel já conhece, nunca do
     que a página mandar: aceitar caminho arbitrário daria ao painel o poder de
     rodar o CLI em qualquer lugar do disco. */
  /* CC-60 e CC-79: o que o escritório do Felipe consome.
     Decisão dele em 16/08: fica só o fork em `app_escritorio`, e ele mescla os
     agentes da VPS e do PC. Mesclar já é resolvido AQUI pela federação — então
     em vez de o fork reimplementar isso, ele lê esta rota e desenha. O cockpit
     sabe quem trabalha; o escritório sabe desenhar. */
  if (url.pathname === '/api/escritorio') {
    const s = snapshot()

    /* As rotas ocupadas dos projetos que TÊM agente agora.
       Varrer todos os projetos custaria uma leitura de quadro por pasta a cada
       chamada, para depois jogar fora a maioria — o escritório só desenha quem
       está trabalhando. */
    const rotas = []
    const vistos = new Set()
    for (const j of s.jobs) {
      const dir = j.cwd && !vistos.has(j.cwd) ? j.cwd : null
      if (!dir) continue
      vistos.add(dir)
      const texto = lerQuadro(dir)
      if (!texto) continue
      for (const l of texto.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
        if (!l.includes('🔴') || !l.includes('|')) continue
        rotas.push({
          rota: (l.match(/`([^`]+)`/) || [])[1] || null,
          quem: (l.match(/\b([0-9a-f]{8})\b/) || [])[1] || null,
          arquivos: arquivosDeclarados(l),
          projeto: path.basename(dir),
        })
      }
    }

    return send(res, 200, montarEscritorio(s.jobs, {
      rotas: rotas.filter((r) => r.rota),
      maquinas: s.maquinas || [],
    }))
  }

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
          /* Os arquivos que a rota reivindica, da planilha dele: a tarefa é
             definida pelos arquivos que toca, não só pelo texto. A marca é a
             mesma que o guarda de rota lê, então tela e trava nunca discordam. */
          arquivos: arquivosDeclarados(l),
        }
      }).filter((x) => x.rota)

    /* CC-102: as rotas das OUTRAS máquinas na tela. Isto já existia desde o
       CC-48, mas só saía por comando de terminal, e o Felipe trabalha do
       telefone: recurso que só existe no terminal não existe para ele.
       Rota ocupada lá fora aparece como linha própria, com a máquina escrita,
       porque a decisão que ela muda é "posso pegar esta rota agora?". */
    const projetoAqui = path.basename(dir)
    const deFora = []
    for (const p of lerPacotes()) {
      const nome = p.maquina?.nome || p.maquina?.id || 'outra máquina'
      for (const q of p.rotas || []) {
        if (q?.projeto !== projetoAqui) continue
        for (const o of q.ocupadas || []) {
          if (todas.some((x) => x.rota === o.rota && x.quem === o.id)) continue
          deFora.push({
            rota: o.rota,
            cor: o.veredito === 'orfa' ? 'orfa' : 'ocupada',
            quem: o.id || null,
            silencio: o.silencioMs != null ? humanizarSilencio(o.silencioMs) : null,
            veredito: o.veredito || null,
            arquivos: o.arquivos || [],
            origem: nome,
          })
        }
      }
    }
    /* CC-155: as avenidas. Ideia dele em 18/08, vendo o aviso de vizinhança
       funcionar: *"um mapa com várias linhas, com cores diferentes, quando se
       cruza mostra em qual bifurcação se colidindo com outro agente"*.

       As rotas de FORA entram junto: uma sessão na VPS segurando um arquivo é
       exatamente o tipo de colisão que ninguém vê olhando só a máquina local.

       O grafo só é calculado quando há mais de uma avenida, e é a mesma
       economia que o `rota-guard` já faz: com uma rota só não existe cruzamento
       possível, e varrer o projeto para descobrir isso seria pagar por nada. */
    const paraMapa = [...todas, ...deFora]
    const comArquivos = paraMapa.filter((r) => r.quem && (r.arquivos || []).length)
    let grafo = null
    if (comArquivos.length > 1) {
      try { grafo = mapearDependencias(dir) } catch { /* sem grafo, sobra a colisão direta */ }
    }
    const mapa = mapearAvenidas(paraMapa, grafo)

    /* CC-243: os pedidos de autorização passam a chegar no PAINEL.
       Até aqui eles só existiam no fim da resposta no chat, e ele reclamou com
       razão: *"não faz sentido eu ficar vendo esse furdunço de mensagem no
       chat"*. Decisão dele é decisão dele, e o lugar de decidir é a tela.
       Falha em silêncio de propósito: o quadro de rotas não pode deixar de
       responder porque o arquivo de pedidos sumiu. */
    let pedidos = []
    try {
      pedidos = pendentesDeRota(dir).map((p) => ({
        id: p.id, de: p.de, arquivo: p.arquivo, vezes: p.vezes || 1, em: p.em || null,
      }))
    } catch { pedidos = [] }

    return send(res, 200, {
      existe: true, dir, rotas: todas, deFora, pedidos, avenidas: { ...mapa, resumo: resumoAvenidas(mapa) },
    })
  }

  /* CC-243: responder ao pedido pela tela, em vez de por comando no terminal.
     O texto no chat mandava ele copiar e colar `node ~/.claude/hooks/...`, que
     é justamente a burocracia que ele quer fora da conversa. */
  if (url.pathname === '/api/rotas/pedido' && req.method === 'POST') {
    return comCorpoAsync(req, res, 4e3, async ({ projeto, cwd, id, decisao, motivo }) => {
      const dir = cwdDoProjeto(cwd, projeto)
      if (!dir) return { erro: 'projeto desconhecido' }
      if (!['autorizado', 'negado'].includes(decisao)) return { erro: 'decisão precisa ser autorizado ou negado' }
      const r = responderPedidoDeRota(dir, { id, decisao, por: 'felipe', motivo: motivo || '' })
      if (!r) return { erro: `não achei o pedido ${id}` }
      return { pedido: { id: r.id, status: r.status, expiraEm: r.expiraEm || null } }
    })
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
      /* CC-247: os turnos do gate que ficaram órfãos quando o painel caiu.
         O filho morre junto com o painel, e sem este conserto a conversa
         ficaria marcada como ocupada para sempre: ele nunca mais conseguiria
         mandar mensagem nela. Fecha o turno dizendo até onde a resposta chegou,
         em vez de deixar sumir. */
      try { reconciliarGate({ vivo: vivoGate }) } catch { /* conversa nenhuma ainda */ }

      // CC-47: o empurrão para a máquina servidora. Fica aqui, e não no tique
      // de 2s do stream, porque é a ÚNICA chamada de rede periódica do painel
      // e 30s já é mais rápido do que o Felipe troca de tela. Sem federação
      // configurada, o timer nem existe.
      /* CC-261: o gasto do plano, buscado direto.
         Nesta máquina a barra de status nunca é chamada (Remote Control não tem
         terminal), então o número oficial não chega sozinho. A busca é a segunda
         chamada de rede do painel inteiro, junto do câmbio, e por isso vai num
         ritmo próprio e falha calada: sem contato, fica o último valor. */
      const buscarUso = () => {
        import('./uso.mjs')
          .then((u) => u.atualizarUsoDaConta())
          .catch(() => {})
      }
      const relUso = setInterval(buscarUso, 5 * 60 * 1000)
      relUso.unref()
      buscarUso()

      /* CC-260: o gasto por sessão, no ritmo dele e não no do painel.
         A varredura custa ~305ms na primeira vez e 1ms depois, com o cache em
         memória. A cada 30 segundos ela roda e enche o mapa que `sessoes.mjs`
         consulta; o tique de 2 segundos nunca paga essa conta. */
      const atualizarGastoPorSessao = () => {
        Promise.all([import('./tempo.mjs'), import('./sessoes.mjs')])
          .then(([T, S]) => S.atualizarTokens(T.tokensPorSessao()))
          .catch(() => {})
      }
      const relTok = setInterval(atualizarGastoPorSessao, 30_000)
      relTok.unref()
      atualizarGastoPorSessao()

      /* CC-262: revisar as pendências DELE, dizendo o que já parece resolvido.
         A cada minuto, e nunca dentro da rota: as provas rodam comando de
         sistema, e ele abre a aba Trabalho a toda hora. */
      const revisarPendencias = () => {
        Promise.all([import('./meu.mjs'), import('./tarefasProva.mjs'), import('./sessoes.mjs')])
          .then(([M, P, S]) => {
            const lista = M.tudo(S.todosOsJobs()).filter((t) => !t.feito)
            const mapa = {}
            /* `cwdDoProjeto` já sabe achar a pasta de um projeto pelo nome, e é
               a mesma conta que o resto do painel usa. Sem ela, o caminho
               relativo cairia em `/home/claudedev`, que é onde o serviço roda,
               e a prova responderia sobre o lugar errado. */
            for (const t of P.revisar(lista, { raiz: process.cwd(), raizDe: (proj) => cwdDoProjeto('', proj) || null })) {
              if (t.resolvida === null && !t.comoSoube) continue
              mapa[t.id] = { pareceResolvida: t.resolvida === true, comoSoube: t.comoSoube }
            }
            REVISAO_PENDENCIAS = mapa
          })
          .catch(() => {})
      }
      const relRev = setInterval(revisarPendencias, 60_000)
      relRev.unref()
      revisarPendencias()

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
