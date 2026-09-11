const BASE = 'http://127.0.0.1:8099'
const ROTAS = ['/api/jobs', '/api/trabalho', '/api/cockpit', '/api/projetos/painel', '/api/projetos', '/api/quadro-projetos',
  '/api/servers', '/api/docker', '/api/federacao', '/api/framework/projetos', '/api/framework', '/api/maquina', '/api/rotas',
  '/api/meu', '/api/recados', '/api/roadmap', '/api/escritorio', '/api/remote-control', '/api/paineis', '/api/git',
  '/api/travas', '/api/vps', '/api/sincronia', '/api/hooks', '/api/modulos', '/api/tela', '/api/calendario', '/api/cambio',
  '/api/tarefas', '/api/graficos', '/api/gate/conversas', '/api/agy-remote-control', '/api/armazem', '/api/roadmap/estado',
  '/api/fila-perdida', '/api/paineis-meus', '/api/pip', '/api/assinatura', '/api/taxa', '/api/mercado', '/api/tempo',
  '/api/glossario', '/api/marcos', '/api/pastas', '/api/estrutura', '/api/bancada', '/api/rotinas', '/api/conexao', '/api/uso', '/api/instalacao']

const forma = (v, prof = 0) => {
  if (Array.isArray(v)) return v.length ? `[${v.length}] ${forma(v[0], prof + 1)}` : '[]'
  if (v && typeof v === 'object') {
    if (prof > 2) return '{…}'
    return '{ ' + Object.entries(v).slice(0, 40).map(([k, x]) => `${k}: ${forma(x, prof + 1)}`).join(', ') + ' }'
  }
  if (typeof v === 'string') return `"${v.slice(0, 30).replace(/\s+/g, ' ')}"`
  return String(v)
}

for (const r of ROTAS) {
  const t0 = Date.now()
  try {
    const res = await fetch(BASE + r, { signal: AbortSignal.timeout(8000) })
    const txt = await res.text()
    let j; try { j = JSON.parse(txt) } catch { j = txt.slice(0, 80) }
    console.log(`\n=== ${r}  (${res.status}, ${txt.length} bytes, ${Date.now() - t0}ms)`)
    console.log(forma(j).slice(0, 2500))
  } catch (e) {
    console.log(`\n=== ${r}  ERRO ${e.name}: ${e.message}`)
  }
}
