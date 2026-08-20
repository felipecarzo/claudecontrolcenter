/**
 * Mede contraste de um tema contra o PAR: fundo da página e fundo do cartão.
 *
 * Existe porque medir só contra `bg` já reprovou duas vezes neste projeto:
 * quase todo texto mora dentro de uma superfície mais clara que a página, e a
 * medida boa contra o fundo esconde a medida ruim contra o cartão.
 *
 * Uso:  node tools/contraste.mjs <tema>
 * Sem argumento, mede todos os temas declarados aqui.
 */
const hex = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) }
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/* Distância perceptual aproximada, para a regra "uma cor, um significado":
   duas cores de estado que caem perto demais confundem de relance mesmo com
   contraste ótimo. Foi assim que "quebrou" e "é a sua vez" ficaram idênticas. */
const dist = (a, b) => {
  const [r1, g1, b1] = hex(a).map((v) => v * 255)
  const [r2, g2, b2] = hex(b).map((v) => v * 255)
  const rm = (r1 + r2) / 2
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
}

/* Os pisos: corpo de texto precisa de 4,5; a régua e a marca de tabela não são
   texto, então valem 3. `fg` sobre `bg` é o par de leitura principal e tem que
   passar de 7. */
const PISO = { fg: 7, dim: 4.5, faint: 4.5, tinta: 3, acento: 4.5, vez: 4.5, working: 4.5, waiting: 4.5, failed: 4.5, done: 4.5, idle: 4.5 }
/* Estados que precisam ser distinguíveis ENTRE SI, não só legíveis. O acento
   entra na conta porque ele é INTERFACE (foco, aba ativa, seleção): se cair em
   cima de uma cor de estado, o painel passa a dizer "feito" em toda aba
   selecionada. Foi assim que o acento antigo, azul, fazia todo tema parecer
   "trabalhando". */
const SEMANTICOS = ['vez', 'working', 'waiting', 'failed', 'done', 'idle', 'acento']
const SEPARACAO = 60

export const TEMAS = {
  noite: {
    bg: '#1c2320', surface: '#242c28',
    fg: '#e6e2d6', dim: '#a8b0a4', faint: '#939c90', tinta: '#7d8a7f', acento: '#9dc2a4',
    vez: '#e8776b', working: '#6f9fd8', waiting: '#d9a441', failed: '#d488b0', done: '#6aab7d', idle: '#99a296',
  },
  papel: {
    bg: '#e9e7dc', surface: '#f6f4ec',
    fg: '#2b302b', dim: '#565c54', faint: '#64695f', tinta: '#767c6f', acento: '#3f6b49',
    vez: '#a8362c', working: '#245e95', waiting: '#845a0e', failed: '#8e2f63', done: '#2f6742', idle: '#6f6759',
  },
  /* O chão da sala de operação: o quase-preto do mockup que ele aprovou.
     As famílias de matiz são as mesmas do boletim de propósito. A semântica
     já está resolvida e ele já leu essa tela; o que muda é o chão, não o
     significado das cores. */
  torre: {
    bg: '#0b0d0f', surface: '#171b20',
    fg: '#e6e8ea', dim: '#a1a9b3', faint: '#8b939c', tinta: '#6b737d', acento: '#4fbfae',
    vez: '#e8776b', working: '#6f9fd8', waiting: '#d9a441', failed: '#d488b0', done: '#6aab7d', idle: '#99a296',
  },
  /* O claro do painel novo. Neutro, não o papel esverdeado do boletim: a sala
     de operação continua sendo a mesma sala quando as luzes acendem. */
  'torre-claro': {
    bg: '#e8eaec', surface: '#f5f6f7',
    fg: '#1b1f24', dim: '#4d545c', faint: '#5c646d', tinta: '#767e88', acento: '#0e5f66',
    vez: '#a8362c', working: '#245e95', waiting: '#7a5410', failed: '#8e2f63', done: '#2f6742', idle: '#61686f',
  },
}

/* Só mede quando é ele que foi chamado. Sem esta guarda, quem importa `TEMAS`
   recebe o relatório inteiro na saída e um `process.exit` no meio do próprio
   trabalho: aconteceu na primeira tentativa de usar a tabela daqui. */
if (import.meta.main) medir(process.argv[2])

export function medir(alvo) {
let falhou = false

for (const [nome, t] of Object.entries(TEMAS)) {
  if (alvo && nome !== alvo) continue
  console.log(`\n=== ${nome} ===  fundo ${t.bg} · cartão ${t.surface}`)
  for (const [chave, piso] of Object.entries(PISO)) {
    if (!t[chave]) continue
    const cBg = razao(t[chave], t.bg)
    const cSurf = razao(t[chave], t.surface)
    const pior = Math.min(cBg, cSurf)
    const ok = pior >= piso
    if (!ok) falhou = true
    console.log(`  ${ok ? 'ok  ' : 'RUIM'} ${chave.padEnd(8)} ${t[chave]}  fundo ${cBg.toFixed(2)}  cartão ${cSurf.toFixed(2)}  (piso ${piso})`)
  }
  for (let i = 0; i < SEMANTICOS.length; i++) {
    for (let j = i + 1; j < SEMANTICOS.length; j++) {
      const [a, b] = [SEMANTICOS[i], SEMANTICOS[j]]
      if (!t[a] || !t[b]) continue
      const d = Math.round(dist(t[a], t[b]))
      if (d <= SEPARACAO) { falhou = true; console.log(`  RUIM ${a} e ${b} caem perto demais: ${d} (mínimo ${SEPARACAO})`) }
    }
  }
}

process.exitCode = falhou ? 1 : 0
}
