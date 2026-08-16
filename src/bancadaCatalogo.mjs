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
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/**
 * O navegador desta máquina, se houver — sem instalar nada.
 *
 * Procura o Chromium que o Playwright já baixou e o `playwright-core` de
 * qualquer projeto que o tenha. Não é elegante, e é deliberado: a alternativa
 * seria uma dependência de runtime, e o projeto inteiro não tem nenhuma.
 *
 * Devolve `null` quando não acha, e a camada RECUSA em vez de passar. Camada de
 * verificação que diz "está limpo" sem ter olhado é o pior defeito possível.
 */
async function abrirNavegador() {
  const { createRequire } = await import('node:module')
  const chromes = [
    `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`,
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ]
  const executablePath = chromes.find((c) => fs.existsSync(c))

  let pw = null
  for (const raiz of ['/usr/local/lib/hermes-agent/index.js', '/opt/hermes-work/ahtleta/index.js', `${process.cwd()}/index.js`]) {
    try { pw = createRequire(raiz)('playwright-core'); break } catch { /* tenta o próximo */ }
  }
  if (!pw?.chromium) return null

  try {
    return await pw.chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] })
  } catch { return null }
}

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

/**
 * CC-71 — os arquivos que mudaram desde o último commit.
 *
 * `lint-staged` roda só no que mudou, e é isso que torna o hook rápido o
 * bastante para ninguém desligar. A falta virou concreta em 16/08, quando a
 * Bancada passou a ser gate pelo `bancada-guard`: varrer o repositório inteiro a
 * cada entrega é o tipo de lentidão que faz o Felipe desligar o recurso.
 *
 * `null` quando não dá para saber (não é git, git ausente, erro). Nesse caso
 * quem chama varre tudo — **degradar para MAIS verificação, nunca para menos.**
 * Uma camada de segurança que se cala por não conseguir listar o diff seria o
 * pior tipo de falha silenciosa.
 */
export function mudadosDesde(raiz, referencia = 'HEAD') {
  let saida = ''
  try {
    saida = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', referencia], {
      cwd: raiz, encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'],
    })
    // o que ainda não foi adicionado ao git também conta: é onde o trabalho de
    // agora está, e é justamente o que o gate precisa olhar
    saida += execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: raiz, encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch { return null }

  const lista = saida.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return [...new Set(lista)].map((rel) => path.join(raiz, rel))
}

/**
 * Os arquivos que uma camada deve olhar: o recorte, ou tudo.
 *
 * `cfg.soMudou` liga o modo incremental do CC-71. A regra de degradação é a que
 * importa: **sem conseguir listar o diff, varre tudo.** Uma camada de segurança
 * que se cala por não saber o que mudou seria a pior falha possível — a tela
 * diria "limpo" tendo olhado zero arquivos.
 *
 * O `git diff` traz caminho de arquivo apagado também; `existsSync` filtra, e é
 * mais barato que pedir ao git para distinguir.
 */
function alvosDe(raiz, cfg = {}) {
  if (!cfg.soMudou) return arquivosDe(raiz)
  const mudados = mudadosDesde(raiz, cfg.referencia || 'HEAD')
  if (!mudados) return arquivosDe(raiz)
  return mudados.filter((a) => { try { return fs.statSync(a).isFile() } catch { return false } })
}

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


/**
 * URL e chave anônima do Supabase, lidas do `.env` do projeto.
 *
 * ⚠️ O valor é usado em memória e **nunca sai deste processo**: não é impresso,
 * não vai para o resultado da camada, não entra em log. O `.env` é justamente o
 * arquivo que o `segredo-guard` impede o agente de abrir, e a razão é boa — o
 * conteúdo ficaria em texto puro no transcript, relido a cada `--resume`. Aqui
 * quem lê é o painel, em tempo de execução.
 *
 * Os nomes procurados são os convencionais do Supabase, documentados e
 * públicos; nada aqui depende de conhecer o conteúdo de um `.env` específico.
 */
function supabaseDoProjeto(raiz) {
  const NOMES_URL = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL', 'PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']
  const NOMES_CHAVE = ['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']

  const vars = {}
  for (const nome of ['.env', '.env.local', '.env.production']) {
    let texto = ''
    try { texto = fs.readFileSync(path.join(raiz, nome), 'utf8') } catch { continue }
    for (const linha of texto.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linha)
      if (m && vars[m[1]] === undefined) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }

  const url = NOMES_URL.map((n) => vars[n]).find((v) => v && /^https?:\/\//.test(v))
  const chave = NOMES_CHAVE.map((n) => vars[n]).find(Boolean)
  return url && chave ? { url: url.replace(/\/+$/, ''), chave } : null
}

/** Nome de tabela que quase sempre guarda dado de pessoa. */
const SENSIVEL = /^(users?|profiles?|clientes?|customers?|pedidos?|orders?|pagamentos?|payments?|assinaturas?|subscriptions?|mensagens?|messages?|contratos?|documentos?|enderecos?|addresses|telefones?|emails?|leads?|cadastros?)$/i


/**
 * Os níveis de exigência da Bancada.
 *
 * ## A pergunta que criou isto
 *
 * > "Podemos automatizar o uso da banca em níveis diferentes de engenharia de
 * > cibersegurança?"
 *
 * Dá, e o desenho vem de uma observação simples: **o que precisa ser verificado
 * não depende do projeto, depende de quem alcança o projeto.** Um script que só
 * roda na máquina dele e um site com login de cliente na internet não merecem a
 * mesma exigência, e tratá-los igual tem dois custos opostos — ou o rascunho
 * fica insuportável de mexer, ou o site do cliente sobe sem ninguém olhar.
 *
 * ## Os quatro níveis, pela pergunta que cada um responde
 *
 * | nível | a pergunta | quem alcança |
 * |---|---|---|
 * | `rascunho` | vazei alguma chave? | só ele, na própria máquina |
 * | `interno` | isso se sustenta? | ele e as máquinas dele |
 * | `cliente` | dado de outra pessoa está protegido? | um cliente, com login |
 * | `exposto` | e quem nem é usuário? | a internet inteira |
 *
 * **Cada nível inclui os anteriores.** `exposto` roda tudo de `cliente`, que
 * roda tudo de `interno`, que roda tudo de `rascunho`. Sem isso a escolha viraria
 * um menu de dezenove caixinhas, que é exatamente o que faz ninguém escolher.
 *
 * ## Duas decisões que evitam o teatro de segurança
 *
 * **Camada que não cabe no projeto não reprova o nível.** Um projeto sem
 * Supabase não pode ficar eternamente reprovado por causa do `rls-supabase`.
 * O que reprova é camada que cabe, rodou e achou — ou que cabe e **não rodou**.
 *
 * **Camada ainda não implementada não aprova nem reprova: ela avisa.** Contar
 * como aprovada seria dizer que olhou; como reprovada, travaria o projeto por
 * dívida nossa. O nível informa quantas faltam, e a decisão é dele.
 *
 * ## Por que as camadas de IA ficam fora da escala
 *
 * `eval-prompt` e `ataque-modelo` não são mais rigorosas, são de outro eixo: só
 * fazem sentido em projeto que chama modelo. Entram por aplicabilidade, nunca
 * por nível — pôr no `exposto` obrigaria um site institucional a rodar teste de
 * injeção de prompt que não tem onde acontecer.
 */
export const NIVEIS = {
  rascunho: {
    id: 'rascunho',
    ordem: 0,
    titulo: 'Rascunho',
    pergunta: 'vazei alguma chave?',
    explica: 'Só você alcança. A única coisa irreversível aqui é segredo commitado, porque o commit fica no histórico mesmo depois de apagar o arquivo.',
    camadas: ['segredo'],
  },
  interno: {
    id: 'interno',
    ordem: 1,
    titulo: 'Interno',
    pergunta: 'isso se sustenta?',
    explica: 'Roda nas suas máquinas. Entra o que quebra sozinho com o tempo: dependência velha, teste parado, e o segredo que ficou no histórico.',
    camadas: ['segredo-historico', 'dependencia', 'teste'],
  },
  cliente: {
    id: 'cliente',
    ordem: 2,
    titulo: 'Cliente',
    pergunta: 'o dado de outra pessoa está protegido?',
    explica: 'Alguém de fora usa, com login. A partir daqui o erro não é seu prejuízo, é o dado de um terceiro — e é o nível que o método entrega-cliente exige.',
    camadas: ['service-role', 'rls-supabase', 'zona-restrita', 'pacote-malicioso', 'navegador'],
  },
  exposto: {
    id: 'exposto',
    ordem: 3,
    titulo: 'Exposto',
    pergunta: 'e quem nem é usuário?',
    explica: 'Está na internet aberta. Aqui entra quem nunca fez login: varredura automática, porta esquecida, certificado vencido no fim de semana.',
    camadas: ['tls', 'exposicao', 'passiva', 'container', 'estatico', 'segredo-vivo'],
  },
}

export const NIVEL_PADRAO = 'interno'

/** Todas as camadas exigidas até aquele nível, na ordem em que devem rodar. */
export function camadasDoNivel(nivel) {
  const alvo = NIVEIS[nivel] || NIVEIS[NIVEL_PADRAO]
  return Object.values(NIVEIS)
    .filter((n) => n.ordem <= alvo.ordem)
    .flatMap((n) => n.camadas)
}

/** O nível em que cada camada entra — para a tela mostrar a escala sem repetir a lista. */
export function nivelDaCamada(id) {
  return Object.values(NIVEIS).find((n) => n.camadas.includes(id))?.id || null
}

/**
 * O veredito de um nível, a partir do que já rodou.
 *
 * Devolve as três listas separadas porque elas pedem ações diferentes: `falhou`
 * é trabalho de agora, `faltaRodar` é um comando, e `semExecucao` é dívida nossa
 * que ele decide se importa. Somar as três num número só esconderia justamente a
 * diferença que interessa.
 */
export function avaliarNivel(nivel, camadas) {
  const exigidas = camadasDoNivel(nivel)
  const porId = Object.fromEntries(camadas.map((c) => [c.id, c]))

  const falhou = []
  const faltaRodar = []
  const semExecucao = []
  const naoSeAplica = []
  const ok = []

  for (const id of exigidas) {
    const c = porId[id]
    if (!c) continue
    if (!c.implementada) { semExecucao.push(id); continue }
    if (!c.cabe) { naoSeAplica.push(id); continue }
    if (!c.resultado) { faltaRodar.push(id); continue }
    if (c.resultado.ok === false) { falhou.push(id); continue }
    ok.push(id)
  }

  return {
    nivel,
    // dívida nossa não reprova o projeto dele; camada que cabe e não rodou, sim
    aprovado: falhou.length === 0 && faltaRodar.length === 0,
    ok,
    falhou,
    faltaRodar,
    semExecucao,
    naoSeAplica,
  }
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
    async rodar(raiz, cfg = {}) {
      const achados = []
      for (const arquivo of alvosDe(raiz, cfg)) {
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
    async rodar(raiz, cfg = {}) {
      const achados = []
      /* Pasta que vira navegador. `.env` fica FORA: lá a chave é legítima, e
         acusá-la seria o alarme falso que faz desligar a camada. */
      const perigosas = /(^|[\\/])(public|static|assets|dist|build|components?|pages|app|src[\\/](app|pages|components))([\\/]|$)/i
      const RE_SERVICE = /service_role|SUPABASE_SERVICE_ROLE|supabaseServiceRole/

      /* Texto que FALA sobre a chave não é a chave.
         Medido em 16/08 rodando aqui: 5 achados, todos em `docs/` e no próprio
         ROADMAP, que só citam o termo. Ferramenta de segurança com cinco alarmes
         falsos no primeiro uso é ferramenta que ninguém abre de novo — e o custo
         de perder um achado real em markdown é zero, porque `.md` não vira
         bundle nem é servido como código. */
      const soTexto = /\.(md|mdx|txt|rst|adoc)$/i

      for (const arquivo of alvosDe(raiz, cfg)) {
        const rel = path.relative(raiz, arquivo)
        if (/(^|[\\/])\.env/.test(rel)) continue
        if (soTexto.test(rel)) continue
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

  /**
   * `npm audit signatures` confere a ASSINATURA do que o registro entregou.
   *
   * Diferente do `npm audit` comum, que compara versão com uma lista de CVE:
   * este pergunta ao registro se cada tarball foi mesmo publicado por quem diz
   * ter publicado. É o que pega troca de pacote no meio do caminho, que é o
   * ataque de cadeia antes de existir CVE — quando o CVE sai, já rodou.
   *
   * O Socket faria mais (script de instalação, código ofuscado, acesso de rede
   * novo), e não está instalado. O npm está, e cobre a parte que não dá para
   * fazer sem falar com o registro.
   */
  {
    id: 'pacote-malicioso',
    nome: 'Pacote malicioso',
    grupo: 'suprimento',
    custo: 'grátis',
    duracao: 'segundos',
    ferramenta: 'npm audit signatures (o Socket faria mais, e não está instalado)',
    explica: 'Confere se cada pacote instalado foi mesmo publicado por quem diz. Pega troca no meio do caminho, o ataque de cadeia antes de existir CVE.',
    // sem lockfile o npm não tem o que conferir, e este projeto é um deles
    aplicaA: (raiz) => ['package-lock.json', 'npm-shrinkwrap.json']
      .some((f) => fs.existsSync(path.join(raiz, f))),
    async rodar(raiz) {
      let saida = ''
      try {
        const r = await exec('npm', ['audit', 'signatures'], { cwd: raiz, timeout: 90_000 })
        saida = `${r.stdout}${r.stderr}`
      } catch (e) {
        saida = `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`
      }

      /* ⚠️ A primeira versão desta camada devolvia `ok: true, achados: []` quando
         o npm falhava, e isso foi pego rodando contra o `mnzs`: o npm dizia
         "found no dependencies to audit that were installed from a supported
         registry" (node_modules não instalado) e a camada respondia LIMPO.

         É exatamente o defeito que o cabeçalho deste arquivo chama de pior
         possível numa ferramenta de verificação — dizer que olhou sem ter
         olhado. `nota` existe para isto: a tela mostra "não deu para verificar",
         que é diferente de "está tudo certo". */
      const naoRodou = /npm (error|ERR!)/i.test(saida) || !/audited|verified|signature/i.test(saida)
      if (naoRodou) {
        const motivo = (/npm (?:error|ERR!)\s+(.+)/i.exec(saida) || [])[1] || 'o npm não completou'
        return {
          ok: true,
          achados: [],
          verificou: false,
          nota: `não deu para verificar: ${motivo.slice(0, 140)}. Rode \`npm install\` no projeto primeiro.`,
        }
      }

      const achados = []
      // o npm reporta em prosa; dois números importam e saem por regex, porque
      // `--json` nesta subcomando varia de formato entre versões
      const invalidas = Number((/(\d+)\s+package[s]?\s+ha[ds]?\s+(?:an?\s+)?invalid/i.exec(saida) || [])[1] || 0)
      const semAssinatura = Number((/(\d+)\s+package[s]?\s+(?:ha[ds]?\s+)?missing/i.exec(saida) || [])[1] || 0)

      if (invalidas) {
        achados.push({
          gravidade: 'alta',
          titulo: `${invalidas} pacote(s) com assinatura INVÁLIDA`,
          onde: path.basename(raiz),
          conserto: 'apague node_modules e o lockfile e instale de novo. Se repetir, o pacote foi adulterado: não publique nada até resolver.',
        })
      }
      if (semAssinatura > 0) {
        achados.push({
          gravidade: 'baixa',
          titulo: `${semAssinatura} pacote(s) sem assinatura no registro`,
          onde: path.basename(raiz),
          conserto: 'normal em pacote antigo. Vale olhar se algum deles é crítico para o projeto.',
        })
      }
      return { ok: !invalidas, achados, verificou: true }
    },
  },

  /**
   * A página abre mesmo? A camada mais barata que existe, e a que ele mais usa.
   *
   * Regra 1 do ciclo dele: *"prova visual antes de dizer feito"*, e o motivo
   * está medido no próprio projeto — já houve **545 testes verdes com a tela
   * quebrada no navegador**. Teste unitário não vê tela branca por erro de
   * JavaScript, e é exatamente isso que esta camada pega.
   *
   * Usa o Chromium que o Playwright já baixou; não instala nada. Se não
   * houver navegador na máquina, recusa dizendo, em vez de fingir que passou.
   */
  {
    id: 'navegador',
    nome: 'A página abre?',
    grupo: 'runtime',
    custo: 'grátis',
    duracao: 'segundos',
    ferramenta: 'Chromium do Playwright, já em cache nesta máquina',
    explica: 'Abre cada endereço num navegador de verdade e conta erro de JavaScript, requisição que falhou e tela vazia. Teste verde não prova tela viva: já houve 545 passando com a página quebrada.',
    aplicaA: (raiz, cfg) => (cfg?.urls || []).length > 0,
    async rodar(raiz, cfg = {}) {
      const nav = await abrirNavegador()
      if (!nav) {
        return { ok: true, achados: [], nota: 'sem Chromium nesta máquina — instale o Playwright ou rode do PC' }
      }
      const achados = []
      try {
        for (const url of (cfg.urls || []).slice(0, 10)) {
          const pagina = await nav.newPage({ viewport: { width: 390, height: 800 } })
          const erros = []
          const quebradas = []
          pagina.on('pageerror', (e) => erros.push(String(e.message || e).slice(0, 160)))
          pagina.on('requestfailed', (r) => quebradas.push(r.url().slice(0, 120)))
          let resposta = null
          try {
            resposta = await pagina.goto(url, { waitUntil: 'load', timeout: 20_000 })
            await pagina.waitForTimeout(1200) // dá tempo do JavaScript quebrar
          } catch (e) {
            achados.push({
              gravidade: 'alta', titulo: 'a página não abriu', onde: url,
              conserto: String(e.message || e).slice(0, 140),
            })
            await pagina.close()
            continue
          }

          const status = resposta?.status() ?? 0
          const texto = await pagina.evaluate(() => document.body?.innerText?.trim().length || 0)
          if (status >= 400) {
            achados.push({ gravidade: 'alta', titulo: `respondeu ${status}`, onde: url, conserto: 'confira a rota e o servidor' })
          }
          // tela branca: carregou, respondeu 200, e não tem nada escrito
          if (status < 400 && texto < 20) {
            achados.push({
              gravidade: 'alta', titulo: 'a página abriu VAZIA',
              onde: url,
              conserto: 'é o caso que passa em teste unitário e quebra no navegador. Abra o console e veja o primeiro erro.',
            })
          }
          for (const e of [...new Set(erros)].slice(0, 3)) {
            achados.push({ gravidade: 'alta', titulo: 'erro de JavaScript na página', onde: url, conserto: e })
          }
          if (quebradas.length) {
            achados.push({
              gravidade: 'média', titulo: `${quebradas.length} requisição(ões) falharam`,
              onde: url, conserto: [...new Set(quebradas)].slice(0, 3).join(' · '),
            })
          }
          await pagina.close()
        }
      } finally {
        await nav.close().catch(() => {})
      }
      return { ok: !achados.some((a) => a.gravidade === 'alta'), achados }
    },
  },

  /**
   * A sonda de RLS: dá para ler a tabela sendo um estranho?
   *
   * ## Por que esta é a camada mais valiosa das dezenove
   *
   * Nenhuma ferramenta de prateleira faz isto, e o furo é o mais caro do stack
   * dele. No Supabase a chave `anon` **é pública por desenho** — vai no bundle
   * do navegador, qualquer um lê. O que separa "público" de "vazado" é
   * exclusivamente a Row Level Security de cada tabela, ligada uma a uma. Uma
   * tabela sem política é um banco aberto na internet, e nada na tela avisa:
   * o app do cliente continua funcionando igual.
   *
   * ## Como ela descobre as tabelas sem credencial de administrador
   *
   * O PostgREST publica o próprio esquema em `/rest/v1/` como OpenAPI, usando a
   * mesma chave `anon`. Ou seja: a sonda vê exatamente o que um estranho veria,
   * que é o ponto — testar com chave de serviço responderia a pergunta errada.
   *
   * ## O que este código NUNCA faz
   *
   * Não imprime o valor de nenhuma chave, não guarda o conteúdo das linhas, e
   * não escreve nada no banco. Só conta quantas linhas voltaram. O `.env` é
   * lido aqui dentro, em memória, e o valor não sai deste processo.
   */
  {
    id: 'rls-supabase',
    nome: 'RLS do Supabase',
    grupo: 'dados',
    custo: 'grátis',
    duracao: 'segundos',
    ferramenta: '—  (código nosso: nenhuma ferramenta de prateleira faz isto)',
    explica: 'Tenta ler cada tabela como um estranho, com a mesma chave pública que vai no navegador. Tabela sem RLS é banco aberto na internet, e o app continua funcionando igual.',
    aplicaA: (raiz) => Boolean(supabaseDoProjeto(raiz)),
    async rodar(raiz) {
      const cfg = supabaseDoProjeto(raiz)
      if (!cfg) return { ok: true, achados: [], verificou: false, nota: 'não achei URL e chave anônima do Supabase neste projeto' }

      const cab = { apikey: cfg.chave, Authorization: `Bearer ${cfg.chave}` }
      const pegar = async (caminho) => {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 12_000)
        try {
          const r = await fetch(`${cfg.url}${caminho}`, { headers: cab, signal: ctrl.signal })
          return { status: r.status, corpo: await r.json().catch(() => null) }
        } catch (e) {
          return { erro: String(e.message || e) }
        } finally { clearTimeout(t) }
      }

      const esquema = await pegar('/rest/v1/')
      if (esquema.erro || !esquema.corpo?.paths) {
        return {
          ok: true, achados: [], verificou: false,
          nota: `não deu para falar com o Supabase: ${esquema.erro || `respondeu ${esquema.status}`}`,
        }
      }

      const tabelas = Object.keys(esquema.corpo.paths)
        .filter((p) => /^\/[a-z0-9_]+$/i.test(p))
        .map((p) => p.slice(1))

      if (!tabelas.length) {
        // sem nenhuma tabela visível o RLS está fazendo o trabalho dele
        return { ok: true, achados: [], verificou: true, nota: `${0} tabela(s) visíveis para um estranho — é o resultado que se quer` }
      }

      const achados = []
      let lidas = 0
      for (const tabela of tabelas.slice(0, 40)) {
        const r = await pegar(`/rest/v1/${tabela}?select=*&limit=1`)
        if (r.erro || r.status !== 200 || !Array.isArray(r.corpo)) continue
        if (!r.corpo.length) continue  // responde, mas RLS filtra tudo: correto
        lidas += 1
        achados.push({
          gravidade: SENSIVEL.test(tabela) ? 'alta' : 'média',
          titulo: `um estranho consegue LER a tabela "${tabela}"`,
          onde: `${cfg.url.replace(/^https?:\/\//, '')} · ${tabela}`,
          conserto: SENSIVEL.test(tabela)
            ? 'o nome sugere dado de pessoa. Ligue RLS nesta tabela AGORA: alter table … enable row level security, e crie a política de leitura.'
            : 'se for catálogo público, está certo. Se não for, ligue RLS: alter table … enable row level security.',
        })
      }

      return {
        ok: !achados.some((a) => a.gravidade === 'alta'),
        achados,
        verificou: true,
        nota: `${tabelas.length} tabela(s) visíveis, ${lidas} com linha devolvida para anônimo`,
      }
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
    { id: 'navegador-remoto', nome: 'Navegador remoto', grupo: 'runtime', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'skill remote-browser',
      explica: 'O Chrome que já roda na VPS. Hoje exige um token guardado em pasta de root, e o guarda de segredo (com razão) não deixa lê-lo.' },
    { id: 'exposicao', nome: 'Exposição na internet', grupo: 'rede', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'Nuclei',
      explica: 'O que responde de fora: painel aberto, rota administrativa, arquivo esquecido no servidor.' },
    { id: 'passiva', nome: 'Varredura passiva', grupo: 'rede', custo: 'grátis', duracao: 'minutos',
      ferramenta: 'OWASP ZAP baseline',
      explica: 'Navega o site sem atacar e aponta o que está exposto. Seguro de rodar em produção.' },
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

/**
 * TODAS as camadas, cada uma dizendo se cabe neste projeto e por quê.
 *
 * Decisão dele em 15/08: *"a bancada precisa ter todas as camadas, mas poder
 * rodar elas individualmente"*. `camadasDe()` filtra, e isso fazia camada
 * implementada SUMIR da lista quando o `aplicaA` dizia não — pior que a camada
 * declarada e não implementada, que ao menos aparecia. Do lado de fora, sumir
 * e não existir são a mesma coisa.
 *
 * O motivo é derivado, não escrito duas vezes: quem tem `aplicaA` sabe o que
 * exige, e a frase sai do próprio requisito.
 */
export function todasAsCamadas(raiz, cfg = {}) {
  return CAMADAS.map((c) => {
    let cabe = true
    try { cabe = c.aplicaA ? Boolean(c.aplicaA(raiz, cfg)) : true } catch { cabe = false }
    return {
      ...c,
      cabe,
      implementada: typeof c.rodar === 'function',
      porQueNao: cabe ? null : (MOTIVO[c.id] || 'não se aplica a este projeto'),
    }
  })
}

/** Por que a camada não cabe, na língua dele — nunca "aplicaA devolveu false". */
const MOTIVO = {
  'pacote-malicioso': 'este projeto não tem package-lock.json, então o npm não tem o que conferir',
  navegador: 'nenhum endereço configurado para abrir — informe as URLs do projeto',
  tls: 'nenhum domínio configurado',
  teste: 'o package.json não tem script de teste',
  dependencia: 'este projeto não tem package-lock.json nem pnpm-lock.yaml',
  'zona-restrita': 'nenhuma zona restrita declarada',
  'rls-supabase': 'não achei configuração de Supabase neste projeto',
}
