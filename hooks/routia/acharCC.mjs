/**
 * Onde está o `cc.mjs` nesta máquina.
 *
 * Existe porque a mesma linha errada estava copiada em dois hooks: um caminho
 * único, fixo, do npm global do Windows. Medido na VPS em 18/08, ao escrever os
 * primeiros testes dessas travas: em Linux o arquivo não existe, então
 *
 * - a trava que cobra to-do aberto na entrega liberava sempre, calada;
 * - o aviso de fim de rota nunca conseguia confirmar "estou sozinho no projeto",
 *   e avisava toda vez.
 *
 * Falha aberta não faz barulho, e é por isso que os dois passaram meses assim
 * sem ninguém notar.
 *
 * A ordem vai do mais específico ao mais genérico. O segundo é o que quase
 * sempre resolve: estes hooks moram DENTRO do repositório do cockpit, então o
 * `cc.mjs` está dois níveis acima, em qualquer sistema.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function acharCC() {
  const candidatos = [
    process.env.CC_CLI,
    fileURLToPath(new URL('../../cc.mjs', import.meta.url)),
    join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'claude-control-center', 'cc.mjs'),
    join(homedir(), '.npm-global', 'lib', 'node_modules', 'claude-control-center', 'cc.mjs'),
    '/usr/lib/node_modules/claude-control-center/cc.mjs',
  ].filter(Boolean)
  return candidatos.find((p) => existsSync(p)) || null
}
