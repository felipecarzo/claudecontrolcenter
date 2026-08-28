/**
 * CC-381 — o guarda que confere, em operação, se algum projeto sumiu do quadro.
 *
 * ## Por que este teste existe, e por que ele não basta sozinho
 *
 * Ele nasceu de uma correção dele. Eu tinha dito que a conta dos projetos era a
 * garantia, e ele cortou:
 *
 * > *"vamos ser mais explícitos. como assim uma conta? isso é garantia do quê?
 * > sabemos que a única coisa que garante é Hook"*
 *
 * Estava certo. Um teste prova que a FUNÇÃO soma certo, com dados que eu mesmo
 * inventei, e só roda quando alguém roda o gate. O hook roda na máquina dele, a
 * cada resposta, contra os projetos de verdade.
 *
 * Então este arquivo testa **o guarda**, não a conta: que ele fala quando deve
 * falar, e principalmente que ele CALA quando deve calar. Guarda que repete o
 * que já foi decidido vira paisagem, e paisagem não protege nada.
 *
 * ## Isolamento
 *
 * `CC_HOME` para a foto e `CC_PROJECTS_BASE` para os projetos. Nada aqui toca
 * em pasta ou arquivo de verdade dele: teste que escreve em dado real é
 * defeito, e este projeto já pagou por isso uma vez.
 */
import assert from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let passou = 0
const ok = (nome) => { console.log('  ok   ' + nome); passou++ }

const CASA = mkdtempSync(join(tmpdir(), 'cc-quadro-guard-'))
const BASE = join(CASA, 'projetos')
const HOOK = new URL('./hooks/quadro-guard.mjs', import.meta.url).pathname

function projeto(nome, roadmap) {
  const dir = join(BASE, nome)
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'CLAUDE.md'), `# ${nome}\n`)
  if (roadmap !== null) writeFileSync(join(dir, 'docs', 'ROADMAP.md'), roadmap)
  return dir
}

/** Roda o guarda como o Claude Code roda: JSON no stdin, resposta no código de
 *  saída. `0` libera, `2` devolve o texto e faz o modelo ler. */
function rodar(entrada = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(entrada),
    encoding: 'utf8',
    env: { ...process.env, CC_HOME: join(CASA, '.claude'), CC_PROJECTS_BASE: BASE },
  })
  return { codigo: r.status, texto: r.stderr || '' }
}

mkdirSync(BASE, { recursive: true })
mkdirSync(join(CASA, '.claude'), { recursive: true })

/* Um projeto que rende cartão e um que é lido e não rende nada. */
projeto('VPS_bom', '## Uma frente\n\n### Fazer alguma coisa\n\ntexto\n')
projeto('VPS_mudo', '## Só prosa\n\nnenhum item aqui, só explicação.\n')

/* ── nível 3: fala UMA vez sobre o projeto novo que ficou de fora ────────── */
{
  const a = rodar()
  assert.equal(a.codigo, 2, 'a primeira volta avisa')
  assert.match(a.texto, /VPS_mudo/)
  assert.match(a.texto, /PELA PRIMEIRA VEZ/)
  ok('avisa na primeira vez que um projeto é lido e fica fora do quadro')

  /* A prova ao contrário, e é a que decide se este guarda serve para alguma
     coisa: na segunda volta ele CALA. Se ele repetisse, o recado viraria
     paisagem em dois dias e ninguém mais leria nenhum aviso dele. */
  const b = rodar()
  assert.equal(b.codigo, 0, 'a segunda volta cala')
  assert.equal(b.texto.trim(), '')
  ok('a prova ao contrário: na segunda volta ele cala sobre o mesmo projeto')
}

/* ── o laço: `stop_hook_active` corta sempre ─────────────────────────────── */
{
  projeto('VPS_outroMudo', '## Só prosa\n\nsem item nenhum.\n')
  const r = rodar({ stop_hook_active: true })
  assert.equal(r.codigo, 0)
  assert.equal(r.texto.trim(), '')
  ok('com o turno já devolvido uma vez, o guarda não devolve de novo')

  /* E sem a marca ele fala do projeto novo, provando que o silêncio acima veio
     da marca e não de o guarda ter parado de funcionar. */
  const s = rodar()
  assert.equal(s.codigo, 2)
  assert.match(s.texto, /VPS_outroMudo/)
  ok('sem a marca de laço, o projeto novo é avisado normalmente')
}

/* ── nível 2: projeto que SAIU do quadro cobra em toda volta ─────────────── */
{
  /* Escrevo a foto à mão dizendo que um projeto estava no quadro. É o que
     acontece de verdade quando alguém quebra o leitor: ontem aparecia, hoje
     não. */
  const foto = join(CASA, '.local', 'share', 'agent-cockpit', 'quadro-foto.json')
  mkdirSync(join(CASA, '.local', 'share', 'agent-cockpit'), { recursive: true })
  writeFileSync(foto, JSON.stringify({
    noQuadro: ['VPS_bom', 'VPS_sumiu'],
    jaAvisados: ['VPS_mudo', 'VPS_outroMudo'],
  }))

  const a = rodar()
  assert.equal(a.codigo, 2)
  assert.match(a.texto, /SAÍRAM DO QUADRO/)
  assert.match(a.texto, /VPS_sumiu/)
  ok('projeto que saiu do quadro é acusado como regressão')

  /* A diferença deste nível para o de baixo: ele NÃO marca como visto, então
     cobra de novo. Some enquanto o problema estiver de pé. */
  const b = rodar()
  assert.equal(b.codigo, 2, 'insiste na volta seguinte')
  assert.match(b.texto, /VPS_sumiu/)
  ok('a regressão volta a cobrar na resposta seguinte, e não some sozinha')

  /* E o `VPS_bom`, que continua no quadro, não é acusado junto: o guarda fala
     do que saiu, e não da lista inteira. */
  assert.ok(!/VPS_bom/.test(b.texto))
  ok('quem continua no quadro não entra no aviso de regressão')
}

/* ── falha aberta: erro do guarda nunca trava trabalho ───────────────────── */
{
  const r = spawnSync(process.execPath, [HOOK], {
    input: 'isto não é json',
    encoding: 'utf8',
    env: { ...process.env, CC_HOME: join(CASA, '.claude'), CC_PROJECTS_BASE: join(CASA, 'pasta-que-nao-existe') },
  })
  assert.equal(r.status, 0,
    'sem projeto nenhum e com stdin quebrado, o guarda libera. Guarda que trava '
    + 'por defeito próprio é desligado no mesmo dia, e com razão.')
  ok('falha aberta: stdin quebrado e base inexistente liberam o trabalho')
}

rmSync(CASA, { recursive: true, force: true })
console.log(`\n${passou} verificações, todas passaram.`)
