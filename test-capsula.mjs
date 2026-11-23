// CC-1080, passo 1: a cápsula de projeto. Casa falsa e projeto falso; não encosta em nada real.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { WIN } from './test/windows.mjs'

// CC-1118: a cápsula é da VPS: tar GNU (que lê "C:" como máquina remota), gpg, /bin/sh e falsos em shell. Roda lá.
if (WIN) { console.log('test-capsula: PULADO no Windows (precisa de tar GNU com caminho Linux, gpg e /bin/sh)'); process.exit(0) }

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'test-capsula-'))
const CASA = path.join(T, 'casa')
const SAIDA = path.join(CASA, 'caps')
fs.mkdirSync(CASA, { recursive: true })
// casa falsa: nada de ~/.gnupg nem de ~/.local reais
process.env.HOME = CASA
process.env.USERPROFILE = CASA // CC-1118: no Windows os.homedir() lê USERPROFILE, não HOME
process.env.CC_HOME = path.join(CASA, '.claude')
process.env.GNUPGHOME = fs.mkdtempSync(path.join(os.tmpdir(), 'g-'))
fs.chmodSync(process.env.GNUPGHOME, 0o700)
process.env.CC_SEM_NAVEGADOR = '1'

// O gpg real precisa de um socket unix (gpg-agent). Na caixa de proteção da sessão de IA todo socket é negado,
// então, SE o gpg real não funcionar aqui, entra um gpg de mentira (openssl) só para exercitar o encanamento.
// Nesse caso a cifra REAL não foi conferida, e o teste diz isso no fim. Fora da caixa (PC, painel) vale o gpg real.
let gpgReal = true
{
  const sonda = path.join(T, 'sonda.txt'); fs.writeFileSync(sonda, 'x')
  const p = spawnSync('gpg', ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256', '-o', sonda + '.gpg', sonda], { input: 'p\n', encoding: 'utf8', timeout: 30000 })
  gpgReal = p.status === 0 && fs.existsSync(sonda + '.gpg')
  if (!gpgReal) {
    const bin = path.join(T, 'bin-falso'); fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'gpg'), `#!/bin/sh
MODO=; OUT=; IN=
while [ $# -gt 0 ]; do
  case "$1" in
    --symmetric|-c) MODO=enc ;; --decrypt|-d) MODO=dec ;;
    -o) OUT="$2"; shift ;; --pinentry-mode|--passphrase-fd|--cipher-algo) shift ;;
    --*) ;; *) IN="$1" ;;
  esac; shift
done
IFS= read -r PW
if [ "$MODO" = enc ]; then
  (echo CAPSULA-FALSO; cat "$IN") | { printf '%s\\n' "$PW" > "$OUT.pw"; openssl enc -aes-256-cbc -pbkdf2 -pass "file:$OUT.pw" -out "$OUT"; R=$?; rm -f "$OUT.pw"; exit $R; }
else
  printf '%s\\n' "$PW" > "$OUT.pw"
  openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$OUT.pw" -in "$IN" > "$OUT.tmp" 2>/dev/null; R=$?; rm -f "$OUT.pw"
  if [ $R -ne 0 ] || [ "$(head -n 1 "$OUT.tmp")" != CAPSULA-FALSO ]; then rm -f "$OUT.tmp"; echo "gpg falso: senha errada" >&2; exit 2; fi
  tail -n +2 "$OUT.tmp" > "$OUT"; rm -f "$OUT.tmp"
fi
`, { mode: 0o755 })
    process.env.PATH = bin + ':' + process.env.PATH
  }
}

const C = await import('./src/capsula.mjs')

let falhas = 0, total = 0
const ok = (cond, msg) => { total++; if (!cond) { falhas++; console.log('  FALHOU:', msg) } else console.log('  ok:', msg) }
const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 120000, ...o })

// ---- projeto falso -------------------------------------------------------
const PROJ = path.join(T, 'meus', 'jogo-falso')
const w = (rel, txt, modo) => { const f = path.join(PROJ, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); if (modo) fs.chmodSync(f, modo) }
w('package.json', '{"name":"jogo-falso"}\n')
w('src/a.js', 'console.log("a")\n')
w('node_modules/pkg/index.js', 'module.exports = 1\n')
w('node_modules/.bin/ex', '#!/bin/sh\necho ex\n', 0o755)
w('bin/rodar.sh', '#!/bin/sh\necho rodando\n', 0o755)
w('.env', 'SEGREDO=abc123-nao-pode-vazar\n')
w('.env.example', 'SEGREDO=\n')
w('apps/x/.env.local', 'OUTRO=zzz-tambem-secreto\n')
fs.mkdirSync(path.join(PROJ, 'vazia'))
fs.symlinkSync('src/a.js', path.join(PROJ, 'atalho'))
const git = (...a) => sh('git', ['-C', PROJ, '-c', 'user.email=t@t', '-c', 'user.name=t', ...a])
git('init', '-q'); git('add', 'package.json', 'src', 'bin'); git('commit', '-q', '-m', 'um')
w('novo-nao-commitado.txt', 'ainda não foi commitado\n')
w('src/a.js', 'console.log("a mudou")\n')

const SENHA = 'senha-de-teste-123'
const antesGit = git('status', '--porcelain').stdout

const extrair = (arquivo, dir) => { fs.mkdirSync(dir, { recursive: true }); return sh('tar', ['-xzpf', arquivo, '-C', dir]) }
const assinatura = (dir, ignorar = []) => { const { itens } = C.varrer(dir); return C.assinarArvore(dir, itens, new Set(ignorar)).sha256 }

// (a) fazer e provar
console.log('(a) fazer e provar')
const r = await C.fazer(PROJ, { senha: SENHA, saida: SAIDA })
ok(fs.existsSync(r.arquivo) && /jogo-falso-\d{8}-\d{4}\.capsula\.tar\.gz$/.test(r.arquivo), `nome da cápsula: ${path.basename(r.arquivo)}`)
ok(r.prova.ok === true, `prova automática ok: ${r.prova.motivo}`)
const cap = path.join(T, 'cap')
extrair(r.arquivo, cap)
const partes = fs.readdirSync(cap).sort()
ok(JSON.stringify(partes) === JSON.stringify(['RESTAURAR.md', 'manifesto.json', 'projeto.tar.gz', 'restaurar.sh', 'segredos.tar.gpg']), `partes: ${partes.join(', ')}`)
const mani = JSON.parse(fs.readFileSync(path.join(cap, 'manifesto.json'), 'utf8'))
ok(mani.provada.ok === true && mani.provada.em, 'manifesto traz provada.ok = true e a data')
ok(mani.git.commit && mani.git.status.total === git('status', '--porcelain').stdout.trim().split('\n').length, `manifesto traz git (commit e contagem ${mani.git.status.total})`)
ok(mani.segredos.arquivos.join() === '.env,apps/x/.env.local' && !JSON.stringify(mani).includes('abc123'), 'manifesto lista só os NOMES dos segredos')
ok(git('status', '--porcelain').stdout === antesGit, 'a origem ficou como estava (git status igual)')

// restaurar de fora, com dash se existir, e comparar com a origem inteira (segredos incluídos)
const shell = fs.existsSync('/usr/bin/dash') ? 'dash' : 'sh'
const D1 = path.join(T, 'rest1')
const rr = sh(shell, [path.join(cap, 'restaurar.sh'), '--aplicar', '--destino', D1], { input: SENHA + '\n' })
ok(rr.status === 0, `restaurar.sh --aplicar com ${shell} saiu 0 (${rr.status})`)
ok(assinatura(D1) === assinatura(PROJ), 'o restaurado é idêntico à origem (sha256, permissões, atalhos, pastas vazias)')
ok(fs.lstatSync(path.join(D1, 'atalho')).isSymbolicLink() && (fs.statSync(path.join(D1, 'bin/rodar.sh')).mode & 0o111) !== 0, 'atalho e executável preservados')
ok(fs.readFileSync(path.join(D1, 'novo-nao-commitado.txt'), 'utf8').includes('ainda não') && fs.existsSync(path.join(D1, 'node_modules/pkg/index.js')), 'não commitado e node_modules voltaram')
ok(sh('git', ['-C', D1, 'status', '--porcelain']).stdout.trim().split('\n').length === mani.git.status.total, 'git status do restaurado tem a mesma contagem da origem')

// (b) o segredo NÃO está no projeto.tar.gz
console.log('(b) segredos')
const lista = sh('tar', ['-tzf', path.join(cap, 'projeto.tar.gz')]).stdout.split('\n')
ok(!lista.some((l) => /\.env($|\.local$)/.test(l)) && lista.some((l) => l.endsWith('.env.example')), '.env e .env.local fora do projeto.tar.gz; .env.example dentro')
ok(!fs.readFileSync(path.join(cap, 'segredos.tar.gpg')).includes('abc123'), 'segredos.tar.gpg não tem o texto em claro')
ok(fs.readFileSync(path.join(D1, '.env'), 'utf8').includes('abc123') && fs.existsSync(path.join(D1, 'apps/x/.env.local')), '.env só aparece depois de restaurar com a senha certa')
const D0 = path.join(T, 'rest0')
fs.mkdirSync(D0)
sh('tar', ['-xzpf', path.join(cap, 'projeto.tar.gz'), '-C', D0])
ok(!fs.existsSync(path.join(D0, 'jogo-falso', '.env')), 'extrair só o projeto.tar.gz à mão não traz o .env')

// (c) senha errada
console.log('(c) senha errada')
const D2 = path.join(T, 'rest2')
const rc = sh(shell, [path.join(cap, 'restaurar.sh'), '--aplicar', '--destino', D2], { input: 'senha-errada\n' })
ok(rc.status === 6, `senha errada: restaurou com aviso (saída 6, veio ${rc.status})`)
ok(!fs.existsSync(path.join(D2, '.env')) && fs.existsSync(path.join(D2, 'package.json')), 'senha errada não abre o .env e o resto restaura')
ok(/SEM os segredos/.test(rc.stdout), 'o script avisa que voltou sem os segredos')
const D2b = path.join(T, 'rest2b')
const rc2 = sh(shell, [path.join(cap, 'restaurar.sh'), '--aplicar', '--destino', D2b], { input: '\n' })
ok(rc2.status === 6 && !fs.existsSync(path.join(D2b, '.env')) && fs.existsSync(path.join(D2b, 'package.json')), 'sem senha: restaura sem os segredos e avisa')

// (d) com segredo e sem senha, fazer recusa
console.log('(d) sem senha, recusa')
let erro = null
try { await C.fazer(PROJ, { senha: null, saida: path.join(T, 'saida-d') }) } catch (e) { erro = e }
ok(erro && erro.codigo === 'SENHA' && /senha/.test(erro.message), `fazer recusa: ${erro && erro.message.slice(0, 70)}...`)
ok(!fs.existsSync(path.join(T, 'saida-d')), 'recusou antes de criar qualquer coisa')
const cli = sh('node', [path.join(AQUI, 'cc.mjs'), 'capsula', 'fazer', PROJ, '--saida', path.join(T, 'saida-d2')], { input: '', env: { ...process.env } })
ok(cli.status === 1 && /senha/.test(cli.stderr), 'o comando cc capsula fazer sai com código 1 e explica')

// (e) ensaio não cria nada
console.log('(e) ensaio')
const D3 = path.join(T, 'rest3')
const re = sh(shell, [path.join(cap, 'restaurar.sh'), '--destino', D3])
ok(re.status === 0 && !fs.existsSync(D3) && /ENSAIO/.test(re.stdout), 'sem --aplicar não cria o destino')
const reD = path.join(T, 'rest3d')
fs.mkdirSync(reD); const re2 = sh(shell, [path.join(cap, 'restaurar.sh'), '--destino', reD])
ok(fs.readdirSync(reD).length === 0, 'sem --aplicar não escreve em destino vazio existente')

// (f) destino existente e não vazio
console.log('(f) destino ocupado')
const D4 = path.join(T, 'rest4')
fs.mkdirSync(D4); fs.writeFileSync(path.join(D4, 'meu.txt'), 'meu')
const rf = sh(shell, [path.join(cap, 'restaurar.sh'), '--aplicar', '--destino', D4], { input: SENHA + '\n' })
ok(rf.status === 4 && fs.readdirSync(D4).join() === 'meu.txt', 'destino não vazio é recusado e fica intacto')
const rf2 = sh(shell, [path.join(cap, 'restaurar.sh'), '--aplicar', '--destino', D4, '--sobrescrever'], { input: SENHA + '\n' })
ok(rf2.status === 0 && fs.existsSync(path.join(D4, 'package.json')) && fs.existsSync(path.join(D4, 'meu.txt')), 'com --sobrescrever restaura por cima sem apagar o que já havia')

// (g) cápsula adulterada
console.log('(g) adulterada')
const capG = path.join(T, 'capG')
extrair(r.arquivo, capG)
const pg = path.join(capG, 'projeto.tar.gz')
const buf = fs.readFileSync(pg); buf[Math.floor(buf.length / 2)] ^= 0xff; fs.writeFileSync(pg, buf)
const DG = path.join(T, 'restG')
const rg = sh(shell, [path.join(capG, 'restaurar.sh'), '--aplicar', '--destino', DG], { input: SENHA + '\n' })
ok(rg.status === 3 && /SOMA DIFERENTE/.test(rg.stderr) && !fs.existsSync(DG), 'um byte trocado: recusada pela soma, nada restaurado')
const pgp = path.join(capG, 'segredos.tar.gpg')
const b2 = fs.readFileSync(pgp); b2[b2.length - 1] ^= 0x01; fs.writeFileSync(pgp, b2)
fs.writeFileSync(pg, fs.readFileSync(path.join(cap, 'projeto.tar.gz')))
const rg2 = sh(shell, [path.join(capG, 'restaurar.sh'), '--destino', DG])
ok(rg2.status === 3, 'segredos adulterados também são recusados pela soma')

// (h) disco cheio simulado
console.log('(h) disco')
let eh = null
const saidaH = path.join(T, 'saida-h')
try { await C.fazer(PROJ, { senha: SENHA, saida: saidaH, livre: () => 1024 ** 3 }) } catch (e) { eh = e }
ok(eh && eh.codigo === 'DISCO' && !fs.existsSync(saidaH), `disco com 1 GB livre: recusou antes de gravar (${eh && eh.message.slice(0, 40)}...)`)
const pico = C.ensaio(PROJ, { saida: saidaH, livre: () => 0 }).pico
let eh2 = null
try { await C.fazer(PROJ, { senha: SENHA, saida: saidaH, livre: () => pico + C.MIN_SOBRA - 1 }) } catch (e) { eh2 = e }
ok(C.MIN_SOBRA === 2 * 1024 ** 3 && eh2 && eh2.codigo === 'DISCO', 'um byte abaixo da folga de 2 GB recusa')
fs.rmSync(saidaH, { recursive: true, force: true })
const en = C.ensaio(PROJ, { saida: saidaH, livre: () => 1024 ** 3 })
ok(en.cabe === false && !fs.existsSync(saidaH), 'o ensaio mede e diz que não cabe, sem gravar')

// (i) sintaxe
console.log('(i) sintaxe do script')
ok(sh('sh', ['-n', path.join(cap, 'restaurar.sh')]).status === 0, 'sh -n restaurar.sh passa')
if (fs.existsSync('/usr/bin/dash')) ok(sh('dash', ['-n', path.join(cap, 'restaurar.sh')]).status === 0, 'dash -n restaurar.sh passa')

// extras: prova de que provar() acusa quando a restauração não bate, e RESTAURAR.md
console.log('(extra) prova que acusa, e o documento')
const rprova = C.provar(r.arquivo, { senha: 'senha-errada' })
ok(rprova.ok === false, `provar com senha errada falha: ${rprova.motivo.slice(0, 60)}...`)
const rsem = C.provar(r.arquivo, { senha: null, gravar: false })
ok(rsem.parcial === true && rsem.ok === false, 'provar sem senha numa cápsula com segredo diz PARCIAL e não grava')
const md = fs.readFileSync(path.join(cap, 'RESTAURAR.md'), 'utf8')
ok((md.match(/^## \d\. /gm) || []).length === 9, 'RESTAURAR.md tem as 9 seções')
ok(!/[—–]/.test(md) && !/[—–]/.test(C.RESTAURAR_SH), 'sem travessão no RESTAURAR.md nem no restaurar.sh')
ok(!md.includes('abc123') && /Não se aplica a esta cápsula/.test(md), 'o documento não tem segredo e diz "não se aplica" onde o passo 1 não cobre')

// projeto sem segredo: não pede senha e não cria segredos.tar.gpg
const P2 = path.join(T, 'meus', 'sem-segredo'); fs.mkdirSync(P2, { recursive: true }); fs.writeFileSync(path.join(P2, 'a.txt'), 'oi')
const r2 = await C.fazer(P2, { saida: SAIDA })
ok(r2.prova.ok && !r2.manifesto.sha256['segredos.tar.gpg'], 'projeto sem segredo: cápsula sem segredos.tar.gpg, prova ok')

// ============================================================================
// PASSO 2: a parte Docker. TUDO com o Docker FALSO (tools/capsula/docker-falso.mjs): nenhum comando real.
// ============================================================================
console.log('(j) Docker: só comandos permitidos, filtro pelo projeto, sem senha na linha')
const Dk = await import('./src/capsulaDocker.mjs')
const { criarFalso, criarProjetoDocker, SENHA_DO_BANCO } = await import('./tools/capsula/docker-falso.mjs')
const falso = criarFalso(T)
falso.ligar()
const FD = criarProjetoDocker(T, falso)
const SENHA2 = 'outra-senha-de-teste-456'
const GRANDE = () => 100 * 1024 ** 3
const executar = Dk.executorPadrao() // com CC_DOCKER_BIN ligado, roda o falso
falso.zerarLog()
const rj = await C.fazer(FD.raiz, { senha: SENHA2, saida: SAIDA, docker: { executar }, livre: GRANDE })
ok(rj.prova.ok === true, `cápsula com Docker feita e provada: ${rj.prova.motivo.slice(0, 150)}`)
const capJ = path.join(T, 'capJ'); extrair(rj.arquivo, capJ)
const maniJ = JSON.parse(fs.readFileSync(path.join(capJ, 'manifesto.json'), 'utf8'))
const chaves = Object.keys(maniJ.sha256)
ok(chaves.some((k) => k === 'docker/compose/1-docker-compose.yml') && chaves.filter((k) => k.startsWith('docker/volumes/')).length === 2
  && chaves.filter((k) => k.startsWith('docker/imagens/')).length === 2 && chaves.filter((k) => k.startsWith('dados/') && k.endsWith('.dump')).length === 2 && chaves.includes('docker/plano.tsv'),
  `todas as partes Docker no manifesto com sha256 (${chaves.length} partes)`)
ok(maniJ.docker.projeto_compose === 'fe-teste' && maniJ.docker.volumes.length === 2 && maniJ.docker.imagens.length === 2 && maniJ.docker.bancos.map((b) => b.banco).sort().join() === 'appdb,extra', 'manifesto: projeto Compose, 2 volumes, 2 imagens, 2 bancos')
ok(maniJ.docker.imagens.every((i) => /^(postgres|node)@sha256:/.test(i.digest)), 'o digest de cada imagem está no manifesto')
ok(maniJ.docker.portas.some((p) => p.publica === 5433) && maniJ.docker.conteineres.some((c) => c.variaveis.includes('POSTGRES_PASSWORD')) && maniJ.docker.conteineres.some((c) => c.variaveis.includes('DATABASE_URL')), 'portas e NOMES das variáveis de ambiente registrados')

const todoTexto = (d) => { const r = sh('grep', ['-rl', '-e', SENHA_DO_BANCO, '-e', 'postgres://app:senha', '-e', SENHA2, d]); return r.stdout.trim() }
ok(todoTexto(capJ) === '', 'nenhum valor de segredo (senha do banco, URL, senha da cápsula) em NENHUM arquivo da cápsula aberta')
ok(!fs.readFileSync(path.join(capJ, 'segredos.tar.gpg')).includes(SENHA_DO_BANCO), 'o .env só existe cifrado')
const mdJ = fs.readFileSync(path.join(capJ, 'RESTAURAR.md'), 'utf8')
ok((mdJ.match(/^## \d\. /gm) || []).length === 9 && /projeto Compose "fe-teste"/.test(mdJ) && /banco Postgres: appdb/.test(mdJ) && /porta 5433/.test(mdJ) && !/[—–]/.test(mdJ), 'RESTAURAR.md: 9 seções, preenche banco, porta e servidor, sem travessão')

const logJ = falso.linhas()
const verbo = (l) => l.split(' ')[0]
ok(logJ.length > 10 && logJ.every((l) => ['ps', 'inspect', 'image', 'exec', 'run', 'save', 'version'].includes(verbo(l))), `só comandos permitidos em ${logJ.length} chamadas ao Docker`)
ok(!logJ.some((l) => /^(stop|restart|rm|kill|pull|compose|start|create|rmi|down|up|load|tag|cp|commit)\b/.test(l)), 'nenhum stop, restart, rm, kill, pull, compose, load')
const runs = logJ.filter((l) => verbo(l) === 'run')
ok(runs.length >= 4 && runs.every((l) => /(^| )--rm /.test(l) && l.includes('--network none') && /-v \S+:\/v:ro /.test(l)), `todos os ${runs.length} "run" são --rm, sem rede e com volume :ro`)
ok(!runs.some((l) => /-v \S+:\/v(?!:ro)/.test(l)), 'nenhum volume montado sem :ro')
const dumps = logJ.filter((l) => l.includes('pg_dump'))
ok(dumps.length === 2 && dumps.every((l) => /^exec a{64} pg_dump -Fc -U app (appdb|extra)$/.test(l)), `pg_dump no formato "exec <ctr> pg_dump -Fc -U <usuário> <banco>": ${dumps[0]}`)
ok(!logJ.some((l) => /NAO-VAZAR|PGPASSWORD|senha| -W| -h /.test(l.replace('DATABASE_URL', ''))), 'nenhuma senha, -h, -W ou PGPASSWORD em linha de comando alguma')
// o ps e o inspect do começo listam todos os contêineres (é como se descobre o dono da pasta); depois disso, só o projeto pedido
ok(!logJ.filter((l) => !/^(ps|inspect) /.test(l)).some((l) => /cliente-real|c{64}|postgres:15|3{64}/.test(l)), 'exec, run e save nunca tocam o contêiner, o volume e a imagem do OUTRO projeto')
ok(runs.find((l) => l.includes('--entrypoint tar')).includes('sha256:' + '1'.repeat(64)), 'o volume é lido com a imagem do próprio banco, que já existe aqui')
ok(logJ.filter((l) => verbo(l) === 'save').map((l) => l.split(' ')[1]).sort().join() === 'node:20,postgres:16', 'docker save só das duas imagens do projeto')
ok(Dk.executorPadrao.length === 0 && sh('tar', ['-tzf', path.join(capJ, 'projeto.tar.gz')]).stdout.split('\n').some((l) => l.endsWith('dados-locais/upload.txt')), 'a pasta ligada ao contêiner, que está dentro do projeto, vai no projeto.tar.gz')

console.log('(k) Docker: guarda de comandos, executor e código-fonte')
const ctxT = Dk.criarContexto(async () => ({ codigo: 0, saida: '' }))
ctxT.ok.conteineres.add('abc'); ctxT.ok.volumes.add('v1'); ctxT.ok.imagens.add('img')
const RO = ['--rm', '--network', 'none', '-v', 'v1:/v:ro', '--entrypoint', 'tar', 'img', 'czf', '-', '-C', '/v', '.']
const proibidos = [['stop', 'abc'], ['restart', 'abc'], ['rm', 'abc'], ['rm', '-f', 'abc'], ['kill', 'abc'], ['pull', 'postgres'], ['compose', 'down'], ['compose', 'up', '-d'], ['load', '-i', 'x'], ['exec', 'outro', 'pg_dump'], ['exec', 'abc', 'sh'], ['exec', 'abc', 'rm'],
  ['image', 'rm', 'x'], ['volume', 'rm', 'v1'], ['volume', 'create', 'x'], ['save', 'outra-imagem'],
  ['run', '--network', 'none', '-v', 'v1:/v:ro', '--entrypoint', 'tar', 'img'], ['run', '--rm', '-v', 'v1:/v:ro', '--entrypoint', 'tar', 'img'],
  ['run', '--rm', '--network', 'none', '-v', 'v1:/v', '--entrypoint', 'tar', 'img'], ['run', '--rm', '--network', 'none', '-v', 'outro:/v:ro', '--entrypoint', 'tar', 'img'],
  ['run', '--rm', '--network', 'none', '-v', 'v1:/v:ro', '--entrypoint', 'sh', 'img'], ['run', '--rm', '--network', 'none', '--privileged', '-v', 'v1:/v:ro', '--entrypoint', 'tar', 'img']]
const furou = proibidos.filter((a) => { try { Dk.guardar(ctxT, a); return true } catch { return false } })
ok(furou.length === 0, `a guarda recusa ${proibidos.length} comandos proibidos${furou.length ? ' (passaram: ' + furou.map((a) => a.join(' ')).join(' | ') + ')' : ''}`)
const permitidos = [['ps', '-a', '-q'], ['inspect', 'x'], ['image', 'inspect', 'x'], ['version'], ['exec', 'abc', 'pg_dump', '-Fc', '-U', 'app', 'db'], ['exec', 'abc', 'psql', '-U', 'app'], ['save', 'img'], ['run', ...RO]]
ok(permitidos.every((a) => { try { Dk.guardar(ctxT, a); return true } catch { return false } }), 'a guarda deixa passar o que é do projeto e de leitura')
const srcDk = fs.readFileSync(path.join(AQUI, 'src', 'capsulaDocker.mjs'), 'utf8')
ok(!/['"`](stop|restart|kill|pull|start|rmi|create|down|up|compose|rm)['"`]/.test(srcDk), 'o código do capsulaDocker.mjs não tem stop, restart, rm, kill, pull, compose nem up/down')
const antes = { c: process.env.CLAUDECODE, b: process.env.CC_DOCKER_BIN }
process.env.CLAUDECODE = '1'; delete process.env.CC_DOCKER_BIN
let eIA = null; try { Dk.executorPadrao() } catch (e) { eIA = e }
process.env.CC_DOCKER_BIN = antes.b
if (antes.c === undefined) delete process.env.CLAUDECODE; else process.env.CLAUDECODE = antes.c
ok(eIA && eIA.codigo === 'SESSAO_IA', 'o executor padrão se recusa a rodar o docker de verdade em sessão de IA')

console.log('(l) Docker: estimativa, disco e falhas')
const est = await C.ensaioCompleto(FD.raiz, { saida: SAIDA, livre: GRANDE, docker: { executar } })
ok(est.docker.volumes.length === 2 && est.docker.volumes[0].bytes === 2048 * 1024 && est.bytes_total > est.bytes + 1400 * 1024 ** 2 && est.cabe === true, `ensaio estima a parte Docker: total ${C.formatarBytes(est.bytes_total)} (pasta ${C.formatarBytes(est.bytes)})`)
const est2 = await C.ensaioCompleto(FD.raiz, { saida: SAIDA, livre: () => 3 * 1024 ** 3, docker: { executar } })
ok(est2.cabe === false && est2.sobra < C.MIN_SOBRA, 'com pouco disco o ensaio diz que não cabe, contando a parte Docker')
let eDisco = null
try { await C.fazer(FD.raiz, { senha: SENHA2, saida: path.join(T, 'saida-disco'), docker: { executar }, livre: () => 3 * 1024 ** 3 }) } catch (e) { eDisco = e }
ok(eDisco && eDisco.codigo === 'DISCO' && !fs.existsSync(path.join(T, 'saida-disco')), 'fazer recusa por disco contando o Docker, antes de gravar')

falso.arquivo('falha-volume.txt', 'fe-teste_uploads')
const rf1 = await C.fazer(FD.raiz, { senha: SENHA2, saida: SAIDA, docker: { executar }, livre: GRANDE })
falso.arquivo('falha-volume.txt', null)
const mf = rf1.manifesto.docker
ok(mf.falhas.length === 1 && mf.falhas[0].tipo === 'volume' && mf.volumes.length === 1 && rf1.prova.ok === false && /incompleta/.test(rf1.prova.motivo), 'volume que não copiou: fica registrado, a cápsula sai marcada como NÃO provada')
ok(/volume fe-teste_uploads/.test(fs.readFileSync(path.join(extrair(rf1.arquivo, path.join(T, 'capF')) && path.join(T, 'capF'), 'RESTAURAR.md'), 'utf8')), 'o RESTAURAR.md diz o que a coleta não conseguiu guardar')

falso.arquivo('dump-corrompido', 'x')
const rfDump = await C.fazer(FD.raiz, { senha: SENHA2, saida: SAIDA, docker: { executar }, livre: GRANDE })
falso.arquivo('dump-corrompido', null)
ok(rfDump.prova.ok === false && /pg_restore -l/.test(rfDump.prova.motivo), 'despejo que não abre no pg_restore -l reprova a prova')

if (process.getuid && process.getuid() !== 0) {
  const P3 = path.join(T, 'meus', 'com-root'); fs.mkdirSync(path.join(P3, 'trancada'), { recursive: true })
  fs.writeFileSync(path.join(P3, 'bom.txt'), 'ok'); fs.writeFileSync(path.join(P3, 'raiz.dat'), 'do root'); fs.writeFileSync(path.join(P3, 'trancada', 'x'), 'x')
  fs.chmodSync(path.join(P3, 'raiz.dat'), 0); fs.chmodSync(path.join(P3, 'trancada'), 0)
  const r3 = await C.fazer(P3, { saida: SAIDA, livre: GRANDE })
  fs.chmodSync(path.join(P3, 'trancada'), 0o755)
  const md3 = fs.readFileSync(path.join(extrair(r3.arquivo, path.join(T, 'cap3')) && path.join(T, 'cap3'), 'RESTAURAR.md'), 'utf8')
  ok(r3.prova.ok === true && r3.manifesto.nao_coletado_total === 2 && r3.manifesto.nao_coletado.every((x) => /precisa de root/.test(x.motivo)), 'arquivo e pasta ilegíveis: ficam de fora, vão para o manifesto como "precisa de root", e a prova passa')
  ok(/não coletado, precisa de root: 2/.test(md3) && /raiz\.dat/.test(md3) && /trancada/.test(md3), 'o RESTAURAR.md lista o que exige root')
} else console.log('  (rodando como root: o teste de arquivo ilegível foi pulado)')

console.log('(m) Docker: o projeto Compose pedido, e só ele')
const wdA = path.join(T, 'meus', 'dois'), wdA1 = path.join(wdA, 'p1'), wdA2 = path.join(wdA, 'p2')
fs.mkdirSync(wdA1, { recursive: true }); fs.mkdirSync(wdA2, { recursive: true })
const cA = (id, proj, wd, srv) => falso.ctr({ id: id.repeat(64), nome: `${proj}-${srv}`, img: 'sha256:' + '1'.repeat(64), ref: 'postgres:16', proj, wd, cf: path.join(wd, 'docker-compose.yml'), srv })
falso.cenario({ containers: [cA('d', 'p1', wdA1, 'a'), cA('e', 'p2', wdA2, 'a')], imagens: FD.imagens })
let eMulti = null
try { await Dk.descobrir(wdA, { executar }) } catch (e) { eMulti = e }
ok(eMulti && eMulti.codigo === 'COMPOSE' && /p1, p2/.test(eMulti.message), 'pasta com dois projetos Compose: recusa e diz quais')
const dP1 = await Dk.descobrir(wdA, { executar, projetoCompose: 'p1' })
ok(dP1.projeto === 'p1' && dP1.conteineres.length === 1 && dP1.conteineres[0].Id === 'd'.repeat(64), 'com o projeto pedido, só os contêineres dele')
let eNao = null
try { await Dk.descobrir(wdA, { executar, projetoCompose: 'nao-existe' }) } catch (e) { eNao = e }
ok(eNao && eNao.codigo === 'COMPOSE', 'projeto pedido que não mora na pasta: recusa')
const dNada = await Dk.descobrir(path.join(T, 'meus', 'sem-segredo'), { executar })
ok(dNada.projeto === null && /nenhum contêiner Compose/.test(dNada.motivo), 'pasta sem Compose: não acha projeto e diz o motivo')
const rSemDk = await C.fazer(path.join(T, 'meus', 'sem-segredo'), { saida: SAIDA, livre: GRANDE, docker: { executar } })
ok(rSemDk.prova.ok === true && rSemDk.manifesto.docker.projeto_compose === null, 'projeto sem Docker: cápsula normal, com o motivo no manifesto')
criarProjetoDocker(T, falso) // devolve o cenário de "fe-teste"

console.log('(n) restaurar.sh: parte Docker (com o Docker falso no PATH)')
const rodar = (args, { input = SENHA2 + '\n', env = {} } = {}) => sh('/bin/sh', [path.join(capJ, 'restaurar.sh'), ...args], { input, env: { ...process.env, ...falso.env(), ...env } })
const lido = () => falso.linhas()
// 1. ensaio: só lê
falso.zerarLog()
const DN1 = path.join(T, 'dk1')
const e1 = rodar(['--destino', DN1])
ok(e1.status === 0 && /ENSAIO/.test(e1.stdout) && /voltaria como "fe-teste-restaurado"/.test(e1.stdout) && !fs.existsSync(DN1), 'ensaio mostra o plano da parte Docker e não cria nada')
ok(lido().length > 0 && lido().every((l) => /^(volume inspect|ps )/.test(l)), `o ensaio só LÊ do Docker (${lido().length} consultas, todas inspect/ps)`)
// 2. aplicar com projeto novo
falso.zerarLog()
const DN2 = path.join(T, 'dk2')
const a2 = rodar(['--aplicar', '--destino', DN2, '--projeto-compose', 'novoprj'])
const L2 = lido()
ok(a2.status === 0, `--aplicar com projeto novo saiu 0 (${a2.status}) ${a2.status ? a2.stderr.slice(-200) : ''}`)
ok(L2.filter((l) => l.startsWith('load -i ')).length === 2, 'docker load das 2 imagens')
ok(L2.includes('volume create novoprj_dbdata') && L2.includes('volume create novoprj_uploads'), 'volumes recriados com o prefixo do projeto NOVO')
ok(!L2.some((l) => /fe-teste_/.test(l) && /create|-v /.test(l)) && !L2.some((l) => /-p fe-teste( |$)/.test(l)), 'nada com o prefixo do projeto original')
ok(L2.some((l) => l === 'run --rm -i --network none -v novoprj_dbdata:/v --entrypoint tar postgres:16 xzf - -C /v'), 'o tar do volume é despejado no volume novo')
ok(L2.some((l) => l === `compose -p novoprj --project-directory ${DN2} -f ${DN2}/docker-compose.yml up -d`), 'o compose sobe na pasta de destino, com o nome novo')
ok(L2.some((l) => l === 'exec -i cid-servico pg_restore --clean --if-exists --no-owner -U app -d appdb') && L2.some((l) => /pg_restore .* -d extra$/.test(l)), 'pg_restore em cada banco, sem senha na linha')
ok(!L2.some((l) => /^(stop|restart|rm|kill|pull)\b/.test(l)) && L2.filter((l) => l.startsWith('compose')).every((l) => l.includes('-p novoprj ')), 'nenhum stop, rm, kill, pull; todo compose é do projeto novo')
ok(fs.readFileSync(path.join(DN2, '.env'), 'utf8').includes(SENHA_DO_BANCO), 'o .env voltou com a senha da cápsula')
// 3. nome padrão
falso.zerarLog()
const a3 = rodar(['--aplicar', '--destino', path.join(T, 'dk3')])
ok(a3.status === 0 && lido().includes('volume create fe-teste-restaurado_dbdata') && lido().some((l) => l.startsWith('compose -p fe-teste-restaurado ')), 'sem --projeto-compose, o nome é "<original>-restaurado", nunca o original')
// 4. conflito de volume
falso.arquivo('volumes-existem.txt', 'novoprj4_dbdata\n')
falso.zerarLog()
const DN4 = path.join(T, 'dk4')
const a4 = rodar(['--aplicar', '--destino', DN4, '--projeto-compose', 'novoprj4'])
ok(a4.status === 7 && /RECUSADO/.test(a4.stderr) && !fs.existsSync(DN4) && !lido().some((l) => /^(volume create|load|compose|run)/.test(l)), 'volume de mesmo nome: recusa (saída 7) antes de mudar qualquer coisa')
falso.arquivo('volumes-existem.txt', null)
// 5. conflito de contêiner
falso.arquivo('ps-projeto.txt', 'abc123\n')
const DN5 = path.join(T, 'dk5')
const a5 = rodar(['--aplicar', '--destino', DN5, '--projeto-compose', 'novoprj5'])
ok(a5.status === 7 && !fs.existsSync(DN5), 'contêiner do projeto Compose de mesmo nome: recusa (saída 7)')
falso.arquivo('ps-projeto.txt', null)
// 6. --sobrescrever usa o nome original e não recria o que existe
falso.arquivo('volumes-existem.txt', 'fe-teste_dbdata\n')
falso.zerarLog()
const a6 = rodar(['--aplicar', '--destino', path.join(T, 'dk6'), '--sobrescrever'])
ok(a6.status === 0 && lido().some((l) => /-v fe-teste_dbdata:\/v /.test(l)) && !lido().includes('volume create fe-teste_dbdata') && lido().includes('volume create fe-teste_uploads') && lido().some((l) => l.startsWith('compose -p fe-teste ')), '--sobrescrever: nome original, restaura por cima do volume que existe e cria o que falta')
falso.arquivo('volumes-existem.txt', null)
// 7. --sem-docker
falso.zerarLog()
const a7 = rodar(['--aplicar', '--destino', path.join(T, 'dk7'), '--sem-docker'])
ok(a7.status === 0 && lido().length === 0 && fs.existsSync(path.join(T, 'dk7', 'index.js')), '--sem-docker restaura só a pasta e não chama o Docker')
// 8. sem o comando docker
const semDocker = path.join(T, 'bin-sem-docker'); fs.mkdirSync(semDocker)
for (const f of ['sh', 'tar', 'gzip', 'sed', 'grep', 'cut', 'head', 'ls', 'find', 'wc', 'mktemp', 'sha256sum', 'dirname', 'cat', 'rm', 'mkdir', 'sleep', 'tail', 'gpg', 'git', 'stty', 'openssl']) {
  const p = sh('sh', ['-c', `command -v ${f}`]).stdout.trim(); if (p) fs.symlinkSync(p, path.join(semDocker, f))
}
const a8 = sh('/bin/sh', [path.join(capJ, 'restaurar.sh'), '--aplicar', '--destino', path.join(T, 'dk8')], { input: SENHA2 + '\n', env: { PATH: semDocker, HOME: CASA, GNUPGHOME: process.env.GNUPGHOME } })
ok(a8.status === 5 && /docker/.test(a8.stderr) && !fs.existsSync(path.join(T, 'dk8')), 'sem o comando docker: recusa (saída 5) antes de restaurar, e diz como seguir')
const a8b = sh('/bin/sh', [path.join(capJ, 'restaurar.sh'), '--aplicar', '--destino', path.join(T, 'dk8b'), '--sem-docker'], { input: SENHA2 + '\n', env: { PATH: semDocker, HOME: CASA, GNUPGHOME: process.env.GNUPGHOME } })
ok(a8b.status === 0, `sem docker e com --sem-docker: restaura a pasta (${a8b.status})`)
// 9. nome de projeto inválido, soma, sintaxe
ok(rodar(['--aplicar', '--destino', path.join(T, 'dk9'), '--projeto-compose', 'Nome Errado']).status === 2, 'nome de projeto Compose inválido é recusado (saída 2)')
const capAd = path.join(T, 'capAd'); extrair(rj.arquivo, capAd)
const volAd = path.join(capAd, maniJ.docker.volumes[0].arquivo); const bv = fs.readFileSync(volAd); bv[bv.length - 2] ^= 0xff; fs.writeFileSync(volAd, bv)
const a9 = sh('/bin/sh', [path.join(capAd, 'restaurar.sh'), '--aplicar', '--destino', path.join(T, 'dk10')], { input: SENHA2 + '\n', env: { ...process.env, ...falso.env() } })
ok(a9.status === 3 && /SOMA DIFERENTE/.test(a9.stderr) && !fs.existsSync(path.join(T, 'dk10')), 'um byte trocado num volume: soma diferente, nada restaurado')
ok(sh('sh', ['-n', path.join(capJ, 'restaurar.sh')]).status === 0 && (!fs.existsSync('/usr/bin/dash') || sh('dash', ['-n', path.join(capJ, 'restaurar.sh')]).status === 0), 'sh -n e dash -n passam no restaurar.sh novo')
ok(!/[—–]/.test(C.RESTAURAR_SH) && !/[—–]/.test(srcDk), 'sem travessão no restaurar.sh nem no capsulaDocker.mjs')

// ============================================================================
// PASSO 3: a configuração de servidor. TUDO com nginx, PM2, crontab e unidades FALSOS (tools/capsula/servidor-falso.mjs).
// ============================================================================
console.log('(o) Servidor: descoberta (pasta do nginx falsa com 9 arquivos de blocos, de vários tipos)')
const { criarServidorFalso, criarBinariosFalsos, SEGREDOS } = await import('./tools/capsula/servidor-falso.mjs')
const Sv = await import('./src/capsulaServidor.mjs')
const SF = criarServidorFalso(T)
const acessos = []
const baseLeitor = Sv.leitorPadrao()
const espiao = { ler: (p2) => { acessos.push(p2); return baseLeitor.ler(p2) }, listar: (p2) => { acessos.push(p2); return baseLeitor.listar(p2) }, real: (p2) => { acessos.push(p2); return baseLeitor.real(p2) }, pode: (p2) => { acessos.push(p2); return baseLeitor.pode(p2) } }
const lei = { ...SF.readers, leitor: espiao }
const dA = Sv.descobrir(SF.alfa, lei)
const nomes = (d) => d.nginx.arquivos.map((f) => f.nome).sort().join()
ok(nomes(dA) === 'alfa,alfa-estatico', `alfa: liga só os dois arquivos que são dele (${nomes(dA)}); "outro", "solto" e os de gama/beta/zeta ficam de fora`)
const fAlfa = dA.nginx.arquivos.find((f) => f.nome === 'alfa')
ok(fAlfa.outros_atalhos.join() === 'alfa-antigo' && fAlfa.certeza === 'certo' && fAlfa.blocos.length === 2 && fAlfa.blocos.every((b) => b.certeza === 'certo'), 'atalho duplicado (alfa-antigo) vira um arquivo só; os dois blocos (443 e o desvio de http) são "certo"')
ok(fAlfa.blocos.some((b) => b.motivos.some((m) => /proxy_pass para a porta 8101.*\.env, variável PORT/.test(m.motivo))) && fAlfa.blocos.some((b) => b.motivos.some((m) => /mesmo server_name \(alfa\.exemplo\.com\)/.test(m.motivo))), 'o motivo de cada bloco está escrito: porta 8101 vinda do .env (só o nome PORT) e "mesmo server_name" do irmão')
ok(dA.nginx.arquivos.find((f) => f.nome === 'alfa-estatico').blocos[0].motivos.some((m) => m.certeza === 'certo' && /root \/var\/www\/alfa tem o nome da pasta/.test(m.motivo)), 'root em /var/www/<nome da pasta> liga como "certo"')
ok(dA.dominios.map((d) => d.dominio).join() === 'alfa.exemplo.com,estatico.alfa.exemplo.com' && dA.dominios[0].certificado === 'certbot' && dA.dominios[1].certificado === 'sem-ssl', 'domínios do alfa: os dois, com o tipo de certificado, e nenhum de outro projeto')
ok(fAlfa.certificados.length === 1 && fAlfa.certificados[0].dominio === 'alfa.exemplo.com' && fAlfa.dominios_certbot.join() === 'alfa.exemplo.com' && !!fAlfa.texto_sem_ssl, 'do certificado sai só o NOME do domínio (da linha ssl_certificate), e há a variante só-HTTP para servidor novo')
ok(!/ssl_certificate|443|options-ssl/.test(fAlfa.texto_sem_ssl) && /listen 80;/.test(fAlfa.texto_sem_ssl) && !/return 301/.test(fAlfa.texto_sem_ssl), 'a variante sem SSL não tem certificado, vira escuta 80 e descarta o desvio de http que sobraria duplicado')

const dB = Sv.descobrir(SF.beta, lei)
ok(nomes(dB) === 'beta' && dB.nginx.arquivos[0].certeza === 'certo' && /^upstream beta_up/.test(dB.nginx.arquivos[0].texto) && dB.nginx.arquivos[0].blocos[0].motivos.some((m) => /porta 8202/.test(m.motivo)), 'beta: proxy_pass para um upstream resolve a porta (8202) e leva o bloco upstream junto no texto')
ok(dB.nao_coletado.some((x) => /PM2 do root \(porta 8202\)/.test(x.caminho) && /precisa de root/.test(x.motivo)), 'porta que o nginx leva ao projeto e nenhum processo do usuário explica: registra "PM2 do root ... precisa de root"')

const dG = Sv.descobrir(SF.gama, lei)
ok(nomes(dG) === 'gama,gama-citado,gama-landing' && dG.nginx.arquivos.every((f) => f.certeza === 'candidato' && f.blocos.every((b) => b.certeza === 'candidato' && b.motivos.length && b.motivos.every((m) => m.certeza === 'candidato'))), 'gama: porta só no package.json, nome parecido e domínio só citado no README são TODOS "candidato", nunca certeza')
const mG = dG.nginx.arquivos.flatMap((f) => f.blocos.flatMap((b) => b.motivos.map((m) => m.motivo))).join(' | ')
ok(/scripts\.dev/.test(mG) && /nome parecido/.test(mG) && /aparece em README\.md/.test(mG), `cada candidato traz o motivo (${mG.length} caracteres de motivos)`)

const dZ0 = Sv.descobrir(SF.zeta, lei)
const dZ = Sv.descobrir(SF.zeta, { ...lei, portasDocker: [{ publica: 8303, servico: 'web' }] })
ok(dZ0.nginx.arquivos.length === 0 && nomes(dZ) === 'zeta' && dZ.nginx.arquivos[0].certeza === 'certo' && /Docker, serviço web/.test(dZ.nginx.arquivos[0].blocos[0].motivos[0].motivo), 'zeta: sem a porta do Docker não liga nada; com ela (descoberta do passo 2), liga como "certo"')

ok(dA.pm2.processos.length === 1 && dA.pm2.processos[0].nome === 'alfa-web' && dA.pm2.processos[0].variaveis.join() === 'API_TOKEN,DB_PASSWORD,PORT', 'PM2: só o processo cujo cwd está no projeto, com os NOMES das variáveis (sem PATH)')
ok(dA.unidades.unidades.map((u) => u.nome).join() === 'alfa.service,alfa.timer' && dA.cron.linhas.length === 2, 'unidades de usuário (serviço e timer) e linhas de cron que citam a pasta; as de outro dono ficam de fora')
const todoD = JSON.stringify([dA, dB, dG, dZ].map((d) => ({ r: Sv.resumir(d), t: d.nginx.arquivos.map((f) => [f.texto, f.texto_sem_ssl]), u: d.unidades.unidades.map((u) => u.texto), c: d.cron.linhas })))
const vazou = Object.entries(SEGREDOS).filter(([k, v]) => k !== 'externo' && k !== 'htpasswd' && todoD.includes(v)).map(([k]) => k)
ok(vazou.length === 0, `nenhum valor de variável de ambiente nem segredo em claro em nginx, PM2, unidade ou cron (${vazou.join(', ') || 'nada vazou'})`)
ok(/Authorization \*\*\*/.test(fAlfa.texto) && /API_KEY=\*\*\*/.test(dA.unidades.unidades[0].texto) && /PORT=8101/.test(dA.unidades.unidades[0].texto) && dA.cron.linhas.some((l) => /TOKEN=\*\*\*/.test(l)), 'o valor foi trocado por *** e o PORT (que não é segredo) ficou')
ok(acessos.some((x) => x.startsWith(SF.nginxDir)) && !acessos.some((x) => /letsencrypt|privkey|\.key$|\.pem$|\/private/i.test(x)), `o leitor tocou ${acessos.length} caminhos do nginx falso e NENHUM de /etc/letsencrypt, chave ou .pem`)
const barrou = ['/etc/letsencrypt/live/x/privkey.pem', '/etc/letsencrypt/options-ssl-nginx.conf', '/etc/ssl/private/x.key'].map((c) => { try { baseLeitor.ler(c); return false } catch (e) { return e.codigo === 'PROIBIDO' } })
let bl = false; try { baseLeitor.listar('/etc/letsencrypt') } catch (e) { bl = e.codigo === 'PROIBIDO' }
ok(barrou.every(Boolean) && bl, 'o leitor padrão RECUSA ler /etc/letsencrypt e chave privada, antes de chegar ao disco')
if (process.getuid && process.getuid() !== 0) {
  ok(dA.nao_coletado.some((x) => /htpasswd-trancado/.test(x.caminho) && /não coletado, precisa de root/.test(x.motivo)), 'arquivo de senha que o usuário não consegue ler: "não coletado, precisa de root"')
} else console.log('  (rodando como root: o teste do arquivo ilegível foi pulado)')
const dSem = Sv.descobrir(SF.alfa, { ...lei, nginxDir: path.join(T, 'nao-existe') })
ok(dSem.nginx.lido === false && /não tem nginx/.test(dSem.nginx.motivo) && dSem.nginx.arquivos.length === 0, 'servidor sem nginx: diz o motivo e segue')

console.log('(p) Servidor: dentro da cápsula')
const rS = await C.fazer(SF.alfa, { senha: SENHA2, saida: SAIDA, livre: GRANDE, servidor: SF.readers })
const capS = path.join(T, 'capS'); extrair(rS.arquivo, capS)
const maniS = JSON.parse(fs.readFileSync(path.join(capS, 'manifesto.json'), 'utf8'))
ok(rS.prova.ok === true, `cápsula com servidor feita e provada: ${rS.prova.motivo.slice(0, 120)}`)
const arqsS = Object.keys(maniS.sha256)
ok(['servidor/nginx/alfa.conf', 'servidor/nginx/alfa.sem-ssl.conf', 'servidor/nginx/alfa-estatico.conf', 'servidor/nginx/snippets/security.conf', 'servidor/pm2.json', 'servidor/systemd/alfa.service', 'servidor/systemd/alfa.timer', 'servidor/cron.txt', 'servidor/dominios.txt', 'servidor/plano.tsv'].every((a) => arqsS.includes(a)), 'as partes do servidor estão na cápsula e no manifesto com sha256')
ok(maniS.servidor.nginx.arquivos.length === 2 && maniS.servidor.dominios.length === 2 && maniS.servidor.pm2.processos.length === 1 && maniS.servidor.cron.linhas === 2 && maniS.formato === 4,'manifesto: blocos ligados com o motivo, domínios, PM2, cron')
const segTudo = ['senha-env-alfa-nao-pode', SEGREDOS.nginx, SEGREDOS.pm2, SEGREDOS.unidade, SEGREDOS.cron, SEGREDOS.htpasswd, SEGREDOS.externo]
const achou = segTudo.filter((v) => sh('grep', ['-rl', '--binary-files=text', '-e', v, capS]).stdout.trim())
ok(achou.length === 0, `nenhum segredo em claro em NENHUM arquivo da cápsula aberta (${achou.join(', ') || 'limpo'}); controle: o grep acha o domínio ${sh('grep', ['-rl', 'alfa.exemplo.com', capS]).stdout.trim().split('\n').length} vez(es)`)
ok(maniS.segredos.externos.length === 2 && maniS.segredos.externos.every((x) => /^_servidor\//.test(x.membro)) && maniS.segredos.externos.some((x) => /htpasswd-alfa/.test(x.caminho_original)) && maniS.segredos.externos.some((x) => /ext\.env/.test(x.caminho_original)), 'o htpasswd e o EnvironmentFile (legíveis) foram para os segredos cifrados, em _servidor/')
ok(!fs.existsSync(path.join(rS.manifesto.caminho_origem, '..', '.ext')) && !fs.readdirSync(SAIDA).some((n) => n.startsWith('.fazendo-')), 'o rascunho em claro dos segredos não sobrou no disco')
const mdS = fs.readFileSync(path.join(capS, 'RESTAURAR.md'), 'utf8')
ok((mdS.match(/^## \d\. /gm) || []).length === 9 && /alfa\.exemplo\.com/.test(mdS) && /sudo certbot --nginx -d alfa\.exemplo\.com/.test(mdS) && /sudo nginx -t/.test(mdS) && /DNS no registrador/.test(mdS) && /PM2: processo alfa-web/.test(mdS) && /\/var\/www\/alfa/.test(mdS), 'RESTAURAR.md: 9 seções, com blocos, domínios, DNS, comandos de root e o que fica fora (/var/www)')
ok(!/[—–]/.test(mdS) && !segTudo.some((v) => mdS.includes(v)), 'o RESTAURAR.md não tem travessão nem segredo')
if (process.getuid && process.getuid() !== 0) ok(/não coletado, precisa de root/.test(mdS) && /htpasswd-trancado/.test(mdS) && maniS.nao_coletado.some((x) => /htpasswd-trancado/.test(x.caminho)), 'o que o usuário não lê aparece como "não coletado, precisa de root" no manifesto e no RESTAURAR.md')
const eS = await C.ensaioCompleto(SF.alfa, { saida: SAIDA, livre: GRANDE, servidor: SF.readers })
ok(eS.servidor.nginx.arquivos.length === 2 && eS.servidor.dominios.length === 2 && eS.servidor.nginx.arquivos.every((f) => f.blocos.every((b) => b.motivos.length)), 'o ensaio mostra os blocos achados (com motivo) e os domínios ANTES de fazer')
let eSenha = null
try { await C.fazer(SF.alfa, { senha: null, saida: path.join(T, 'saida-s'), livre: GRANDE, servidor: SF.readers }) } catch (e) { eSenha = e }
ok(eSenha && eSenha.codigo === 'SENHA', 'sem senha, recusa (o projeto tem .env e o servidor aponta segredos)')
const rFD = await C.fazer(FD.raiz, { senha: SENHA2, saida: SAIDA, docker: { executar }, livre: GRANDE, servidor: { ...SF.readers, pm2: () => ({ ok: true, lista: [] }), crontab: () => ({ ok: true, texto: '' }) } })
ok(rFD.prova.ok === true && rFD.manifesto.servidor.nginx.arquivos.map((f) => f.arquivo).join() === 'fe-teste' && /Docker, serviço web/.test(rFD.manifesto.servidor.nginx.arquivos[0].blocos[0].motivos[0].motivo), 'com o Docker falso do passo 2: a porta 3055 que o Docker publica liga o bloco certo')

console.log('(q) restaurar.sh: parte servidor (binários falsos; PATH é só a pasta falsa)')
const fb = criarBinariosFalsos(T)
const novoND = (nome) => { const d = path.join(T, 'destino-nginx', nome); fs.mkdirSync(path.join(d, 'sites-available'), { recursive: true }); fs.mkdirSync(path.join(d, 'sites-enabled'), { recursive: true }); return d }
const rodarS = (cap, args, { nd, uid = 1000, input = SENHA2 + '\n', extra = {} } = {}) => sh('/bin/sh', [path.join(cap, 'restaurar.sh'), ...args], { input, env: { ...fb.env(nd, uid, extra), HOME: CASA, GNUPGHOME: process.env.GNUPGHOME } })
const ls = (d) => fs.readdirSync(d).sort().join()
// a. sem root: só imprime
{
  const nd = novoND('a'); const D = path.join(T, 'dsrv-a')
  fb.zerar()
  const x = rodarS(capS, ['--aplicar', '--destino', D, '--nginx-dir', nd], { nd, uid: 1000 })
  ok(x.status === 0 && /Você não é root: NADA do servidor foi tentado/.test(x.stdout), `sem root: saiu 0 e avisou que nada foi tentado (${x.status})`)
  ok(/sudo (cp|tee) .*sites-available\/alfa/.test(x.stdout) && /sudo ln -s .*sites-enabled\/alfa/.test(x.stdout) && /sudo nginx -t && sudo nginx -s reload/.test(x.stdout) && /sudo certbot --nginx -d alfa\.exemplo\.com/.test(x.stdout) && /pm2 start '.*server\.js' --name 'alfa-web'/.test(x.stdout) && /crontab -l/.test(x.stdout) && /DNS destes domínios precisa apontar/.test(x.stdout), 'sem root: imprime, prontos para colar, o cp/ln com sudo, o nginx -t, o certbot com o DNS, o pm2 start e o cron')
  ok(ls(path.join(nd, 'sites-available')) === '' && ls(path.join(nd, 'sites-enabled')) === '' && fb.linhas().length === 0, 'sem root: a pasta do nginx ficou vazia e NENHUM nginx, certbot, pm2, crontab ou systemctl foi chamado')
  ok(fs.existsSync(path.join(D, 'server.js')), 'sem root: a pasta do projeto foi restaurada mesmo assim')
}
// b. ensaio
{
  const nd = novoND('b'); fb.zerar()
  const x = rodarS(capS, ['--destino', path.join(T, 'dsrv-b'), '--nginx-dir', nd], { nd, uid: 0 })
  ok(x.status === 0 && /ENSAIO/.test(x.stdout) && /instalaria o bloco alfa \(certo\)/.test(x.stdout) && /como root: instalaria, testaria com nginx -t/.test(x.stdout) && fb.linhas().length === 0 && ls(path.join(nd, 'sites-available')) === '', 'ensaio (mesmo como root): só mostra o que faria, não chama nada')
}
// c. root simulado, servidor novo sem certificado: o nginx -t falha com SSL e passa com a variante só-HTTP
{
  const nd = novoND('c'); const D = path.join(T, 'dsrv-c'); const casaC = path.join(T, 'casa-c'); fs.mkdirSync(casaC)
  fb.zerar(); fb.arquivo('nginx-t-exige-sem-ssl', '1')
  const x = sh('/bin/sh', [path.join(capS, 'restaurar.sh'), '--aplicar', '--destino', D, '--nginx-dir', nd], { input: SENHA2 + '\n', env: { ...fb.env(nd, 0), HOME: casaC, GNUPGHOME: process.env.GNUPGHOME } })
  fb.arquivo('nginx-t-exige-sem-ssl', null)
  const L = fb.linhas()
  ok(x.status === 0, `root simulado, servidor novo: saiu 0 (${x.status}) ${x.status ? x.stderr.slice(-300) : ''}`)
  ok(ls(path.join(nd, 'sites-available')) === 'alfa,alfa-estatico' && ls(path.join(nd, 'sites-enabled')) === 'alfa,alfa-estatico' && fs.lstatSync(path.join(nd, 'sites-enabled', 'alfa')).isSymbolicLink(), 'cada bloco foi para sites-available com atalho em sites-enabled')
  const inst = fs.readFileSync(path.join(nd, 'sites-available', 'alfa'), 'utf8')
  ok(!/ssl_certificate/.test(inst) && /listen 80;/.test(inst), 'o nginx -t falhou com o certificado original, então ficou a variante só-HTTP')
  ok(L.filter((l) => l === 'nginx -t').length === 2 && L.includes('nginx -s reload') && L.indexOf('nginx -s reload') > L.lastIndexOf('nginx -t'), 'rodou nginx -t duas vezes e só recarregou DEPOIS do que passou')
  ok(L.includes('certbot --nginx -d alfa.exemplo.com') && /DNS destes domínios precisa apontar/.test(x.stdout), 'reemitiu o certificado com o certbot e avisou do DNS')
  ok(fs.existsSync(path.join(nd, 'snippets', 'security.conf')), 'o snippet que o bloco inclui foi instalado (não existia)')
  ok(fs.readFileSync(path.join(nd, '.htpasswd-alfa'), 'utf8').includes(SEGREDOS.htpasswd) && !fs.existsSync(path.join(nd, '.htpasswd-trancado')) && (fs.statSync(path.join(nd, '.htpasswd-alfa')).mode & 0o777) === 0o640, 'o htpasswd voltou do segredo cifrado, para a pasta do nginx NOVA, com modo 640; o que era "precisa de root" não foi inventado')
  ok(L.some((l) => l === `pm2 start ${D}/server.js --name alfa-web --cwd ${D} --interpreter node -- --port 8101`) && L.includes('pm2 save'), 'pm2 start com o caminho trocado para o destino, e pm2 save')
  const un = path.join(casaC, '.config', 'systemd', 'user')
  ok(ls(un) === 'alfa.service,alfa.timer' && fs.readFileSync(path.join(un, 'alfa.service'), 'utf8').includes(`WorkingDirectory=${D}`) && /API_KEY=\*\*\*/.test(fs.readFileSync(path.join(un, 'alfa.service'), 'utf8')) && L.includes('systemctl --user daemon-reload') && !L.some((l) => /enable|start/.test(l) && l.startsWith('systemctl')), 'unidades instaladas com o caminho novo, daemon-reload, e NÃO ligadas sozinhas')
  const cron = fs.readFileSync(path.join(fb.dados, 'crontab'), 'utf8')
  ok(cron.includes(`0 3 * * * cd ${D} && ./backup.sh`) && /TOKEN=\*\*\*/.test(cron), 'as linhas de cron foram acrescentadas com o caminho novo')
  // rodar de novo: nada duplica
  fs.rmSync(D, { recursive: true, force: true }); fb.zerar()
  const y = sh('/bin/sh', [path.join(capS, 'restaurar.sh'), '--aplicar', '--destino', D, '--nginx-dir', nd, '--sobrescrever'], { input: SENHA2 + '\n', env: { ...fb.env(nd, 0), HOME: casaC, GNUPGHOME: process.env.GNUPGHOME } })
  ok(y.status === 0 && /cron: as linhas já existiam/.test(y.stdout) && /pm2: alfa-web já existe/.test(y.stdout) === false, `segunda rodada com --sobrescrever: o cron não duplica (${y.status})`)
}
// d. root simulado, o nginx -t passa com o certificado original: sem variante, sem certbot
{
  const nd = novoND('d'); fb.zerar()
  const x = rodarS(capS, ['--aplicar', '--destino', path.join(T, 'dsrv-d'), '--nginx-dir', nd, '--sem-docker'], { nd, uid: 0, extra: { HOME: path.join(T, 'casa-d') } })
  ok(x.status === 0 && /ssl_certificate/.test(fs.readFileSync(path.join(nd, 'sites-available', 'alfa'), 'utf8')) && !fb.linhas().some((l) => l.startsWith('certbot')) && /o certbot não foi preciso/.test(x.stdout), 'nginx -t passou com o certificado original: fica o bloco original e o certbot não é chamado')
}
// e. nginx -t FALHA: a instalação é desfeita
{
  const nd = novoND('e'); fb.zerar(); fb.arquivo('nginx-t-falha', '1')
  fs.writeFileSync(path.join(nd, 'sites-available', 'vizinho'), 'server { listen 81; }\n')
  const x = rodarS(capS, ['--aplicar', '--destino', path.join(T, 'dsrv-e'), '--nginx-dir', nd], { nd, uid: 0, extra: { HOME: path.join(T, 'casa-e') } })
  const L = fb.linhas()
  ok(x.status === 11 && /DESFEITA/.test(x.stderr) && /erro de teste do nginx falso/.test(x.stderr), `nginx -t falso que falha: saiu 11, disse que desfez e por quê (${x.status})`)
  ok(ls(path.join(nd, 'sites-available')) === 'vizinho' && ls(path.join(nd, 'sites-enabled')) === '' && !fs.existsSync(path.join(nd, 'snippets')) && !fs.existsSync(path.join(nd, '.htpasswd-alfa')), 'desfeito: sobrou só o que já existia; blocos, atalhos, snippet (e a pasta dele) e htpasswd instalados saíram')
  ok(!L.includes('nginx -s reload') && !L.some((l) => l.startsWith('certbot')), 'não recarregou o nginx nem chamou o certbot depois da falha')
  // com --sobrescrever, o bloco antigo volta
  fs.writeFileSync(path.join(nd, 'sites-available', 'alfa'), 'ORIGINAL ANTIGO\n'); fs.symlinkSync(path.join(nd, 'sites-available', 'alfa'), path.join(nd, 'sites-enabled', 'alfa'))
  const y = rodarS(capS, ['--aplicar', '--destino', path.join(T, 'dsrv-e2'), '--nginx-dir', nd, '--sobrescrever'], { nd, uid: 0, extra: { HOME: path.join(T, 'casa-e') } })
  ok(y.status === 11 && fs.readFileSync(path.join(nd, 'sites-available', 'alfa'), 'utf8') === 'ORIGINAL ANTIGO\n' && fs.lstatSync(path.join(nd, 'sites-enabled', 'alfa')).isSymbolicLink(), 'com --sobrescrever e nginx -t falhando, o bloco que existia ANTES volta inteiro')
  fb.arquivo('nginx-t-falha', null)
}
// f. bloco existente é recusado sem --sobrescrever
{
  const nd = novoND('f'); fb.zerar()
  fs.writeFileSync(path.join(nd, 'sites-available', 'alfa'), 'MEU BLOCO\n')
  const D = path.join(T, 'dsrv-f')
  const x = rodarS(capS, ['--aplicar', '--destino', D, '--nginx-dir', nd], { nd, uid: 0 })
  ok(x.status === 9 && /RECUSADO: já existe no nginx/.test(x.stderr) && fs.readFileSync(path.join(nd, 'sites-available', 'alfa'), 'utf8') === 'MEU BLOCO\n' && !fs.existsSync(D) && fb.linhas().length === 0, 'bloco com o mesmo nome: recusado (saída 9) antes de mudar qualquer coisa, sem restaurar a pasta e sem chamar o nginx')
  const e = rodarS(capS, ['--destino', D, '--nginx-dir', nd], { nd, uid: 0 })
  ok(/RECUSARIA \(como root\), já existe: sites-available\/alfa/.test(e.stdout), 'o ensaio já avisa que recusaria')
}
// g. candidatos
{
  const rG = await C.fazer(SF.gama, { saida: SAIDA, livre: GRANDE, servidor: SF.readers })
  const capG2 = path.join(T, 'capG2'); extrair(rG.arquivo, capG2)
  ok(rG.prova.ok === true && rG.manifesto.servidor.nginx.arquivos.length === 3 && rG.manifesto.servidor.nginx.arquivos.every((f) => f.certeza === 'candidato'), 'cápsula do gama (sem segredo, sem senha): 3 arquivos, todos candidatos')
  const nd = novoND('g'); fb.zerar()
  const x = rodarS(capG2, ['--aplicar', '--destino', path.join(T, 'dsrv-g'), '--nginx-dir', nd], { nd, uid: 0, input: '' })
  ok(x.status === 0 && ls(path.join(nd, 'sites-available')) === '' && /candidato NÃO instalado: gama/.test(x.stdout), 'candidato NÃO é instalado por padrão')
  const nd2 = novoND('g2')
  const y = rodarS(capG2, ['--aplicar', '--destino', path.join(T, 'dsrv-g2'), '--nginx-dir', nd2, '--incluir-candidatos'], { nd: nd2, uid: 0, input: '' })
  ok(y.status === 0 && ls(path.join(nd2, 'sites-available')) === 'gama,gama-citado,gama-landing', 'com --incluir-candidatos, entram')
  const nd3 = novoND('g3')
  const z = rodarS(capG2, ['--aplicar', '--destino', path.join(T, 'dsrv-g3'), '--nginx-dir', nd3], { nd: nd3, uid: 1000, input: '' })
  ok(/# candidato, NÃO incluído/.test(z.stdout) && !/sudo cp .*gama/.test(z.stdout), 'sem root, o candidato sai só como comentário, nunca como comando')
}
// h. sintaxe e --sem-servidor
ok(sh('sh', ['-n', path.join(capS, 'restaurar.sh')]).status === 0 && (!fs.existsSync('/usr/bin/dash') || sh('dash', ['-n', path.join(capS, 'restaurar.sh')]).status === 0), 'sh -n e dash -n passam no restaurar.sh com a parte servidor')
{
  const nd = novoND('h'); fb.zerar()
  const x = rodarS(capS, ['--aplicar', '--destino', path.join(T, 'dsrv-h'), '--nginx-dir', nd, '--sem-servidor'], { nd, uid: 0 })
  ok(x.status === 0 && fb.linhas().length === 0 && ls(path.join(nd, 'sites-available')) === '' && /pulado \(--sem-servidor\)/.test(x.stdout), '--sem-servidor pula tudo, mesmo como root')
}
const srcSv = fs.readFileSync(path.join(AQUI, 'src', 'capsulaServidor.mjs'), 'utf8')
ok(!/[—–]/.test(srcSv) && !/[—–]/.test(C.RESTAURAR_SH) && !/spawnSync\('(nginx|certbot|systemctl|docker)'/.test(srcSv) && !/['"`](reload|restart|start|stop|delete)['"`]/.test(srcSv), 'sem travessão; o código do servidor não chama nginx, certbot, systemctl, nem pm2 start/stop/restart/delete')

// ============================================================================
// LACUNA DO SITE PUBLICADO: as pastas que o nginx serve de fora do projeto (publicado/) e as que os contêineres montam (montagens/).
// Só pastas FALSAS na casa temporária e Docker FALSO. Nada de /var/www, /opt nem docker de verdade.
// ============================================================================
console.log('(r) Publicado: descoberta das pastas root/alias de fora do projeto')
const Pa = await import('./src/capsulaPastas.mjs')
const { CHAVE_MONTADA } = await import('./tools/capsula/docker-falso.mjs')
const naoRoot = !(process.getuid && process.getuid() === 0)
const rel = (c) => c.replace(SF.www, '')
const dD = Sv.descobrir(SF.delta, lei)
const pubD = Object.fromEntries(dD.publicado.map((p) => [rel(p.caminho), p.certeza]))
ok(JSON.stringify(pubD) === JSON.stringify({ '/delta-midia': 'certo', '/delta-promo': 'candidato', '/delta-publico': 'certo', '/delta-trancado': 'certo' }), `delta: root e alias de fora do projeto, certos e candidata separados (${JSON.stringify(pubD)})`)
ok(dD.publicado.find((p) => p.caminho.endsWith('delta-publico')).origens.some((o) => /nginx delta, delta\.exemplo\.com \(root\)/.test(o)) && dD.publicado.find((p) => p.caminho.endsWith('delta-midia')).origens.some((o) => /\(alias\)/.test(o)), 'cada pasta diz de onde veio: o bloco, o domínio e se é root ou alias')
if (naoRoot) ok(dD.publicado.find((p) => p.caminho.endsWith('delta-trancado')).av.situacao === 'precisa-root' && dD.publicado.find((p) => p.caminho.endsWith('delta-trancado')).av.legivel === false, 'pasta que o usuário não lê: situação "precisa-root", sem ler')
else console.log('  (rodando como root: o teste da pasta ilegível foi pulado)')

console.log('(s) Ruído: domínio citado em 3 ou mais projetos não vira candidato por citação')
const nomesD = dD.nginx.arquivos.map((f) => f.nome).sort().join()
ok(nomesD === 'delta,delta-promo,dois', `delta: comum.exemplo.com (citado em delta, eps1 e eps2) NÃO vira candidato; dois.exemplo.com (2 projetos) e promo.delta (1) ainda viram (${nomesD})`)
ok(dD.ruido.length === 1 && dD.ruido[0].dominio === 'comum.exemplo.com' && dD.ruido[0].projetos === 3, 'o domínio ignorado por ruído fica registrado com a contagem de projetos')
const dSemRuido = Sv.descobrir(SF.delta, { ...lei, outros: null })
ok(dSemRuido.nginx.arquivos.some((f) => f.nome === 'comum' && f.certeza === 'candidato') && dSemRuido.ruido.length === 0, 'controle: sem a contagem de outros projetos o mesmo domínio VIRA candidato (a regra é que o corta)')
const dMuito = Sv.descobrir(SF.delta, { ...lei, outros: () => 9 })
ok(dMuito.nginx.arquivos.find((f) => f.nome === 'delta').certeza === 'certo' && !dMuito.nginx.arquivos.some((f) => f.nome === 'dois'), 'domínio muito citado ainda liga como CERTO por porta (delta.exemplo.com), só deixa de ser candidato por citação')

console.log('(t) Pastas: sistema, chave e pasta ampla ficam de fora')
const ap = path.join(T, 'projs', 'VPS_delta')
const av = (c) => Pa.avaliar(c, { raizes: [ap] }).situacao
ok(['/var/run/docker.sock', '/etc/localtime', '/etc/timezone', '/proc/1', '/sys/fs/cgroup', '/dev/shm', '/etc/letsencrypt/live/x', '/run/x.sock'].every((c) => av(c) === 'sistema'), 'docker.sock, /etc/localtime, /etc/timezone, /proc, /sys, /dev e /etc/letsencrypt são de sistema')
ok(['/', '/var/www', '/opt', '/home', path.dirname(ap), path.dirname(path.dirname(ap))].every((c) => av(c) === 'ampla'), 'pasta ampla (/var/www, /opt, a pasta que CONTÉM o projeto) não é coletada')
ok(av('/srv/x/privkey.pem') === 'excluida' && av('/srv/x/id_rsa') === 'excluida', 'chave privada isolada é excluída')
{
  const envSolto = path.join(T, 'env-solto', '.env'); fs.mkdirSync(path.dirname(envSolto), { recursive: true }); fs.writeFileSync(envSolto, 'Z=1\n')
  ok(av(envSolto) === 'segredo' && av(envSolto + '.local') === 'nao-existe', '.env isolado que existe vira "segredo" (vai cifrado, não em tar)')
}

const f = (caminho, bytes, situacao = 'ok') => ({ caminho, certeza: 'certo', av: { situacao, bytes } })
ok(Pa.bytesDe([f('/x/a', 10), f('/x/a/icons', 3), f('/x/b', 5), f('/x/c', 99, 'precisa-root')]) === 15, 'o tamanho não conta pasta dentro de pasta duas vezes, nem a que não será guardada')

console.log('(u) Publicado: dentro da cápsula')
const ensD = await C.ensaioCompleto(SF.delta, { saida: SAIDA, livre: GRANDE, servidor: lei })
ok(ensD.bytes_publicado > 0 && ensD.bytes_publicado_candidatas > 0 && ensD.bytes_total === ensD.bytes + ensD.bytes_publicado && ensD.servidor.publicado_achado.length === 4, `ensaio: tamanho das pastas publicadas (${ensD.bytes_publicado} B certas, ${ensD.bytes_publicado_candidatas} B candidatas, separadas) entra no total`)
const ensDc = await C.ensaioCompleto(SF.delta, { saida: SAIDA, livre: GRANDE, servidor: lei, incluirCandidatos: true })
ok(ensDc.bytes_total === ensD.bytes_total + ensD.bytes_publicado_candidatas, 'marcando os candidatos, o total sobe exatamente o tamanho da pasta deles')
const tD = ensD.bytes + ensD.bytes_publicado
ok((await C.ensaioCompleto(SF.delta, { saida: SAIDA, livre: () => 3 * tD + C.MIN_SOBRA, servidor: lei })).cabe === true && (await C.ensaioCompleto(SF.delta, { saida: SAIDA, livre: () => 3 * tD + C.MIN_SOBRA - 1, servidor: lei })).cabe === false, 'o ensaio recusa com 1 byte abaixo dos 2 GB de folga, CONTANDO o publicado')
ok((await C.ensaioCompleto(SF.delta, { saida: SAIDA, livre: () => 3 * ensD.bytes + C.MIN_SOBRA, servidor: lei })).cabe === false, 'sem contar o publicado caberia: contando, não (o tamanho dele pesa)')
let eDiscoP = null
try { await C.fazer(SF.delta, { senha: SENHA2, saida: path.join(T, 'saida-disco-p'), livre: () => 3 * tD + C.MIN_SOBRA - 1, servidor: lei }) } catch (e) { eDiscoP = e }
ok(eDiscoP && eDiscoP.codigo === 'DISCO' && !fs.existsSync(path.join(T, 'saida-disco-p')), 'fazer recusa por disco contando o publicado, antes de gravar')

const rP = await C.fazer(SF.delta, { senha: SENHA2, saida: SAIDA, livre: GRANDE, servidor: lei })
const capP = path.join(T, 'capP'); extrair(rP.arquivo, capP)
const maniP = JSON.parse(fs.readFileSync(path.join(capP, 'manifesto.json'), 'utf8'))
ok(rP.prova.ok === true && /pastas de fora do projeto: 2 publicada\(s\)/.test(rP.prova.motivo), `cápsula do delta feita e PROVADA: ${rP.prova.motivo.slice(0, 200)}`)
const entP = Object.fromEntries(maniP.publicado.map((x) => [rel(x.caminho), x]))
ok(maniP.formato === 4 && entP['/delta-publico'].estado === 'coletada' && entP['/delta-midia'].estado === 'coletada' && entP['/delta-promo'].estado === 'candidata-nao-incluida', 'manifesto: root e alias de fora coletados; a pasta do candidato NÃO entra sem a opção')
ok(!fs.readdirSync(path.join(capP, 'publicado')).some((n) => /delta-promo/.test(n)) && fs.readdirSync(path.join(capP, 'publicado')).length === 2, 'candidato sem a opção: nenhuma parte em publicado/ para ele')
const parteP = entP['/delta-publico']
ok(/^publicado\/[A-Za-z0-9_-]+delta-publico\.tar\.gz$/.test(parteP.parte) && parteP.caminho === path.join(SF.www, 'delta-publico') && parteP.bytes_origem > 0 && /^[0-9a-f]{64}$/.test(parteP.sha256), `parte "${parteP.parte}", com caminho original, tamanho e sha256 no manifesto`)
ok(parteP.sha256 === maniP.sha256[parteP.parte] && sh('sha256sum', [path.join(capP, parteP.parte)]).stdout.split(' ')[0] === parteP.sha256, 'o sha256 do manifesto é o do arquivo de verdade')
const listaP = sh('tar', ['-tzf', path.join(capP, parteP.parte)]).stdout.split('\n')
ok(['./index.html', './css/site.css', './uploads/foto.txt'].every((f) => listaP.includes(f)), 'o tar da pasta publicada tem o site (index, css, uploads)')
ok(!listaP.some((l) => /\.env|privkey|id_rsa/.test(l)) && ['certs/privkey.pem', 'id_rsa'].every((x) => parteP.excluidos.includes(x)) && !parteP.excluidos.includes('.env') && parteP.segredos.join() === '.env', 'chave privada e id_rsa de dentro da pasta ficam de fora para sempre; o .env também sai do tar, mas o manifesto diz que ele foi para os segredos cifrados')
const abertoP = path.join(T, 'abertoP'); fs.mkdirSync(abertoP)
for (const x of maniP.publicado.filter((y) => y.estado === 'coletada')) { const d = path.join(abertoP, path.basename(x.parte)); fs.mkdirSync(d); sh('tar', ['-xzpf', path.join(capP, x.parte), '-C', d]) }
ok(['CHAVE-PRIVADA-PEM-NAO-VAZAR-555', 'env-dentro-do-publicado-NAO-VAZAR', 'ID-RSA-NAO-VAZAR-777'].every((v) => !sh('grep', ['-rl', '--binary-files=text', '-e', v, abertoP, capP]).stdout.trim()), 'nenhuma chave nem segredo de dentro das pastas publicadas em NENHUM arquivo da cápsula')
if (naoRoot) {
  ok(!listaP.some((l) => /trancado\.dat/.test(l)), 'o arquivo ilegível de dentro da pasta ficou de fora do tar')
  ok(entP['/delta-trancado'].estado === 'nao-coletada' && /precisa de root/.test(entP['/delta-trancado'].motivo) && maniP.nao_coletado.some((x) => /delta-trancado/.test(x.caminho) && /não coletado, precisa de root/.test(x.motivo)), 'pasta que o usuário não lê: "não coletado, precisa de root" no manifesto, e a cápsula segue')
  ok(maniP.nao_coletado.some((x) => /delta-publico.*1 item\(ns\) ilegíveis.*trancado\.dat/.test(x.caminho)), 'arquivo ilegível DENTRO de uma pasta coletada também vira "precisa de root"')
}
const mdP = fs.readFileSync(path.join(capP, 'RESTAURAR.md'), 'utf8')
ok((mdP.match(/^## \d\. /gm) || []).length === 9 && !/[—–]/.test(mdP) && mdP.includes(parteP.caminho) && mdP.includes(parteP.sha256) && /CANDIDATA e NÃO incluída: .*delta-promo/.test(mdP), 'RESTAURAR.md seção 2: cada pasta com caminho, tamanho e sha256; a candidata aparece como NÃO incluída')
ok(new RegExp(`ls -A ${parteP.caminho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(mdP) && /servido por delta\.exemplo\.com/.test(mdP) && /fora da pasta do projeto: .*delta-publico \(guardada em publicado\//.test(mdP), 'seções 8 e 2: como saber que voltou (o caminho publicado e o domínio) e o nginx diz que a pasta foi guardada')
const mdRoot = C.gerarRestaurar(JSON.parse(JSON.stringify(maniP).split(SF.www).join('/var/www/zz')))
ok(/sudo mkdir -p \/var\/www\/zz\/delta-publico && sudo tar -xzpf publicado\/\S+delta-publico\.tar\.gz -C \/var\/www\/zz\/delta-publico/.test(mdRoot) && /## 7\. O que exige root[\s\S]*Recolocar \/var\/www\/zz\/delta-publico/.test(mdRoot), 'RESTAURAR.md seção 7: /var/www exige root, com o comando sudo exato')

console.log('(v) Publicado: candidatos só com a opção, e a prova confere as partes novas')
const rPc = await C.fazer(SF.delta, { senha: SENHA2, saida: SAIDA, livre: GRANDE, servidor: lei, incluirCandidatos: true })
const maniPc = rPc.manifesto
ok(rPc.prova.ok === true && maniPc.incluiu_candidatos === true && maniPc.publicado.find((x) => /delta-promo/.test(x.caminho)).estado === 'coletada' && /3 publicada\(s\)/.test(rPc.prova.motivo), 'com incluirCandidatos a pasta do candidato entra (3 publicadas) e a prova passa')
const adulterar = (cap, quando) => {
  const d = path.join(T, 'adult-' + quando); extrair(cap, d)
  return d
}
{
  const d = adulterar(rP.arquivo, 'soma')
  const f = path.join(d, parteP.parte); const b = fs.readFileSync(f); b[Math.floor(b.length / 2)] ^= 0xff; fs.writeFileSync(f, b)
  const novo = path.join(T, 'adulterada-soma.capsula.tar.gz'); sh('tar', ['-czf', novo, '-C', d, '.'])
  const pr = C.provar(novo, { senha: SENHA2, gravar: false })
  ok(pr.ok === false && /SOMA DIFERENTE/.test(pr.motivo), `a prova acusa a soma de uma parte nova adulterada: ${pr.motivo.slice(0, 90)}`)
}
{
  const d = adulterar(rP.arquivo, 'tar')
  const f = path.join(d, parteP.parte); fs.writeFileSync(f, 'isto nao e um tar.gz\n')
  const sha = sh('sha256sum', [f]).stdout.split(' ')[0]
  const mf = path.join(d, 'manifesto.json'); fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').split(parteP.sha256).join(sha))
  const novo = path.join(T, 'adulterada-tar.capsula.tar.gz'); sh('tar', ['-czf', novo, '-C', d, '.'])
  const pr = C.provar(novo, { senha: SENHA2, gravar: false })
  ok(pr.ok === false && /não abre como tar\.gz/.test(pr.motivo), `soma refeita mas o arquivo não é tar.gz: a prova abre cada tar e acusa: ${pr.motivo.slice(0, 90)}`)
}

console.log('(w) restaurar.sh: recoloca publicado/ sem root, e só imprime o que exige root')
const Dp = path.join(T, 'rest-pub')
const rEns = rodarS(capP, ['--destino', Dp, '--nginx-dir', novoND('pub-e')], { nd: novoND('pub-e'), uid: 1000 })
ok(rEns.status === 0 && /ENSAIO/.test(rEns.stdout) && /recolocaria \(publicado, \d+ KB\) .*delta-publico em .*_externo.*delta-publico/.test(rEns.stdout) && !fs.existsSync(Dp), 'ensaio: mostra o que recolocaria e não cria nada')
const ndPub = novoND('pub-a')
fb.zerar()
const rApl = rodarS(capP, ['--aplicar', '--destino', Dp, '--nginx-dir', ndPub], { nd: ndPub, uid: 1000 })
const alvoPub = path.join(Dp, '_externo', SF.www)
ok(rApl.status === 0 && fs.readFileSync(path.join(alvoPub, 'delta-publico', 'index.html'), 'utf8') === '<h1>delta</h1>\n' && fs.readFileSync(path.join(alvoPub, 'delta-midia', 'a.txt'), 'utf8') === 'midia a\n' && /recolocando .*delta-publico/.test(rApl.stdout), `--destino sem root: as pastas voltam para <destino>/_externo/<caminho original> (${rApl.status})`)
ok(fs.readFileSync(path.join(alvoPub, 'delta-publico', '.env'), 'utf8') === `X=${SF.SEGREDOS.envPublicado}\n` && !fs.existsSync(path.join(alvoPub, 'delta-publico', 'certs', 'privkey.pem')) && !fs.existsSync(path.join(alvoPub, 'delta-publico', 'id_rsa')) && fs.existsSync(path.join(Dp, 'package.json')) && fs.readFileSync(path.join(SF.www, 'delta-midia', 'a.txt'), 'utf8') === 'midia a\n', 'o .env de dentro da pasta volta do segredo cifrado (com a senha); a chave e o id_rsa não voltam (nunca estiveram na cápsula); o projeto voltou; a pasta de origem ficou intacta')
ok(fb.linhas().length === 0, 'restaurar as pastas sem root não chamou nginx, certbot, pm2, crontab nem systemctl')
// nginx: com root simulado e --destino, o root/alias do bloco instalado aponta para onde as pastas foram parar
{
  const nd = novoND('pub-nginx'); const D = path.join(T, 'rest-pub-nginx'); fb.zerar()
  const x = rodarS(capP, ['--aplicar', '--destino', D, '--nginx-dir', nd, '--sem-docker'], { nd, uid: 0, extra: { HOME: path.join(T, 'casa-pub-nginx') } })
  const conf = fs.existsSync(path.join(nd, 'sites-available', 'delta')) ? fs.readFileSync(path.join(nd, 'sites-available', 'delta'), 'utf8') : ''
  ok(x.status === 0 && conf.includes(`root ${D}/_externo${SF.www}/delta-publico;`) && conf.includes(`alias ${D}/_externo${SF.www}/delta-midia/;`) && fs.existsSync(path.join(D, '_externo', SF.www, 'delta-publico', 'index.html')), `o bloco do nginx instalado aponta o root e o alias para as pastas recolocadas (${x.status})`)
}
// --externos-originais, pasta igual, pasta diferente
{
  const sem = (a) => rodarS(capP, a, { nd: novoND('pub-orig'), uid: 1000 })
  const D1 = path.join(T, 'rest-orig-1')
  const x1 = sem(['--aplicar', '--destino', D1, '--externos-originais', '--nginx-dir', novoND('pub-orig1')])
  const temDiff = sh('sh', ['-c', 'command -v diff']).status === 0
  ok(temDiff ? x1.status === 0 && /delta-publico já está igual ao da cápsula: mantida/.test(x1.stdout) : x1.status === 12, `--externos-originais: pasta que já tem tudo o que a cápsula traz é mantida, sem recusar${temDiff ? '' : ' (sem diff nesta máquina: recusa por segurança)'} (${x1.status})`)
  fs.writeFileSync(path.join(SF.www, 'delta-midia', 'a.txt'), 'MUDOU DEPOIS\n')
  const D2 = path.join(T, 'rest-orig-2')
  const x2 = sem(['--aplicar', '--destino', D2, '--externos-originais', '--nginx-dir', novoND('pub-orig2')])
  ok(x2.status === 12 && /RECUSADO: já existe, com conteúdo diferente/.test(x2.stderr) && !fs.existsSync(D2) && fs.readFileSync(path.join(SF.www, 'delta-midia', 'a.txt'), 'utf8') === 'MUDOU DEPOIS\n', 'pasta existente com conteúdo DIFERENTE: recusa (saída 12) antes de mudar qualquer coisa, e não toca na pasta')
  const e2 = sem(['--destino', D2, '--externos-originais', '--nginx-dir', novoND('pub-orig3')])
  ok(e2.status === 0 && /RECUSARIA .*delta-midia: já existe e não está vazio/.test(e2.stdout) && !fs.existsSync(D2), 'o ensaio já avisa que recusaria')
  const x3 = sem(['--aplicar', '--destino', D2, '--externos-originais', '--sobrescrever', '--nginx-dir', novoND('pub-orig4')])
  ok(x3.status === 0 && fs.readFileSync(path.join(SF.www, 'delta-midia', 'a.txt'), 'utf8') === 'midia a\n', 'com --sobrescrever a pasta é restaurada por cima (e só então)')
}
// o que exige root: caminho em /var/www (palpite de caminho; não toca em nada fora da casa temporária)
if (naoRoot) {
  const capR = path.join(T, 'capR'); extrair(rP.arquivo, capR)
  const ptsv = path.join(capR, 'pastas.tsv')
  const novoTsv = fs.readFileSync(ptsv, 'utf8').split(SF.www).join('/var/www/zz-cap-teste')
  fs.writeFileSync(ptsv, novoTsv)
  const shaNovo = sh('sha256sum', [ptsv]).stdout.split(' ')[0]
  const mfR = path.join(capR, 'manifesto.json'); fs.writeFileSync(mfR, fs.readFileSync(mfR, 'utf8').split(maniP.sha256['pastas.tsv']).join(shaNovo))
  const DR = path.join(T, 'rest-sudo')
  const eR = sh('sh', [path.join(capR, 'restaurar.sh'), '--destino', DR, '--externos-originais'], { env: { ...process.env } })
  ok(eR.status === 0 && /\/var\/www\/zz-cap-teste\/delta-publico \(publicado, \d+ KB\) vai para \/var\/www\/zz-cap-teste\/delta-publico, que fica fora de casa: sem root imprimiria os comandos com sudo/.test(eR.stdout), 'ensaio: /var/www fica fora de casa, sem root imprimiria os comandos com sudo')
  const xR = sh('sh', [path.join(capR, 'restaurar.sh'), '--aplicar', '--destino', DR, '--externos-originais'], { input: SENHA2 + '\n', env: { ...process.env } })
  ok(xR.status === 0 && /NADA foi tentado\. Cole \(sudo\)/.test(xR.stdout) && xR.stdout.includes("sudo mkdir -p '/var/www/zz-cap-teste/delta-publico' && sudo tar -xzpf '") && xR.stdout.includes("-C '/var/www/zz-cap-teste/delta-publico'") && !fs.existsSync('/var/www/zz-cap-teste'), `sem root: para /var/www só IMPRIME os comandos com sudo e não cria nada lá (${xR.status})`)
  ok(fs.existsSync(path.join(DR, 'package.json')) && /1 para colar com sudo|2 para colar com sudo/.test(xR.stdout), 'o projeto voltou mesmo assim, e o resumo diz quantas pastas ficaram para o sudo')
} else console.log('  (rodando como root: o teste de /var/www sem root foi pulado)')
ok(sh('sh', ['-n', path.join(capP, 'restaurar.sh')]).status === 0 && (!fs.existsSync('/usr/bin/dash') || sh('dash', ['-n', path.join(capP, 'restaurar.sh')]).status === 0), 'sh -n e dash -n passam no restaurar.sh com a parte das pastas')
{
  const x = rodarS(capP, ['--aplicar', '--destino', path.join(T, 'rest-sem-pastas'), '--sem-pastas', '--nginx-dir', novoND('sem-pastas')], { nd: novoND('sem-pastas'), uid: 1000 })
  ok(x.status === 0 && !fs.existsSync(path.join(T, 'rest-sem-pastas', '_externo')) && fs.existsSync(path.join(T, 'rest-sem-pastas', 'package.json')), '--sem-pastas restaura só o projeto')
}

console.log('(x) Montagens: pastas montadas pelos contêineres (Docker FALSO)')
const mm = Object.fromEntries(maniJ.montagens.map((x) => [x.caminho, x]))
const estPasta = path.join(T, 'montado', 'estatico')
ok(mm[estPasta].estado === 'coletada' && /^montagens\/[A-Za-z0-9_-]+estatico\.tar\.gz$/.test(mm[estPasta].parte) && mm[estPasta].sha256 === maniJ.sha256[mm[estPasta].parte] && mm[estPasta].bytes_origem > 0, 'montagem bind de fora do projeto coletada em montagens/, com caminho original, tamanho e sha256')
ok(mm[path.join(estPasta, 'img')].estado === 'coberta', 'montagem dentro de outra já coletada fica como "coberta" (não duplica)')
ok(['/var/run/docker.sock', '/etc/localtime', '/etc/timezone', '/etc/letsencrypt/live/x', '/sys/fs/cgroup', '/proc/stat', '/dev/shm'].every((c) => mm[c] && mm[c].estado === 'excluida' && !mm[c].parte), 'docker.sock, localtime, timezone, letsencrypt, /sys, /proc e /dev: de sistema, excluídas, sem parte')
ok(mm['/opt'].estado === 'nao-coletada' && /ampla demais/.test(mm['/opt'].motivo), 'bind em /opt inteiro: ampla demais, não coletada')
ok(!Object.keys(maniJ.sha256).some((k) => /letsencrypt|docker\.sock|localtime/.test(k)), 'nenhuma parte da cápsula vem de /etc/letsencrypt nem de montagem de sistema')
const listaM = sh('tar', ['-tzf', path.join(capJ, mm[estPasta].parte)]).stdout.split('\n')
ok(listaM.includes('./index.html') && listaM.includes('./img/a.txt') && !listaM.some((l) => /privkey|\.env/.test(l)) && mm[estPasta].excluidos.includes('chaves/privkey.pem') && !mm[estPasta].excluidos.includes('.env') && mm[estPasta].segredos.join() === '.env', 'o tar da montagem tem o conteúdo e NÃO tem a chave privada nem o .env que estavam dentro (o .env foi para os segredos cifrados)')
const abertoM = path.join(T, 'abertoM'); fs.mkdirSync(abertoM); sh('tar', ['-xzpf', path.join(capJ, mm[estPasta].parte), '-C', abertoM])
ok(!sh('grep', ['-rl', '--binary-files=text', '-e', CHAVE_MONTADA, abertoM, capJ]).stdout.trim(), 'a chave que estava na pasta montada não aparece em nenhum arquivo da cápsula')
ok(/montada\(s\)/.test(rj.prova.motivo) && /1 montada\(s\)/.test(rj.prova.motivo), 'a prova abriu o tar da montagem')
const mdM = fs.readFileSync(path.join(capJ, 'RESTAURAR.md'), 'utf8')
ok(mdM.includes(`Pasta montada por contêiner: ${estPasta}`) && mdM.includes(`pasta ligada ao contêiner: ${estPasta} em /usr/share/static (FORA do projeto, guardada em ${mm[estPasta].parte})`) && !/docker\.sock/.test(mdM) && !/[—–]/.test(mdM), 'RESTAURAR.md: a pasta montada aparece como guardada; as de sistema nem aparecem')
const estP = await C.ensaioCompleto(FD.raiz, { saida: SAIDA, livre: GRANDE, docker: { executar } })
const mE = estP.docker.montagens.find((x) => x.caminho === estPasta)
ok(mE && mE.bytes > 0 && estP.docker.bytes >= mE.bytes && estP.docker.avisos.some((a) => /\/opt .*ampla demais/.test(a)), 'ensaio do Docker mede a pasta montada, soma no total e avisa da que não será guardada')
// o restaurador: pasta montada volta junto, e --sem-docker a pula
falso.zerarLog()
const DM = path.join(T, 'rest-mont')
const aM = rodar(['--aplicar', '--destino', DM, '--projeto-compose', 'montprj'])
ok(aM.status === 0 && fs.readFileSync(path.join(DM, '_externo', estPasta, 'index.html'), 'utf8') === '<h1>montado</h1>\n' && fs.readFileSync(path.join(DM, '_externo', estPasta, '.env'), 'utf8').startsWith('Y=') && !fs.existsSync(path.join(DM, '_externo', estPasta, 'chaves', 'privkey.pem')), `restaurar.sh recoloca a pasta montada sob <destino>/_externo, com o .env vindo do segredo cifrado e sem a chave (${aM.status})`)
ok(!fs.existsSync(path.join(T, 'dk7', '_externo')), '--sem-docker não restaura as pastas montadas')
{
  // pasta montada que o usuário não lê, e outra que não existe
  const FD2 = criarProjetoDocker(T, falso, 'fe-teste-site2', { trancada: naoRoot, inexistente: true })
  const r2 = await C.fazer(FD2.raiz, { senha: SENHA2, saida: SAIDA, docker: { executar }, livre: GRANDE })
  FD2.destrancar()
  const m2 = Object.fromEntries(r2.manifesto.montagens.map((x) => [x.caminho, x]))
  ok(m2[path.join(T, 'montado', 'nao-existe')].estado === 'nao-coletada' && /não existe/.test(m2[path.join(T, 'montado', 'nao-existe')].motivo) && r2.prova.ok === true, 'montagem que não existe: registrada como não coletada, e a cápsula segue provada')
  if (naoRoot) ok(m2[path.join(T, 'montado', 'trancada')].estado === 'nao-coletada' && r2.manifesto.nao_coletado.some((x) => /montado\/trancada/.test(x.caminho) && /não coletado, precisa de root/.test(x.motivo)), 'pasta montada ilegível: "não coletado, precisa de root"')
  criarProjetoDocker(T, falso) // devolve o cenário de "fe-teste"
}
console.log('(y) Segredos de fora do projeto: o .env de dentro da pasta publicada vai no MESMO segredos.tar.gpg')
const SEG_OMEGA = 'env-do-site-omega-NAO-VAZAR-9981'
const OM = path.join(T, 'meus2', 'omega'); const OM_PUB = path.join(T, 'www2', 'omega-pub'); const OM_ND = path.join(T, 'nginx-omega'); const OM_UN = path.join(T, 'units-omega')
for (const d of [OM, OM_PUB, path.join(OM_ND, 'sites-enabled'), OM_UN]) fs.mkdirSync(d, { recursive: true })
fs.writeFileSync(path.join(OM, 'package.json'), '{"name":"omega"}\n')
fs.writeFileSync(path.join(OM_PUB, 'index.html'), '<h1>omega</h1>\n')
fs.writeFileSync(path.join(OM_PUB, '.env'), `CHAVE=${SEG_OMEGA}\n`, { mode: 0o640 }); fs.chmodSync(path.join(OM_PUB, '.env'), 0o640)
fs.mkdirSync(path.join(OM_PUB, 'cfg')); fs.writeFileSync(path.join(OM_PUB, 'cfg', '.env.production'), `P=${SEG_OMEGA}-prod\n`)
fs.writeFileSync(path.join(OM_PUB, 'privkey.pem'), 'CHAVE-PEM-OMEGA-NAO-VAZAR\n')
fs.writeFileSync(path.join(OM_ND, 'sites-enabled', 'omega'), `server {\n  listen 80;\n  server_name omega.exemplo.com;\n  location / { proxy_pass http://127.0.0.1:8505; }\n  location /static/ { alias ${OM_PUB}/; }\n}\n`)
fs.writeFileSync(path.join(OM_UN, 'omega.service'), `[Service]\nWorkingDirectory=${OM}\nExecStart=/usr/bin/node s.js\nEnvironment=PORT=8505\n`)
const leiOm = { nginxDir: OM_ND, unitDir: OM_UN, pm2: () => ({ ok: true, lista: [] }), crontab: () => ({ ok: true, texto: '' }), outros: null }
const SAIDA_OM = path.join(T, 'saida-omega')
const ensOm = await C.ensaioCompleto(OM, { saida: SAIDA_OM, livre: GRANDE, servidor: leiOm })
ok(JSON.stringify(ensOm.segredos_de_fora) === JSON.stringify([path.join(OM_PUB, '.env'), path.join(OM_PUB, 'cfg', '.env.production')].sort()) && ensOm.segredos.length === 0, 'ensaio: o projeto não tem .env, mas a tela é avisada dos 2 .env de dentro da pasta publicada (só os caminhos)')
ok(!JSON.stringify(ensOm).includes(SEG_OMEGA), 'o ensaio não leva o conteúdo de nenhum segredo')
let eOm = null
try { await C.fazer(OM, { senha: null, saida: SAIDA_OM, livre: GRANDE, servidor: leiOm }) } catch (e) { eOm = e }
ok(eOm && eOm.codigo === 'SENHA' && /pastas de fora do projeto/.test(eOm.message) && !fs.existsSync(SAIDA_OM), 'sem senha, a cápsula com segredo SÓ de fora do projeto é recusada, antes de gravar qualquer coisa')
const rOm = await C.fazer(OM, { senha: SENHA2, saida: SAIDA_OM, livre: GRANDE, servidor: leiOm })
const capOm = path.join(T, 'capOm'); extrair(rOm.arquivo, capOm)
const maniOm = JSON.parse(fs.readFileSync(path.join(capOm, 'manifesto.json'), 'utf8'))
ok(rOm.prova.ok === true && maniOm.segredos.cifrados === true && maniOm.segredos.arquivos.length === 0 && maniOm.segredos.pastas.length === 2 && !!maniOm.sha256['segredos.tar.gpg'], `cápsula feita e PROVADA, com segredos.tar.gpg só por causa dos de fora: ${rOm.prova.motivo.slice(0, 110)}`)
ok(maniOm.segredos.pastas.every((x) => /^_externo\//.test(x.membro)) && maniOm.segredos.pastas.map((x) => x.caminho_original).sort().join() === [path.join(OM_PUB, '.env'), path.join(OM_PUB, 'cfg', '.env.production')].sort().join(), 'manifesto: o caminho original de cada um (e só o caminho)')
ok(!JSON.stringify(maniOm).includes(SEG_OMEGA) && !sh('grep', ['-rl', '--binary-files=text', '-e', SEG_OMEGA, capOm]).stdout.trim(), 'o conteúdo dos .env não aparece em claro em NENHUMA parte da cápsula aberta (manifesto, pastas.tsv, tar da pasta, RESTAURAR.md)')
ok(!sh('grep', ['-rl', '--binary-files=text', '-e', 'CHAVE-PEM-OMEGA', capOm]).stdout.trim() && !fs.readFileSync(path.join(capOm, 'segredos.tar.gpg')).includes(SEG_OMEGA), 'a chave privada continua fora de tudo, e o gpg não tem o texto em claro')
const tsvOm = fs.readFileSync(path.join(capOm, 'pastas.tsv'), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'))
ok(tsvOm.filter((l) => l[0] === 'segredo').length === 2 && tsvOm.filter((l) => l[0] === 'segredo').every((l) => l[1] === 'publicado' && l[2] === 'f' && /^_externo\//.test(l[3])) && tsvOm.some((l) => l[0] === 'publicado'), 'pastas.tsv: uma linha "segredo" por arquivo (origem, f, membro, bytes, caminho original) ao lado da linha da pasta')
const tarOm = sh('tar', ['-tzf', path.join(capOm, maniOm.publicado.find((x) => x.estado === 'coletada').parte)]).stdout.split('\n')
ok(!tarOm.some((l) => /\.env|privkey/.test(l)) && tarOm.includes('./index.html'), 'o tar da pasta publicada tem o site, sem .env e sem chave')
const mdOm = fs.readFileSync(path.join(capOm, 'RESTAURAR.md'), 'utf8')
ok((mdOm.match(/^## \d\. /gm) || []).length === 9 && !/[—–]/.test(mdOm) && mdOm.includes(path.join(OM_PUB, '.env')) && /CIFRADOS no segredos\.tar\.gpg/.test(mdOm) && /_externo\//.test(mdOm) && /dono e o grupo originais/.test(mdOm), 'RESTAURAR.md: cita os caminhos dos .env cifrados, o como-restaurar, e avisa que dono e grupo não voltam')
// restaurar com a senha certa, no lugar certo
{
  const nd = novoND('om-a'); const D = path.join(T, 'rest-om-a'); fb.zerar()
  const x = rodarS(capOm, ['--aplicar', '--destino', D, '--nginx-dir', nd, '--sem-docker'], { nd, uid: 1000 })
  const alvo = path.join(D, '_externo', OM_PUB)
  ok(x.status === 0 && fs.readFileSync(path.join(alvo, '.env'), 'utf8') === `CHAVE=${SEG_OMEGA}\n` && fs.readFileSync(path.join(alvo, 'cfg', '.env.production'), 'utf8') === `P=${SEG_OMEGA}-prod\n` && fs.readFileSync(path.join(alvo, 'index.html'), 'utf8') === '<h1>omega</h1>\n', `senha certa: os .env voltam no caminho original sob <destino>/_externo, junto da pasta (${x.status})`)
  ok((fs.statSync(path.join(alvo, '.env')).mode & 0o777) === 0o640 && !fs.existsSync(path.join(alvo, 'privkey.pem')), 'o modo de origem (640) volta; a chave não')
  ok(!x.stdout.includes(SEG_OMEGA) && !x.stderr.includes(SEG_OMEGA) && /segredos de fora do projeto: 2 recolocado/.test(x.stdout), 'o conteúdo do segredo nunca é impresso, e o resumo conta quantos voltaram')
  ok(!fs.readdirSync(D).some((n) => /cap-novo/.test(n)) && !fs.readdirSync(alvo).some((n) => /cap-novo/.test(n)), 'nenhum arquivo temporário ficou para trás')
}
// senha errada e sem senha: a pasta volta, os segredos não, e o script diz
for (const [rot, entrada] of [['errada', 'senha-errada\n'], ['vazia', '\n']]) {
  const nd = novoND('om-' + rot); const D = path.join(T, 'rest-om-' + rot)
  const x = rodarS(capOm, ['--aplicar', '--destino', D, '--nginx-dir', nd, '--sem-docker'], { nd, uid: 1000, input: entrada })
  const alvo = path.join(D, '_externo', OM_PUB)
  ok(x.status === 6 && fs.existsSync(path.join(alvo, 'index.html')) && !fs.existsSync(path.join(alvo, '.env')) && !fs.existsSync(path.join(alvo, 'cfg', '.env.production')) && /segredos de fora do projeto NÃO voltaram/.test(x.stdout), `senha ${rot}: o site volta, os .env de fora NÃO voltam, e sai 6 avisando (${x.status})`)
}
// ensaio: lista o que faria e não cria nada
{
  const nd = novoND('om-e'); const D = path.join(T, 'rest-om-e')
  const x = rodarS(capOm, ['--destino', D, '--nginx-dir', nd, '--sem-docker'], { nd, uid: 1000 })
  ok(x.status === 0 && /Segredos de fora do projeto \(cifrados/.test(x.stdout) && x.stdout.includes('recolocaria o segredo') && !fs.existsSync(D), 'ensaio: mostra os segredos de fora que recolocaria e não cria nada')
}
// --sem-pastas e --sem-servidor pulam (os publicados vêm do servidor)
for (const flag of ['--sem-pastas', '--sem-servidor']) {
  const nd = novoND('om-p' + flag); const D = path.join(T, 'rest-om-p' + flag)
  const x = rodarS(capOm, ['--aplicar', '--destino', D, '--nginx-dir', nd, '--sem-docker', flag], { nd, uid: 1000 })
  ok(x.status === 0 && !fs.existsSync(path.join(D, '_externo')) && fs.existsSync(path.join(D, 'package.json')), `${flag}: nenhum segredo de fora é recolocado, e o projeto volta`)
}
// o que já existe no caminho original (--externos-originais): igual é mantido, diferente nunca é trocado sem --sobrescrever
{
  const orig = path.join(OM_PUB, '.env')
  const roda = (extra = [], nome) => rodarS(capOm, ['--aplicar', '--destino', path.join(T, 'rest-om-' + nome), '--externos-originais', '--nginx-dir', novoND('om-' + nome), '--sem-docker', ...extra], { nd: novoND('om-' + nome), uid: 1000 })
  const temDiff = sh('sh', ['-c', 'command -v diff']).status === 0
  const x1 = roda([], 'orig1')
  ok(!temDiff || (x1.status === 0 && /segredo .*\.env já está igual ao da cápsula: mantido/.test(x1.stdout)), `segredo que já existe e é igual: mantido (${x1.status})`)
  fs.writeFileSync(orig, 'MUDOU=depois-da-capsula\n')
  const x2 = roda([], 'orig2')
  ok(!temDiff || (x2.status === 6 && /já existe e é DIFERENTE do da cápsula: mantido/.test(x2.stdout) && fs.readFileSync(orig, 'utf8') === 'MUDOU=depois-da-capsula\n'), `segredo existente e DIFERENTE: nunca é trocado sem --sobrescrever, e sai 6 (${x2.status})`)
  const x3 = roda(['--sobrescrever'], 'orig3')
  ok(x3.status === 0 && fs.readFileSync(orig, 'utf8') === `CHAVE=${SEG_OMEGA}\n` && (fs.statSync(orig).mode & 0o777) === 0o640, `com --sobrescrever o segredo é trocado pelo da cápsula, com o modo de origem (${x3.status})`)
}
// root: o caminho em /var/www exige root; sem root só imprime o comando (sem o conteúdo) e não cria nada
if (naoRoot) {
  const capR2 = path.join(T, 'capR2'); extrair(rOm.arquivo, capR2)
  const ptsv = path.join(capR2, 'pastas.tsv')
  fs.writeFileSync(ptsv, fs.readFileSync(ptsv, 'utf8').split(OM_PUB).join('/var/www/zz-cap-segredo'))
  const mf = path.join(capR2, 'manifesto.json')
  fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').split(maniOm.sha256['pastas.tsv']).join(sh('sha256sum', [ptsv]).stdout.split(' ')[0]))
  const DR = path.join(T, 'rest-om-sudo')
  const ens = sh('sh', [path.join(capR2, 'restaurar.sh'), '--destino', DR, '--externos-originais'], { env: { ...process.env } })
  ok(ens.status === 0 && /\/var\/www\/zz-cap-segredo\/\.env fica fora de casa: sem root imprimiria o comando com sudo/.test(ens.stdout), 'ensaio: /var/www fica fora de casa, sem root imprimiria o comando com sudo')
  const x = sh('sh', [path.join(capR2, 'restaurar.sh'), '--aplicar', '--destino', DR, '--externos-originais'], { input: SENHA2 + '\n', env: { ...process.env } })
  ok(x.status === 0 && /NADA foi tentado\. O conteúdo não é impresso/.test(x.stdout) && x.stdout.includes("| sudo tee '/var/www/zz-cap-segredo/.env' >/dev/null && sudo chmod 600 '/var/www/zz-cap-segredo/.env'") && x.stdout.includes("tar -xOf - '_externo/1-") && !x.stdout.includes(SEG_OMEGA) && !fs.existsSync('/var/www/zz-cap-segredo'), `sem root: o segredo de /var/www só vira comando com sudo (sem o conteúdo) e nada é criado lá (${x.status})`)
  ok(/2 para colar com sudo/.test(x.stdout) && fs.existsSync(path.join(DR, 'package.json')), 'o resumo conta os que ficaram para o sudo, e o projeto voltou')
} else console.log('  (rodando como root: o teste de /var/www sem root foi pulado)')
// uma cápsula antiga (sem linha "segredo" no pastas.tsv) continua restaurando igual
{
  const capV = path.join(T, 'capV'); extrair(rOm.arquivo, capV)
  const ptsv = path.join(capV, 'pastas.tsv')
  fs.writeFileSync(ptsv, fs.readFileSync(ptsv, 'utf8').split('\n').filter((l) => !l.startsWith('segredo\t')).join('\n'))
  const mf = path.join(capV, 'manifesto.json')
  fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').split(maniOm.sha256['pastas.tsv']).join(sh('sha256sum', [ptsv]).stdout.split(' ')[0]))
  const nd = novoND('om-v'); const D = path.join(T, 'rest-om-v')
  const x = rodarS(capV, ['--aplicar', '--destino', D, '--nginx-dir', nd, '--sem-docker'], { nd, uid: 1000 })
  ok(x.status === 0 && fs.existsSync(path.join(D, '_externo', OM_PUB, 'index.html')) && !fs.existsSync(path.join(D, '_externo', OM_PUB, '.env')) && !/segredos de fora/.test(x.stdout), 'sem linha "segredo" no pastas.tsv (cápsula antiga): restaura como antes, sem tentar segredo nenhum')
}
ok(sh('sh', ['-n', path.join(capOm, 'restaurar.sh')]).status === 0 && (!fs.existsSync('/usr/bin/dash') || sh('dash', ['-n', path.join(capOm, 'restaurar.sh')]).status === 0), 'sh -n e dash -n passam no restaurar.sh com a parte dos segredos de fora')
ok(!fs.readdirSync(SAIDA_OM).some((n) => n.startsWith('.fazendo-')) && !fs.existsSync(path.join(OM, '.ext')), 'o rascunho em claro dos segredos de fora não sobrou no disco')

const srcP = fs.readFileSync(path.join(AQUI, 'src', 'capsulaPastas.mjs'), 'utf8')
ok(!/[—–]/.test(srcP) && !/spawnSync\('(docker|nginx|certbot|systemctl|pm2)'/.test(srcP), 'sem travessão; o código das pastas não chama docker, nginx, certbot, systemctl nem pm2')

// limpeza: nada fica de pé
SF.destrancar()
if (gpgReal) sh('gpgconf', ['--kill', 'gpg-agent'])
else console.log('\nAVISO: o gpg REAL não funciona neste ambiente (sem socket unix). Usei um gpg de mentira feito com openssl.\n       A cifra gpg AES256 de verdade NÃO foi conferida nesta rodada. Rode de novo fora da caixa para conferir.')
fs.rmSync(T, { recursive: true, force: true })
fs.rmSync(process.env.GNUPGHOME, { recursive: true, force: true })
console.log(`\n${total - falhas} de ${total} verificações ok, ${falhas} falha(s)`)
process.exit(falhas ? 1 : 0)
