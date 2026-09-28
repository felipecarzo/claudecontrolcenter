// Leitura fixa de um comando, sem IA: o que ele faz, em qual máquina, com que poder.
// A frase do agy vem por baixo, marcada como explicação da IA. Pura, para o teste.
const ACOES = [
  [/\bdocker\s+compose\s+build\b|\bdocker\s+build\b/, 'constrói uma imagem Docker (não troca o que está no ar sozinho)', false],
  [/\bdocker\s+compose\s+up\b|\bdocker\s+(run|start)\b/, 'sobe ou reinicia containers (pode trocar o que está no ar)', true],
  [/\bdocker\s+compose\s+down\b|\bdocker\s+(rm|rmi|stop|kill)\b/, 'derruba ou apaga containers', true],
  [/\bpm2\s+(restart|reload|stop|delete)\b|\bsystemctl\s+(restart|stop|disable)\b/, 'reinicia ou para um serviço', true],
  [/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/, 'apaga pastas inteiras sem perguntar (rm -rf)', true],
  [/\brm\s/, 'apaga arquivos', true],
  [/\bgit\s+push\b[^|;&]*(--force|-f\b)/, 'envia ao GitHub POR CIMA do que está lá (push forçado)', true],
  [/\bgit\s+push\b/, 'envia commits ao GitHub', false],
  [/\bgit\s+reset\s+--hard\b|\bgit\s+checkout\s+--\s|\bgit\s+clean\s+-[a-z]*f/, 'descarta mudanças do git sem volta', true],
  [/\b(npm|pnpm|yarn)\s+(install|i|add)\b|\bpip\s+install\b/, 'instala pacotes', false],
  [/\bscp\b|\brsync\b/, 'copia arquivos entre máquinas', false],
  [/\bcurl\b|\bwget\b/, 'acessa a internet', false],
  [/\b(UPDATE|DELETE\s+FROM|DROP\s+(TABLE|DATABASE)|TRUNCATE|INSERT\s+INTO)\b/i, 'escreve num banco de dados', true],
  [/\bpsql\b|\bmysql\b|\bsqlite3\b/, 'abre um banco de dados', false],
  [/\bkill\b|\bpkill\b/, 'encerra processos', true],
  [/\bchmod\b|\bchown\b/, 'muda permissão ou dono de arquivos', true],
  [/\bnohup\b/, 'deixa algo rodando em segundo plano', false],
]

export function raioX(comando) {
  const c = String(comando || '')
  if (!c.trim()) return []
  const fatos = []
  const ssh = c.match(/\bssh\b[^"'\n]*?\s([\w.-]+)@([\w.-]+)/)
  if (ssh) {
    fatos.push({ texto: `entra em outra máquina: ${ssh[2]}`, perigo: false })
    fatos.push({ texto: ssh[1] === 'root' ? 'como root (poder total naquela máquina)' : `como o usuário ${ssh[1]}`, perigo: ssh[1] === 'root' })
  } else if (/\bsudo\b/.test(c)) fatos.push({ texto: 'usa sudo (poder de administrador)', perigo: true })
  const pastas = [...new Set((c.match(/(?:^|[\s"'=(])((?:\/|~\/)[\w.@+-]+(?:\/[\w.@+-]+)*)/g) || [])
    .map((x) => x.replace(/^[\s"'=(]/, '')).filter((x) => !/\.ssh\//.test(x) && x !== '/dev/null'))].slice(0, 4)
  if (pastas.length) fatos.push({ texto: 'mexe em: ' + pastas.join(', '), perigo: Boolean(ssh) && pastas.some((x) => /^\/(opt|var\/www|etc)\b/.test(x)) })
  for (const [re, texto, perigo] of ACOES) {
    if (!re.test(c)) continue
    if (texto === 'apaga arquivos' && fatos.some((f) => /rm -rf/.test(f.texto))) continue
    if (texto === 'envia commits ao GitHub' && fatos.some((f) => /forçado/.test(f.texto))) continue
    fatos.push({ texto, perigo })
  }
  return fatos
}
