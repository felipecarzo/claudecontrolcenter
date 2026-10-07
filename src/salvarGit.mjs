/**
 * CC-884: o botão "commit e push" do cartão do projeto.
 *
 * Ação que sai da máquina (o push publica no GitHub), então o desenho é:
 * a tela mostra o que vai junto ANTES, o texto do commit é dele, e nada aqui
 * usa `--force` nem `--no-verify`. Falha em qualquer passo para ali e diz qual.
 * Os arquivos vão todos (`add -A`): é o que "salvar o projeto" quer dizer, e a
 * lista aparece na confirmação para ele ver o que está incluindo.
 */
import { execFile } from 'node:child_process'
import { raizGit, pontos } from './caixaGit.mjs'

const ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
const git = (raiz, args, timeout = 60000) => new Promise((ok) => {
  execFile('git', ['-C', raiz, ...args], { timeout, maxBuffer: 8 * 1024 * 1024, env: ENV }, (e, out, err) =>
    ok({ ok: !e, saida: String(out || '').trim(), erro: String(err || e?.message || '').trim() }))
})

/** O que um commit e push faria agora. Só leitura. */
export async function mudancas(dir) {
  const raiz = raizGit(dir)
  if (!raiz) return { ok: false, erro: 'esta pasta não é um repositório git' }
  const [ramo, st, remoto, antes] = await Promise.all([
    git(raiz, ['rev-parse', '--abbrev-ref', 'HEAD'], 5000), git(raiz, ['status', '--porcelain'], 15000),
    git(raiz, ['remote'], 5000), git(raiz, ['rev-list', '--count', '@{upstream}..HEAD'], 5000),
  ])
  const arquivos = st.saida.split(/\r?\n/).filter(Boolean).map((l) => ({ estado: l.slice(0, 2).trim() || '?', caminho: l.slice(3) }))
  let sessoes = 0
  try { sessoes = pontos(raiz).length } catch { /* sem leitura de presença, sem aviso */ }
  return {
    ok: true, raiz, ramo: ramo.saida, destacado: ramo.saida === 'HEAD', arquivos,
    temRemoto: remoto.saida.split(/\s+/).includes('origin'),
    semUpstream: !antes.ok, porEmpurrar: antes.ok ? Number(antes.saida) || 0 : null, sessoesVivas: sessoes,
  }
}

/** Remove a linha de coautoria: regra dele, em nenhum commit de nenhum projeto. */
const limparMensagem = (m) => String(m || '').split(/\r?\n/).filter((l) => !/^co-authored-by:/i.test(l.trim())).join('\n').trim()

/** Commit (se há o que commitar) e push. Devolve cada passo, para a tela dizer onde parou. */
export async function salvar(dir, mensagem) {
  const m = await mudancas(dir)
  if (!m.ok) return m
  if (m.destacado) return { ok: false, erro: 'o repositório está fora de qualquer ramo (HEAD solto): escolha um ramo antes' }
  const passos = []
  const falhou = (nome, r) => { passos.push({ nome, ok: false, texto: r.erro || r.saida }); return { ok: false, erro: `${nome} falhou: ${(r.erro || r.saida).split('\n').slice(-3).join(' ')}`, passos } }
  const texto = limparMensagem(mensagem)
  if (m.arquivos.length) {
    if (texto.length < 5) return { ok: false, erro: 'escreva o que mudou, em pelo menos uma frase curta' }
    const a = await git(m.raiz, ['add', '-A']); if (!a.ok) return falhou('git add', a)
    const c = await git(m.raiz, ['commit', '-m', texto]); if (!c.ok) return falhou('commit', c)
    passos.push({ nome: 'commit', ok: true, texto: `${m.arquivos.length} arquivo(s)` })
  } else if (!m.semUpstream && !m.porEmpurrar) return { ok: false, erro: 'nada para salvar: sem mudanças e tudo já empurrado' }
  const commit = (await git(m.raiz, ['rev-parse', '--short', 'HEAD'], 5000)).saida
  if (!m.temRemoto) { passos.push({ nome: 'push', ok: true, texto: 'pulado: este repositório não tem remoto origin' }); return { ok: true, commit, ramo: m.ramo, passos, empurrou: false } }
  const p = await git(m.raiz, m.semUpstream ? ['push', '-u', 'origin', m.ramo] : ['push'], 120000)
  if (!p.ok) return { ...falhou('push', p), commit, commitFeito: passos.some((x) => x.nome === 'commit') }
  passos.push({ nome: 'push', ok: true, texto: `ramo ${m.ramo} enviado` })
  return { ok: true, commit, ramo: m.ramo, passos, empurrou: true }
}
