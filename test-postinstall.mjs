/**
 * O postinstall instala os hooks sozinho, e não estraga nada no caminho.
 *
 * Casa isolada por `CC_HOME`. Escrever no `settings.json` de verdade durante
 * um teste é o defeito que este projeto já cometeu com o bloco de notas dele.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/* `import.meta.dirname`, nunca caminho fixo: um `D:/...` aqui passaria neste
   PC e quebraria na VPS, que é exatamente o defeito que o `git-add-guard`
   cometeu e o `cc hooks testar` pegou em 17/08. */
const REPO = import.meta.dirname
const SCRIPT = join(REPO, 'src', 'postinstall.mjs')

let falhou = false
const ok = (nome, cond, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FALHA'} ${nome}${extra ? ` — ${extra}` : ''}`)
  if (!cond) falhou = true
}

const rodar = (casa) => spawnSync(process.execPath, [SCRIPT], {
  encoding: 'utf8', timeout: 60000, cwd: REPO,
  env: { ...process.env, CC_HOME: casa },
})

/* --- casa limpa, com um hook de terceiro já lá dentro --- */
{
  const casa = mkdtempSync(join(tmpdir(), 'provahook-'))
  try {
    /* O settings de verdade dele tem hooks de OUTRO sistema (pixel-agents).
       Se o postinstall apagar isso, o estrago é silencioso e fora do projeto. */
    writeFileSync(join(casa, 'settings.json'), JSON.stringify({
      permissions: { allow: ['Bash'] },
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: 'command', command: 'node C:/outro-sistema/hook.js' }] },
        ],
      },
    }, null, 1))

    const r = rodar(casa)
    ok('sai com código 0, para nunca derrubar um npm install', r.status === 0,
      `status ${r.status}: ${(r.stderr || '').slice(0, 120)}`)

    const depois = JSON.parse(readFileSync(join(casa, 'settings.json'), 'utf8'))

    const todos = JSON.stringify(depois.hooks || {})
    ok('o hook de OUTRO sistema continua lá', todos.includes('C:/outro-sistema/hook.js'))
    ok('as permissões de terceiro não foram tocadas',
      JSON.stringify(depois.permissions) === JSON.stringify({ allow: ['Bash'] }))

    ok('registrou os hooks do catálogo', /rota-guard|travessao-guard|gate-guard/.test(todos),
      todos.slice(0, 100))

    const copiados = existsSync(join(casa, 'hooks')) ? readdirSync(join(casa, 'hooks')) : []
    ok('copiou os arquivos de hook para a casa', copiados.length > 20, `${copiados.length} arquivo(s)`)

    /* Rodar de novo é o caso normal de quem reinstala o pacote: não pode
       duplicar entrada nem falar de novo. */
    const antesDoSegundo = readFileSync(join(casa, 'settings.json'), 'utf8')
    const r2 = rodar(casa)
    ok('rodar de novo não muda nada', readFileSync(join(casa, 'settings.json'), 'utf8') === antesDoSegundo)
    ok('e fica calado na segunda vez', `${r2.stdout || ''}${r2.stderr || ''}`.trim() === '',
      `${r2.stdout || ''}${r2.stderr || ''}`.slice(0, 100))
  } finally {
    rmSync(casa, { recursive: true, force: true })
  }
}

/* --- casa vazia, sem settings nenhum: acontece em CI e em container --- */
{
  const casa = join(tmpdir(), `provahook-vazia-${Date.now()}`)
  const r = rodar(casa)
  ok('casa sem settings.json não derruba a instalação', r.status === 0,
    `status ${r.status}`)
  ok('e avisa o que fazer, em vez de falhar calado',
    /hooks sync|não foram instalados/.test(`${r.stdout || ''}${r.stderr || ''}`),
    `${r.stdout || ''}${r.stderr || ''}`.slice(0, 140))
  rmSync(casa, { recursive: true, force: true })
}

console.log(falhou ? '\nFALHOU' : '\ntudo passou')
process.exit(falhou ? 1 : 0)
