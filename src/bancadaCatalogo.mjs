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
    grupo: 'dados',
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

  /**
   * Segredo no HISTÓRICO, sem Gitleaks.
   *
   * O Gitleaks é a ferramenta prevista e não está instalado aqui. Mas o git
   * sozinho resolve o essencial: `git log -G<regex>` acha o commit que
   * INTRODUZIU um padrão, e é justamente isso que se procura.
   *
   * **Por que esta camada existe separada da de código:** apagar o arquivo não
   * apaga o commit. Um segredo removido ontem continua clonável hoje por quem
   * tiver o repositório — e o repositório deste projeto é público.
   */
  {
    id: 'segredo-historico',
    nome: 'Segredo no histórico',
    grupo: 'segredo',
    custo: 'grátis',
    duracao: 'segundos',
    ferramenta: 'git log -G (o Gitleaks faria mais, e não está instalado)',
    explica: 'Chave, token e senha em QUALQUER commit do histórico — não só no código de agora. Apagar o arquivo não apaga o commit.',
    aplicaA: (raiz) => fs.existsSync(path.join(raiz, '.git')),
    async rodar(raiz) {
      const achados = []
      for (const p of PADROES_SEGREDO) {
        // `-G` procura a EXPRESSÃO no diff; `--all` cobre todos os ramos
        const r = await exec('git', ['log', '--all', '-G', p.re.source, '--format=%h %ad %s', '--date=short'], {
          cwd: raiz, maxBuffer: 4 * 1024 * 1024, timeout: 30_000,
        }).catch(() => null)
        if (!r?.stdout?.trim()) continue

        for (const linha of r.stdout.trim().split('\n').slice(0, 10)) {
          const [hash, data, ...resto] = linha.split(' ')
          achados.push({
            gravidade: 'alta',
            titulo: `${p.nome} entrou num commit`,
            onde: `${hash} · ${data} · ${resto.join(' ').slice(0, 60)}`,
            conserto: 'rotacione a credencial. Reescrever o histórico não basta: quem já clonou continua com ela.',
          })
        }
      }
      return { ok: achados.length === 0, achados }
    },
  },

  /**
   * A `service_role` do Supabase onde ela nunca pode estar.
   *
   * É a chave que **ignora todas as regras de acesso**. No servidor é normal;
   * em qualquer coisa que chegue ao navegador é o fim da linha — quem abrir o
   * DevTools lê o banco inteiro.
   *
   * Ele tem Supabase em produção nesta VPS, então a camada vale de verdade.
   */
  {
    id: 'service-role',
    nome: 'Caça à service_role',
    grupo: 'dados',
    custo: 'grátis',
    duracao: 'segundos',
    explica: 'A chave que ignora TODAS as regras de acesso, procurada onde ela nunca deveria estar: código de navegador, bundle, arquivo público.',
    aplicaA: () => true,
    async rodar(raiz) {
      const achados = []
      /* Pasta que vira navegador. `.env` fica FORA: lá a chave é legítima, e
         acusá-la seria o alarme falso que faz desligar a camada. */
      const perigosas = /(^|[\\/])(public|static|assets|dist|build|components?|pages|app|src[\\/](app|pages|components))([\\/]|$)/i
      const RE_SERVICE = /service_role|SUPABASE_SERVICE_ROLE|supabaseServiceRole/

      for (const arquivo of arquivosDe(raiz)) {
        const rel = path.relative(raiz, arquivo)
        if (/(^|[\\/])\.env/.test(rel)) continue
        let texto = ''
        try {
          if (fs.statSync(arquivo).size > 2 * 1024 * 1024) continue
          texto = fs.readFileSync(arquivo, 'utf8')
        } catch { continue }
        if (!RE_SERVICE.test(texto)) continue

        const noNavegador = perigosas.test(rel)
        const linha = texto.split('\n').findIndex((l) => RE_SERVICE.test(l)) + 1
        achados.push({
          gravidade: noNavegador ? 'alta' : 'média',
          titulo: noNavegador
            ? 'service_role em código que vai para o navegador'
            : 'service_role citada no código',
          onde: `${rel}:${linha}`,
          conserto: noNavegador
            ? 'tire daí AGORA e rotacione a chave: quem abrir o DevTools lê o banco inteiro'
            : 'confirme que este arquivo só roda no servidor, e que a chave vem de variável de ambiente',
        })
      }
      return { ok: !achados.some((a) => a.gravidade === 'alta'), achados }
    },
  },

  /**
   * Certificado e TLS dos domínios que estão no ar, com o `tls` do Node.
   *
   * O `testssl.sh` faria muito mais (cifras, protocolos velhos, vulnerabilidades
   * nomeadas). O que cabe sem dependência é o que mais dói na prática:
   * **certificado vencendo**. Renovação automática falha em silêncio, e o site
   * cai num sábado.
   */
  {
    id: 'tls',
    nome: 'Certificado e TLS',
    grupo: 'rede',
    custo: 'grátis',
    duracao: 'segundos',
    ferramenta: 'node:tls (o testssl.sh faria mais, e não está instalado)',
    explica: 'Quanto falta para o certificado de cada domínio vencer. Renovação automática falha calada, e o site cai no fim de semana.',
    aplicaA: (raiz, cfg) => (cfg?.dominios || []).length > 0,
    async rodar(raiz, cfg = {}) {
      const tls = await import('node:tls')
      const achados = []

      for (const dominio of (cfg.dominios || []).slice(0, 20)) {
        const cert = await new Promise((resolve) => {
          const s = tls.connect({ host: dominio, port: 443, servername: dominio, timeout: 8000 }, () => {
            const c = s.getPeerCertificate()
            s.end()
            resolve(c)
          })
          s.on('error', (e) => resolve({ erro: String(e.message || e) }))
          s.on('timeout', () => { s.destroy(); resolve({ erro: 'tempo esgotado' }) })
        })

        if (cert?.erro) {
          achados.push({
            gravidade: 'alta', titulo: 'não consegui falar com o domínio',
            onde: dominio, conserto: `verifique se está no ar: ${cert.erro}`,
          })
          continue
        }
        const dias = Math.round((new Date(cert.valid_to) - Date.now()) / 86400000)
        if (dias < 21) {
          achados.push({
            gravidade: dias < 7 ? 'alta' : 'média',
            titulo: dias < 0 ? 'certificado VENCIDO' : `certificado vence em ${dias} dias`,
            onde: `${dominio} · ${cert.issuer?.O || 'emissor desconhecido'}`,
            conserto: 'confira o certbot.timer — renovação automática falha em silêncio',
          })
        }
      }
      return { ok: achados.length === 0, achados }
    },
  },

  /* ==================== as declaradas, ainda sem execução ====================
     Decisão dele em 15/08: *"a bancada precisa ter todas as camadas, mas poder
     rodar elas individualmente"*.

     Declarar sem implementar tem valor próprio, e é o motivo de estarem aqui:
     o catálogo passa a ser **o mapa do que existe para verificar**, e não a
     lista do que eu já escrevi. Ele decide o que vale ligar olhando a lista
     inteira, não a metade que coube num dia.

     `rodar` ausente = a tela mostra a camada, explica o que ela pegaria, e diz
     que falta implementar. Nunca finge que rodou. */
  ...[
    { id: 'pacote-malicioso', nome: 'Pacote malicioso', grupo: 'suprimento', custo: 'grátis', duracao: 'segundos',
      ferramenta: 'npm audit signatures + Socket',
      explica: 'Pacote MALICIOSO, não só vulnerável: script de instalação, código ofuscado, acesso de rede novo. Pega ataque de cadeia antes de existir CVE.' },
    { id: 'container', nome: 'Container e infraestrutura', grupo: 'suprimento', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'Trivy',
      explica: 'Imagem Docker, Dockerfile e config de infra. Vale para a VPS, que roda 22 containers.' },
    { id: 'segredo-vivo', nome: 'Segredo que ainda funciona', grupo: 'segredo', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'TruffleHog',
      explica: 'Dos segredos achados, quais ainda respondem. Faz a chamada e confirma — transforma 200 alarmes em 3 reais.' },
    { id: 'estatico', nome: 'Análise estática', grupo: 'codigo', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'Semgrep',
      explica: '2000+ regras OWASP rodando local, sem subir código. Determinístico: mesma entrada, mesmo resultado.' },
    { id: 'autonomo', nome: 'Auditoria autônoma', grupo: 'codigo', custo: 'token do plano', duracao: 'minutos a horas',
      ferramenta: 'Sandyaa',
      explica: 'Bug de lógica e de fluxo de dados, com prova de conceito gerada. É a camada cara: roda sob pedido, nunca junto das outras.' },
    { id: 'navegador', nome: 'Navegador de verdade', grupo: 'runtime', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'Playwright',
      explica: 'A tela como o usuário vê. Pega o que teste de unidade não pega — 545 testes verdes já conviveram com a tela quebrada.' },
    { id: 'navegador-remoto', nome: 'Navegador remoto', grupo: 'runtime', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'skill remote-browser',
      explica: 'O Chrome que já roda na VPS. Hoje exige um token guardado em pasta de root, e o guarda de segredo (com razão) não deixa lê-lo.' },
    { id: 'exposicao', nome: 'Exposição na internet', grupo: 'rede', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'Nuclei',
      explica: 'O que responde de fora: painel aberto, rota administrativa, arquivo esquecido no servidor.' },
    { id: 'passiva', nome: 'Varredura passiva', grupo: 'rede', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'OWASP ZAP baseline',
      explica: 'Navega o site sem atacar e aponta o que está exposto. Seguro de rodar em produção.' },
    { id: 'rls-supabase', nome: 'Sonda de RLS do Supabase', grupo: 'dados', custo: 'grátis', duracao: 'segundos',
      explica: 'Tenta ler tabela como anônimo. RLS mal configurado é o furo mais comum e mais caro em projeto com Supabase.' },
    { id: 'eval-prompt', nome: 'Eval de prompt', grupo: 'ia', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'promptfoo',
      explica: 'O prompt continua respondendo o que devia depois de uma mudança. É teste de regressão para IA.' },
    { id: 'ataque-modelo', nome: 'Ataque ao modelo', grupo: 'ia', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'promptfoo redteam / Garak',
      explica: 'Injeção de prompt e vazamento de instrução. Vale para o Pierre, que recebe documento de terceiro.' },
  ].map((c) => ({ ...c, aplicaA: () => true, implementada: false })),
]

/** Marca as que têm execução de verdade. A distinção existe para a tela nunca
 *  oferecer um botão que não faz nada — declarada aparece, mas não promete. */
for (const c of CAMADAS) if (c.implementada === undefined) c.implementada = typeof c.rodar === 'function'

export const camadaDe = (id) => CAMADAS.find((c) => c.id === id) || null

/** As camadas que fazem sentido neste projeto. `aplicaA` que explode não pode
 *  derrubar a lista inteira: camada com defeito some, o resto continua. */
export function camadasDe(raiz, cfg = {}) {
  return CAMADAS.filter((c) => {
    try { return c.aplicaA(raiz, cfg) } catch { return false }
  })
}
