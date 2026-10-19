/**
 * CC-1063, M1 ("ver"): o arco "Esperando você" e a mesa dos agentes (docs/CC-1063.md).
 *
 * Arco: os cartões que pedem decisão, à frente, em semicírculo a 1,6 m, o mais antigo no centro. Mesa: cada agente é uma
 * esfera numa roda abaixo da linha dos olhos; gira devagar quando trabalha, pulsa em âmbar quando espera, fica cinza
 * parada, vermelha quando falhou, sempre com o nome do projeto e a palavra do estado embaixo (regra 10).
 * Recebe o dado de /api/vr/estado (src/vrEstado.mjs) e só repinta o que mudou.
 */
import * as THREE from 'three';
import { painel, linhas, caber, arredondado, noArco, COR, ESTADO } from './kit.js';

/* Alturas relativas ao chão de quem está SENTADO (olho em ~1,2 m); o "recentrar" desloca a sala inteira para a altura
   real da cabeça (revisão de 19/10: o painel em 1,45 m ficava 27° acima do olho sentado). */
export const OLHO = 1.2;
const ARCO_RAIO = 1.6, ARCO_ALTURA = OLHO, PASSO_GRAUS = 34, MAX_CARTOES = 5;
// mesa larga: com 10 agentes num leque de 0,95 m os nomes se sobrepunham (foto de 19/10)
const MESA_RAIO = 1.25, MESA_ALTURA = OLHO - 0.5, MAX_AGENTES = 12;

/** Ângulos dos cartões: o primeiro no centro, os outros alternando direita e esquerda. Puro, testado. */
export function angulosDoArco(n, passo = PASSO_GRAUS) {
  const out = []; for (let i = 0; i < n; i++) out.push(i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * passo);
  return out;
}
/** Ângulos da mesa: espalhados num leque de até 140 graus à frente, centrados. Puro, testado. */
export function angulosDaMesa(n, leque = 160) {
  if (n <= 1) return n ? [0] : [];
  const passo = Math.min(24, leque / (n - 1)); const ini = -passo * (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => ini + i * passo);
}

function pintarCartao(ctx, w, h, c) {
  ctx.fillStyle = COR.fundo; arredondado(ctx, 0, 0, w, h, 40); ctx.fill();
  const corEst = c.rotulo === 'pergunta' || c.rotulo === 'permissão' ? COR.atencao : COR.apagado;
  ctx.fillStyle = corEst; ctx.fillRect(0, 0, 14, h); // faixa do estado na borda
  const m = 40; let y = 64;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = COR.apagado; ctx.font = '600 34px system-ui';
  ctx.fillText(`${c.projeto}${c.maquina ? ' · ' + c.maquina : ''}`, m, y);
  ctx.fillStyle = corEst; ctx.font = '700 30px system-ui'; ctx.textAlign = 'right'; ctx.fillText(String(c.rotulo || '').toUpperCase(), w - m, y); ctx.textAlign = 'left';
  y += 70;
  ctx.fillStyle = COR.texto; ctx.font = '44px system-ui';
  const ls = linhas(ctx, c.pergunta, w - 2 * m, c.opcoes?.length ? 3 : 5);
  for (const l of ls) { ctx.fillText(l, m, y); y += 56; }
  if (c.opcoes?.length) {
    y += 10; ctx.font = '38px system-ui';
    c.opcoes.forEach((o, i) => {
      if (y > h - 30) return;
      ctx.fillStyle = COR.fundoAlt; arredondado(ctx, m, y - 40, w - 2 * m, 58, 18); ctx.fill();
      ctx.fillStyle = COR.texto; ctx.fillText(`${i + 1}. ${linhas(ctx, o, w - 2 * m - 60, 1)[0] || ''}`, m + 22, y); y += 70;
    });
  }
}

function pintarRotuloAgente(ctx, w, h, a) {
  const e = ESTADO[a.estado] || ESTADO.parada;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COR.texto; ctx.font = '600 40px system-ui'; ctx.fillText(caber(ctx, a.projeto, w - 16), w / 2, 46);
  ctx.fillStyle = e.cor; ctx.font = '34px system-ui'; ctx.fillText(caber(ctx, e.palavra + (a.maquina ? ' · ' + a.maquina : ''), w - 16), w / 2, 92);
}

/** Monta a sala do M1 dentro de `grupo` e devolve `atualizar(estado)` e `quadro(t)`. */
export function criarSala(grupo) {
  const cartoes = []; const agentes = new Map();
  const g = new THREE.Group(); grupo.add(g);

  function atualizar(est) {
    const cs = (est?.cartoes || []).slice(0, MAX_CARTOES); const angs = angulosDoArco(cs.length);
    while (cartoes.length > cs.length) { const c = cartoes.pop(); g.remove(c.mesh); c.mesh.geometry.dispose(); c.tex.dispose(); }
    cs.forEach((c, i) => {
      if (!cartoes[i]) { cartoes[i] = painel(0.78, 0.6, (ctx, w, h, dado) => pintarCartao(ctx, w, h, dado)); g.add(cartoes[i].mesh); }
      cartoes[i].dado = c; cartoes[i].atualizar(JSON.stringify(c), c);
      noArco(cartoes[i].mesh, angs[i], ARCO_RAIO, ARCO_ALTURA);
    });

    const as = (est?.agentes || []).slice(0, MAX_AGENTES); const vivos = new Set(as.map((a) => a.id)); const angM = angulosDaMesa(as.length);
    for (const [id, o] of agentes) if (!vivos.has(id)) { g.remove(o.grupo); agentes.delete(id); }
    as.forEach((a, i) => {
      let o = agentes.get(a.id);
      if (!o) {
        const esf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshStandardMaterial({ color: 0x6b7484, flatShading: true, emissive: 0x000000 }));
        const rot = painel(0.34, 0.11, (ctx, w, h, dado) => pintarRotuloAgente(ctx, w, h, dado));
        rot.mesh.position.set(0, i % 2 ? -0.27 : -0.14, 0); // vizinhos em alturas alternadas: os nomes não encostam
        const grupoA = new THREE.Group(); grupoA.add(esf, rot.mesh); g.add(grupoA);
        o = { grupo: grupoA, esf, rot, fase: Math.random() * Math.PI * 2 }; agentes.set(a.id, o);
      }
      o.estado = a.estado;
      const e = ESTADO[a.estado] || ESTADO.parada; o.esf.material.color.set(e.cor); o.esf.material.emissive.set(a.estado === 'esperando' ? e.cor : '#000000');
      o.rot.atualizar(JSON.stringify(a), a);
      noArco(o.grupo, angM[i], MESA_RAIO, MESA_ALTURA);
    });
  }

  /** Movimento barato por quadro: só rotação e escala das esferas, nada de textura. */
  function quadro(t) {
    for (const o of agentes.values()) {
      if (o.estado === 'trabalhando') o.esf.rotation.y = t * 0.0012 + o.fase;
      const s = o.estado === 'esperando' ? 1 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.006 + o.fase)) : 1;
      o.esf.scale.setScalar(s);
      if (o.estado === 'esperando') o.esf.material.emissiveIntensity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.006 + o.fase));
    }
  }
  return { atualizar, quadro, cartoes, agentes };
}
