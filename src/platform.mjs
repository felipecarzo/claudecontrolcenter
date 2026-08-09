// Tudo que depende do sistema operacional mora aqui. O resto do projeto não
// pode ter `process.platform` espalhado.
//
// ⚠️ Windows é o único caminho verificado em máquina real. macOS e Linux foram
// escritos com os comandos padrão de cada um, mas nunca rodaram — trate como
// não testado até alguém rodar de verdade.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))

export const SO = process.platform // 'win32' | 'darwin' | 'linux'
export const ehWindows = SO === 'win32'
export const ehMac = SO === 'darwin'

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

const existe = (cmd) => quiet(ehWindows ? 'where' : 'which', [cmd]).ok

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
  const candidatos = ehWindows
    ? [
        path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      ]
    : ehMac
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium']
  return candidatos.find((p) => fs.existsSync(p)) || null
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
