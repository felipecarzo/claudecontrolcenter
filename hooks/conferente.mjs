#!/usr/bin/env node
/**
 * CC-1070, peça 3: o conferente separado.
 *
 * Stop, rodado pelo `parada.mjs`, depois do `confere-fala`. Dois gatilhos, uma
 * vez por turno no total:
 *   - fala: a resposta afirma feito ou estado, e só na segunda passada do
 *     `confere-fala` (stop_hook_active), para não gastar duas chamadas na mesma
 *     resposta; com o `confere-fala` desligado, roda já na primeira.
 *   - risco (CC-1073): o REGISTRO do turno tem ação de risco (derrubou, ligou,
 *     apagou, enviou arquivo, commitou ou publicou), mesmo que a resposta não
 *     afirme nada. Só na primeira passada. Aqui `sem_prova` não conta, porque
 *     não há afirmação para provar.
 *
 * Compara pedido, feito e fala por um segundo modelo (`src/conferente.mjs`).
 * Qualquer lista não vazia devolve a resposta com as listas. Falha do
 * conferente passa e grava em ~/logs/conferente.log. Teto de 30 chamadas por hora.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

if (process.env.CC_CONFERENTE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-cli') sair()

let dados = null
try { dados = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { sair() }

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
const cwd = dados?.cwd || process.cwd()
if (cfg?.hookEnabled && !cfg.hookEnabled('conferente', undefined, cwd)) sair()
const segunda = !!dados?.stop_hook_active

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let motivo = null
try {
  const C = await import(urlDeModulo(AQUI, '../src/conferente.mjs'))
  const R = await import(urlDeModulo(AQUI, '../src/registroTurno.mjs'))
  const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs'))
  const fala = E.ultimaResposta(arquivo) || ''
  const sem = C.limpar(fala)
  const home = os.homedir()
  const registro = R.registroDoTurno(arquivo)
  /* CC-1099: o confere-fala não barra mais (vira cobrança da próxima), então não há segunda volta para esperar. */
  const porFala = !!fala && !/nao conferi/.test(sem) && C.afirma(sem) && !segunda
  const risco = segunda ? [] : R.riscoDoRegistro(registro)
  if (porFala || risco.length) {
    const marca = path.join(home, '.local', 'share', 'agent-cockpit', 'conferente-marca', `${String(dados?.session_id || 'sem').replace(/[^\w-]/g, '_')}.json`)
    const turno = String(registro.pedidoEm || '')
    let jaRodou = false
    try { jaRodou = JSON.parse(fs.readFileSync(marca, 'utf8')).turno === turno } catch { /* sem marca */ }
    if (!jaRodou) {
      try { fs.mkdirSync(path.dirname(marca), { recursive: true }); fs.writeFileSync(marca, JSON.stringify({ turno })) } catch { /* sem marca, vale igual */ }
      const sessao = dados?.session_id || null
      const gatilho = porFala ? 'fala' : 'risco'
      if (C.chamadasNaHora({ home }) >= C.TETO_POR_HORA) {
        C.gravarLog({ sessao, status: 'teto', gatilho, limite: C.TETO_POR_HORA }, { home })
      } else {
        const r = C.chamar(C.montarPrompt({ registro, fala }), { home })
        if (r.erro) C.gravarLog({ sessao, chamada: true, gatilho, status: 'erro', erro: r.erro, ms: r.ms, modelo: r.modelo || null }, { home })
        else {
          if (!porFala) r.veredito.fala_x_feito.sem_prova = [] // só risco: não há afirmação para provar
          if (!C.temAchado(r.veredito)) C.gravarLog({ sessao, chamada: true, gatilho, status: 'passou', modelo: r.modelo, ms: r.ms }, { home })
          else {
            C.gravarLog({ sessao, chamada: true, gatilho, status: 'barrou', modelo: r.modelo, ms: r.ms, veredito: r.veredito, ...(risco.length ? { risco: risco.slice(0, 5) } : {}) }, { home })
            motivo = C.mensagem(r.veredito)
          }
        }
      }
    }
  }
} catch { motivo = null /* falha aberta */ }

if (!motivo) sair()
console.error(motivo)
process.exit(2)
