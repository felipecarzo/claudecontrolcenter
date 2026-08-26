#!/usr/bin/env node
/**
 * A varredura de impacto de renomear/mover/apagar uma pasta.
 *
 * Nasceu do estrago de 23/08: eu disse que renomear as pastas "não quebrava
 * nada" e quebrou o venv de dois projetos (o shebang crava o caminho absoluto),
 * uma instalação de um projeto dentro do outro, e as conversas do painel (o
 * caminho morto). Eu tinha conferido container, nginx, porta e config, e vendi
 * amostra como varredura.
 *
 * Esta varredura lista o que DEPENDE do caminho absoluto de uma pasta, por
 * classe. Não conserta nada e não move nada: só mostra o que vai quebrar se o
 * caminho mudar, para "não quebra" nunca mais sair de uma checagem parcial.
 *
 * Uso: `node hooks/impacto-scan.mjs <caminho-da-pasta>`
 * Sai 0 sempre (é diagnóstico); o número de achados vai no JSON e no texto.
 * `--json` imprime só o JSON, para o gancho consumir.
 *
 * A lista de classes CRESCE quando aparece classe nova. Hoje são nove.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const alvo = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])
const soJson = process.argv.includes('--json')
if (!alvo) {
  console.error('uso: node hooks/impacto-scan.mjs <caminho-da-pasta> [--json]')
  process.exit(0)
}
const abs = path.resolve(alvo)
const nome = path.basename(abs)
const home = os.homedir()

/** grep sem lançar: devolve as linhas que casam, ou []. */
function procurar(padrao, arquivos) {
  const achados = []
  for (const f of arquivos) {
    try {
      const txt = fs.readFileSync(f, 'utf8')
      for (const linha of txt.split(/\r?\n/)) {
        if (linha.includes(padrao)) achados.push({ arquivo: f, linha: linha.trim().slice(0, 120) })
      }
    } catch { /* arquivo ausente ou binário: ignora */ }
  }
  return achados
}

const lerDir = (dir) => { try { return fs.readdirSync(dir) } catch { return [] } }

const achados = [] // { classe, o_que, detalhe }
const add = (classe, oQue, detalhe) => achados.push({ classe, o_que: oQue, detalhe })

// 1. venv de Python: o caminho absoluto está cravado no activate e nos shebangs
for (const marca of ['pyvenv.cfg', 'bin/activate', 'Scripts/activate']) {
  if (fs.existsSync(path.join(abs, marca))) {
    add('venv-python', 'ambiente virtual de Python dentro da pasta',
      `${marca} crava o caminho ${abs}; renomear quebra o activate e o shebang de cada binário`)
    break
  }
}

// 2. git: trabalho não salvo ou não empurrado se perde a referência ao renomear
if (fs.existsSync(path.join(abs, '.git'))) {
  try {
    const sujo = execFileSync('git', ['-C', abs, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
    const ramo = execFileSync('git', ['-C', abs, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
    if (sujo) add('git-sujo', 'trabalho sem commit neste repositório', `${sujo.split('\n').length} arquivo(s) na branch ${ramo}`)
  } catch { /* não é repo válido */ }
}

// 3. link global do npm: a pasta pode estar linkada em node_modules global
for (const base of [path.join(home, '.npm-global/lib/node_modules'), path.join(home, '.npm-global/bin'),
  '/usr/local/lib/node_modules', '/usr/lib/node_modules']) {
  for (const item of lerDir(base)) {
    try {
      const alvoLink = fs.readlinkSync(path.join(base, item))
      if (path.resolve(base, alvoLink).startsWith(abs)) {
        add('npm-global', 'instalado globalmente por link do npm', `${path.join(base, item)} aponta para dentro de ${abs}`)
      }
    } catch { /* não é link */ }
  }
}

// 4. instalação editável cruzada: outro projeto instalou ESTE via link/pip -e
for (const nm of lerDir(path.join(home, 'projetos'))) {
  const outro = path.join(home, 'projetos', nm, 'node_modules')
  if (nm === nome || !fs.existsSync(outro)) continue
  for (const pkg of lerDir(outro)) {
    try {
      if (path.resolve(outro, fs.readlinkSync(path.join(outro, pkg))).startsWith(abs)) {
        add('instalacao-cruzada', `o projeto ${nm} usa este por link`, `${nm}/node_modules/${pkg} aponta para ${abs}`)
      }
    } catch { /* não é link */ }
  }
}

// 5. atalho de shell: o caminho citado em rc de shell
add.perfis = ['.bashrc', '.zshrc', '.bash_profile', '.profile'].map((f) => path.join(home, f))
for (const a of procurar(abs, add.perfis)) add('atalho-shell', 'citado num arquivo de inicialização do shell', `${path.basename(a.arquivo)}: ${a.linha}`)

// 6. serviço do sistema: unit do systemd de usuário citando o caminho
const unidades = lerDir(path.join(home, '.config/systemd/user')).map((f) => path.join(home, '.config/systemd/user', f))
for (const a of procurar(abs, unidades)) add('servico-systemd', 'citado num serviço do systemd do usuário', `${path.basename(a.arquivo)}: ${a.linha}`)

// 7. estado do painel: as conversas e o config guardam o caminho (cwd)
const casaClaude = path.join(home, '.claude')
const projetosDir = path.join(casaClaude, 'projects')
for (const pasta of lerDir(projetosDir)) {
  // o nome da pasta troca não-alfanum por hífen; se contém o nome, é candidato
  if (pasta.includes(nome.replace(/[^a-zA-Z0-9]/g, '-'))) {
    add('painel-conversas', 'conversas do painel gravadas com este caminho',
      `${pasta} guarda o cwd antigo; renomear deixa as conversas órfãs`)
  }
}
for (const a of procurar(abs, [path.join(casaClaude, 'control-center.json')])) {
  add('painel-config', 'caminho gravado na configuração do painel', a.linha); break
}

// 8. script solto: qualquer .sh/.mjs na home que cite o caminho
const soltos = ['dev.sh', 'cockpit-auth.mjs'].map((f) => path.join(home, f)).filter((f) => fs.existsSync(f))
for (const a of procurar(abs, soltos)) add('script-solto', 'citado num script da home', `${path.basename(a.arquivo)}: ${a.linha}`)

// 9. atalho/symlink apontando para a pasta (o proj_controlcenter -> VPS_cockpit)
for (const nm of lerDir(path.join(home, 'projetos'))) {
  const p = path.join(home, 'projetos', nm)
  try {
    if (fs.lstatSync(p).isSymbolicLink() && path.resolve(path.dirname(p), fs.readlinkSync(p)) === abs) {
      add('atalho-symlink', `o atalho ${nm} aponta para esta pasta`, `${p} -> ${abs}; renomear o alvo deixa o atalho morto`)
    }
  } catch { /* corrida entre lstat e readlink */ }
}

/* Deixa um marcador de que ESTA pasta foi varrida agora. É o que o
   `quebra-guard` procura para liberar a ação: sem varredura, sem renomear. O
   marcador tem o nome da pasta, então varrer uma não libera renomear outra. */
try {
  const dir = path.join(home, '.cache', 'agent-cockpit', 'impacto')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, encodeURIComponent(nome)), JSON.stringify({ alvo: abs, quando: Date.now(), quantos: achados.length }))
} catch { /* marcador é conforto; sua falta só faz o guard cobrar de novo */ }

const resultado = { alvo: abs, achados, quantos: achados.length }
if (soJson) { console.log(JSON.stringify(resultado)); process.exit(0) }

console.log(`Varredura de impacto de: ${abs}\n`)
if (!achados.length) {
  console.log('Nenhuma dependência de caminho absoluto encontrada nas 9 classes.')
  console.log('Isso NÃO é prova de que nada quebra: é o que ESTAS 9 classes viram.')
} else {
  console.log(`${achados.length} dependência(s) do caminho absoluto. Renomear/mover/apagar quebra:\n`)
  for (const a of achados) console.log(`  [${a.classe}] ${a.o_que}\n      ${a.detalhe}`)
}
process.exit(0)
