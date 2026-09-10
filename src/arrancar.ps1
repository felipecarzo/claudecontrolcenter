# arrancar.ps1 — o UM arranque supervisionado do painel no Windows.
#
# Por que existe: o PC tinha DOIS jeitos de subir ao mesmo tempo (o atalho de
# logon antigo, sem supervisão, e a tarefa agendada nova) e isso é o que
# empilhava os bugs — dois painéis, dois empurradores, um com código velho.
# Este script é o ÚNICO ponto de entrada que a Tarefa Agendada chama agora.
#
# Achado em 26/08, medido: o `RestartOnFailure` da Tarefa Agendada NÃO
# religa quando o `node` é morto (`Stop-Process -Force`), em nenhum dos dois
# modos testados (com administrador e sem). Duas rodadas de teste, mais de 2
# minutos de espera em cada, nenhum religamento. Por isso a supervisão de
# verdade não pode depender do Windows perceber a queda: este script agora
# tem o PRÓPRIO laço, e relança o painel por dentro, sem nunca terminar
# sozinho. A Tarefa Agendada continua existindo como rede de segurança para
# o caso raro deste script inteiro morrer (não só o painel), mas não é mais
# a peça que faz o "sempre ver conectado" funcionar de fato.

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

$bandejaScript = Join-Path $repo "src\bandeja.ps1"
function Subir-Bandeja {
  return Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $bandejaScript, "-Port", "$Port" -PassThru
}
$bandeja = Subir-Bandeja

# Contador de quedas rápidas em sequência: se o painel morrer de novo em
# menos de 30s da vez anterior, é sinal de código quebrado (não vai adiantar
# religar sem parar), não de queda passageira. Sem esta trava, um `node`
# crashando na largada viraria centenas de religadas por hora, cada uma com
# `git pull` e abertura de bandeja nova.
$quedasRapidas = 0
$ultimaPartida = Get-Date

while ($true) {
  # `git pull` best-effort a cada arranque: rede fora do ar não pode impedir
  # o painel de subir com o código que já está no disco. Falha aqui vira
  # aviso, nunca parada.
  #
  # CC-439: só quando a pasta É um repositório. A cópia INSTALADA (a que roda,
  # separada da que se edita) não tem `.git` de propósito, e ela não deve puxar
  # nada: ela muda quando alguém publica, nunca sozinha. Sem esta guarda, o
  # mesmo lançador na cópia instalada gritaria "not a git repository" a cada
  # arranque, e pior, a promessa de "a versão que roda não muda sem eu mandar"
  # seria falsa.
  if (Test-Path (Join-Path $repo '.git')) {
    try {
      $saida = git pull --ff-only 2>&1
      Write-Output "[arrancar] git pull: $saida"
    } catch {
      Write-Output "[arrancar] git pull falhou, seguindo com o código local: $_"
    }
  } else {
    Write-Output "[arrancar] versão instalada (sem .git): não puxa nada, muda só quando alguém publica"
  }

  $ultimaPartida = Get-Date
  $node = Start-Process -FilePath "node" -ArgumentList "cc.mjs", "--web-only", "--port", "$Port" -WorkingDirectory $repo -PassThru -WindowStyle Hidden
  Write-Output "[arrancar] painel subiu, pid=$($node.Id), $(Get-Date -Format 'HH:mm:ss')"

  while (-not $node.HasExited) {
    # CC-459: sair com código 0 é a própria bandeja dizendo "já tem uma de pé,
    # saí de propósito" (o mutex de instância única, linha 28). Só código
    # diferente de 0 é queda de verdade. Sem esta distinção, encontrar a vaga
    # tomada virava religada, que religava, que achava a vaga tomada de novo —
    # um `Subir-Bandeja` a cada 5 segundos, para sempre.
    if ($bandeja.HasExited -and $bandeja.ExitCode -ne 0) {
      $bandeja = Subir-Bandeja
    }
    Start-Sleep -Seconds 5
  }

  Write-Output "[arrancar] painel caiu, $(Get-Date -Format 'HH:mm:ss')"

  if (((Get-Date) - $ultimaPartida).TotalSeconds -lt 30) {
    $quedasRapidas++
    if ($quedasRapidas -ge 5) {
      Write-Output "[arrancar] 5 quedas rápidas seguidas, desisto. Provavelmente o código está quebrado."
      break
    }
  } else {
    $quedasRapidas = 0
  }

  Start-Sleep -Seconds 3
}

if (-not $bandeja.HasExited) {
  Stop-Process -Id $bandeja.Id -Force -ErrorAction SilentlyContinue
}

$mutex.ReleaseMutex()
exit 1
