#!/usr/bin/env node
/**
 * A resposta diz o FATO. Não conta o caminho que eu percorri até ele.
 *
 * ## O pedido, em 11/09
 *
 * > "muitas vezes você fala coisas como 'achei o erro, e não era o que eu
 * > pensava', pra que falar isso? Não é mais fácil falar: Achei o erro. O erro
 * > era tal coisa."
 *
 * E o motivo, que é o que faz esta trava existir:
 *
 * > "eu como humano olho uma tela cheia de texto enquanto desenvolvo 6
 * > projetos e eu não entendo nada, primeiro pq eu já perdi o contexto (…)
 * > quando eu leio, além de processar o que já passou, preciso processar o que
 * > vem de novo no texto"
 *
 * Ele também disse por que isso é dele e não de todo mundo: *"acredito que
 * você tenha no seu treino essa característica de explicar imitando humano e a
 * maioria das pessoas gosta disso (…) mas pra mim isso piora muito a minha
 * retenção"*.
 *
 * ## O que esta trava conta, e o que ela deixa passar
 *
 * Conta a NARRATIVA do meu próprio processo: a hipótese que eu tinha, o erro
 * que era meu, o achado em série. Tudo isso é texto que ele lê e descarta, e
 * que empurra o fato para baixo.
 *
 * **Não conta a linha de anúncio antes de usar ferramenta** ("vou ler o
 * quadro"), e a razão é medida: das 51 respostas minhas de uma sessão real,
 * uma lista de padrões pegou 12, e 7 eram essa linha — que é REGRA DELE,
 * escrita no arquivo global (*"antes de qualquer tool call, escrever primeiro
 * uma linha em português simples explicando o que vai ser feito e por quê"*).
 * Uma trava que briga com a ordem dele é trava que ele desliga.
 *
 * Sobram 6 em 51. É pouco por padrão, e é o que dá para pegar sem julgamento:
 * o resto ("frase de efeito") exige juízo, e juízo de IA vira trava que erra.
 * O outro lado do mesmo problema, o rótulo de tela em forma de frase, é pego
 * no gate, onde é lista de palavra em arquivo e acerta sempre.
 *
 * Falha ABERTA, uma volta só.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* `import()` no Windows precisa de URL, não de caminho: com `D:\...` ele
   lança e o módulo some dentro do `.catch`, sem erro visível. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('fala-guard')) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const texto = E.respostaDoTurno(arquivo) || E.ultimaResposta(arquivo)
if (!texto) sair()

/* Bloco de código sai da conta: ali dentro é comando, não conversa. */
const prosa = texto
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/^\s{4,}\S.*$/gm, ' ')

/**
 * Os padrões, e o que cada um substitui.
 *
 * Cada entrada carrega o CONSERTO, não só a acusação: trava que só diz "está
 * errado" faz eu reescrever no chute, e a segunda tentativa sai igual.
 */
const PADROES = [
  {
    id: 'hipótese minha',
    re: /\b(n[ãa]o era o que eu (pensava|achava|imaginava)|eu (pensava|achava|imaginava) que|minha (primeira )?hip[óo]tese|a hip[óo]tese (era|estava) errada|contra o que eu esperava)\b/i,
    troca: 'Diga o que a coisa É. O que você supunha antes não muda nada para ele.',
  },
  {
    id: 'erro meu narrado',
    re: /\b(erro meu|um erro meu|foi (a minha|o meu|minha|meu) \w+|era a minha|era o meu|eu tinha (escrito|feito|posto|deixado)|culpa minha)\b/i,
    troca: 'Diga o que mudou e o que ficou certo. Se a causa importa, ela é uma linha, sem o "meu".',
  },
  {
    id: 'achado em série',
    re: /\b(achei (mais um|outro)|mais um (defeito|erro|problema|achado)|apareceu (mais um|outro)|encontrei (mais um|outro))\b/i,
    troca: 'Liste os achados de uma vez, com o nome de cada um. "Mais um" obriga ele a lembrar dos anteriores.',
  },
  {
    id: 'suspense',
    re: /\b(e (a[íi]|ent[ãa]o) (descobri|vi que)|acontece que|s[óo] que (a[íi]|ent[ãa]o)|para minha surpresa|curiosamente)\b/i,
    troca: 'Fato primeiro. A ordem em que você descobriu não é a ordem em que ele precisa ler.',
  },
  {
    id: 'veredito vazio',
    re: /\b(ficou (?:[óo]timo|bom|melhor|perfeito)|est[áa] (?:bem )?melhor agora|funcionou lindamente|ficou show|perfeito!)/i,
    troca: 'Troque o elogio pelo número medido, ou corte a frase.',
  },
]

const achados = PADROES
  .map((p) => ({ ...p, m: prosa.match(p.re) }))
  .filter((p) => p.m)

if (!achados.length) sair()

console.error(
  `${achados.length} TRECHO(S) CONTANDO O CAMINHO, EM VEZ DO FATO.\n\n`
  + achados.map((a) => `  · "${a.m[0]}"  (${a.id})\n    → ${a.troca}`).join('\n\n')
  + '\n\nEle em 11/09: "pra que falar isso? Não é mais fácil falar: Achei o erro.\n'
  + 'O erro era tal coisa." E o motivo: ele toca 6 projetos ao mesmo tempo, já\n'
  + 'perdeu o contexto, e cada linha a mais é uma linha que ele processa antes\n'
  + 'de chegar no que importa.\n\n'
  + 'A forma que ele pediu:\n\n'
  + '  1. o fato        o que é, ou o que mudou\n'
  + '  2. a causa       uma linha, e só se ele precisar dela para decidir\n'
  + '  3. a pergunta    na caixa de escolha, nunca em prosa\n\n'
  + 'A explicação longa não some: vai para o arquivo do projeto, onde ele lê\n'
  + 'quando quiser. O chat fica com o fato.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
