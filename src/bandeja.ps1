# bandeja.ps1 — o ícone na barra de tarefas do Windows, o "sempre ver" que ele pediu.
#
# Desenho dele, com todas as letras (25/08): "diferente do de rede padrão, pq a
# gente já usa uma bola verde ou vermelha no screive4me. Então dois nós ligados
# por um traço, e o TRAÇO muda de estado, nunca uma bolinha." Por isso os quatro
# estados abaixo mudam a FORMA do traço (cheio, tracejado, partido), e só o
# estado "painel fora do ar" vira cinza — a cor nunca é a única pista.
#
# Fica de pé sozinho, com laço de mensagens do Windows Forms: sem isso o ícone
# aparece e trava, porque não há quem entregue os cliques do usuário.
#
# Instância única por processo: dois `bandeja.ps1` ao mesmo tempo seriam dois
# ícones brigando pelo mesmo lugar na bandeja, e o Task Manager mostraria dois
# "PowerShell" sem dizer qual é o de verdade. O mutex nomeado resolve isso sem
# precisar de arquivo de trava em disco.

param(
  [int]$Port = 8099
)

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = [Console]::OutputEncoding

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$mutex = New-Object System.Threading.Mutex($false, 'Global\AgentCockpitBandeja')
if (-not $mutex.WaitOne(0)) {
  # já tem um ícone de pé: sair calado, não é erro, é o caso normal de
  # religar o painel sem religar a bandeja junto.
  exit 0
}

$base = "http://127.0.0.1:$Port"

# ── o desenho ────────────────────────────────────────────────────────────────
#
# Dois nós (círculos) ligados por um traço no meio. `$estilo` decide a FORMA do
# traço: 'cheio' uma linha só, 'tracejado' um Pen com DashStyle, 'partido' dois
# segmentos curtos com um vão no meio (o "caiu" visual, sem precisar de cor).
# `$cinza` sobrepõe tudo em tom de cinza: painel fora do ar não tem traço
# nenhum para mostrar, e cinza é o único estado que muda a COR de propósito.
function Novo-IconeBandeja {
  param([string]$Estilo, [bool]$Cinza)

  $tam = 32
  $bmp = New-Object System.Drawing.Bitmap $tam, $tam
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $corTraco = if ($Cinza) { [System.Drawing.Color]::FromArgb(150, 150, 150) } else { [System.Drawing.Color]::FromArgb(90, 200, 210) }
  $corNo = if ($Cinza) { [System.Drawing.Color]::FromArgb(120, 120, 120) } else { [System.Drawing.Color]::FromArgb(230, 230, 230) }

  $yMeio = 16
  $noEsq = 8
  $noDir = 24
  $raio = 4

  $penTraco = New-Object System.Drawing.Pen($corTraco, 3)
  switch ($Estilo) {
    'tracejado' { $penTraco.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash }
    'partido' {
      # dois segmentos curtos com vão no meio, em vez de uma linha inteira:
      # é o "quebrou" que não depende de olhar a cor.
      $g.DrawLine($penTraco, ($noEsq + $raio), $yMeio, ($noEsq + 6), $yMeio)
      $g.DrawLine($penTraco, ($noDir - 6), $yMeio, ($noDir - $raio), $yMeio)
    }
    default { $g.DrawLine($penTraco, ($noEsq + $raio), $yMeio, ($noDir - $raio), $yMeio) }
  }
  if ($Estilo -ne 'partido') {
    $g.DrawLine($penTraco, ($noEsq + $raio), $yMeio, ($noDir - $raio), $yMeio)
  }

  $brushNo = New-Object System.Drawing.SolidBrush($corNo)
  $g.FillEllipse($brushNo, ($noEsq - $raio), ($yMeio - $raio), ($raio * 2), ($raio * 2))
  $g.FillEllipse($brushNo, ($noDir - $raio), ($yMeio - $raio), ($raio * 2), ($raio * 2))

  $hicon = $bmp.GetHicon()
  $icone = [System.Drawing.Icon]::FromHandle($hicon)
  $g.Dispose()
  return @{ icone = $icone; bmp = $bmp }
}

# ── ler o estado real, nunca inventado ───────────────────────────────────────
#
# `GET /api/federacao` já traz `empurrando` (o último envio de verdade, com
# `em` e `ok`) desde o CC-165. A bandeja não reimplementa a leitura do
# empurrador: só decide, a partir do carimbo, em qual dos quatro estados cair.
function Ler-Estado {
  try {
    $resp = Invoke-RestMethod -Uri "$base/api/federacao" -TimeoutSec 4 -ErrorAction Stop
  } catch {
    return @{ estilo = 'partido'; cinza = $true; texto = "painel fora do ar (porta $Port)" }
  }

  if (-not $resp.configurada) {
    return @{ estilo = 'partido'; cinza = $false; texto = 'federação não configurada' }
  }

  $emp = $resp.empurrando
  if (-not $emp) {
    return @{ estilo = 'partido'; cinza = $false; texto = 'ainda não empurrou nada' }
  }

  $idadeSeg = [Math]::Round(([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - [double]$emp.em) / 1000)
  $quando = if ($idadeSeg -lt 60) { "há ${idadeSeg}s" } else { "há $([Math]::Round($idadeSeg / 60))min" }

  if (-not $emp.ok) {
    return @{ estilo = 'partido'; cinza = $false; texto = "último envio falhou ($quando): $($emp.erro)" }
  }
  if ($idadeSeg -lt 45) {
    return @{ estilo = 'cheio'; cinza = $false; texto = "sincronizando com $($resp.enviandoPara) ($quando)" }
  }
  if ($idadeSeg -lt 90) {
    return @{ estilo = 'tracejado'; cinza = $false; texto = "atrasou ($quando), rumo a $($resp.enviandoPara)" }
  }
  return @{ estilo = 'partido'; cinza = $false; texto = "parou de mandar ($quando), rumo a $($resp.enviandoPara)" }
}

# ── o ícone e o menu ─────────────────────────────────────────────────────────

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Visible = $true
$notify.Text = 'Agent Cockpit'

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$itemAbrir = $menu.Items.Add('Abrir painel')
$itemReiniciar = $menu.Items.Add('Reiniciar')
$menu.Items.Add('-') | Out-Null
$itemSair = $menu.Items.Add('Sair')
$notify.ContextMenuStrip = $menu

$itemAbrir.Add_Click({ Start-Process "$base" }) | Out-Null
$itemReiniciar.Add_Click({
  try { Invoke-RestMethod -Uri "$base/api/shutdown" -Method Post -TimeoutSec 4 | Out-Null } catch { }
}) | Out-Null
$itemSair.Add_Click({
  $notify.Visible = $false
  $notify.Dispose()
  [System.Windows.Forms.Application]::Exit()
}) | Out-Null
$notify.Add_DoubleClick({ Start-Process "$base" }) | Out-Null

$iconeAtual = $null
function Atualizar {
  $estado = Ler-Estado
  $novo = Novo-IconeBandeja -Estilo $estado.estilo -Cinza $estado.cinza
  $velho = $notify.Icon
  $notify.Icon = $novo.icone
  $notify.Text = ("Agent Cockpit`n" + $estado.texto).Substring(0, [Math]::Min(127, ("Agent Cockpit`n" + $estado.texto).Length))
  if ($velho) { $velho.Dispose() }
  $novo.bmp.Dispose()
}

Atualizar

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 15000
$timer.Add_Tick({ Atualizar }) | Out-Null
$timer.Start()

[System.Windows.Forms.Application]::Run()

$notify.Visible = $false
$notify.Dispose()
$mutex.ReleaseMutex()
