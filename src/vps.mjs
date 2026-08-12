// Retrato da VPS por SSH — nginx, PM2 e Docker — pra virar organograma na
// aba VPS em vez de ficar só na cabeça de quem entra por SSH cru.
//
// Só roda sob clique (`atualizarSnapshot`). NUNCA em timer: isto usa a chave
// privada do Felipe pra entrar num servidor de produção, e o painel já é um
// processo que fica sempre religado no login — automatizar SSH nele é escala
// que ninguém pediu. O resultado fica salvo (`setVpsSnapshot`), e é essa
// cópia que a aba mostra até o próximo clique.

import { quietAsync } from './platform.mjs'
import { readConfig, setVpsSnapshot } from './config.mjs'

const MARCA = {
  host: '===HOST===', ram: '===RAM===', disco: '===DISCO===',
  nginx: '===NGINX===', pm2: '===PM2===', docker: '===DOCKER===',
}

// Um comando só (menos round-trips SSH que um por seção). `-k` no df força
// bloco de 1024 bytes — sem isso o padrão POSIX é bloco de 512 e a conta de
// GB sai errada pela metade.
const COMANDO = [
  `echo '${MARCA.host}'`, 'hostname', 'uptime',
  `echo '${MARCA.ram}'`, `free -m | awk 'NR==2{print $2,$3}'`,
  `echo '${MARCA.disco}'`, `df -Pk / | awk 'NR==2{print $2,$3}'`,
  `echo '${MARCA.nginx}'`,
  `for f in /etc/nginx/sites-enabled/*; do [ -f "$f" ] && echo ">>$(basename "$f")" `
    + `&& grep -hE 'server_name|proxy_pass|root ' "$f" | sed 's/^[[:space:]]*//;s/;$//'; done 2>/dev/null`,
  `echo '${MARCA.pm2}'`, `pm2 jlist 2>/dev/null || echo '[]'`,
  `echo '${MARCA.docker}'`,
  `docker ps --format '{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null`,
].join('; ')

/** Quebra a saída única nas seções marcadas, na ordem em que apareceram. */
function secoes(saida) {
  const achadas = Object.entries(MARCA)
    .map(([k, m]) => ({ k, i: saida.indexOf(m), len: m.length }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i)
  const partes = {}
  achadas.forEach((atual, n) => {
    const fim = n + 1 < achadas.length ? achadas[n + 1].i : saida.length
    partes[atual.k] = saida.slice(atual.i + atual.len, fim).trim()
  })
  return partes
}

const porta = (texto) => {
  const m = String(texto || '').match(/:(\d{2,5})\b/)
  return m ? Number(m[1]) : null
}

/** `>>arquivo` abre um site novo; as linhas seguintes até o próximo `>>` são dele. */
function parseNginx(bloco) {
  if (!bloco) return []
  const sites = []
  let atual = null
  for (const linha of bloco.split('\n')) {
    const t = linha.trim()
    if (!t) continue
    if (t.startsWith('>>')) { atual = { arquivo: t.slice(2), serverName: null, tipo: null, alvo: null, porta: null }; sites.push(atual); continue }
    if (!atual) continue
    if (t.startsWith('server_name')) atual.serverName = t.replace(/^server_name\s+/, '')
    else if (t.startsWith('proxy_pass')) {
      atual.alvo = t.replace(/^proxy_pass\s+/, '')
      atual.tipo = 'proxy'
      atual.porta = porta(atual.alvo)
    } else if (t.startsWith('root')) {
      atual.alvo = t.replace(/^root\s+/, '')
      atual.tipo = atual.tipo || 'estatico'
    }
  }
  return sites
}

function parsePm2(bloco) {
  try {
    const lista = JSON.parse(bloco || '[]')
    if (!Array.isArray(lista)) return []
    return lista.map((p) => ({
      nome: p.name,
      status: p.pm2_env?.status || 'desconhecido',
      restarts: p.pm2_env?.restart_time ?? 0,
      uptimeMs: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : null,
      memMB: p.monit?.memory ? Math.round(p.monit.memory / 1024 / 1024) : null,
    }))
  } catch {
    return []
  }
}

function parseDocker(bloco) {
  if (!bloco) return []
  return bloco.split('\n').map((l) => l.trim()).filter(Boolean).map((linha) => {
    const [nome, imagem, status, portas] = linha.split('\t')
    const lista = (portas || '').split(',').map((p) => p.trim()).filter(Boolean)
    return { nome, imagem, status, portas: lista, porta: porta(portas) }
  })
}

/** `null` quando a VPS ainda não foi configurada nesta máquina. */
export function configurada() {
  return Boolean(readConfig().vps?.host)
}

export async function atualizarSnapshot() {
  const cfg = readConfig().vps
  if (!cfg?.host) throw new Error('configure host, usuário e chave antes de atualizar')

  const args = [
    '-i', cfg.chave, '-o', 'ConnectTimeout=15', '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new', `${cfg.usuario || 'root'}@${cfg.host}`, COMANDO,
  ]
  const r = await quietAsync('ssh', args, 25000)
  if (!r.ok) throw new Error(`SSH falhou: ${r.out.slice(0, 300) || 'sem resposta'}`)

  const partes = secoes(r.out)
  const [totalMB, usadoMB] = (partes.ram || '').split(/\s+/).map(Number)
  const [totalKB, usadoKB] = (partes.disco || '').split(/\s+/).map(Number)
  const [host, uptime] = (partes.host || '').split('\n')

  const snapshot = {
    em: Date.now(),
    host: host || cfg.host,
    uptime: uptime || null,
    ram: Number.isFinite(totalMB) && Number.isFinite(usadoMB) ? { totalMB, usadoMB } : null,
    disco: Number.isFinite(totalKB) && Number.isFinite(usadoKB)
      ? { totalGB: Math.round(totalKB / 1024 / 1024), usadoGB: Math.round(usadoKB / 1024 / 1024) } : null,
    nginx: parseNginx(partes.nginx),
    pm2: parsePm2(partes.pm2),
    docker: parseDocker(partes.docker),
  }
  setVpsSnapshot(snapshot)
  return snapshot
}

export const _internals = { secoes, parseNginx, parsePm2, parseDocker, porta }
