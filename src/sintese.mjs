/**
 * A síntese escrita por IA em cima dos números da tela Análise.
 *
 * ## O pedido dele, e a escolha que ele fez
 *
 * Olhando a tela Análise: *"uma da IA analisar todos esses dados e me dar uma
 * síntese"*. Perguntado quem escreveria, ele escolheu o opencode, com a razão
 * dele: *"o bom é que ele é gratuito"*.
 *
 * ## Por que a síntese é ARQUIVO, e não uma chamada ao abrir a tela
 *
 * Medido nesta VPS antes de escrever qualquer código: o opencode leva **13
 * segundos** para responder *"quanto é 2+2"*. Uma síntese sobre números de 19
 * projetos leva mais. Pedir na abertura da tela deixaria ele olhando para um
 * "pensando…" no telefone, e cobraria a espera toda vez que ele voltasse.
 *
 * Então o desenho é o mesmo do resto do painel: **quem lê, lê disco.** A tela
 * abre instantânea com o último texto e a hora em que ele foi escrito. Pedir
 * um novo é ação sob clique.
 *
 * ## O que vai para o modelo, e o que não vai
 *
 * Um resumo de poucos números, montado aqui. As rotas cruas somam centenas de
 * KB, e mandar isso seria pagar contexto para o modelo reencontrar o que este
 * arquivo já sabe achar. Também importa o que fica de fora: nada de conteúdo
 * de projeto de cliente, nada de caminho de máquina, nada de nome de arquivo.
 * A síntese fala de números, e número não vaza trabalho de ninguém.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { casaClaude } from './platform.mjs'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'
import { nomeCanonico } from './nomeProjeto.mjs'

export const MODELO = 'opencode/big-pickle'

/* Teto generoso, e o motivo está medido: 13s para a pergunta mais boba que
   existe. Uma síntese de verdade tem prompt maior e resposta maior. Um teto
   curto transformaria "demorou" em "falhou", e ele veria erro onde havia
   espera. */
const TETO_MS = 4 * 60 * 1000

export const ARQUIVO = () => path.join(casaClaude(), 'control-center-sintese.json')

/* `~/.claude` é somente leitura dentro do sandbox, e escrita nova morre ali com
   `EROFS` sem nada aparecer na tela. O abrigo é o mesmo dos outros módulos, e
   respeita `CC_HOME` para o teste nunca tocar no dado real dele. */
export const ARQUIVO_ABRIGO = () => path.join(
  path.dirname(DIR_SESSOES_ABRIGO()), 'control-center-sintese.json',
)

/**
 * Onde o binário do opencode mora.
 *
 * ⚠️ **Não basta chamar `opencode` e torcer.** Ele é instalado por npm global,
 * e `~/.npm-global/bin` não está no PATH de um serviço systemd. Foi o que fez o
 * botão "ligar" do escritório responder `ok` sem subir nada. Aqui o sintoma
 * seria pior: a síntese falharia calada e a tela mostraria o texto velho para
 * sempre.
 */
export function acharOpencode() {
  const candidatos = [
    process.env.CC_OPENCODE,
    path.join(process.env.HOME || '', '.npm-global', 'bin', 'opencode'),
    path.join(process.env.HOME || '', '.local', 'bin', 'opencode'),
    '/usr/local/bin/opencode',
    '/usr/bin/opencode',
  ].filter(Boolean)
  for (const c of candidatos) {
    try { if (fs.statSync(c).isFile()) return c } catch { /* tenta o próximo */ }
  }
  return null
}

/** Um número por linha, sem enfeite. É o que o modelo lê. */
function linha(rotulo, valor) {
  return valor === null || valor === undefined ? null : `${rotulo}: ${valor}`
}

/**
 * Os números da Análise, reduzidos ao que cabe num prompt.
 *
 * Recebe as três respostas de rota já lidas por quem chamou, em vez de buscar
 * sozinho: assim a rota HTTP não vira uma segunda fonte de verdade, e o teste
 * consegue passar dado de mentira sem subir servidor nenhum.
 */
export function resumo({ travas = null, armazem = null, bancada = null } = {}) {
  const partes = []

  /* ⚠️ **Os nomes dos campos foram MEDIDOS contra as rotas de verdade, não
     supostos.** A primeira versão usou `disparos` e `camadas[].ok`, que não
     existem: o resultado era "nenhuma regra muda" e "0 de 22 camadas passaram",
     as duas falsas. A segunda é o pior tipo de erro possível aqui, porque a
     verificação está APROVADA e o modelo concluiria o contrário com confiança.
     Síntese com número errado é pior que síntese nenhuma: ela é convincente. */
  if (travas) {
    const regras = Array.isArray(travas.regras) ? travas.regras : []
    const ajudou = regras.reduce((s, r) => s + (r.ajudou || 0), 0)
    const atrapalhou = regras.reduce((s, r) => s + (r.atrapalhou || 0), 0)
    partes.push('## As guardas (regras que barram trabalho errado)')
    partes.push(...[
      linha('regras escritas', regras.length),
      linha('vezes que barraram, nos últimos dias', (travas.eventos || []).length),
      linha('projetos alcançados', travas.alcance),
      linha('avaliadas por ele como ajudaram', ajudou),
      linha('avaliadas por ele como atrapalharam', atrapalhou),
      linha('nunca avaliadas por ele', regras.filter((r) => !r.ajudou && !r.atrapalhou).length),
    ].filter(Boolean))
    /* As regras que NUNCA dispararam são o achado mais útil desta tela, e é o
       padrão que este projeto mais repete: peça construída e desligada. */
    const mudas = regras.filter((r) => !r.vezes).map((r) => r.label || r.trava).filter(Boolean)
    if (mudas.length) partes.push(`regras que nunca dispararam (${mudas.length} de ${regras.length}): ${mudas.slice(0, 12).join(', ')}`)
    else partes.push('todas as regras já dispararam pelo menos uma vez')
  }

  if (armazem) {
    partes.push('')
    partes.push('## As medidas ao longo do tempo')
    partes.push(...[
      linha('medidas colhidas', (armazem.medidas || []).length),
      linha('projetos com série', (armazem.projetos || []).length),
      linha('dias com diário', (armazem.diario || []).length),
    ].filter(Boolean))
    const fora = (armazem.alarmes || []).filter((a) => a && a.fora)
    if (fora.length) {
      partes.push(`fora da faixa normal (${fora.length}):`)
      for (const a of fora.slice(0, 10)) {
        partes.push(`  ${a.medida}: hoje ${a.hoje}, base ${a.base}${a.projeto ? ` (${nomeCanonico(a.projeto)})` : ''}`)
      }
    } else {
      partes.push('nenhuma medida fora da faixa normal')
    }
  }

  if (bancada) {
    const camadas = Array.isArray(bancada.camadas) ? bancada.camadas : []
    const v = bancada.veredito || {}
    partes.push('')
    partes.push('## A verificação de segurança do projeto aberto')
    partes.push(...[
      linha('nível declarado', bancada.nivel),
      linha('aprovado nesse nível', v.aprovado === true ? 'sim' : v.aprovado === false ? 'não' : null),
      linha('verificações que passaram', (v.ok || []).length),
      linha('verificações que falharam', (v.falhou || []).length),
      linha('verificações que faltam rodar', (v.faltaRodar || []).length),
      linha('verificações exigidas neste nível', camadas.filter((c) => c.escolhida).length),
      linha('verificações existentes ao todo', camadas.length),
      linha('escritas mas não exigidas neste nível', camadas.filter((c) => c.implementada && !c.escolhida).length),
    ].filter(Boolean))
  }

  return partes.join('\n')
}

/** O pedido ao modelo. Fica separado para o teste poder lê-lo sem gastar nada. */
export function prompt(numeros) {
  return [
    'Você lê os números de um painel de trabalho e escreve uma síntese curta para o dono dele.',
    '',
    'REGRAS DA RESPOSTA, todas obrigatórias:',
    '- Português do Brasil.',
    '- No máximo 6 frases, em 2 ou 3 parágrafos curtos.',
    '- NUNCA use travessão nem meia-risca. Use ponto ou vírgula.',
    '- Não repita os números crus: diga o que eles significam.',
    '- Aponte o que mudou e o que está parado. Se algo parece desligado ou esquecido, diga.',
    '- Se os números não sustentam uma conclusão, diga que não dá para concluir. Não invente.',
    '- Sem saudação, sem título, sem lista. Só o texto.',
    '',
    'OS NÚMEROS:',
    '',
    numeros,
  ].join('\n')
}

/**
 * Chama o opencode e devolve o texto.
 *
 * ⚠️ **Três armadilhas deste projeto, todas aplicadas aqui:**
 * a) **`stdin` fechado, sempre.** Sem isso o opencode engole o que vier depois
 *    e executa. É a regra escrita para ele em qualquer script.
 * b) **Nada de `shell: true` com texto livre.** O prompt é conteúdo arbitrário,
 *    e concatenar na linha de comando de um shell é injeção de verdade, não
 *    questão de estilo. Vai como argumento próprio do array.
 * c) **Nada de `detached`.** Quem chama é o processo do painel, que não sai
 *    sozinho. `detached` só serve para sobreviver a quem disparou, e junto com
 *    ele a captura da saída para de funcionar.
 */
export function rodar(textoPrompt, { binario = null, modelo = MODELO, teto = TETO_MS } = {}) {
  const exe = binario || acharOpencode()
  if (!exe) return Promise.resolve({ ok: false, motivo: 'o opencode não foi encontrado nesta máquina' })

  return new Promise((resolve) => {
    let saida = ''
    let erro = ''
    let respondido = false
    const responder = (r) => { if (!respondido) { respondido = true; resolve(r) } }

    let filho
    try {
      filho = spawn(exe, ['run', '--model', modelo, textoPrompt], { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      return responder({ ok: false, motivo: String(e.message || e) })
    }

    const relogio = setTimeout(() => {
      try { filho.kill('SIGKILL') } catch { /* já morreu */ }
      responder({ ok: false, motivo: `passou de ${Math.round(teto / 1000)}s sem responder` })
    }, teto)

    filho.stdout.on('data', (c) => { saida += c })
    filho.stderr.on('data', (c) => { erro += c })
    filho.on('error', (e) => { clearTimeout(relogio); responder({ ok: false, motivo: String(e.message || e) }) })
    filho.on('close', (codigo) => {
      clearTimeout(relogio)
      const texto = limpar(saida)
      if (!texto) return responder({ ok: false, motivo: erro.trim().slice(0, 300) || `saiu com código ${codigo} e não escreveu nada` })
      responder({ ok: true, texto })
    })
  })
}

/* O caractere de escape das cores de terminal, escrito por código e não
   literal: um byte de controle solto no meio do arquivo é invisível para quem
   lê o código e some em copiar e colar. */
const ESC = String.fromCharCode(27)
const CORES = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g')

/**
 * Tira do texto o que o opencode escreve em volta da resposta.
 *
 * Ele imprime cores de terminal e um cabeçalho do tipo `> build · big-pickle`
 * antes de responder. Sem limpar, esse cabeçalho apareceria como primeira
 * linha da síntese na tela dele.
 */
export function limpar(bruto) {
  return String(bruto || '')
    .replace(CORES, '')
    .split('\n')
    .filter((l) => !/^\s*>\s+\S+\s+·\s+\S+\s*$/.test(l))
    .join('\n')
    .trim()
}

/** Lê a última síntese gravada. Instantâneo: é o que a tela chama ao abrir. */
export function ler() {
  for (const arq of [ARQUIVO(), ARQUIVO_ABRIGO()]) {
    try {
      const d = JSON.parse(fs.readFileSync(arq, 'utf8'))
      if (d && d.texto) return d
    } catch { /* tenta o próximo */ }
  }
  return null
}

/**
 * Grava, em escrita atômica, e falhando EM VOZ ALTA.
 *
 * Cair no abrigo em silêncio é como o dado parece sumir: quem chama precisa
 * saber onde foi parar, e a tela precisa poder dizer que não gravou.
 */
export function gravar(dado) {
  const erros = []
  for (const arq of [ARQUIVO(), ARQUIVO_ABRIGO()]) {
    try {
      fs.mkdirSync(path.dirname(arq), { recursive: true })
      const tmp = `${arq}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(dado, null, 2))
      fs.renameSync(tmp, arq)
      return { ok: true, onde: arq }
    } catch (e) { erros.push(String(e.code || e.message)) }
  }
  return { ok: false, onde: null, motivo: erros.join(' / ') }
}

/** O caminho inteiro: números, prompt, modelo, disco. */
export async function pedir(fontes, { binario = null, modelo = MODELO } = {}) {
  const numeros = resumo(fontes)
  if (!numeros.trim()) return { ok: false, motivo: 'não havia número nenhum para analisar' }
  const r = await rodar(prompt(numeros), { binario, modelo })
  if (!r.ok) return r
  const dado = { texto: r.texto, em: Date.now(), modelo, numeros }
  const g = gravar(dado)
  return { ...dado, ok: true, gravado: g.ok, onde: g.onde, motivoGravacao: g.motivo || null }
}
