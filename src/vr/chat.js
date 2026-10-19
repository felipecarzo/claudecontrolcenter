/**
 * CC-1063, M3 ("conversar"): o chat de um agente, dentro da sala (docs/CC-1063.md).
 *
 * Tocar um agente na mesa abre este painel à frente, mais perto que os cartões: o nome e o estado no topo, as últimas
 * falas em balões (as dele à direita, as do agente à esquerda, como o chat do painel), setas para subir e descer, e
 * embaixo:
 *  - "falar": a voz vira texto, que aparece para ele CONFERIR antes de enviar ("enviar" ou "descartar");
 *  - "escrever": até existir o teclado da sala (M6), sai da sala com o campo aberto naquele agente;
 *  - "parar", só com o agente trabalhando, com segundo toque para confirmar.
 * O painel é anteparo do raio: o que está atrás dele (os cartões) não se aperta através dele.
 * A rede fica na página: `ler(conversa)` devolve { itens, erro } e `aoAgir(envio)` manda para as rotas do painel.
 */
import * as THREE from 'three';
import { painel, botao, linhas, caber, arredondado, noArco, COR, ESTADO } from './kit.js';
import { janela } from './puro.js';
import { OLHO } from './sala.js';

const L = 0.95, A = 0.8; // o painel do chat, em metros
const RAIO = 1.15, ALTURA = OLHO + 0.22; // à frente e mais perto que o arco dos cartões (1,6 m)

function pintarChat(ctx, w, h, s) {
  ctx.fillStyle = COR.fundo; arredondado(ctx, 0, 0, w, h, 40); ctx.fill();
  const m = 36; const e = ESTADO[s.agente?.estado] || ESTADO.parada;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = COR.texto; ctx.font = '700 48px system-ui'; ctx.fillText(caber(ctx, s.agente?.projeto || 'agente', w - 2 * m - 440), m, 64);
  ctx.fillStyle = e.cor; ctx.font = '38px system-ui'; ctx.textAlign = 'right';
  ctx.fillText(caber(ctx, e.palavra + (s.agente?.maquina ? ', ' + s.agente.maquina : ''), 420), w - m, 62); ctx.textAlign = 'left';
  ctx.fillStyle = COR.borda; ctx.fillRect(m, 88, w - 2 * m, 3);
  if (!s.itens) {
    ctx.fillStyle = s.erro ? COR.erro : COR.apagado; ctx.font = '42px system-ui';
    linhas(ctx, s.erro || 'lendo a conversa…', w - 2 * m, 3).forEach((l, i) => ctx.fillText(l, m, 160 + i * 52));
    return;
  }
  const J = janela(s.itens, s.desloc);
  if (!J.falas.length) { ctx.fillStyle = COR.apagado; ctx.font = '42px system-ui'; ctx.fillText('a conversa ainda não tem falas', m, 160); return; }
  // de baixo para cima: a fala mais recente encostada no rodapé, como em app de mensagem
  ctx.font = '38px system-ui'; let y = h - 36; const maxL = w * 0.8; let cortou = false;
  for (let i = J.falas.length - 1; i >= 0; i--) {
    const f = J.falas[i]; const ls = linhas(ctx, f.texto, maxL - 48, 4); const bh = ls.length * 46 + 28;
    if (y - bh < 140) { cortou = true; break; }
    const bw = Math.min(maxL, Math.max(...ls.map((l) => ctx.measureText(l).width)) + 48);
    const x = f.tipo === 'voce' ? w - m - bw : m; y -= bh;
    ctx.fillStyle = f.tipo === 'voce' ? '#2a3350' : COR.fundoAlt; arredondado(ctx, x, y, bw, bh, 24); ctx.fill();
    ctx.fillStyle = COR.texto; ls.forEach((l, k) => ctx.fillText(l, x + 24, y + 46 + k * 46));
    y -= 16;
  }
  ctx.fillStyle = COR.apagado; ctx.font = '32px system-ui'; ctx.textAlign = 'center';
  // o aviso conta o que foi DESENHADO: fala que não coube também é fala mais antiga
  if (J.temAntes || cortou) ctx.fillText('há falas mais antigas: seta para cima', w / 2, 128);
  else if (J.temDepois) ctx.fillText('início da conversa', w / 2, 128);
  ctx.textAlign = 'left';
}

/**
 * `ler(conversa)` -> Promise<{ itens?, erro? }>; `aoAgir({ rota, corpo })` -> Promise<{ ok, erro? }>;
 * `ouvir()` -> Promise<{ texto?, erro? }> (a voz); `escrever(agente)` sai da sala para escrever no navegador.
 */
export function criarChat(mundo, { raio, ler, aoAgir, ouvir, escrever, aoMudar } = {}) {
  const g = new THREE.Group(); g.visible = false; mundo.add(g);
  const S = { agente: null, itens: null, erro: null, desloc: 0, rascunho: null, aviso: null };
  const tela = painel(L, A, (ctx, w, h) => pintarChat(ctx, w, h, S)); g.add(tela.mesh); raio?.anteparo(tela.mesh);
  const ult = () => (S.itens && S.itens.length ? S.itens[S.itens.length - 1] : null);
  const pint = () => tela.atualizar(JSON.stringify([S.agente?.projeto, S.agente?.estado, S.agente?.maquina, S.itens && S.itens.length, ult()?.texto, S.erro, S.desloc]));
  const aviso = painel(L, 0.1, (ctx, w, h) => {
    if (!S.aviso && !S.rascunho) return;
    ctx.fillStyle = COR.fundoAlt; arredondado(ctx, 0, 0, w, h, 22); ctx.fill();
    ctx.fillStyle = S.rascunho ? COR.texto : (S.aviso?.erro ? COR.erro : COR.acento); ctx.font = '34px system-ui'; ctx.textBaseline = 'middle';
    ctx.fillText(caber(ctx, S.rascunho ? 'você disse: "' + S.rascunho + '"' : S.aviso.texto, w - 40), 20, h / 2);
  });
  aviso.mesh.position.set(0, -A / 2 - 0.08, 0); g.add(aviso.mesh);
  const pintAviso = () => { aviso.atualizar(JSON.stringify([S.aviso, S.rascunho])); aviso.mesh.visible = Boolean(S.aviso || S.rascunho); };

  const B = (t, fn, cor, larg = 0.3) => { const b = botao(t, fn, { larg, alt: 0.11, cor }); g.add(b.mesh); raio?.add(b); return b; };
  const linhaY = -A / 2 - 0.22;
  const btFalar = B('falar', () => falar(), '#9d7cff'); btFalar.mesh.position.set(-0.32, linhaY, 0.005);
  const btEscrever = B('escrever', () => escrever?.(S.agente), '#5cc8ff'); btEscrever.mesh.position.set(0, linhaY, 0.005);
  const btFechar = B('fechar', () => fechar(), '#6b7484'); btFechar.mesh.position.set(0.32, linhaY, 0.005);
  const btEnviar = B('enviar', () => enviar(), '#9d7cff'); btEnviar.mesh.position.set(-0.17, linhaY, 0.005);
  const btDescartar = B('descartar', () => { S.rascunho = null; modoRascunho(false); pintAviso(); }, '#6b7484'); btDescartar.mesh.position.set(0.17, linhaY, 0.005);
  const btSobe = B('▲', () => { S.desloc = Math.min(S.desloc + 3, Math.max(0, janela(S.itens).total - 1)); pint(); }, '#6b7484', 0.12); btSobe.mesh.position.set(L / 2 + 0.09, 0.12, 0.005);
  const btDesce = B('▼', () => { S.desloc = Math.max(0, S.desloc - 3); pint(); }, '#6b7484', 0.12); btDesce.mesh.position.set(L / 2 + 0.09, -0.12, 0.005);
  // parar: só com o agente trabalhando, e com segundo toque em até 4 s
  let armado = false, tParar = null;
  const btParar = B('parar', async (b) => {
    // o primeiro toque diz a consequência (regra 11); só o segundo, em até 4 s, manda
    if (!armado) {
      armado = true; b.texto('tocar de novo'); S.aviso = { texto: 'parar: ele interrompe o que está fazendo, e a sessão fica aberta' }; pintAviso();
      tParar = setTimeout(() => { armado = false; b.texto('parar'); S.aviso = null; pintAviso(); }, 4000); return;
    }
    clearTimeout(tParar); armado = false; b.texto('parando…');
    const r = await aoAgir?.({ rota: 'parar', corpo: { conversa: S.agente?.conversa } }).catch(() => ({ ok: false }));
    // o servidor às vezes só confirma que mandou o Esc: a frase dele vale mais que um "parado" seco
    b.texto('parar'); S.aviso = r && r.ok ? { texto: r.aviso || 'Esc enviado: ele para no próximo passo' } : { erro: true, texto: 'não parou: ' + ((r && r.erro) || 'sem resposta') }; pintAviso();
  }, '#ef5b5b', 0.3); btParar.mesh.position.set(L / 2 - 0.15, A / 2 + 0.08, 0.005);

  const temConversa = () => Boolean(S.agente?.conversa);
  function modoRascunho(sim) {
    btFalar.mesh.visible = !sim && temConversa() && Boolean(ouvir);
    btEscrever.mesh.visible = !sim && temConversa();
    btFechar.mesh.visible = !sim;
    btEnviar.mesh.visible = btDescartar.mesh.visible = sim;
    btParar.mesh.visible = !sim && S.agente?.estado === 'trabalhando' && temConversa();
  }

  let ouvindo = false;
  async function falar() {
    if (!ouvir || ouvindo) return;
    ouvindo = true; S.aviso = { texto: 'fale agora…' }; S.rascunho = null; pintAviso();
    const r = await ouvir().catch(() => ({ erro: 'não conseguiu ouvir' })); ouvindo = false;
    if (!g.visible) return; // fechou enquanto ouvia
    if (r && r.texto) { S.aviso = null; S.rascunho = r.texto; modoRascunho(true); }
    else S.aviso = { erro: true, texto: (r && r.erro) || 'não ouviu nada' };
    pintAviso();
  }
  let enviando = false;
  async function enviar() {
    if (enviando || !S.rascunho || !temConversa()) return;
    enviando = true; const texto = S.rascunho; const conversa = S.agente.conversa;
    S.rascunho = null; modoRascunho(false); S.aviso = { texto: 'enviando…' }; pintAviso();
    const r = await aoAgir?.({ rota: 'mensagem', corpo: { conversa, texto } }).catch(() => ({ ok: false }));
    enviando = false;
    if (S.agente?.conversa !== conversa) return; // trocou de agente no meio
    // falhou: o texto volta para ele não perder o que disse
    if (r && r.ok) S.aviso = { texto: r.aviso || 'enviado' };
    else { S.rascunho = texto; modoRascunho(true); S.aviso = { erro: true, texto: 'não foi: ' + ((r && r.erro) || 'sem resposta') + '. Tente de novo' }; }
    pintAviso(); if (r && r.ok) recarregar();
  }
  let lendo = false;
  async function recarregar() {
    if (!temConversa() || lendo) return;
    lendo = true; const conversa = S.agente.conversa;
    const r = await ler?.(conversa).catch(() => ({ erro: 'o painel não respondeu' })); lendo = false;
    if (S.agente?.conversa !== conversa) return;
    // leitura vazia não apaga a última boa (a conversa do PC às vezes vem sem o rabo)
    if (r && Array.isArray(r.itens) && (r.itens.length || !S.itens)) { S.itens = r.itens; S.erro = null; }
    else if (!S.itens) S.erro = (r && r.erro) || 'sem conversa';
    pint();
  }

  let timer = null;
  function abrir(agente) {
    S.agente = agente; S.itens = null; S.desloc = 0; S.rascunho = null; S.aviso = null; armado = false; btParar.texto('parar');
    S.erro = temConversa() ? null : 'esta sessão não tem conversa que a sala alcance';
    modoRascunho(false);
    noArco(g, 0, RAIO, ALTURA); g.visible = true; pint(); pintAviso(); aoMudar?.(true);
    clearInterval(timer); recarregar(); timer = setInterval(recarregar, 3000);
  }
  function fechar() { g.visible = false; clearInterval(timer); timer = null; S.agente = null; S.rascunho = null; S.aviso = null; aoMudar?.(false); }
  /** o estado do agente muda na mesa: o topo e o "parar" acompanham */
  function atualizarAgente(a) {
    if (!S.agente || !a || a.id !== S.agente.id) return;
    S.agente = { ...S.agente, ...a }; modoRascunho(Boolean(S.rascunho)); pint();
  }
  return {
    abrir, fechar, atualizarAgente, recarregar,
    get aberto() { return g.visible ? S.agente : null; },
    estado: S, botoes: { falar: btFalar, escrever: btEscrever, fechar: btFechar, enviar: btEnviar, descartar: btDescartar, parar: btParar, sobe: btSobe, desce: btDesce },
  };
}
