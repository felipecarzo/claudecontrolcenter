/**
 * CC-103 — o gancho nasce com a instalação, como no husky.
 *
 * A última linha aberta da comparação com as ferramentas de gate do mundo
 * humano. O `husky` resolveu isto no git há anos: gancho não é versionado,
 * então cada máquina teria que instalar à mão, e a solução foi um
 * `postinstall` no `package.json`.
 *
 * Aqui doía mais, porque o `settings.json` é global e o caminho muda de
 * máquina. **A prova do custo veio em 19/08**: ao abrir este projeto no PC
 * depois de seis dias só na VPS, **31 dos 36 hooks nunca tinham sido
 * instalados aqui**. Não estavam quebrados: nunca tinham sido copiados. Todas
 * as travas de escrita, o gate do framework e o registro no diário existiam
 * no repositório e não valiam nada nesta máquina.
 *
 * ## Por que isto é seguro rodar sozinho
 *
 * Três garantias, e a terceira é a que importa:
 *
 * 1. **Só acrescenta.** `instalar()` pula o que já está registrado e nunca
 *    remove entrada de terceiro — o `settings.json` dele tem hooks de outros
 *    sistemas (pixel-agents), e apagá-los seria estrago silencioso.
 * 2. **Cópia de segurança antes de escrever**, que `instalar()` já faz.
 * 3. **Nunca falha a instalação do pacote.** Sai com código 0 sempre. Um
 *    `npm install` que quebra porque um hook não pôde ser registrado é pior
 *    que o problema que ele resolve, e o `npm` roda `postinstall` em contexto
 *    onde a casa do Claude Code pode nem existir (CI, container, máquina de
 *    build).
 *
 * ## O que ele NÃO faz
 *
 * Não liga hook nenhum: registrar é diferente de ligar. O interruptor por
 * projeto continua sendo dele, e um hook registrado mas desligado no config
 * continua calado.
 */
import { HOOKS } from './hooksCatalogo.mjs'
import { instalar, sincronizar } from './hooksRegistro.mjs'

/** Sinal de que ninguém está olhando a saída: `npm install` roda isto no meio
 *  de centenas de linhas, e despejar trinta linhas de relatório ali é ruído. */
const silencioso = process.env.npm_lifecycle_event === 'postinstall'

export function rodar({ log = console.error } = {}) {
  const doCatalogo = HOOKS.filter((h) => h.implementado && h.script)

  let copiados = 0
  let registrados = 0
  const problemas = []

  try {
    copiados = sincronizar(doCatalogo).filter((r) => r.acao === 'copiado').length
  } catch (e) {
    problemas.push(`não deu para copiar os hooks: ${e?.message || e}`)
  }

  try {
    const r = instalar(doCatalogo)
    if (r.ok === false) problemas.push(r.erro)
    else registrados = (r.feitos || []).filter((f) => f.acao === 'registrado').length
  } catch (e) {
    problemas.push(`não deu para registrar no settings.json: ${e?.message || e}`)
  }

  /* Silêncio quando não houve mudança: instalar o pacote de novo numa máquina
     já configurada não deve dizer nada. Barulho só quando algo mudou de fato,
     ou quando falhou — e falha aqui é aviso, nunca erro fatal. */
  if (problemas.length) {
    log(`cockpit: os hooks não foram instalados automaticamente (${problemas[0]}).`)
    log('cockpit: rode `cc hooks sync && cc hooks install` quando quiser ligá-los.')
  } else if (copiados || registrados) {
    log(`cockpit: ${copiados} hook(s) copiado(s), ${registrados} registrado(s) no Claude Code.`)
    log('cockpit: abra /hooks no Claude Code ou reinicie a sessão para valerem.')
  }

  return { copiados, registrados, problemas }
}

/* Só age quando chamado como script. Importar este arquivo (o teste faz) não
   pode escrever em máquina nenhuma. */
if (process.argv[1] && process.argv[1].endsWith('postinstall.mjs')) {
  try {
    rodar({ log: silencioso ? console.error : console.log })
  } catch (e) {
    console.error(`cockpit: instalação dos hooks pulada (${e?.message || e})`)
  }
  process.exit(0) // sempre 0: nunca derrubar o `npm install` de ninguém
}
