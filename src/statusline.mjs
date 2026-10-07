// A barra de status do Claude Code: grava o uso do plano e, se pedido, embrulha a original.
//
// Morava dentro do `cc.mjs`, e cada execução carregava o arquivo inteiro (132 KB e
// dezenas de módulos) só para gravar dois números. Medido em 02/10, com a VPS a 98%
// de CPU: 0,39 s para o `cc.mjs` partir contra 0,11 s para o que a barra realmente
// usa. Cada sessão aberta chama isto a cada atualização, e eram seis sessões.
//
// Rodável direto (`node src/statusline.mjs [--wrap "<comando>"]`), que é o caminho
// leve; o `cc.mjs statusline` continua funcionando e chama esta mesma função.
import { pathToFileURL } from 'node:url'
import path from 'node:path'

export async function rodar(argv = process.argv.slice(2)) {
  const val = (f, d = null) => {
    const i = argv.indexOf(f)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : d
  }
  const entrada = await new Promise((resolve) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => { buf += c })
    process.stdin.on('end', () => resolve(buf))
    process.stdin.on('error', () => resolve(''))
  })
  try {
    const { gravarUso, marcarChamada } = await import('./uso.mjs')
    const dados = JSON.parse(entrada)
    /* CC-261: registra que a barra FOI chamada, mesmo quando não veio número.
       É o que distingue "nunca rodou aqui" de "rodou e não trouxe o dado", e
       os dois deixam a tela igual: sem número. */
    marcarChamada(Boolean(dados?.rate_limits))
    gravarUso(dados)
  } catch { /* sem rate_limits, JSON quebrado ou disco cheio: segue o jogo */ }

  const embrulhado = val('--wrap')
  if (!embrulhado) return

  let saida = ''
  try {
    const { spawnSync } = await import('node:child_process')
    // 15s: a statusline embrulhada pode chamar ferramenta externa lenta (a do
    // Felipe cai num `npx ccusage` quando o binário não está instalado).
    // CC-460: `windowsHide`, para cada redesenho não piscar janela preta no Windows.
    const r = spawnSync(embrulhado, {
      input: entrada, shell: true, encoding: 'utf8', timeout: 15000, windowsHide: true,
    })
    saida = r.stdout || ''
  } catch { /* fica com a linha mínima abaixo */ }

  // Se a original travou ou não imprimiu nada, ainda assim sai algo: barra
  // vazia parece painel quebrado, e o uso do plano é a informação que mais importa ali.
  if (!saida.trim()) {
    try {
      const j = JSON.parse(entrada)
      const u = (await import('./uso.mjs')).readUso()
      const pct = (x) => (x ? `${Math.round(x.pct)}%` : '—')
      saida = [
        j.workspace?.current_dir ? j.workspace.current_dir.split(/[\\/]/).filter(Boolean).pop() : '',
        j.model?.display_name,
        u ? `plano 5h ${pct(u.cincoHoras)} · semana ${pct(u.semana)}` : '',
      ].filter(Boolean).join('  ·  ')
    } catch { /* nem isso: sai vazio mesmo */ }
  }
  if (saida) process.stdout.write(saida)
}

// só roda sozinho quando chamado direto, nunca ao ser importado (pelo cc.mjs ou pelo gate)
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await rodar()
