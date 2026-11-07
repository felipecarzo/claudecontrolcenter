/* CC-1080, passo 2: o Docker FALSO dos testes da cápsula.
 *
 * Nenhum teste da cápsula pode chamar o Docker de verdade (sessão de IA não roda docker, nem para ler). Este script de sh
 * ocupa o lugar do binário: grava cada comando que recebeu em um log e responde com o que o teste preparou.
 * Usado por test-capsula.mjs e test-capsula-painel.mjs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const DOCKER = `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_LOG"
case "$1" in
  version) echo "27.0.1" ;;
  ps)
    case "$*" in
      *"-a -q --no-trunc"*) cat "$FAKE_DIR/ids.txt" ;;
      *"label=com.docker.compose.service="*) echo "cid-servico" ;;
      *"label=com.docker.compose.project="*) cat "$FAKE_DIR/ps-projeto.txt" 2>/dev/null ;;
    esac ;;
  inspect) cat "$FAKE_DIR/inspect.json" ;;
  image) cat "$FAKE_DIR/images.json" ;;
  volume)
    case "$2" in
      inspect) grep -qx "$3" "$FAKE_DIR/volumes-existem.txt" 2>/dev/null || exit 1 ;;
    esac ;;
  exec)
    case "$*" in
      *pg_isready*) exit 0 ;;
      *"select datname"*) printf 'appdb\\nextra\\n' ;;
      *pg_database_size*) echo 1048576 ;;
      *"pg_dump -Fc"*) if [ -f "$FAKE_DIR/dump-corrompido" ]; then printf 'CORROMPIDO\\n'; else printf 'PGDMP-falso %s\\n' "$*"; fi ;;
      *pg_restore*) cat > /dev/null ;;
    esac ;;
  run)
    case "$*" in
      *"--entrypoint du"*) printf '2048\\t/v\\n' ;;
      *"--entrypoint tar"*czf*)
        FV=$(cat "$FAKE_DIR/falha-volume.txt" 2>/dev/null)
        if [ -n "$FV" ]; then case "$*" in *"$FV:/v"*) echo "tar: nao achei o binario" >&2; exit 1 ;; esac; fi
        cat "$FAKE_DIR/volume.tar.gz" ;;
      *xzf*) cat > /dev/null ;;
    esac ;;
  save) cat "$FAKE_DIR/imagem.tar" ;;
  load|compose) ;;
  *) echo "comando inesperado no docker falso: $*" >&2; exit 99 ;;
esac
`

const PG_RESTORE = `#!/bin/sh
# pg_restore falso: só o -l, e recusa o arquivo marcado como corrompido
[ "$1" = "-l" ] || exit 2
grep -q CORROMPIDO "$2" && { echo "arquivo corrompido" >&2; exit 1; }
echo "; Archive falso"
exit 0
`

/**
 * Casa de GnuPG isolada. O gpg real precisa de um socket unix (gpg-agent), que a caixa de proteção da sessão de IA nega; nesse caso
 * entra um gpg de mentira feito com openssl, só para o encanamento. Devolve true quando o gpg REAL funcionou.
 */
export function prepararGpg(T) {
  process.env.GNUPGHOME = fs.mkdtempSync(path.join(T, 'g-'))
  fs.chmodSync(process.env.GNUPGHOME, 0o700)
  const sonda = path.join(T, 'sonda.txt'); fs.writeFileSync(sonda, 'x')
  const p = spawnSync('gpg', ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256', '-o', sonda + '.gpg', sonda], { input: 'p\n', encoding: 'utf8', timeout: 30000 })
  if (p.status === 0 && fs.existsSync(sonda + '.gpg')) return true
  const bin = path.join(T, 'bin-gpg-falso'); fs.mkdirSync(bin)
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
  return false
}

export function criarFalso(T) {
  const dir = path.join(T, 'falso')
  const bin = path.join(dir, 'bin')
  const dados = path.join(dir, 'dados')
  fs.mkdirSync(bin, { recursive: true }); fs.mkdirSync(dados, { recursive: true })
  fs.writeFileSync(path.join(bin, 'docker'), DOCKER, { mode: 0o755 })
  fs.writeFileSync(path.join(bin, 'pg_restore'), PG_RESTORE, { mode: 0o755 })
  const log = path.join(dir, 'docker.log')
  fs.writeFileSync(log, '')
  // um tar.gz de verdade para fingir o conteúdo de um volume, e um tar de verdade com manifest.json para fingir um docker save
  const vol = path.join(dir, 'conteudo-volume'); fs.mkdirSync(vol, { recursive: true }); fs.writeFileSync(path.join(vol, 'dado.bin'), 'linhas do volume\n')
  spawnSync('tar', ['czf', path.join(dados, 'volume.tar.gz'), '-C', vol, '.'])
  const img = path.join(dir, 'conteudo-imagem'); fs.mkdirSync(img, { recursive: true }); fs.writeFileSync(path.join(img, 'manifest.json'), '[]')
  spawnSync('tar', ['cf', path.join(dados, 'imagem.tar'), '-C', img, 'manifest.json'])

  const ctr = (o) => ({
    Id: o.id, Name: '/' + o.nome, Image: o.img, State: { Running: o.run !== false, Status: o.run === false ? 'exited' : 'running' },
    Config: { Image: o.ref, Env: o.env || [], Labels: { 'com.docker.compose.project': o.proj, 'com.docker.compose.project.working_dir': o.wd, 'com.docker.compose.project.config_files': o.cf, 'com.docker.compose.service': o.srv } },
    Mounts: o.mounts || [], NetworkSettings: { Ports: o.ports || {} },
  })
  const api = {
    dir, bin, log, dados, ctr,
    /** variáveis de ambiente para o processo: o binário falso e os arquivos dele */
    env: () => ({ CC_DOCKER_BIN: path.join(bin, 'docker'), FAKE_DIR: dados, FAKE_LOG: log, PATH: `${bin}:${process.env.PATH}` }),
    ligar() { Object.assign(process.env, api.env()) },
    /** prepara o que o ps/inspect/image devolvem */
    cenario({ containers, imagens }) {
      fs.writeFileSync(path.join(dados, 'ids.txt'), containers.map((c) => c.Id).join('\n') + '\n')
      fs.writeFileSync(path.join(dados, 'inspect.json'), JSON.stringify(containers))
      fs.writeFileSync(path.join(dados, 'images.json'), JSON.stringify(imagens))
    },
    arquivo(nome, texto) { if (texto === null) fs.rmSync(path.join(dados, nome), { force: true }); else fs.writeFileSync(path.join(dados, nome), texto) },
    zerarLog() { fs.writeFileSync(log, '') },
    linhas() { return fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) },
  }
  return api
}

/**
 * O projeto de teste "fe-teste": pasta com compose, .env com uma senha de banco que NUNCA pode vazar, uma pasta ligada ao contêiner
 * e dois contêineres (banco e site) no projeto Compose "fe-teste", mais UM contêiner de OUTRO projeto que não pode ser tocado.
 */
export const SENHA_DO_BANCO = 'senha-do-banco-NAO-VAZAR-987'
export const CHAVE_MONTADA = 'CHAVE-DA-PASTA-MONTADA-NAO-VAZAR-321'
/** `trancada`: acrescenta uma pasta montada que o usuário não lê (precisa de root); `inexistente`: uma que não existe. Quem usa devolve o modo com `destrancar()`. */
export function criarProjetoDocker(T, falso, nome = 'fe-teste-site', { trancada = false, inexistente = false } = {}) {
  const raiz = path.join(T, 'meus', nome)
  fs.mkdirSync(path.join(raiz, 'dados-locais'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'docker-compose.yml'), 'services:\n  db:\n    image: postgres:16\n  web:\n    image: node:20\n')
  fs.writeFileSync(path.join(raiz, '.env'), `POSTGRES_PASSWORD=${SENHA_DO_BANCO}\n`)
  fs.writeFileSync(path.join(raiz, 'dados-locais', 'upload.txt'), 'um arquivo enviado\n')
  fs.writeFileSync(path.join(raiz, 'index.js'), 'console.log(1)\n')
  const cf = path.join(raiz, 'docker-compose.yml')
  const proj = 'fe-teste'
  // pastas montadas de FORA do projeto (bind mount): uma legítima, com chave dentro que não pode entrar no tar, mais as de sistema
  const est = path.join(T, 'montado', 'estatico')
  fs.mkdirSync(path.join(est, 'img'), { recursive: true }); fs.mkdirSync(path.join(est, 'chaves'), { recursive: true })
  fs.writeFileSync(path.join(est, 'index.html'), '<h1>montado</h1>\n'); fs.writeFileSync(path.join(est, 'img', 'a.txt'), 'imagem a\n')
  fs.writeFileSync(path.join(est, 'chaves', 'privkey.pem'), CHAVE_MONTADA + '\n'); fs.writeFileSync(path.join(est, '.env'), `Y=${CHAVE_MONTADA}\n`)
  const bind = (origem, destino) => ({ Type: 'bind', Source: origem, Destination: destino })
  const extras = [
    bind(est, '/usr/share/static'), bind(path.join(est, 'img'), '/img'),
    bind('/var/run/docker.sock', '/var/run/docker.sock'), bind('/etc/localtime', '/etc/localtime'), bind('/etc/timezone', '/etc/timezone'),
    bind('/etc/letsencrypt/live/x', '/certs'), bind('/sys/fs/cgroup', '/cg'), bind('/proc/stat', '/stat'), bind('/dev/shm', '/shm'), bind('/opt', '/opt'),
  ]
  const trancadaDir = path.join(T, 'montado', 'trancada')
  if (trancada) { fs.mkdirSync(trancadaDir, { recursive: true }); fs.writeFileSync(path.join(trancadaDir, 'x'), 'x'); fs.chmodSync(trancadaDir, 0o000); extras.push(bind(trancadaDir, '/trancada')) }
  if (inexistente) extras.push(bind(path.join(T, 'montado', 'nao-existe'), '/nada'))
  const destrancar = () => { try { fs.chmodSync(trancadaDir, 0o755) } catch { /* não existe */ } }
  const db = falso.ctr({ id: 'a'.repeat(64), nome: 'fe-teste-db-1', img: 'sha256:' + '1'.repeat(64), ref: 'postgres:16', proj, wd: raiz, cf, srv: 'db',
    env: ['POSTGRES_USER=app', 'POSTGRES_DB=appdb', `POSTGRES_PASSWORD=${SENHA_DO_BANCO}`, 'PATH=/usr/bin'],
    mounts: [{ Type: 'volume', Name: 'fe-teste_dbdata', Destination: '/var/lib/postgresql/data' }], ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '5433' }] } })
  const web = falso.ctr({ id: 'b'.repeat(64), nome: 'fe-teste-web-1', img: 'sha256:' + '2'.repeat(64), ref: 'node:20', proj, wd: raiz, cf, srv: 'web',
    env: ['DATABASE_URL=postgres://app:senha@db/appdb'],
    mounts: [{ Type: 'volume', Name: 'fe-teste_uploads', Destination: '/uploads' }, { Type: 'bind', Source: path.join(raiz, 'dados-locais'), Destination: '/dados' }, ...extras],
    ports: { '3000/tcp': [{ HostIp: '0.0.0.0', HostPort: '3055' }] } })
  const outro = falso.ctr({ id: 'c'.repeat(64), nome: 'cliente-real-db-1', img: 'sha256:' + '3'.repeat(64), ref: 'postgres:15', proj: 'cliente-real', wd: '/opt/cliente-real', cf: '/opt/cliente-real/docker-compose.yml', srv: 'db',
    env: ['POSTGRES_USER=real', 'POSTGRES_PASSWORD=NAO-TOCAR'], mounts: [{ Type: 'volume', Name: 'cliente-real_dados', Destination: '/var/lib/postgresql/data' }] })
  const imagens = [
    { Id: 'sha256:' + '1'.repeat(64), RepoTags: ['postgres:16'], RepoDigests: ['postgres@sha256:' + 'd'.repeat(64)], Size: 400 * 1024 ** 2 },
    { Id: 'sha256:' + '2'.repeat(64), RepoTags: ['node:20'], RepoDigests: ['node@sha256:' + 'e'.repeat(64)], Size: 1100 * 1024 ** 2 },
    { Id: 'sha256:' + '3'.repeat(64), RepoTags: ['postgres:15'], RepoDigests: [], Size: 1 },
  ]
  falso.cenario({ containers: [db, web, outro], imagens })
  return { raiz, proj, db, web, outro, imagens, est, destrancar }
}
