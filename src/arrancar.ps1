# arrancar.ps1 — o UM arranque supervisionado do painel no Windows.
#
# Por que existe: o PC tinha DOIS jeitos de subir ao mesmo tempo (o atalho de
# logon antigo, sem supervisão, e a tarefa agendada nova) e isso é o que
# empilhava os bugs — dois painéis, dois empurradores, um com código velho.
# Este script é o ÚNICO ponto de entrada que a Tarefa Agendada chama agora:
# atualiza o código, sobe o painel, sobe a bandeja, e sua PRÓPRIA vida fica
# amarrada à do painel. Painel caiu, este script termina, e é isso que faz a
# tarefa (com reinício automático) religar tudo de novo, código incluído.
#
# Continua supervisionando a bandeja por fora, sem torná-la o coração do
# reinício: ela pode cair e voltar sozinha aqui, sem derrubar o painel.

param(
  [int]$Port = 8099
)

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = [Console]::OutputEncoding

$repo = Split-Path -Parent $PSScriptRoot

$mutex = New-Object System.Threading.Mutex($false, 'Global\AgentCockpitArrancar')
if (-not $mutex.WaitOne(0)) {
  # já tem um arranque de pé: a Tarefa Agendada tem `IgnoreNew`, e este mutex
  # é a segunda trava, para quem disparar o script à mão por engano.
  exit 0
}

Set-Location $repo

# `git pull` best-effort: rede fora do ar não pode impedir o painel de subir
# com o código que já está no disco. Falha aqui vira aviso, nunca parada.
try {
  $saida = git pull --ff-only 2>&1
  Write-Output "[arrancar] git pull: $saida"
} catch {
  Write-Output "[arrancar] git pull falhou, seguindo com o código local: $_"
}

$node = Start-Process -FilePath "node" -ArgumentList "cc.mjs", "--web-only", "--port", "$Port" -WorkingDirectory $repo -PassThru -WindowStyle Hidden

$bandejaScript = Join-Path $repo "src\bandeja.ps1"
function Subir-Bandeja {
  return Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $bandejaScript, "-Port", "$Port" -PassThru
}
$bandeja = Subir-Bandeja

# A vida deste script é a vida do painel: painel caiu, o laço termina, e a
# Tarefa Agendada religa TUDO (com `git pull` incluso) por RestartOnFailure.
# A bandeja é vigiada à parte e volta sozinha aqui: ela cair não deve derrubar
# o painel, que é a parte que importa de verdade.
while (-not $node.HasExited) {
  if ($bandeja.HasExited) {
    $bandeja = Subir-Bandeja
  }
  Start-Sleep -Seconds 5
}

if (-not $bandeja.HasExited) {
  Stop-Process -Id $bandeja.Id -Force -ErrorAction SilentlyContinue
}

$mutex.ReleaseMutex()
exit 1
