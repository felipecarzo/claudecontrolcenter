/**
 * O catálogo da Bancada: cada camada de verificação como DADO.
 *
 * Visão em `docs/produto/BANCADA.md`. Segue o molde de `hooksCatalogo.mjs` e do
 * `METODOS` do framework: camada nova é um objeto novo, sem tocar no runner. É
 * isso que faz a bancada ser agnóstica em vez de uma lista de ifs.
 *
 * ## Por que começa por código nosso, e não por ferramenta famosa
 *
 * Medido na VPS em 15/08: gitleaks, trivy, semgrep, trufflehog e nuclei, nenhum
 * instalado. E o `proj_controlcenter` não tem lockfile, então nem `npm audit`
 * roda aqui. Uma bancada que só sabe chamar ferramenta de terceiro nasceria
 * inteira cinza, sem provar nada.
 *
 * As camadas que o documento chamava de diferencial são justamente as que não
 * dependem de instalar nada: código curto, atacando o que o stack dele tem de
 * específico. Começar por elas é começar pelo que funciona hoje.
 *
 * ## O contrato de uma camada
 *
 *   id, nome, grupo, custo, duracao, explica
 *   aplicaA(raiz, cfg)  a camada faz sentido neste projeto?
 *   rodar(raiz, cfg)    Promise<{ ok, achados: [{gravidade, titulo, onde, conserto}] }>
 *
 * `ok: false` é o que segura a fase de Verificação do método `entrega-cliente`.
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/** Roda um comando sem shell e nunca lança: comando ausente vira `ok:false` com
 *  o motivo, que a tela mostra como "não instalado" em vez de erro cru. */
async function cmd(bin, args, { cwd, timeout = 120_000 } = {}) {
  try {
    const { stdout } = await exec(bin, args, { cwd, timeout, maxBuffer: 8 * 1024 * 1024 })
    return { ok: true, saida: stdout }
  } catch (e) {
    return { ok: false, saida: e?.stdout || '', erro: String(e?.message || e) }
  }
}

const existe = (dir, ...p) => fs.existsSync(path.join(dir, ...p))

/**
 * Padrões de segredo NO CONTEÚDO.
 *
 * Diferente do `segredo-guard`, que olha nome de arquivo (`.env`, `id_rsa`).
 * Aquele impede a IA de LER; este acha o que já foi commitado dentro do código,
 * que é outro problema e o mais comum em repositório público — como este.
 *
 * Cada padrão é ancorado num prefixo conhecido, nunca em entropia: heurística de
 * entropia acusa hash de teste, base64 de imagem e id de commit, e camada que
 * grita à toa é desligada na terceira semana.
 */
export const PADROES_SEGREDO = [
  { nome: 'chave da AWS', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { nome: 'token do GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { nome: 'chave da OpenAI', re: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { nome: 'chave da Anthropic', re: /\bsk-ant-[A-Za-z0-9-]{20,}\b/g },
  { nome: 'chave privada', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { nome: 'token do Slack', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { nome: 'senha embutida em URL', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]{3,}@/gi },
  {
    // a camada que separa "o site tá bonito" de "a base está aberta"
    nome: 'JWT com service_role',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    conferir: (t) => {
      try {
        return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).role === 'service_role'
      } catch { return false }
    },
  },
]

/** Nunca varridas: ou não são nossas, ou são derivadas de algo que já foi visto. */
const IGNORAR = /(^|\/)(node_modules|\.git|dist|build|coverage|\.next|\.framework)(\/|$)/

function arquivosDe(raiz, limite = 4000) {
  const achados = []
  const andar = (dir) => {
    if (achados.length >= limite) return
    let itens = []
    try { itens = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const it of itens) {
      const cheio = path.join(dir, it.name)
      if (IGNORAR.test(path.relative(raiz, cheio).replace(/\\/g, '/'))) continue
      if (it.isDirectory()) andar(cheio)
      else if (it.isFile()) achados.push(cheio)
    }
  }
  andar(raiz)
  return achados
}

export const CAMADAS = [
  {
    id: 'segredo',
    nome: 'Segredo no código',
    grupo: 'segredo',
    custo: 'grátis',
    duracao: 'segundos',
    explica: 'Procura chave de API, token e chave privada dentro dos arquivos versionados.',
    aplicaA: () => true,
    async rodar(raiz) {
      const achados = []
      for (const arquivo of arquivosDe(raiz)) {
        let texto = ''
        try {
          const st = fs.statSync(arquivo)
          if (st.size > 2 * 1024 * 1024) continue
          texto = fs.readFileSync(arquivo, 'utf8')
        } catch { continue }
        if (texto.includes('\u0000')) continue // binário

        for (const p of PADROES_SEGREDO) {
          for (const m of texto.matchAll(p.re)) {
            if (p.conferir && !p.conferir(m[0])) continue
            const linha = texto.slice(0, m.index).split('\n').length
            achados.push({
              gravidade: 'alta',
              titulo: p.nome,
              onde: `${path.relative(raiz, arquivo)}:${linha}`,
              conserto: 'tire do código, rotacione a credencial e passe a ler de variável de ambiente',
            })
          }
        }
      }
      return { ok: achados.length === 0, achados }
    },
  },

  {
    id: 'dependencia',
    nome: 'Dependência vulnerável',
    grupo: 'suprimento',
    custo: 'grátis',
    duracao: 'segundos',
    explica: 'CVE conhecido nas dependências, pelo npm audit.',
    aplicaA: (raiz) => existe(raiz, 'package-lock.json') || existe(raiz, 'pnpm-lock.yaml'),
    async rodar(raiz) {
      const r = await cmd('npm', ['audit', '--json'], { cwd: raiz })
      let dados = null
      try { dados = JSON.parse(r.saida) } catch { /* saída suja */ }
      if (!dados) {
        return {
          ok: false,
          achados: [{
            gravidade: 'media',
            titulo: 'npm audit não devolveu JSON',
            onde: 'dependências',
            conserto: 'rodar `npm audit` à mão para ver o que houve',
          }],
        }
      }
      if (dados.error) return { ok: true, achados: [], nota: dados.error.summary }

      const achados = Object.entries(dados.vulnerabilities || {})
        .filter(([, v]) => ['moderate', 'high', 'critical'].includes(v.severity))
        .map(([nome, v]) => ({
          gravidade: v.severity === 'moderate' ? 'media' : 'alta',
          titulo: `${nome}: ${v.severity}`,
          onde: 'dependências',
          conserto: v.fixAvailable ? 'npm audit fix' : 'sem correção publicada ainda',
        }))
      return { ok: achados.length === 0, achados }
    },
  },

  {
    id: 'teste',
    nome: 'Testes do projeto',
    grupo: 'codigo',
    custo: 'grátis',
    duracao: 'segundos',
    explica: 'Roda o `npm test` do próprio projeto, se existir.',
    aplicaA: (raiz) => {
      try {
        return Boolean(JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).scripts?.test)
      } catch { return false }
    },
    async rodar(raiz) {
      const r = await cmd('npm', ['test', '--silent'], { cwd: raiz, timeout: 300_000 })
      if (r.ok) return { ok: true, achados: [] }
      const ultima = String(r.saida || r.erro).trim().split('\n').slice(-3).join(' ')
      return {
        ok: false,
        achados: [{
          gravidade: 'alta',
          titulo: 'a suíte de testes falhou',
          onde: 'npm test',
          conserto: ultima.slice(0, 200) || 'rodar `npm test` para ver a saída',
        }],
      }
    },
  },

  {
    id: 'zona-restrita',
    nome: 'Zona restrita sem login',
    grupo: 'dado',
    custo: 'grátis',
    duracao: 'segundos',
    explica: 'Chama /admin, /dashboard e /.env sem sessão, e exige que não respondam conteúdo.',
    aplicaA: (raiz, cfg) => Boolean(cfg?.alvo),
    async rodar(raiz, cfg) {
      const base = String(cfg?.alvo || '').replace(/\/+$/, '')
      if (!base) return { ok: true, achados: [], nota: 'sem alvo configurado' }
      const achados = []
      for (const rota of ['/admin', '/dashboard', '/.env', '/.git/config']) {
        try {
          const r = await fetch(base + rota, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
          // 2xx sem sessão é o achado: a rota devolveu conteúdo para qualquer um
          if (r.status >= 200 && r.status < 300) {
            achados.push({
              gravidade: 'alta',
              titulo: `${rota} responde ${r.status} sem login`,
              onde: base + rota,
              conserto: 'exigir sessão nessa rota, devolvendo 401, 403 ou redirect',
            })
          }
        } catch { /* fora do ar ou timeout não é achado de segurança */ }
      }
      return { ok: achados.length === 0, achados }
    },
  },
]

export const camadaDe = (id) => CAMADAS.find((c) => c.id === id) || null

/** As camadas que fazem sentido neste projeto. `aplicaA` que explode não pode
 *  derrubar a lista inteira: camada com defeito some, o resto continua. */
export function camadasDe(raiz, cfg = {}) {
  return CAMADAS.filter((c) => {
    try { return c.aplicaA(raiz, cfg) } catch { return false }
  })
}
