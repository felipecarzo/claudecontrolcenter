/**
 * CC-1118: ajudantes dos testes para o Windows.
 *
 * Vários testes põem um programa FALSO (script de shell: `claude`, `gh`, `python`...) na frente do PATH.
 * No Windows o spawn só executa .exe: o falso não roda e, pior, o spawn segue o PATH e acha o programa
 * REAL (o `claude.exe` dele, que gasta token). Por isso, no Windows, `pathComFalso` tira do PATH as
 * pastas onde o programa real existe, e `soComFalso` troca a checagem que depende do falso por um
 * aviso de PULADO. No Linux e no macOS nada muda: o falso roda e a checagem vale.
 */
import fs from 'node:fs'
import path from 'node:path'

export const WIN = process.platform === 'win32'

/** PATH com `bin` na frente; no Windows, sem as pastas que têm `nome` real (.exe, .cmd, .com, .bat ou sem extensão). */
export function pathComFalso(bin, nome, base = process.env.PATH || '') {
  const resto = base.split(path.delimiter).filter(Boolean)
  const tem = (d) => ['', '.exe', '.cmd', '.com', '.bat'].some((e) => fs.existsSync(path.join(d, nome + e)))
  return [bin, ...(WIN ? resto.filter((d) => !tem(d)) : resto)].join(path.delimiter)
}

/** A checagem `ok(cond, msg)` de um trecho que depende do falso: no Windows, a que passa conta, e a que falha vira aviso de PULADO. */
export const soComFalso = (ok, nome) => (WIN
  ? (cond, msg) => (cond ? ok(cond, msg) : console.log(`PULADO no Windows: ${msg} (o ${nome} falso é script de shell, o Windows só executa .exe)`))
  : ok)

/** Lê o que o falso gravou; sem o falso rodando (Windows), devolve texto vazio em vez de derrubar o teste. */
export const lerDoFalso = (arq) => { try { return fs.readFileSync(arq, 'utf8') } catch (e) { if (WIN) return ''; throw e } }
