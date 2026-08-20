// Tudo que depende do sistema operacional mora aqui. O resto do projeto não
// pode ter `process.platform` espalhado.
//
// ⚠️ Windows é o único caminho verificado em máquina real. macOS e Linux foram
// escritos com os comandos padrão de cada um, mas nunca rodaram — trate como
// não testado até alguém rodar de verdade.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, execFile, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))

export const SO = process.platform // 'win32' | 'darwin' | 'linux'
export const ehWindows = SO === 'win32'
export const ehMac = SO === 'darwin'

/**
 * A pasta `.claude` onde o painel guarda o que é dele. Um lugar só, e
 * redirecionável por `CC_HOME`.
 *
 * **Por que a variável existe, e não é conforto de teste.** O gate escrevia no
 * `control-center-notes.json` DE VERDADE: gravava, apagava tudo para conferir a
 * cópia de segurança, e restaurava no `finally`. Funciona quando termina — e
 * `npm test` interrompido no meio (Ctrl+C, crash, a máquina dormindo) deixa o
 * arquivo com a lista vazia.
 *
 * Isso bate com o incidente de 2026-08-09 registrado no `CLAUDE.md`, quando as
 * duas listas do Felipe amanheceram apagadas "sem que se conseguisse provar
 * quem gravou". Não é prova de que foi o teste, mas é um caminho que existia e
 * agora não existe mais: o gate aponta para uma pasta temporária.
 *
 * O mesmo vale para `control-center.json` — a armadilha do `CONFIG_FILE`, no
 * `CLAUDE.md`, dizia que o conserto certo seria exatamente isto e que não
 * existia. Passou a existir.
 *
 * ⚠️ Ler e escrever é sempre daqui. `os.homedir()` solto em módulo novo volta a
 * furar o isolamento, e o furo só aparece quando alguém perde dado.
 */
export const casaClaude = () => process.env.CC_HOME || path.join(os.homedir(), '.claude')

export const quiet = (cmd, args) => {
  try {
    return {
      ok: true,
      out: execFileSync(cmd, args, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
        maxBuffer: 8 * 1024 * 1024,
        // pipe nos dois: senão o erro do filho vaza direto no console
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    }
  } catch (e) {
    return { ok: false, out: String(e.stdout || e.stderr || e.message).trim() }
  }
}

/**
 * Versão que não bloqueia. `quiet` usa `execFileSync`, e num servidor isso
 * segura o event loop inteiro: uma leitura de sensor de 1s congelaria o
 * stream dos agentes junto. Onde a resposta alimenta a tela, use esta.
 */
export const quietAsync = (cmd, args, ms = 15000) => new Promise((resolve) => {
  execFile(cmd, args, { encoding: 'utf8', windowsHide: true, timeout: ms, maxBuffer: 8 * 1024 * 1024 },
    (erro, saida, err) => resolve(erro
      ? { ok: false, out: String(saida || err || erro.message).trim() }
      : { ok: true, out: saida }))
})

const existe = (cmd) => quiet(ehWindows ? 'where' : 'which', [cmd]).ok

/* ------------------------- sensores da máquina ---------------------
   CPU e memória saem do próprio Node, em `maquina.mjs`. Aqui fica só o que
   depende do sistema: a GPU e os sensores de temperatura.

   Não usa PowerShell para a GPU de propósito: `nvidia-smi` é um executável, e
   chamá-lo direto custa ~590ms contra os ~3s de subir um PowerShell. */

const CAMPOS_GPU = [
  'name', 'temperature.gpu', 'temperature.memory', 'utilization.gpu',
  'utilization.memory', 'memory.used', 'memory.total', 'power.draw',
]

const numero = (v) => {
  const n = Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

/** GPU NVIDIA. `null` quando não há placa NVIDIA ou o driver não responde. */
export async function lerGpu() {
  const r = await quietAsync('nvidia-smi', [`--query-gpu=${CAMPOS_GPU.join(',')}`, '--format=csv,noheader,nounits'])
  if (!r.ok) return null
  const linha = r.out.split('\n').find((l) => l.trim())
  if (!linha) return null
  const c = linha.split(',').map((s) => s.trim())
  const usadaMB = numero(c[5])
  const totalMB = numero(c[6])
  return {
    nome: (c[0] || '').replace(/^NVIDIA\s+/i, ''),
    temp: numero(c[1]),
    // placa de consumo costuma não expor sensor da memória: vem "N/A"
    tempMem: numero(c[2]),
    uso: numero(c[3]),
    usoMem: numero(c[4]),
    vramUsadaGB: usadaMB == null ? null : +(usadaMB / 1024).toFixed(1),
    vramTotalGB: totalMB == null ? null : +(totalMB / 1024).toFixed(1),
    watts: numero(c[7]),
  }
}

/**
 * Temperatura de CPU e de memória — só existem se o LibreHardwareMonitor (ou
 * o antigo OpenHardwareMonitor) estiver ABERTO, porque é ele quem publica o
 * namespace WMI. Sem ele, `MSAcpi_ThermalZoneTemperature` e
 * `root/Hardware NumericSensor` existem como classe e devolvem zero
 * instâncias — medido nesta máquina.
 */
export async function lerSensoresExtras() {
  if (!ehWindows) return {}
  const ps = `
    $ErrorActionPreference='SilentlyContinue'
    $s = Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor
    $fonte = 'LibreHardwareMonitor'
    if (-not $s) { $s = Get-CimInstance -Namespace root/OpenHardwareMonitor -ClassName Sensor; $fonte = 'OpenHardwareMonitor' }
    if (-not $s) { '{}'; exit }
    $t = $s | Where-Object { $_.SensorType -eq 'Temperature' }
    $cpu = $t | Where-Object { $_.Identifier -match '/(intelcpu|amdcpu)/' -and $_.Name -match 'Package|Total|CPU' } | Select-Object -First 1
    $ram = $t | Where-Object { $_.Identifier -match '/ram/' } | Select-Object -First 1
    @{ cpuTemp = if ($cpu) { [math]::Round($cpu.Value,0) } else { $null }
       ramTemp = if ($ram) { [math]::Round($ram.Value,0) } else { $null }
       fonte = $fonte } | ConvertTo-Json -Compress`
  const r = await quietAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], 20000)
  if (!r.ok) return {}
  try { return JSON.parse(r.out.trim()) } catch { return {} }
}

/* ------------------------------ mídia ------------------------------
   Controle do que está tocando: transporte e volume por aplicativo.

   No Windows, quem responde é `src/midia.ps1`, mantido VIVO como processo e
   conversando por stdin/stdout. O motivo é medido: o script compila C# para
   falar com a Audio Session API, e uma execução avulsa leva ~18s; em processo
   persistente, cada comando sai em milissegundos.

   Precisa ser `powershell.exe` (5.1) e não `pwsh` (7): o 7 não tem projeção
   WinRT, e a chamada de SMTC morre com "Operation is not supported on this
   platform".

   macOS e Linux: não implementado. Os caminhos seriam `MediaRemote`/AppleScript
   e MPRIS via D-Bus, e nenhum dos dois é tradução direta deste. */

let servidorMidia = null

export function midiaDisponivel() {
  return ehWindows
}

function subirServidorMidia() {
  if (servidorMidia) return servidorMidia
  const script = path.join(AQUI, 'midia.ps1')
  const proc = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, 'servir',
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })

  const estado = { proc, fila: [], buffer: '', pronto: false }
  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (bloco) => {
    estado.buffer += bloco
    let corte
    while ((corte = estado.buffer.indexOf('\n')) >= 0) {
      const linha = estado.buffer.slice(0, corte).trim()
      estado.buffer = estado.buffer.slice(corte + 1)
      if (!linha) continue
      if (!estado.pronto) { estado.pronto = true; continue } // handshake
      const pedido = estado.fila.shift()
      if (pedido) pedido.resolve(linha)
    }
  })
  // Morreu: o próximo pedido sobe outro. Não reinicia sozinho para não ficar
  // ressuscitando em laço quando o problema é permanente.
  const derrubar = () => {
    for (const p of estado.fila) p.resolve('{"erro":"o controlador de mídia caiu"}')
    estado.fila = []
    if (servidorMidia === estado) servidorMidia = null
  }
  proc.on('exit', derrubar)
  proc.on('error', derrubar)

  servidorMidia = estado
  return estado
}

/** Manda um comando e devolve o JSON cru. Nunca lança. */
export function midiaComando(comando, alvo = '', valor = '') {
  if (!ehWindows) return Promise.resolve('{"erro":"controle de mídia só existe no Windows por enquanto"}')
  let estado
  try { estado = subirServidorMidia() } catch (e) { return Promise.resolve(`{"erro":${JSON.stringify(String(e.message))}}`) }

  return new Promise((resolve) => {
    // O primeiro comando espera a compilação do C#; os seguintes, não.
    const relogio = setTimeout(() => {
      const i = estado.fila.findIndex((p) => p.resolve === resolve)
      if (i >= 0) estado.fila.splice(i, 1)
      resolve('{"erro":"o controlador de mídia não respondeu"}')
    }, 30000)
    const pedido = {
      resolve: (linha) => { clearTimeout(relogio); resolve(linha) },
    }
    estado.fila.push(pedido)
    try {
      estado.proc.stdin.write(`${comando} ${alvo} ${valor}\n`)
    } catch {
      pedido.resolve('{"erro":"não deu para falar com o controlador de mídia"}')
    }
  })
}

export function pararMidia() {
  if (!servidorMidia) return
  try { servidorMidia.proc.kill() } catch { /* já morreu */ }
  servidorMidia = null
}

/* ---------------------------- navegador ---------------------------- */

export function abrirNavegador(url) {
  if (ehWindows) return quiet('cmd', ['/c', 'start', '', url]) // `start` é do cmd, não um .exe
  if (ehMac) return quiet('open', [url])
  return quiet('xdg-open', [url])
}

/**
 * Onde o Chrome mora, para a captura de tela e o teste da página.
 * Só o `test-ui.mjs` usa: o painel em si não depende de navegador nenhum.
 */
export function chromePath() {
  /* `CC_CHROME` vem primeiro por um motivo medido: nesta VPS não existe Chrome
     instalado no sistema, e a única cópia é a que o Playwright baixou dentro de
     `~/.cache/ms-playwright`. Sem a variável e sem esse palpite, toda prova de
     tela ficava presa na máquina do Felipe. */
  if (process.env.CC_CHROME && fs.existsSync(process.env.CC_CHROME)) return process.env.CC_CHROME
  const doPlaywright = () => {
    const raiz = path.join(os.homedir(), '.cache', 'ms-playwright')
    try {
      for (const d of fs.readdirSync(raiz)) {
        if (!d.startsWith('chromium-')) continue
        for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
          const alvo = path.join(raiz, d, sub)
          if (fs.existsSync(alvo)) return alvo
        }
      }
    } catch { /* sem Playwright nesta máquina, segue para os candidatos do sistema */ }
    return null
  }
  const candidatos = ehWindows
    ? [
        path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      ]
    : ehMac
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium']
  return candidatos.find((p) => fs.existsSync(p)) || doPlaywright()
}

/* ------------------------------ pastas ----------------------------- */

export function pastaDesktop() {
  const nomes = ['Desktop', 'Área de Trabalho', 'Escritorio', 'Bureau']
  const raizes = [os.homedir(), path.join(os.homedir(), 'OneDrive')]
  for (const r of raizes) for (const n of nomes) {
    const p = path.join(r, n)
    if (fs.existsSync(p)) return p
  }
  return null
}

/* ------------------------- portas em escuta ------------------------ */

const PS_PORTAS = `
$ErrorActionPreference = 'SilentlyContinue'
$conns = Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -ge 1024 }
$ids = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
$filtro = ($ids | ForEach-Object { "ProcessId=$_" }) -join ' OR '
$procs = @{}
if ($filtro) { Get-CimInstance Win32_Process -Filter $filtro | ForEach-Object { $procs[[int]$_.ProcessId] = $_ } }
$out = foreach ($g in ($conns | Group-Object OwningProcess)) {
  $p = $procs[[int]$g.Name]
  [pscustomobject]@{
    pid     = [int]$g.Name
    ports   = @($g.Group | ForEach-Object { [int]$_.LocalPort } | Sort-Object -Unique)
    name    = [string]$p.Name
    cmd     = [string]$p.CommandLine
    started = if ($p.CreationDate) { $p.CreationDate.ToString('o') } else { $null }
  }
}
ConvertTo-Json -InputObject @($out) -Depth 4 -Compress
`

function portasWindows() {
  const r = quiet('powershell', ['-NoProfile', '-NonInteractive', '-Command', PS_PORTAS])
  if (!r.ok) return null
  try {
    const v = JSON.parse(r.out || '[]')
    return Array.isArray(v) ? v : [v]
  } catch {
    return null
  }
}

/**
 * macOS e a maior parte das distros: `lsof` dá porta + PID numa tacada.
 * A linha de comando completa vem depois, de `ps`, porque o lsof só traz o
 * nome curto do processo.
 */
function portasUnix() {
  const alvo = existe('lsof')
    ? quiet('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pcn'])
    : quiet('ss', ['-ltnpH'])
  if (!alvo.ok) return null

  const porPid = new Map()
  const guarda = (pid, porta, nome) => {
    if (!pid || !(porta >= 1024)) return
    if (!porPid.has(pid)) porPid.set(pid, { pid, ports: new Set(), name: nome || '?', cmd: '', started: null })
    const reg = porPid.get(pid)
    reg.ports.add(porta)
    if (nome && reg.name === '?') reg.name = nome
  }

  if (existe('lsof')) {
    // saída em campos: p<pid>, c<comando>, n<endereço>
    let pid = null, nome = null
    for (const linha of alvo.out.split('\n')) {
      const tipo = linha[0], valor = linha.slice(1).trim()
      if (tipo === 'p') { pid = Number(valor); nome = null }
      else if (tipo === 'c') nome = valor
      else if (tipo === 'n') {
        const m = valor.match(/:(\d+)$/)
        if (m) guarda(pid, Number(m[1]), nome)
      }
    }
  } else {
    // ss: ... 0.0.0.0:8099 ... users:(("node",pid=1234,fd=20))
    for (const linha of alvo.out.split('\n')) {
      const porta = linha.match(/[:\]](\d+)\s/)
      const proc = linha.match(/users:\(\("([^"]+)",pid=(\d+)/)
      if (porta && proc) guarda(Number(proc[2]), Number(porta[1]), proc[1])
    }
  }
  if (!porPid.size) return []

  const ids = [...porPid.keys()]
  const ps = quiet('ps', ['-o', 'pid=,lstart=,command=', '-p', ids.join(',')])
  if (ps.ok) {
    for (const linha of ps.out.split('\n')) {
      const m = linha.trim().match(/^(\d+)\s+(.{24})\s+(.*)$/)
      if (!m) continue
      const reg = porPid.get(Number(m[1]))
      if (!reg) continue
      reg.cmd = m[3]
      const t = Date.parse(m[2])
      reg.started = Number.isNaN(t) ? null : new Date(t).toISOString()
    }
  }
  return [...porPid.values()].map((r) => ({ ...r, ports: [...r.ports].sort((a, b) => a - b) }))
}

/** Processos com porta TCP em escuta (>= 1024). null = não deu pra consultar. */
export function listarPortas() {
  return ehWindows ? portasWindows() : portasUnix()
}

export function matarProcesso(pid) {
  if (ehWindows) {
    const r = quiet('taskkill', ['/PID', String(pid), '/T', '/F'])
    if (!r.ok) throw new Error(r.out)
    return
  }
  process.kill(pid, 'SIGTERM')
}

/* --------------------- abrir a pasta do projeto -------------------- */
// Quatro destinos porque a pergunta "onde é isso?" tem quatro respostas
// diferentes: ver os arquivos, mexer no código, rodar comando, ou colar o
// caminho em outro lugar. A última é do navegador, não passa por aqui.

/** Abre a pasta no explorador de arquivos do sistema. */
export function abrirPasta(dir) {
  if (ehWindows) return quiet('explorer.exe', [dir]) // devolve 1 mesmo dando certo
  if (ehMac) return quiet('open', [dir])
  return quiet('xdg-open', [dir])
}

/** Abre a pasta no VS Code. Falha limpa quando o `code` não está no PATH. */
export function abrirEditor(dir) {
  // no Windows o `code` é um .cmd, e .cmd não é executável direto pelo spawn
  const r = ehWindows ? quiet('cmd', ['/c', 'code', dir]) : quiet('code', [dir])
  if (!r.ok) throw new Error('não achei o comando `code` — o VS Code precisa estar no PATH')
  return r
}

/** Abre um terminal já dentro da pasta. */
export function abrirTerminal(dir) {
  if (ehWindows) {
    // Windows Terminal quando existe; senão o PowerShell de sempre.
    if (existe('wt')) return quiet('cmd', ['/c', 'start', '', 'wt', '-d', dir])
    return quiet('cmd', ['/c', 'start', '', 'powershell', '-NoExit', '-Command', `Set-Location '${dir.replace(/'/g, "''")}'`])
  }
  if (ehMac) return quiet('open', ['-a', 'Terminal', dir])
  for (const t of ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm']) {
    if (existe(t)) return quiet(t, ['--working-directory', dir])
  }
  throw new Error('não achei um emulador de terminal instalado')
}

/**
 * Sobe um servidor de desenvolvimento numa pasta.
 *
 * Com janela visível de propósito: dev server que quebra só conta o motivo no
 * próprio log, e um processo invisível transformaria "não subiu" em mistério.
 * O processo é destacado — encerrar o painel não derruba o servidor.
 */
export function lancarComando(comando, cwd) {
  if (ehWindows) {
    // `start` é do cmd. O primeiro "" é o título da janela, que o start exige
    // quando o alvo vem entre aspas — sem ele o comando vira o título.
    const filho = spawn('cmd', ['/c', 'start', '', 'cmd', '/k', comando], {
      cwd, detached: true, stdio: 'ignore', windowsHide: false,
    })
    filho.unref()
    return
  }
  const filho = spawn(process.env.SHELL || '/bin/sh', ['-c', comando], {
    cwd, detached: true, stdio: 'ignore',
  })
  filho.unref()
}

/* ----------------------------- autostart --------------------------- */
// Cada sistema tem seu jeito de subir algo no login. A interface é a mesma:
// instalar({node, script, porta}) / desinstalar() / caminhoAutostart()

const ID = 'control-center'
const APP = 'Control Center'

const pastaStartup = () =>
  path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')

export function caminhoAutostart() {
  if (ehWindows) return path.join(pastaStartup(), `${ID}.vbs`)
  if (ehMac) return path.join(os.homedir(), 'Library', 'LaunchAgents', `com.${ID}.plist`)
  return path.join(os.homedir(), '.config', 'systemd', 'user', `${ID}.service`)
}

/**
 * Windows: `WScript.Shell.Run(..., 0, False)` é a forma confiável de rodar um
 * processo de console sem piscar janela preta.
 */
function autostartWindows(node, script, porta) {
  const arquivo = caminhoAutostart()
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  const q = (s) => `""${s}""` // aspas dentro de string VBS são duplicadas
  fs.writeFileSync(
    arquivo,
    [
      `' ${APP} — gerado por \`cc daemon install\`, não editar à mão`,
      "' sobe o painel em segundo plano no login, sem janela",
      'Set sh = CreateObject("WScript.Shell")',
      `sh.Run "${q(node)} ${q(script)} --web-only --port ${porta}", 0, False`,
      '',
    ].join('\r\n'),
    'latin1', // wscript não lê UTF-8 com BOM de forma confiável
  )
  return arquivo
}

function autostartMac(node, script, porta) {
  const arquivo = caminhoAutostart()
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  fs.writeFileSync(arquivo, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.${ID}</string>
  <key>ProgramArguments</key>
  <array><string>${esc(node)}</string><string>${esc(script)}</string><string>--web-only</string><string>--port</string><string>${porta}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
</dict></plist>
`)
  quiet('launchctl', ['unload', arquivo])
  quiet('launchctl', ['load', arquivo])
  return arquivo
}

function autostartLinux(node, script, porta) {
  const arquivo = caminhoAutostart()
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(arquivo, `[Unit]
Description=${APP}

[Service]
ExecStart=${node} ${script} --web-only --port ${porta}
Restart=on-failure

[Install]
WantedBy=default.target
`)
  quiet('systemctl', ['--user', 'daemon-reload'])
  quiet('systemctl', ['--user', 'enable', '--now', `${ID}.service`])
  return arquivo
}

export function instalarAutostart({ node, script, porta }) {
  if (ehWindows) return autostartWindows(node, script, porta)
  if (ehMac) return autostartMac(node, script, porta)
  return autostartLinux(node, script, porta)
}

export function desinstalarAutostart() {
  const arquivo = caminhoAutostart()
  if (ehMac) quiet('launchctl', ['unload', arquivo])
  if (!ehWindows && !ehMac) {
    quiet('systemctl', ['--user', 'disable', '--now', `${ID}.service`])
  }
  if (fs.existsSync(arquivo)) {
    fs.rmSync(arquivo)
    return arquivo
  }
  return null
}

/** Sobe o painel destacado, do mesmo jeito que o login faria. */
export function subirDestacado({ node, script, porta }) {
  if (ehWindows) {
    const vbs = fs.existsSync(caminhoAutostart())
      ? caminhoAutostart()
      : autostartWindows(node, script, porta)
    return quiet('wscript.exe', [vbs])
  }
  // spawn desacoplado: o painel sobrevive ao fim deste processo
  const filho = spawn(node, [script, '--web-only', '--port', String(porta)], {
    detached: true,
    stdio: 'ignore',
  })
  filho.unref()
  return { ok: true, out: '' }
}

/* ------------------------------ atalho ----------------------------- */

export function nomeAtalho() {
  if (ehWindows) return `${APP}.lnk`
  if (ehMac) return `${APP}.command`
  return `${APP}.desktop`
}

/**
 * O atalho não pode ser só a URL: com o processo morto, o navegador abre "não
 * foi possível conectar". Ele chama `cc open`, que sobe o painel se precisar.
 */
export function criarAtalho({ node, script, porta, abridor }) {
  const dir = pastaDesktop()
  if (!dir) return null
  const arquivo = path.join(dir, nomeAtalho())

  if (ehWindows) {
    // .lnk precisa de COM; o PowerShell resolve sem dependência.
    // Aspas SIMPLES: PowerShell não usa `\` como escape, então JSON.stringify
    // geraria `\"` e quebraria o parse em silêncio.
    const psq = (s) => `'${String(s).replace(/'/g, "''")}'`
    const ps = [
      `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${psq(arquivo)})`,
      `$s.TargetPath = 'wscript.exe'`,
      `$s.Arguments = ${psq(`"${abridor}"`)}`,
      `$s.WorkingDirectory = ${psq(path.dirname(script))}`,
      `$s.Description = 'Abre o ${APP}, subindo o painel se preciso'`,
      `$s.IconLocation = '%SystemRoot%\\System32\\SHELL32.dll,13'`,
      '$s.Save()',
    ].join('; ')
    const r = quiet('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps])
    if (r.ok) return arquivo
    // sem COM, cai no atalho simples: depende do painel já estar no ar
    const alt = path.join(dir, `${APP}.url`)
    fs.writeFileSync(alt, ['[InternetShortcut]', `URL=http://localhost:${porta}`, 'IconIndex=0', ''].join('\r\n'))
    return alt
  }

  if (ehMac) {
    fs.writeFileSync(arquivo, `#!/bin/sh\nexec ${JSON.stringify(node)} ${JSON.stringify(script)} open --port ${porta}\n`)
    fs.chmodSync(arquivo, 0o755)
    return arquivo
  }

  fs.writeFileSync(arquivo, `[Desktop Entry]
Type=Application
Name=${APP}
Comment=Abre o ${APP}, subindo o painel se preciso
Exec=${node} ${script} open --port ${porta}
Terminal=false
Icon=utilities-system-monitor
`)
  fs.chmodSync(arquivo, 0o755)
  return arquivo
}

/** Nomes de atalho de todas as versões, pra desinstalar sem deixar sobra. */
export function atalhosPossiveis() {
  const dir = pastaDesktop()
  if (!dir) return []
  return [`${APP}.lnk`, `${APP}.url`, `${APP}.command`, `${APP}.desktop`].map((n) => path.join(dir, n))
}
