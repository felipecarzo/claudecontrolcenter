// Botão "ligar projetos": dispara `claude --remote-control` num projeto, pra
// acessar do celular via claude.ai/code, sem precisar abrir terminal na mão.
//
// Achado testando de verdade em 13/08, no PC e na VPS: `claude
// --remote-control` falha com "Input must be provided either through stdin
// or as a prompt argument when using --print" quando o processo não tem um
// TTY de verdade. O comando confere isatty no stdout, e sem terminal real
// cai num caminho que se comporta como `--print`, que aí sim exige prompt.
// A primeira versão deste módulo redirecionava stdout pra arquivo de log —
// isso é exatamente o que mata o TTY. Por isso:
//
// - Linux/VPS: `tmux new-session -d`. tmux aloca um pseudo-terminal de
//   verdade pra sessão, e ela sobrevive independente de quem a criou —
//   inclusive a um restart do painel, porque quem segura o PTY é o tmux, não
//   o Node. `tmux capture-pane` lê o que apareceu na tela, é como o link de
//   conexão é recuperado sem precisar de stdout redirecionado.
// - Windows: sem tmux nativo. `spawn()` sem redirecionar stdio e com
//   `detached: true` faz o Windows abrir um console novo de verdade pro
//   filho (comportamento documentado do próprio Node) — é TTY genuíno, só
//   que visível. Sem esse console não dá pra capturar o link por aqui: quem
//   usa lê a janela que abriu.
//
// Liveness: nunca mais re-testar `process.kill(pid, 0)` depois que o
// processo pode ter morrido — o SO recicla PID, e isso já gerou um falso
// "ligado" com processo morto (medido em 13/08). No Windows o pid rastreado
// é o do `cmd /c`, que só sai quando o `claude` de dentro sair: o evento
// `exit` do próprio filho é a fonte de verdade. No Linux a fonte é `tmux
// has-session`/`list-sessions`, porque o tmux sobrevive ao processo que criou.

import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ehWindows, casaClaude } from './platform.mjs'
import { PROJETOS_DIR, DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

const PREFIXO_SESSAO = 'cc-remote-'

const slug = (projeto) => PREFIXO_SESSAO + String(projeto).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)

/**
 * Vários agentes no mesmo projeto: `proj`, `proj-2`, `proj-3`.
 *
 * Pedido dele em 15/08 (*"a gente pode querer abrir vários agentes pro mesmo
 * projeto"*). Antes o nome era só o slug, então o segundo clique batia na
 * sessão existente e devolvia `ja: true` — parecia que tinha funcionado.
 *
 * O sufixo fica fora do primeiro nome de propósito: quem tem uma sessão só
 * continua vendo `cc-remote-projeto`, e nada do que já existe muda de nome.
 */
export const rotuloDe = (projeto, n = 1) => (n > 1 ? `${projeto}-${n}` : projeto)

async function proximoRotulo(projeto, ativos) {
  for (let n = 1; n <= 20; n++) {
    const r = rotuloDe(projeto, n)
    if (!ativos[r]) return r
  }
  return null
}

/**
 * Perguntas que travam a sessão recém-nascida, e a tecla que resolve.
 *
 * A regra é **responder fricção, nunca política**. "Confia nos arquivos desta
 * pasta?" é fricção: ele acabou de clicar em ligar naquela pasta, a resposta já
 * veio no clique. Já "quer auto mode como padrão?" é política de permissão, e
 * decidir isso por ele seria escolher o nível de autonomia dos agentes dele.
 *
 * Medido em 15/08: sem responder a primeira, a sessão sobe e fica parada nela
 * para sempre — e o painel dizia "ligado", que é o pior resultado possível.
 */
const PERGUNTAS_DE_ABERTURA = [
  /trust the files in this folder/i,
  /confia.*(nos arquivos|nesta pasta)/i,
  /Yes, I trust this folder/i,
]

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const tmux = (args, ms = 8000) => new Promise((resolve) => {
  execFile('tmux', args, { encoding: 'utf8', timeout: ms, maxBuffer: 4 * 1024 * 1024 },
    (erro, saida, err) => resolve(erro
      ? { ok: false, out: String(saida || err || erro.message || '').trim() }
      : { ok: true, out: saida }))
})

/** Só existe no Windows: aqui não tem tmux pra ser a fonte de verdade. */
const ativosWindows = new Map() // projeto -> { pid, desde, cwd }

/* ── O caminho de volta ─────────────────────────────────────────────────────
 *
 * 24/08, e este bloco existe por causa de um estrago meu, não de uma ideia.
 *
 * Ele perguntou se uma conversa podia ficar pendurada. Fui olhar, li a hora de
 * CRIAÇÃO que o tmux informa como se fosse a hora da última atividade, chamei
 * de "parada há 15 horas" uma conversa que tinha respondido três minutos antes,
 * e ofereci a ele matar as duas como opção recomendada. Ele aceitou a minha
 * recomendação e perdeu o acesso ao trabalho que estava fazendo.
 *
 * O erro de leitura foi meu, mas o que transformou engano em estrago foi o
 * desenho: **a única ação que o painel oferecia para uma conversa era a
 * irreversível.** Não havia soltar, não havia religar, não havia voltar.
 *
 * O histórico sempre esteve em disco: reabrir a conversa de 15 horas custou um
 * comando. O que faltava era alguém guardar QUAL conversa estava ali, porque
 * depois que a sessão morre o tmux não sabe mais dizer.
 *
 * Duas certezas diferentes, e a diferença importa na hora de oferecer o botão:
 * `medida` é o vínculo gravado quando foi o próprio painel que abriu a conversa
 * (não tem como errar), e `palpite` é a conversa mais recente daquela pasta,
 * usada para sessão que já existia antes disto. Com duas conversas abertas no
 * mesmo projeto, o palpite pode pegar a irmã — por isso ele se anuncia.
 */

/* Mesma casa dos outros módulos, com o mesmo abrigo: dentro do sandbox
   `~/.claude` fica somente leitura, e sem queda o vínculo nasceria mudo
   justamente na máquina onde ele trabalha. Reusa `DIR_SESSOES_ABRIGO` em vez de
   remontar o caminho, senão `CC_HOME` (o isolamento de teste) escaparia aqui. */
const DIR_ABRIGO = () => path.join(DIR_SESSOES_ABRIGO(), '..')
const ARQ_VINCULOS = 'control-center-remoto.json'
const caminhosVinculo = () => [
  path.join(casaClaude(), ARQ_VINCULOS),
  path.join(DIR_ABRIGO(), ARQ_VINCULOS),
]

/** Junta casa e abrigo. A casa vence, porque é onde se grava quando dá. */
export function lerVinculos() {
  const junto = {}
  for (const p of [...caminhosVinculo()].reverse()) {
    try { Object.assign(junto, JSON.parse(fs.readFileSync(p, 'utf8'))) } catch { /* sem vínculo ainda */ }
  }
  return junto
}

/** Grava na casa; se ela recusar, cai pro abrigo e DIZ por onde saiu. Escrita
 *  atômica: um corte no meio não pode deixar o arquivo pela metade. */
function gravarVinculos(todos) {
  const erros = []
  for (const p of caminhosVinculo()) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true })
      const tmp = `${p}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(todos, null, 2))
      fs.renameSync(tmp, p)
      return { ok: true, onde: p, abrigo: p !== caminhosVinculo()[0] }
    } catch (e) { erros.push(`${p}: ${e.code || e.message}`) }
  }
  return { ok: false, erro: erros.join(' / ') }
}

/** A pasta de transcritos daquele projeto. O Claude Code nomeia trocando tudo
 *  que não é letra ou número por hífen: `/home/x/VPS_coepiloto` vira
 *  `-home-x-VPS-coepiloto`. */
const pastaTranscritos = (cwd) => path.join(PROJETOS_DIR(), String(cwd).replace(/[^a-zA-Z0-9]/g, '-'))

/**
 * Qual conversa está (ou estava) rodando naquela pasta. `depoisDe` filtra pelo
 * nascimento da sessão, pra não devolver conversa de ontem.
 */
export function conversasDe(cwd, { depoisDe = 0 } = {}) {
  const achadas = []
  try {
    for (const nome of fs.readdirSync(pastaTranscritos(cwd))) {
      if (!nome.endsWith('.jsonl')) continue
      const st = fs.statSync(path.join(pastaTranscritos(cwd), nome))
      if (st.mtimeMs < depoisDe) continue
      achadas.push({ id: nome.slice(0, -6), quando: st.mtimeMs })
    }
  } catch { /* pasta não existe: projeto sem conversa nenhuma ainda */ }
  return achadas.sort((a, b) => b.quando - a.quando)
}

/** A mais recente delas, que é a que interessa em quase todo lugar. */
export function conversaDe(cwd, opcoes) {
  return conversasDe(cwd, opcoes)[0] || null
}

/**
 * Só os vínculos que dão volta de verdade: têm conversa gravada e a pasta
 * ainda existe. Botão que às vezes não faz nada é pior que botão nenhum, e
 * sessão viva também aparece aqui dentro (sem conversa ainda) enquanto não
 * falou pela primeira vez.
 */
export function caminhosDeVolta() {
  const uteis = {}
  for (const [projeto, v] of Object.entries(lerVinculos())) {
    if (!v || !v.conversa) continue
    if (v.cwd && !fs.existsSync(v.cwd)) continue
    uteis[projeto] = v
  }
  return uteis
}

/** Guarda (ou atualiza) o vínculo de um projeto. */
function anotarVinculo(projeto, dados) {
  const todos = lerVinculos()
  todos[projeto] = { ...(todos[projeto] || {}), ...dados }
  return gravarVinculos(todos)
}

/** O que está ligado agora. */
export async function estado() {
  if (ehWindows) {
    const out = {}
    for (const [projeto, info] of ativosWindows) out[projeto] = info
    return out
  }
  /* `pane_current_path` entra junto porque sem a pasta não dá pra saber quando
     a conversa falou pela última vez — e foi confundir CRIAÇÃO com ATIVIDADE
     que me fez chamar de "parada há 15 horas", em 24/08, uma conversa que
     tinha respondido três minutos antes. Uma chamada só, não uma por sessão. */
  const r = await tmux(['list-sessions', '-F', '#{session_name}\t#{session_created}\t#{pane_current_path}'])
  if (!r.ok) return {} // tmux ausente ou nenhuma sessão viva: mesmo resultado, vazio
  const out = {}
  for (const linha of r.out.split('\n')) {
    const [nome, criado, cwd] = linha.trim().split('\t')
    if (!nome || !nome.startsWith(PREFIXO_SESSAO)) continue
    const conversa = cwd ? conversaDe(cwd) : null
    out[nome.slice(PREFIXO_SESSAO.length)] = {
      sessao: nome,
      desde: (Number(criado) || 0) * 1000 || null,
      cwd: cwd || null,
      /* A hora da última mensagem, que é o que "parada" quer dizer de verdade.
         `null` quando não deu pra saber: silêncio aqui é "não sei", nunca
         "está parada" — a diferença entre os dois é o estrago de 24/08. */
      ativa: conversa ? conversa.quando : null,
      conversa: conversa ? conversa.id : null,
    }
  }
  return out
}

/**
 * Dispara `claude --remote-control "<nome>"` na pasta do projeto, com PTY
 * de verdade. Nunca espera terminar: é sessão que fica viva até o Felipe
 * fechar pelo celular, o `desligar` daqui, ou (só no Windows) o painel cair.
 */
export async function ligar(projeto, cwd, {
  binario = 'claude', mais = false, esperarMs = 6000,
  /* 24/08: os dois botões que eram um só. `remoto: false` abre a conversa sem
     expor acesso nenhum: ela vive aqui e ganha o celular depois, por
     `conectar()`. Medido antes de escrever: uma conversa que nasce sem remoto
     aceita `/rc` depois.

     E uma correção do que eu mesmo tinha escrito aqui: o endereço NÃO é
     estável. Medido em três ciclos seguidos, soltar o celular de verdade faz o
     endereço seguinte ser OUTRO; ele só se repete quando a desconexão não
     chegou a acontecer. Por isso `conectar()` devolve o endereço de agora, e
     nada no painel guarda link antigo: link decorado apontaria para o vazio. */
  remoto = true,
  /* Id de conversa antiga: em vez de começar do zero, retoma de onde parou. */
  retomar = null,
} = {}) {
  if (!cwd || !fs.existsSync(cwd)) return { ok: false, erro: `pasta não existe: ${cwd}` }

  const ativos = await estado()
  const existente = ativos[projeto]
  // `mais` é o botão "mais uma": sem ele, ligar duas vezes devolvia a sessão
  // que já existia e parecia ter aberto uma nova
  if (existente && !mais) return { ok: true, ja: true, ...existente }

  const rotulo = mais ? await proximoRotulo(projeto, ativos) : projeto
  if (!rotulo) return { ok: false, erro: `já há 20 sessões abertas em ${projeto}` }

  if (ehWindows) {
    try {
      // Sem stdio redirecionado + detached: o Windows abre console novo de
      // verdade pro filho. `cmd /c` porque `claude` é `.cmd` do npm global
      // (spawn não invoca `.cmd` sem ele, e `shell: true` com args dinâmicos
      // é injeção de comando); o cmd só sai quando o claude de dentro sair,
      // então o pid do cmd rastreia exatamente o tempo de vida da sessão.
      const filho = spawn('cmd', ['/c', binario, '--remote-control', projeto], {
        cwd, detached: true, stdio: 'ignore', windowsHide: false,
      })
      filho.unref()
      const info = { pid: filho.pid, desde: Date.now(), cwd }
      ativosWindows.set(projeto, info)
      filho.on('exit', () => ativosWindows.delete(projeto))
      filho.on('error', () => ativosWindows.delete(projeto))
      return { ok: true, ja: false, ...info }
    } catch (e) {
      return { ok: false, erro: String(e.message || e) }
    }
  }

  const sessao = slug(rotulo)
  const nascimento = Date.now()
  // Args separados (não uma string só): tmux exec direto, sem passar por
  // shell nenhum — nome de projeto com espaço ou aspas não vira injeção.
  const argsClaude = [binario]
  if (remoto) argsClaude.push('--remote-control', rotulo)
  if (retomar) argsClaude.push('--resume', retomar)
  const r = await tmux(['new-session', '-d', '-s', sessao, '-c', cwd, ...argsClaude])
  if (!r.ok) return { ok: false, erro: `tmux falhou: ${r.out || 'tmux está instalado?'}` }

  /* Responde a pergunta de confiança, senão a sessão nasce parada nela e o
     painel mostra "ligado" para uma sessão que não serve pra nada. A espera é
     generosa porque o CLI demora a desenhar a primeira tela: mandar a tecla
     cedo demais é pior que não mandar, some no vazio e não dá erro. */
  await espera(esperarMs)
  let confianca = false
  const primeira = await tmux(['capture-pane', '-t', sessao, '-p', '-S', '-200'])
  if (primeira.ok && PERGUNTAS_DE_ABERTURA.some((re) => re.test(primeira.out))) {
    await tmux(['send-keys', '-t', sessao, 'Enter'])
    confianca = true
    await espera(2500)
  }

  // A tela vai junto: "ok" sem olhar a tela já enganou neste projeto antes.
  const agora = await tmux(['capture-pane', '-t', sessao, '-p'])
  const tela = agora.ok ? agora.out.split('\n').filter((l) => l.trim()).slice(-12).join('\n') : null

  /* O vínculo é gravado AQUI, com a conversa recém-nascida, e é a única
     certeza que existe: depois que a sessão morre, nada mais sabe dizer qual
     conversa morava nela. Retomada não precisa procurar, o id já é conhecido. */
  const achada = retomar ? { id: retomar } : conversaDe(cwd, { depoisDe: nascimento - 2000 })
  /* Grava mesmo sem conversa achada, porque `desde` sozinho já vale: conversa
     só ganha arquivo em disco depois da primeira mensagem, e é o nascimento da
     sessão que depois permite dizer com certeza qual conversa era dela. */
  anotarVinculo(rotulo, {
    conversa: achada ? achada.id : null,
    cwd,
    certeza: achada ? 'medida' : null,
    desde: nascimento,
    encerradaEm: null,
  })

  return {
    ok: true, ja: false, sessao, rotulo, desde: nascimento, cwd, confianca, tela,
    remoto, conversa: achada ? achada.id : null,
  }
}

/**
 * Mata a sessão, **depois** de anotar o caminho de volta.
 *
 * A ordem não é detalhe: assim que o tmux morre não existe mais como
 * descobrir qual conversa estava ali, e foi exatamente essa informação que
 * faltou em 24/08 para desfazer o estrago sem garimpo manual.
 */
export async function desligar(projeto) {
  if (!ehWindows) await anotarCaminhoDeVolta(projeto)
  if (ehWindows) {
    const info = ativosWindows.get(projeto)
    if (!info) return { ok: true, ja: false }
    // O pid rastreado é do `cmd /c`, e `claude` no Windows é outro `.cmd` —
    // matar só o topo deixa a árvore de processos (e a janela) orfã. `/T`
    // mata a árvore inteira, `/F` força, sem precisar do PowerShell.
    await new Promise((resolve) => execFile('taskkill', ['/PID', String(info.pid), '/T', '/F'], () => resolve()))
    ativosWindows.delete(projeto)
    return { ok: true, ja: true }
  }
  const r = await tmux(['kill-session', '-t', slug(projeto)])
  return { ok: true, ja: r.ok, volta: lerVinculos()[projeto] || null }
}

/** A pasta onde a sessão está de fato, perguntada ao tmux. Serve para a sessão
 *  que nasceu antes disto existir e não tem vínculo gravado. */
async function cwdDaSessao(projeto) {
  const r = await tmux(['display-message', '-p', '-t', slug(projeto), '#{pane_current_path}'])
  return r.ok ? r.out.trim() : null
}

/** Antes de matar, guarda qual conversa era e a hora. Nunca lança: falhar em
 *  anotar não pode impedir o desligar que ele pediu. */
async function anotarCaminhoDeVolta(projeto) {
  try {
    const jaSabido = lerVinculos()[projeto]
    /* `estado()` já resolve pasta e conversa numa chamada só, e é a leitura
       mais fresca que existe. O vínculo gravado no ligar entra como reserva,
       porque conversa que nunca falou ainda não tem arquivo em disco: nesse
       caso não há histórico para voltar, e prometer volta seria mentira. */
    const vivo = (await estado())[projeto] || {}
    const cwd = vivo.cwd || (jaSabido && jaSabido.cwd) || await cwdDaSessao(projeto)
    if (!cwd) return
    /* Nasceu quantas conversas nesta pasta desde que a sessão subiu? Se foi
       exatamente uma, não há o que confundir: é ela, e a certeza é medida.
       Duas ou mais, o painel não tem como saber qual ele quer, e diz isso em
       vez de escolher sozinho. Escolher sozinho e não avisar foi o erro. */
    const desde = vivo.desde || (jaSabido && jaSabido.desde) || 0
    const candidatas = conversasDe(cwd, { depoisDe: desde })
    const conversa = vivo.conversa || (jaSabido && jaSabido.conversa) || (candidatas[0] || {}).id || null
    if (!conversa) return
    const medida = (jaSabido && jaSabido.certeza === 'medida') || (Boolean(desde) && candidatas.length === 1)
    anotarVinculo(projeto, {
      conversa,
      cwd,
      certeza: medida ? 'medida' : 'palpite',
      encerradaEm: Date.now(),
    })
  } catch { /* anotar é conforto, desligar é o pedido */ }
}

/**
 * Reabre a última conversa daquele projeto, de onde ela parou.
 *
 * O histórico nunca esteve em risco: fica em disco, e sobrevive ao processo
 * morrer. O que não existia era alguém lembrar qual arquivo era.
 */
export async function reabrir(projeto, { binario = 'claude', remoto = true } = {}) {
  const volta = lerVinculos()[projeto]
  if (!volta || !volta.conversa) {
    return { ok: false, erro: `não sei qual conversa era a de ${projeto}: não há caminho de volta guardado` }
  }
  if (!fs.existsSync(volta.cwd)) return { ok: false, erro: `a pasta sumiu: ${volta.cwd}` }
  const r = await ligar(projeto, volta.cwd, { binario, remoto, retomar: volta.conversa })
  return r.ok ? { ...r, retomada: volta.conversa, certeza: volta.certeza || 'palpite' } : r
}

/* O menu do `/rc`, e o que cada tecla faz nele. Medido em sessão de teste em
   24/08, não deduzido: `/rc` sempre conecta e abre o menu, com o cursor em
   "Continue" e "Disconnect this session" duas linhas acima. */
const TECLAS_DESCONECTAR = ['Up', 'Up', 'Enter']

/**
 * Espera a tela mostrar o que se procura, olhando de meio em meio segundo.
 *
 * A primeira versão esperava um tanto fixo de segundos e falhou na prova: o
 * comando saiu digitado antes de a tela estar pronta, e o `/rc` foi parar na
 * conversa como se fosse pergunta. Tempo fixo é chute; ler a tela é medida.
 */
async function esperarNaTela(sessao, procurado, { ateMs = 20000, passoMs = 500 } = {}) {
  const limite = Date.now() + ateMs
  let ultima = ''
  while (Date.now() < limite) {
    const r = await tmux(['capture-pane', '-t', sessao, '-p', '-S', '-80'])
    if (r.ok) {
      ultima = r.out
      if (procurado.test(ultima)) return { ok: true, tela: ultima }
    }
    await espera(passoMs)
  }
  return { ok: false, tela: ultima }
}

/** Abre o menu do acesso remoto e devolve a tela dele. Limpa o campo antes:
 *  digitar por cima de um menu aberto manda o comando pra conversa. */
async function abrirMenuRemoto(sessao, procurado = /Disconnect this session/i) {
  await tmux(['send-keys', '-t', sessao, 'Escape'])
  await espera(600)
  await tmux(['send-keys', '-t', sessao, '/rc'])
  await espera(1200) // o CLI precisa reconhecer o comando antes do Enter
  await tmux(['send-keys', '-t', sessao, 'Enter'])
  /* Espera o que o CHAMADOR precisa, não "o menu". Medido em 24/08: aceitar
     o menu servia para desconectar e falhava ao reconectar, porque o endereço
     leva mais alguns segundos para aparecer depois do menu. Esperar pela coisa
     certa é a diferença entre passar sempre e passar às vezes. */
  return esperarNaTela(sessao, procurado)
}

/** Só existe no Linux, pelo mesmo motivo do `link()`: ler a tela do tmux é a
 *  única captura de saída que não mata o terminal de verdade da sessão. */
function soNoLinux(acao) {
  return { ok: false, erro: `${acao} só funciona onde há tmux; no Windows use a janela que abriu` }
}

/**
 * Dá (ou devolve) o acesso pelo celular a uma conversa que já está de pé.
 *
 * É o botão que faltava. Antes, perder o acesso remoto não tinha conserto pela
 * tela: a conversa seguia viva e o único botão oferecido era matar.
 */
export async function conectar(projeto) {
  if (ehWindows) return soNoLinux('conectar')
  const sessao = slug(projeto)
  if (!(await tmux(['has-session', '-t', sessao])).ok) {
    return { ok: false, erro: `não há sessão viva em ${projeto}` }
  }
  let menu = await abrirMenuRemoto(sessao, /claude\.ai\/code\/session_/i)
  if (!/claude\.ai\/code\/session_/i.test(menu.tela)) {
    await espera(1500)
    menu = await abrirMenuRemoto(sessao, /claude\.ai\/code\/session_/i)
  }
  const url = (menu.tela.match(/https?:\/\/\S*claude\.ai\/code\/\S+/g) || []).pop()
  await tmux(['send-keys', '-t', sessao, 'Escape']) // fecha o menu, deixa conectado
  if (!url) return { ok: false, erro: 'liguei o acesso mas não achei o endereço na tela; tenta de novo' }
  return { ok: true, url: url.replace(/[.,)]+$/, '') }
}

/**
 * Solta o celular sem matar nada: a conversa continua viva e trabalhando.
 *
 * A dúvida dele em 24/08 era essa, e a resposta medida é que desconectar o
 * remoto não encosta na conversa, e religar devolve o MESMO endereço.
 */
export async function desconectar(projeto) {
  if (ehWindows) return soNoLinux('desconectar')
  const sessao = slug(projeto)
  if (!(await tmux(['has-session', '-t', sessao])).ok) {
    return { ok: false, erro: `não há sessão viva em ${projeto}` }
  }
  /* Uma segunda tentativa, porque medi uma falha em três: o menu às vezes não
     abre quando o comando chega no meio de um redesenho da tela. Falhar por
     isso mandaria ele matar a conversa, que é o caminho que este trabalho
     inteiro existe para evitar. */
  let menu = await abrirMenuRemoto(sessao)
  if (!/Disconnect this session/i.test(menu.tela)) {
    await espera(1500)
    menu = await abrirMenuRemoto(sessao)
  }
  if (!/Disconnect this session/i.test(menu.tela)) {
    await tmux(['send-keys', '-t', sessao, 'Escape'])
    return { ok: false, erro: 'o menu do acesso remoto não apareceu como esperado; nada foi mexido' }
  }
  for (const tecla of TECLAS_DESCONECTAR) await tmux(['send-keys', '-t', sessao, tecla])
  await espera(3000)
  /* Conferir, não confiar: "matar não é conferir" é armadilha registrada deste
     projeto, e vale igual para desconectar. A sessão TEM que continuar viva. */
  const viva = (await tmux(['has-session', '-t', sessao])).ok
  return { ok: true, viva, aviso: viva ? null : 'a sessão caiu junto, o que não era esperado' }
}

/**
 * URL de conexão que `claude --remote-control` imprime ao subir. Só existe
 * no Linux: sai da tela virtual do tmux, a única captura de saída que não
 * exige redirecionar stdout — que é o próprio bug que este módulo existe
 * pra evitar.
 */
export async function link(projeto) {
  if (ehWindows) return { ok: false, erro: 'no Windows o link aparece na janela do console que abriu' }
  const r = await tmux(['capture-pane', '-t', slug(projeto), '-p', '-S', '-500'])
  if (!r.ok) return { ok: false, erro: `sessão não encontrada: ${r.out}` }
  const achados = r.out.match(/https?:\/\/\S+/g)
  if (!achados) return { ok: false, erro: 'sem link na tela ainda, tenta de novo em alguns segundos' }
  return { ok: true, url: achados[achados.length - 1] }
}

export const _internals = { slug, tmux, ativosWindows }
