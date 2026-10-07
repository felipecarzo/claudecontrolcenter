/**
 * CC-933: o registro de auditoria central. Cada ação sensível (login, revogar
 * sessão, deploy, voltar versão, religar a VPS) vira UMA linha JSON num arquivo
 * só de acréscimo: quem, quando, de onde, o quê e se deu certo.
 *
 * Serve a dois serviços que moram em lugares diferentes (a porta de entrada em
 * /home/claudedev, o deploy seguro em /opt/cockpit-deploy) e ao `cc.mjs`. Por
 * isso não importa nada de fora e é copiado para o lado de cada serviço.
 *
 * Duas regras que não se negociam:
 *  - NUNCA grava senha, código do autenticador, token ou cookie: só o fato;
 *  - se gravar falhar, a ação NÃO falha: avisa no stderr e segue.
 *
 * Sem dependência: só o que vem com o Node.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Onde o instalador do administrador cria o arquivo (dono root, grupo claudedev, só acréscimo). */
export const CAMINHO_CENTRAL = '/var/log/cockpit/auditoria.jsonl'

/** Variável de ambiente primeiro; depois o arquivo central, se existir; senão a casa do usuário. */
export function caminhoAuditoria() {
  if (process.env.COCKPIT_AUDITORIA) return process.env.COCKPIT_AUDITORIA
  if (fs.existsSync(CAMINHO_CENTRAL)) return CAMINHO_CENTRAL
  return path.join(os.homedir(), '.local', 'share', 'agent-cockpit', 'auditoria.jsonl')
}

// token comprido (hex ou base64url) que escorregou para um texto: some antes de gravar
const texto = (v, max) => String(v ?? '').replace(/[A-Fa-f0-9]{32,}/g, '[oculto]').replace(/[\r\n]+/g, ' ').slice(0, max)

/** Acrescenta uma linha. Devolve true se gravou; nunca lança. */
export function registrar({ acao, quem, de, alvo, ok, detalhe, aparelho } = {}) {
  try {
    const linha = { em: new Date().toISOString(), acao: texto(acao, 40), quem: texto(quem, 60), de: texto(de, 60), alvo: texto(alvo, 80), ok: ok === undefined ? null : Boolean(ok) }
    if (aparelho) linha.aparelho = texto(aparelho, 120)
    if (detalhe) linha.detalhe = texto(detalhe, 300)
    const arq = caminhoAuditoria()
    fs.mkdirSync(path.dirname(arq), { recursive: true, mode: 0o750 })
    fs.appendFileSync(arq, JSON.stringify(linha) + '\n', { mode: 0o640 })
    return true
  } catch (e) {
    process.stderr.write(`auditoria: não consegui registrar "${acao}": ${e.message}\n`)
    return false
  }
}

/** As últimas N linhas (as mais novas por último). Linha quebrada é ignorada, não derruba a leitura. */
export function ler({ ultimos = 50 } = {}) {
  let bruto = ''
  try { bruto = fs.readFileSync(caminhoAuditoria(), 'utf8') } catch { return [] }
  const linhas = []
  for (const l of bruto.split('\n')) {
    if (!l.trim()) continue
    try { linhas.push(JSON.parse(l)) } catch { /* linha pela metade: pula */ }
  }
  return linhas.slice(-Math.max(1, Number(ultimos) || 50))
}

const ROTULO = {
  login: 'login', logout: 'saída do painel', 'senha-trocada': 'troca de senha', 'sessao-revogada': 'sessão revogada',
  'segundo-fator': 'código do autenticador', 'segundo-fator-config': 'autenticador no login', 'deploy-pedido': 'deploy pedido', 'deploy-confirmado': 'deploy confirmado',
  'deploy-recusado': 'deploy recusado', 'deploy-resultado': 'deploy terminou', 'rollback-pedido': 'volta de versão pedida',
  'rollback-confirmado': 'volta de versão confirmada', 'rollback-resultado': 'volta de versão terminou',
  'religar-vps': 'religar a VPS', 'cadastro-site': 'site cadastrado', 'codigo-recusado': 'código recusado',
}

/** Uma linha legível em português: "07/10 14:32  login  ERRO  dono, de 1.2.3.4 (iPhone): senha incorreta". */
export function legivel(l) {
  const d = new Date(l.em)
  const quando = Number.isNaN(d.getTime()) ? '??/?? ??:??' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')
  const estado = l.ok === true ? 'ok  ' : l.ok === false ? 'ERRO' : '    '
  const onde = [l.de && `de ${l.de}`, l.aparelho && `(${l.aparelho.slice(0, 40)})`].filter(Boolean).join(' ')
  return `${quando}  ${estado}  ${ROTULO[l.acao] || l.acao}${l.alvo ? ' ' + l.alvo : ''}${l.quem ? ', por ' + l.quem : ''}${onde ? ', ' + onde : ''}${l.detalhe ? ': ' + l.detalhe : ''}`
}
