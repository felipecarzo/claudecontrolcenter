/**
 * CC-922: o catálogo de requisitos de segurança do mapa do produto. Fixo, em código, sem IA.
 *
 * É um recorte do OWASP ASVS 4.0 (nível 1, decisão dele de 06/10): cada parte do mapa recebe os requisitos
 * do TIPO dela. `checagem` é o id da checagem automática de tools/varredura-seguranca/varredura.mjs (hoje é
 * o próprio id ASVS); sem `checagem` o requisito só se confere olhando, e nunca barra o pronto sozinho.
 *
 * ⚠️ O hash de senha (V2.4.1) é nível 2 no ASVS 4.0; ficou aqui porque ele pediu "hash forte" junto do login.
 *
 * Regra dele de 07/10: projeto inicial não tem login. Login e dado de pessoa só entram quando o projeto guarda
 * informação de alguém (`projetoGuardaDado`), e a regra de dedução está escrita aqui embaixo, em `tiposDaParte`.
 */

export const TIPOS_SEGURANCA = ['conta', 'dadoPessoa', 'entrada', 'arquivo', 'publico']

export const NOME_DO_TIPO = {
  conta: 'login e conta',
  dadoPessoa: 'dado de pessoa',
  entrada: 'formulário e entrada',
  arquivo: 'arquivo enviado',
  publico: 'página pública, sem dado',
}

const r = (id, frase, checagem = null) => ({ id, frase, checagem })

export const CATALOGO = {
  conta: [
    r('V2.1.1', 'A senha exige no mínimo 12 caracteres.', 'V2.1.1'),
    r('V2.4.1', 'A senha é guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2), nunca em texto.', 'V2.4.1'),
    r('V2.2.1', 'Há limite de tentativas de login: depois de várias erradas, a conta ou o endereço espera antes de tentar de novo.'),
    r('V3.4.1', 'O cookie de sessão tem o atributo Secure.', 'V3.4.1'),
    r('V3.4.2', 'O cookie de sessão tem o atributo HttpOnly.', 'V3.4.2'),
    r('V3.4.3', 'O cookie de sessão tem o atributo SameSite.', 'V3.4.3'),
    r('V3.3.1', 'Sair da conta encerra a sessão no servidor, não só no aparelho.'),
  ],
  dadoPessoa: [
    r('V4.2.1', 'Cada pessoa só vê e só altera o que é dela: o servidor confere o dono em toda leitura e escrita.'),
    r('V7.1.2', 'Nada pessoal (nome, e-mail, documento, localização) vai para o log.'),
  ],
  entrada: [
    r('V5.1.3', 'Todo campo é validado no servidor, não só na tela.'),
    r('V5.3.4', 'A consulta ao banco usa parâmetros, nunca texto montado com o que a pessoa digitou.', 'V5.3.4'),
    r('V5.2.4', 'Nada do que a pessoa digita é executado como código (sem eval).', 'V5.2.4'),
  ],
  arquivo: [
    r('V12.1.1', 'O envio de arquivo tem tamanho máximo, checado no servidor.'),
    r('V12.5.2', 'O arquivo enviado nunca é devolvido como página ou script, e o tipo é conferido antes de guardar.'),
  ],
  publico: [
    r('V14.4.5', 'A resposta traz Strict-Transport-Security (HSTS).', 'V14.4.5'),
    r('V14.4.4', 'A resposta traz X-Content-Type-Options: nosniff.', 'V14.4.4'),
    r('V14.4.7', 'A resposta proíbe ser posta dentro de outra página (frame-ancestors ou X-Frame-Options).', 'V14.4.7'),
  ],
}

/** Os requisitos de uma lista de tipos, sem repetir id, na ordem do catálogo. */
export function requisitosDosTipos(tipos) {
  const vistos = new Set(), saida = []
  for (const tipo of TIPOS_SEGURANCA) {
    if (!(tipos || []).includes(tipo)) continue
    for (const q of CATALOGO[tipo]) if (!vistos.has(q.id)) { vistos.add(q.id); saida.push({ ...q, tipo }) }
  }
  return saida
}

// ---------- a dedução do tipo: regra simples, escrita ----------

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const texto = (parte) => semAcento([parte?.nome, parte?.atividade, ...(parte?.caracteristicas || [])].join(' '))
const nomeEAtividade = (parte) => semAcento([parte?.nome, parte?.atividade].join(' '))

/** A parte fala de entrar na conta: só o nome e a atividade contam, característica solta ("só entra quem tem login") não. */
const LOGIN = /login|entrar|senha|autentic|cadastr|criar conta|minha conta|sessao/
/** A parte (ou o projeto) guarda informação de alguém. */
const DADO = /cadastr|criar conta|minha conta|perfil|historico|salv|guard|registr|lanc|pedido|gasto|\bmeus?\b|\bminhas?\b|seus dados|dados d|dado pessoal|\bfotos?\b|upload|paciente|cliente|aluno|\bpessoal/
const ARQUIVO = /upload|\bfotos?\b|imagem|imagens|anexo|arquivo|enviar documento|enviar pdf/
const ENTRADA = /formulario|campo|preench|digit|busca|pesquis|lanc|cadastr|registr|informa/

/** Regra 1: projeto inicial sem informação de ninguém não tem login nem dado de pessoa. */
export function projetoGuardaDado(produto) {
  const d = produto?.definicao || {}
  return DADO.test(semAcento(`${d.oque || ''} ${d.problema || ''}`)) || (produto?.partes || []).some((p) => DADO.test(texto(p)))
}

/**
 * Os tipos de segurança de uma parte. `parte.tiposSeguranca` (lista, mesmo vazia) é a escolha dele e vence a dedução.
 * Dedução, nesta ordem: arquivo (fala de upload, foto, anexo); conta (fala de login/cadastro no nome ou na atividade
 * E o projeto guarda dado); dadoPessoa (a parte guarda dado E o projeto guarda dado, e não é a conta); entrada (fala de
 * formulário, campo, busca, lançar); publico (sobrou nada, e é tela ou fluxo).
 */
export function tiposDaParte(parte, produto) {
  if (Array.isArray(parte?.tiposSeguranca)) return TIPOS_SEGURANCA.filter((t) => parte.tiposSeguranca.includes(t))
  const t = texto(parte), guarda = projetoGuardaDado(produto), tipos = []
  if (ARQUIVO.test(t)) tipos.push('arquivo')
  if (guarda && LOGIN.test(nomeEAtividade(parte))) tipos.push('conta')
  else if (guarda && DADO.test(t)) tipos.push('dadoPessoa')
  if (ENTRADA.test(t)) tipos.push('entrada')
  if (!tipos.length && ['tela', 'fluxo'].includes(parte?.tipo)) tipos.push('publico')
  return TIPOS_SEGURANCA.filter((x) => tipos.includes(x))
}

/** Os ids ASVS que a parte carrega, para gravar em `parte.seguranca`. */
export const idsDaParte = (parte, produto) => requisitosDosTipos(tiposDaParte(parte, produto)).map((q) => q.id)

/** Devolve o produto com `seguranca: [ids]` em cada parte. Puro. */
export function comSeguranca(produto) {
  if (!produto || !Array.isArray(produto.partes)) return produto
  return { ...produto, partes: produto.partes.map((p) => ({ ...p, seguranca: idsDaParte(p, produto) })) }
}
