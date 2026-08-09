# Controle de mídia do Windows, para o Control Center.
#
# São DUAS APIs, porque o Windows separa as duas coisas:
#   - SMTC   (Windows.Media.Control) — o que está tocando e os botões de
#            transporte. É a mesma coisa do popup de mídia: qualquer app que
#            apareça lá funciona aqui, do Spotify ao YouTube no Chrome.
#   - WASAPI (Audio Session API)     — volume POR APLICATIVO, o mixer do
#            Windows. SMTC não mexe em volume, e WASAPI não troca de faixa.
#
# Só roda em Windows PowerShell 5.1: o PowerShell 7 não tem projeção WinRT, e
# a chamada de SMTC falha com "Operation is not supported on this platform".
#
# Uso:  midia.ps1 estado
#       midia.ps1 acao <indice> <toggle|play|pause|next|prev>
#       midia.ps1 volume <pid> <0..100>
param(
  [Parameter(Position = 0)][string]$Comando = 'estado',
  [Parameter(Position = 1)][string]$Alvo,
  [Parameter(Position = 2)][string]$Valor
)

$ErrorActionPreference = 'Stop'
# Sem isto, título de música com acento chega ao painel como "m?dia": o console
# do PowerShell 5.1 sai em code page do Windows, não em UTF-8.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = [Console]::OutputEncoding

# ---------------------------------------------------------------- WASAPI
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator { }
enum EDataFlow { eRender }
enum ERole { eMultimedia }

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int NotImpl1();
  int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppDevice);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams,
    [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
  int NotImpl1(); int NotImpl2();
  int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
}

[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
  int GetCount(out int SessionCount);
  int GetSession(int SessionCount, out IAudioSessionControl2 Session);
}

// A ordem aqui é a vtable, e ela herda IAudioSessionControl: um método a mais
// ou a menos faz GetProcessId devolver 0 em silêncio, sem erro nenhum.
[Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {
  int GetState(out int pRetVal);
  int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
  int SetDisplayName(string Value, ref Guid EventContext);
  int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
  int SetIconPath(string Value, ref Guid EventContext);
  int GetGroupingParam(out Guid pRetVal);
  int SetGroupingParam(Guid Override, ref Guid EventContext);
  int RegisterAudioSessionNotification(IntPtr NewNotifications);
  int UnregisterAudioSessionNotification(IntPtr NewNotifications);
  int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
  int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
  int GetProcessId(out int pRetVal);
  int IsSystemSoundsSession();
  int SetDuckingPreference(bool optOut);
}

[Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
  int SetMasterVolume(float fLevel, ref Guid EventContext);
  int GetMasterVolume(out float pfLevel);
  int SetMute(bool bMute, ref Guid EventContext);
  int GetMute(out bool pbMute);
}

public class Mixer {
  static IAudioSessionEnumerator Sessoes() {
    var e = (IMMDeviceEnumerator)(new MMDeviceEnumerator() as object);
    IMMDevice dev; e.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out dev);
    var iid = typeof(IAudioSessionManager2).GUID;
    object o; dev.Activate(ref iid, 1, IntPtr.Zero, out o);
    IAudioSessionEnumerator ses; ((IAudioSessionManager2)o).GetSessionEnumerator(out ses);
    return ses;
  }

  /// pid<TAB>processo<TAB>volume0a100<TAB>mudo<TAB>ativo, uma por linha.
  public static string Listar() {
    var sb = new System.Text.StringBuilder();
    var ses = Sessoes();
    int n; ses.GetCount(out n);
    for (int i = 0; i < n; i++) {
      IAudioSessionControl2 c; ses.GetSession(i, out c);
      int pid; c.GetProcessId(out pid);
      if (pid == 0) continue;                      // sons do sistema
      int estado; c.GetState(out estado);          // 1 = tocando agora
      float vol; ((ISimpleAudioVolume)c).GetMasterVolume(out vol);
      bool mudo; ((ISimpleAudioVolume)c).GetMute(out mudo);
      string nome;
      try { nome = System.Diagnostics.Process.GetProcessById(pid).ProcessName; } catch { continue; }
      sb.AppendLine(pid + "\t" + nome + "\t" + (int)(vol * 100) + "\t" + mudo + "\t" + estado);
    }
    return sb.ToString();
  }

  static ISimpleAudioVolume Achar(int alvo) {
    var ses = Sessoes();
    int n; ses.GetCount(out n);
    for (int i = 0; i < n; i++) {
      IAudioSessionControl2 c; ses.GetSession(i, out c);
      int pid; c.GetProcessId(out pid);
      if (pid == alvo) return (ISimpleAudioVolume)c;
    }
    return null;
  }

  public static bool Definir(int pid, float nivel) {
    var v = Achar(pid); if (v == null) return false;
    var g = Guid.Empty;
    v.SetMasterVolume(nivel, ref g);
    if (nivel > 0) v.SetMute(false, ref g);   // subir volume no mudo não faz som
    return true;
  }

  public static bool Mudo(int pid, bool valor) {
    var v = Achar(pid); if (v == null) return false;
    var g = Guid.Empty; v.SetMute(valor, ref g); return true;
  }
}
'@

# ------------------------------------------------------------------ SMTC
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
                 $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

function Esperar($op, $tipo) {
  $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op))
  if (-not $t.Wait(4000)) { throw 'a chamada de mídia não respondeu' }
  $t.Result
}

$tipoMgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgr = Esperar ($tipoMgr::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$sessoes = @($mgr.GetSessions())

# O nome que a SMTC dá ("Chrome", "Spotify.exe", um AUMID gigante da Store) e o
# nome do processo de áudio não batem sozinhos. Normalizar os dois e comparar
# resolve os casos reais; o que não casar fica sem controle de volume, e a tela
# mostra o transporte assim mesmo.
function Chave([string]$s) {
  if (-not $s) { return '' }
  $s = $s -replace '\.exe$', ''
  if ($s -match '!') { $s = ($s -split '!')[0] }       # AUMID da Store
  if ($s -match '_') { $s = ($s -split '_')[0] }
  if ($s -match '\.') { $s = ($s -split '\.')[-1] }    # 5319275A.WhatsAppDesktop
  return $s.ToLower()
}

function LerAudio {
  $lista = @()
  foreach ($linha in ([Mixer]::Listar() -split "`r?`n")) {
    $c = $linha -split "`t"
    if ($c.Count -lt 5) { continue }
    $lista += [pscustomobject]@{
      pid = [int]$c[0]; processo = $c[1]; volume = [int]$c[2]
      mudo = ($c[3] -eq 'True'); tocando = ($c[4] -eq '1'); chave = (Chave $c[1])
    }
  }
  return $lista
}

function Executar([string]$Comando, [string]$Alvo, [string]$Valor) {
# As sessões são relidas a cada comando: app aberto ou fechado muda a lista, e
# guardar a de quando o processo subiu daria índice apontando para outra coisa.
$sessoes = @($mgr.GetSessions())
$audio = LerAudio

switch ($Comando) {
  'estado' {
    $saida = @()
    for ($i = 0; $i -lt $sessoes.Count; $i++) {
      $s = $sessoes[$i]
      $props = $null
      try { $props = Esperar ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]) } catch { }
      $info = $s.GetPlaybackInfo()
      $ch = Chave $s.SourceAppUserModelId
      $par = $audio | Where-Object { $_.chave -eq $ch } | Select-Object -First 1
      $saida += [ordered]@{
        indice   = $i
        app      = $s.SourceAppUserModelId
        titulo   = if ($props) { $props.Title } else { '' }
        artista  = if ($props) { $props.Artist } else { '' }
        estado   = "$($info.PlaybackStatus)"
        podePlay = [bool]$info.Controls.IsPlayEnabled
        podePausa = [bool]$info.Controls.IsPauseEnabled
        podeProximo = [bool]$info.Controls.IsNextEnabled
        podeAnterior = [bool]$info.Controls.IsPreviousEnabled
        pid      = if ($par) { $par.pid } else { $null }
        volume   = if ($par) { $par.volume } else { $null }
        mudo     = if ($par) { $par.mudo } else { $false }
      }
    }
    @{ sessoes = $saida; audio = $audio } | ConvertTo-Json -Depth 5 -Compress
  }

  'acao' {
    $i = [int]$Alvo
    if ($i -lt 0 -or $i -ge $sessoes.Count) { throw "sessão $i não existe" }
    $s = $sessoes[$i]
    $op = switch ($Valor) {
      'play'   { $s.TryPlayAsync() }
      'pause'  { $s.TryPauseAsync() }
      'toggle' { $s.TryTogglePlayPauseAsync() }
      'next'   { $s.TrySkipNextAsync() }
      'prev'   { $s.TrySkipPreviousAsync() }
      default  { throw "ação desconhecida: $Valor" }
    }
    $ok = Esperar $op ([bool])
    @{ ok = [bool]$ok } | ConvertTo-Json -Compress
  }

  'volume' {
    $p = [int]$Alvo
    $v = [int]$Valor
    if ($v -lt 0) { $v = 0 }; if ($v -gt 100) { $v = 100 }
    $ok = [Mixer]::Definir($p, ($v / 100.0))
    @{ ok = [bool]$ok; volume = $v } | ConvertTo-Json -Compress
  }

  'mudo' {
    $ok = [Mixer]::Mudo([int]$Alvo, ($Valor -eq 'true'))
    @{ ok = [bool]$ok } | ConvertTo-Json -Compress
  }

  default { throw "comando desconhecido: $Comando" }
}
}

# `servir` existe por causa do custo de partida: o Add-Type compila o C# do
# WASAPI a cada execução, e uma chamada avulsa leva ~18s. Em modo servidor isso
# é pago uma vez, e cada comando seguinte sai em milissegundos. O painel mantém
# este processo vivo e conversa por stdin/stdout, uma linha por comando.
if ($Comando -eq 'servir') {
  Write-Output '{"pronto":true}'
  while ($true) {
    $linha = [Console]::In.ReadLine()
    if ($null -eq $linha) { break }        # stdin fechou: o painel caiu
    $linha = $linha.Trim()
    if (-not $linha) { continue }
    $p = $linha -split ' '
    try {
      Write-Output (Executar $p[0] $p[1] $p[2])
    } catch {
      Write-Output (@{ erro = "$($_.Exception.Message)" } | ConvertTo-Json -Compress)
    }
  }
} else {
  try {
    Write-Output (Executar $Comando $Alvo $Valor)
  } catch {
    Write-Output (@{ erro = "$($_.Exception.Message)" } | ConvertTo-Json -Compress)
  }
}
