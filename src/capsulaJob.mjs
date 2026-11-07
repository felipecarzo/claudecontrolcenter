/* CC-1080, passo 2: o processo que FAZ a cápsula, filho do painel.
 *
 * Existe para o painel não travar: empacotar GBs e esperar o Docker leva minutos, e o servidor do painel atende a tela de
 * 2 em 2 segundos. Quem dispara é `capsulaPainel.mjs`; a senha chega SÓ por stdin (primeira linha), nunca por argumento,
 * variável ou arquivo. O andamento vai para o arquivo de estado (argv[2].estado), que nunca recebe a senha.
 * É aqui que o Docker de verdade é chamado, pelo executor padrão, que recusa rodar em sessão de IA, e que a configuração
 * do servidor (nginx, PM2, unidades, cron) é lida: só leitura.
 * O mesmo processo também mede (modo `ensaio`, sem senha): ver ensaioFilho.
 * Só executa quando é o arquivo de entrada do processo: importar este módulo (o gate faz isso) não lê stdin nem faz nada.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fazer } from './capsula.mjs'
import { contar } from './capsulaServidor.mjs'
import { executorPadrao } from './capsulaDocker.mjs'

/** Modo ensaio (Estimar): mede a pasta, o Docker (só lê) e o servidor, sem senha e sem gravar cápsula. Existe para o painel não
 *  parar: a medição varre pastas de forma síncrona (15 s a frio no VPS_ahtleta). O resultado vai no arquivo de estado. */
async function ensaioFilho(params) {
  let estado = { id: params.id, tipo: 'ensaio', projeto: params.projeto, inicio: Date.now(), fase: 'medindo', ok: null }
  const gravar = (parte) => {
    estado = { ...estado, ...parte }
    const tmp = `${params.estado}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(estado), { mode: 0o600 })
    fs.renameSync(tmp, params.estado)
  }
  try {
    gravar({ fase: 'medindo' })
    // atraso de teste: bloqueia ESTE processo de forma síncrona, como a varredura a frio, para provar que o painel não para junto
    if (params.atrasoMs > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, params.atrasoMs)
    const { medir } = await import('./capsulaPainel.mjs')
    const resultado = await medir({ nome: params.projeto, raiz: params.pasta }, { incluirCandidatos: params.incluirCandidatos === true })
    gravar({ fase: 'pronta', fim: Date.now(), ok: true, resultado })
  } catch (e) {
    gravar({ fase: 'falhou', fim: Date.now(), ok: false, erro: String(e.message || e) })
    process.exitCode = 1
  }
}

async function principal() {
  const params = JSON.parse(process.argv[2] || '{}')
  if (params.modo === 'ensaio') return ensaioFilho(params)
  const senha = fs.readFileSync(0, 'utf8').split('\n')[0].replace(/\r$/, '')
  const limpa = (t) => (senha ? String(t).split(senha).join('***') : String(t))

  let estado = { id: params.id, projeto: params.projeto, inicio: Date.now(), fase: 'iniciando', ok: null }
  const gravar = (parte) => {
    estado = { ...estado, ...parte }
    const tmp = `${params.estado}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(estado), { mode: 0o600 })
    fs.renameSync(tmp, params.estado)
  }

  try {
    gravar({ fase: 'iniciando' })
    const r = await fazer(params.pasta, {
      senha,
      saida: params.saida,
      docker: { executar: executorPadrao() },
      servidor: {}, // nginx, PM2, unidades, cron: só leitura, com os leitores padrão
      incluirCandidatos: params.incluirCandidatos === true, // as pastas publicadas dos blocos candidatos, só se ele marcou
      progresso: (fase) => gravar({ fase: limpa(fase) }),
    })
    const d = r.manifesto.docker
    gravar({
      fase: r.prova && r.prova.ok ? 'pronta' : 'pronta, mas a prova falhou',
      fim: Date.now(),
      ok: r.prova ? r.prova.ok === true : true,
      arquivo: path.basename(r.arquivo),
      bytes: r.bytes,
      prova: r.prova ? { ok: r.prova.ok, motivo: limpa(r.prova.motivo), em: r.prova.em } : null,
      docker: d ? { projeto_compose: d.projeto_compose || null, motivo: d.motivo || null, imagens: (d.imagens || []).length, volumes: (d.volumes || []).length, bancos: (d.bancos || []).length, falhas: (d.falhas || []).length } : null,
      servidor: contar(r.manifesto.servidor),
      pastas: { publicado: (r.manifesto.publicado || []).filter((x) => x.estado === 'coletada').length, montagens: (r.manifesto.montagens || []).filter((x) => x.estado === 'coletada').length, candidatas_nao_incluidas: (r.manifesto.publicado || []).filter((x) => x.estado === 'candidata-nao-incluida').length },
      nao_coletado: r.manifesto.nao_coletado_total || 0,
    })
  } catch (e) {
    gravar({ fase: 'falhou', fim: Date.now(), ok: false, erro: limpa(e.message || e) })
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal()
