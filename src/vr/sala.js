/**
 * CC-1063, M1 ("ver") e M2 ("decidir"): o arco "Esperando você" e a mesa dos agentes (docs/CC-1063.md).
 *
 * Arco: os cartões que pedem decisão, à frente, em semicírculo a 1,6 m, o mais antigo no centro. Embaixo de cada
 * cartão, os botões do que dá para responder dali (M2): as opções da pergunta, ou permitir, sempre e negar.
 * Mesa: cada agente é uma esfera numa roda abaixo da linha dos olhos; gira devagar quando trabalha, pulsa em âmbar
 * quando espera, fica cinza parada, vermelha quando falhou, sempre com o nome e a palavra do estado (regra 10).
 * Apertar uma esfera que trabalha oferece "parar", que pede um segundo toque para confirmar (desfaz trabalho).
 *
 * Recebe o dado de /api/vr/estado (src/vrEstado.mjs) e só repinta o que mudou. As ações saem por `aoAgir(acao)`, e
 * quem chama as rotas é a página: esta peça não faz rede.
 */
import * as THREE from 'three';
import { painel, botao, linhas, caber, arredondado, noArco, COR, ESTADO } from './kit.js';

/* Alturas relativas ao chão de quem está SENTADO (olho em ~1,2 m); o "recentrar" desloca a sala inteira para a altura
   real da cabeça (revisão de 19/10: o painel em 1,45 m ficava 27° acima do olho sentado). */
export const OLHO = 1.2;
const ARCO_RAIO = 1.6, ARCO_ALTURA = OLHO + 0.08, MAX_CARTOES = 5;
// mesa larga: com 10 agentes num leque de 0,95 m os nomes se sobrepunham (foto de 19/10)
const MESA_RAIO = 1.25, MESA_ALTURA = OLHO - 0.55, MAX_AGENTES = 12;
const CARTAO_L = 0.78, CARTAO_A = 0.5, BT_L = 0.37, BT_A = 0.11;

// as contas puras moram em ./puro.js, para o Node testar sem three.js
import { angulosDoArco, angulosDaMesa, botoesDoCartao } from './puro.js';
export { angulosDoArco, angulosDaMesa, botoesDoCartao };

function pintarCartao(ctx, w, h, c, envio) {
  ctx.fillStyle = COR.fundo; arredondado(ctx, 0, 0, w, h, 40); ctx.fill();
  const decide = c.rotulo === 'pergunta' || c.rotulo === 'permissão';
  const corEst = decide ? COR.atencao : COR.apagado;
  ctx.fillStyle = corEst; ctx.fillRect(0, 0, 14, h); // faixa do estado na borda
  const m = 40; let y = 64;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = COR.apagado; ctx.font = '600 34px system-ui';
  ctx.fillText(caber(ctx, `${c.projeto}${c.maquina ? ' · ' + c.maquina : ''}`, w - 2 * m - 220), m, y);
  ctx.fillStyle = corEst; ctx.font = '700 30px system-ui'; ctx.textAlign = 'right'; ctx.fillText(String(c.rotulo || '').toUpperCase(), w - m, y); ctx.textAlign = 'left';
  y += 72;
  ctx.fillStyle = COR.texto; ctx.font = '46px system-ui';
  for (const l of linhas(ctx, c.pergunta, w - 2 * m, envio ? 3 : 4)) { ctx.fillText(l, m, y); y += 58; }
  // o rodapé diz o que está acontecendo com a resposta, ou por que o cartão não tem botão
  const rodape = envio ? envio.texto : (c.acao && c.acao.tipo === 'no-painel' ? c.acao.motivo : (!c.acao ? 'nada a decidir aqui: veja a conversa no painel' : ''));
  if (rodape) {
    ctx.fillStyle = envio ? (envio.erro ? COR.erro : COR.acento) : COR.apagado; ctx.font = '36px system-ui';
    const ls = linhas(ctx, rodape, w - 2 * m, 2); const y0 = h - 34 - (ls.length - 1) * 44; // encostado no fundo do cartão
    ls.forEach((l, i) => ctx.fillText(l, m, y0 + i * 44));
  }
}

function pintarRotuloAgente(ctx, w, h, a) {
  const e = ESTADO[a.estado] || ESTADO.parada;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COR.texto; ctx.font = '600 40px system-ui'; ctx.fillText(caber(ctx, a.projeto, w - 16), w / 2, 46);
  ctx.fillStyle = e.cor; ctx.font = '34px system-ui'; ctx.fillText(caber(ctx, e.palavra + (a.maquina ? ' · ' + a.maquina : ''), w - 16), w / 2, 92);
}

/**
 * Monta a sala dentro de `grupo`. `raio` é o do kit (para registrar o que se aperta); `aoAgir(envio, cartao)` recebe
 * { rota, corpo } e devolve uma promessa { ok, erro }.
 */
export function criarSala(grupo, { raio, aoAgir } = {}) {
  const cartoes = []; const agentes = new Map();
  const g = new THREE.Group(); grupo.add(g);
  const envios = new Map(); // id do cartão -> { texto, erro }: sobrevive à releitura

  function montarBotoes(card) {
    for (const b of card.botoes || []) { raio?.remove(b); card.grupo.remove(b.mesh); b.mesh.geometry.dispose(); b.tex.dispose(); }
    card.botoes = [];
    const defs = botoesDoCartao(card.dado.acao); if (!defs.length) return;
    // rótulo longo ("permitir uma vez") não cabe em meia largura: aí é uma coluna, na largura do cartão
    const umaColuna = defs.some((d) => String(d.rotulo).length > 13);
    const larg = umaColuna ? CARTAO_L : BT_L;
    defs.forEach((d, i) => {
      const b = botao(d.rotulo, () => agir(card, d), { larg, alt: BT_A, cor: d.perigo ? '#9aa4b5' : COR.acento });
      const col = umaColuna ? 0 : i % 2, lin = umaColuna ? i : Math.floor(i / 2);
      b.mesh.position.set(umaColuna ? 0 : (col - 0.5) * (BT_L + 0.03), -CARTAO_A / 2 - 0.08 - lin * (BT_A + 0.03), 0.005);
      card.grupo.add(b.mesh); raio?.add(b); card.botoes.push(b);
    });
  }
  async function agir(card, d) {
    if (envios.get(card.dado.id)?.indo) return;
    envios.set(card.dado.id, { indo: true, texto: 'enviando "' + d.rotulo + '"…' }); repintar(card);
    card.botoes.forEach((b) => { b.mesh.visible = false; });
    let r; try { r = await aoAgir?.(d.envio, card.dado); } catch (e) { r = { ok: false, erro: 'o painel não respondeu' }; }
    if (r && r.ok) envios.set(card.dado.id, { texto: 'enviado: a sessão confirma e o cartão sai sozinho' });
    else { envios.set(card.dado.id, { erro: true, texto: 'não foi: ' + ((r && (r.erro || r.error)) || 'sem motivo dito') }); card.botoes.forEach((b) => { b.mesh.visible = true; }); }
    repintar(card);
  }
  const repintar = (card) => card.painel.atualizar(JSON.stringify([card.dado, envios.get(card.dado.id) || null]), card.dado, envios.get(card.dado.id) || null);

  function atualizar(est) {
    const cs = (est?.cartoes || []).slice(0, MAX_CARTOES); const angs = angulosDoArco(cs.length);
    const vivos = new Set(cs.map((c) => c.id)); for (const id of [...envios.keys()]) if (!vivos.has(id)) envios.delete(id);
    while (cartoes.length > cs.length) {
      const c = cartoes.pop(); for (const b of c.botoes || []) raio?.remove(b);
      g.remove(c.grupo); c.painel.mesh.geometry.dispose(); c.painel.tex.dispose();
    }
    cs.forEach((c, i) => {
      let card = cartoes[i];
      if (!card) {
        card = { grupo: new THREE.Group(), painel: painel(CARTAO_L, CARTAO_A, (ctx, w, h, dado, envio) => pintarCartao(ctx, w, h, dado, envio)), botoes: [] };
        card.grupo.add(card.painel.mesh); g.add(card.grupo); cartoes[i] = card;
      }
      const mudouAcao = JSON.stringify(card.dado?.acao || null) + card.dado?.id !== JSON.stringify(c.acao || null) + c.id;
      card.dado = c; repintar(card);
      if (mudouAcao) montarBotoes(card);
      if (envios.get(c.id)?.indo) card.botoes.forEach((b) => { b.mesh.visible = false; });
      noArco(card.grupo, angs[i], ARCO_RAIO, ARCO_ALTURA);
    });

    const as = (est?.agentes || []).slice(0, MAX_AGENTES); const ids = new Set(as.map((a) => a.id)); const angM = angulosDaMesa(as.length);
    for (const [id, o] of agentes) if (!ids.has(id)) { raio?.remove(o.alvo); raio?.remove(o.btParar); g.remove(o.grupo); agentes.delete(id); }
    as.forEach((a, i) => {
      let o = agentes.get(a.id);
      if (!o) {
        const esf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), new THREE.MeshStandardMaterial({ color: 0x6b7484, flatShading: true, emissive: 0x000000 }));
        const rot = painel(0.34, 0.11, (ctx, w, h, dado) => pintarRotuloAgente(ctx, w, h, dado));
        rot.mesh.position.set(0, i % 2 ? -0.27 : -0.14, 0); // vizinhos em alturas alternadas: os nomes não encostam
        const grupoA = new THREE.Group(); grupoA.add(esf, rot.mesh); g.add(grupoA);
        o = { grupo: grupoA, esf, rot, fase: Math.random() * Math.PI * 2 };
        // a esfera é alvo do raio: acende ao mirar e, se trabalha, oferece parar
        o.alvo = { mesh: esf, mirar: (sim) => { o.mirado = sim; }, acao: () => alternarParar(o) };
        esf.userData.alvo = o.alvo; raio?.add(o.alvo);
        agentes.set(a.id, o);
      }
      o.dado = a; o.estado = a.estado;
      const e = ESTADO[a.estado] || ESTADO.parada; o.esf.material.color.set(e.cor); o.esf.material.emissive.set(a.estado === 'esperando' ? e.cor : '#000000');
      o.rot.atualizar(JSON.stringify(a), a);
      if (o.btParar && a.estado !== 'trabalhando') esconderParar(o);
      noArco(o.grupo, angM[i], MESA_RAIO, MESA_ALTURA);
    });
  }

  // parar: primeiro toque mostra o botão; o botão pede confirmação no segundo toque, em até 4 s
  function alternarParar(o) {
    if (o.estado !== 'trabalhando' || !o.dado?.conversa) return;
    if (o.btParar) { esconderParar(o); return; }
    let armado = false, timer = null;
    o.btParar = botao('parar', async (b) => {
      if (!armado) { armado = true; b.texto('tocar de novo para parar'); timer = setTimeout(() => { armado = false; b.texto('parar'); }, 4000); return; }
      clearTimeout(timer); b.texto('parando…');
      let r; try { r = await aoAgir?.({ rota: 'parar', corpo: { conversa: o.dado.conversa } }, o.dado); } catch { r = { ok: false } }
      b.texto(r && r.ok ? 'parado' : 'não parou: ' + ((r && (r.erro || r.error)) || 'sem resposta'));
      setTimeout(() => esconderParar(o), 2500);
    }, { larg: 0.42, alt: 0.1, cor: '#ef5b5b' });
    o.btParar.mesh.position.set(0, 0.16, 0); o.grupo.add(o.btParar.mesh); raio?.add(o.btParar);
  }
  function esconderParar(o) { if (!o.btParar) return; raio?.remove(o.btParar); o.grupo.remove(o.btParar.mesh); o.btParar = null; }

  /** Movimento barato por quadro: só rotação e escala das esferas, nada de textura. */
  function quadro(t) {
    for (const o of agentes.values()) {
      if (o.estado === 'trabalhando') o.esf.rotation.y = t * 0.0012 + o.fase;
      const pulso = o.estado === 'esperando' ? 0.18 * (0.5 + 0.5 * Math.sin(t * 0.006 + o.fase)) : 0;
      o.esf.scale.setScalar(1 + pulso + (o.mirado ? 0.25 : 0));
      if (o.estado === 'esperando') o.esf.material.emissiveIntensity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.006 + o.fase));
    }
  }
  return { atualizar, quadro, cartoes, agentes };
}
