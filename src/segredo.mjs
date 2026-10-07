/**
 * CC-841 (Nisaba): segredo nunca entra no pedido a modelo nenhum.
 *
 * Todo texto que sai desta máquina para um modelo (grátis, Antigravity ou
 * Claude) passa por aqui. O segredo é TROCADO por um aviso, e não o pedido
 * inteiro recusado: a fala dele pode trazer uma chave colada sem querer, e
 * parar a conversa por isso trocaria um vazamento por um travamento. O aviso
 * diz o tipo, nunca o valor.
 *
 * Os padrões são ancorados no formato de cada fornecedor (prefixo conhecido),
 * nunca em "parece aleatório": heurística de entropia apagaria hash de commit
 * e id de tarefa, e o agente passaria a trabalhar com o texto mutilado.
 */

const PADROES = [
  ['chave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ['chave da Anthropic', /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ['chave da OpenAI', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g],
  ['token do GitHub', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}/g],
  ['chave da AWS', /\bAKIA[0-9A-Z]{16}\b/g],
  ['chave do Google', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['token do Slack', /\bxox[abpr]-[A-Za-z0-9-]{10,}/g],
  ['token JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ['senha em endereço', /(?<=\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+(?=@)/gi],
  // linha de .env: NOME_COM_SEGREDO=valor (só nomes que dizem ser segredo)
  ['valor de .env', /(?<=^\s*(?:export\s+)?[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|SENHA|PRIVATE|CREDENTIAL)[A-Z0-9_]*\s*=\s*)["']?[^\s"'#]{6,}["']?/gm],
]

/** Os segredos achados, só o tipo e quantos. Nunca devolve o valor. */
export function acharSegredos(texto) {
  const achados = {}
  for (const [tipo, re] of PADROES) {
    const n = (String(texto || '').match(re) || []).length
    if (n) achados[tipo] = n
  }
  return achados
}

/** O texto com cada segredo trocado por um aviso do tipo. */
export function limparSegredos(texto) {
  let t = String(texto ?? '')
  for (const [tipo, re] of PADROES) t = t.replace(re, `[SEGREDO REMOVIDO: ${tipo}]`)
  return t
}
