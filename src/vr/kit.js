/**
 * CC-1063: o kit de peças da sala de realidade virtual (docs/CC-1063.md).
 *
 * Toda tela da sala (M1 a M8) é montada com estas peças, nunca com HTML: dentro do modo imersivo o navegador não desenha
 * página. Cada peça é um plano 3D com a textura pintada num canvas 2D, repintada só quando o conteúdo muda (o Quest 2
 * precisa de 72 quadros por segundo e repintar textura é caro).
 *
 * Régua (a medir no M0 com ele): PX_POR_M px de canvas por metro; a letra base sai de LETRA_BASE_MM.
 */
import * as THREE from 'three';

export const PX_POR_M = 900;
export const COR = {
  fundo: '#151a23', fundoAlt: '#1c2230', texto: '#e8ecf3', apagado: '#9aa4b5', acento: '#7c8cff',
  ok: '#3ecf8e', atencao: '#f5a524', erro: '#ef5b5b', borda: '#2a3140',
};
/** Estado do agente: cor e palavra juntas (regra 10 de design: cor nunca fala sozinha). */
export const ESTADO = {
  trabalhando: { cor: '#7c8cff', palavra: 'trabalhando' },
  esperando: { cor: '#f5a524', palavra: 'esperando você' },
  parada: { cor: '#6b7484', palavra: 'parada' },
  falhou: { cor: '#ef5b5b', palavra: 'falhou' },
};

/** Retângulo de cantos redondos. */
export function arredondado(ctx, x, y, w, h, r = 36) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Quebra o texto em até `max` linhas que cabem em `larg`; a última leva reticências se sobrar. Puro sobre o ctx. */
export function linhas(ctx, texto, larg, max = 3) {
  const palavras = String(texto || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); const out = []; let l = '';
  for (const p of palavras) { const t = l ? l + ' ' + p : p; if (ctx.measureText(t).width > larg && l) { out.push(l); l = p; } else l = t; }
  if (l) out.push(l);
  if (out.length > max) { const v = out.slice(0, max); v[max - 1] = v[max - 1].replace(/\s*\S*$/, '') + '…'; return v; }
  return out;
}

/** Uma linha que cabe em `larg`: encurta com reticências (palavra única longa também, que `linhas` não quebra). */
export function caber(ctx, texto, larg) {
  let t = String(texto || '');
  if (ctx.measureText(t).width <= larg) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > larg) t = t.slice(0, -1);
  return t + '…';
}

/**
 * Um painel: plano de `larg` x `alt` metros com uma textura de canvas. `pintar(ctx, w, h)` desenha; `atualizar(chave)`
 * só repinta quando a chave muda.
 */
export function painel(larg, alt, pintar, { pxPorM = PX_POR_M } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.max(16, Math.round(larg * pxPorM)); c.height = Math.max(16, Math.round(alt * pxPorM));
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(larg, alt), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  const P = {
    mesh, c, ctx, tex, larg, alt, chave: null, pintar,
    atualizar(chave, ...args) {
      if (chave !== undefined && chave === P.chave) return false;
      P.chave = chave; ctx.clearRect(0, 0, c.width, c.height); P.pintar(ctx, c.width, c.height, ...args); tex.needsUpdate = true; return true;
    },
  };
  return P;
}

/** Um botão: painel com fundo e texto, que reage ao raio (acende ao mirar) e chama `acao` ao apertar. */
export function botao(texto, acao, { larg = 0.36, alt = 0.12, cor = COR.acento } = {}) {
  let aceso = false, rot = texto;
  const B = painel(larg, alt, (ctx, w, h) => {
    ctx.fillStyle = aceso ? cor : COR.fundoAlt; arredondado(ctx, 0, 0, w, h, 28); ctx.fill();
    ctx.strokeStyle = cor; ctx.lineWidth = 6; arredondado(ctx, 3, 3, w - 6, h - 6, 26); ctx.stroke();
    ctx.fillStyle = aceso ? '#0b0e14' : COR.texto; ctx.font = `600 ${Math.round(h * 0.4)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(caber(ctx, rot, w - 40), w / 2, h / 2 + 2);
  });
  B.mesh.userData.alvo = B; B.acao = acao;
  B.mirar = (sim) => { if (sim !== aceso) { aceso = sim; B.atualizar(rot + aceso); } };
  B.texto = (t) => { rot = t; B.atualizar(rot + aceso); };
  B.atualizar(rot + aceso);
  return B;
}

/**
 * O raio: controles (gatilho) e mãos (pinça) chegam como o mesmo evento "select" do WebXR. Mantém a lista de alvos
 * clicáveis, acende o mirado a cada quadro e chama a ação do alvo no select. No modo de tela, o clique do mouse.
 */
export function criarRaio(renderer, scene, camera, canvas) {
  const alvos = new Set(); const ray = new THREE.Raycaster();
  const ctls = []; let mirado = null;
  const acertar = () => ray.intersectObjects([...alvos].filter((a) => a.mesh.visible).map((a) => a.mesh), false)[0]?.object?.userData?.alvo || null;
  for (let i = 0; i < 2; i++) {
    const ctl = renderer.xr.getController(i);
    const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x7c8cff }));
    linha.scale.z = 3; ctl.add(linha);
    ctl.addEventListener('connected', (ev) => { ctl.userData.fonte = ev.data; });
    ctl.addEventListener('select', () => {
      ray.setFromXRController(ctl); const a = acertar();
      if (a) { a.acao?.(a); try { ctl.userData.fonte?.gamepad?.hapticActuators?.[0]?.pulse?.(0.5, 40); } catch { /* sem vibração */ } }
    });
    scene.add(ctl); ctls.push(ctl);
  }
  canvas.addEventListener('click', (ev) => {
    if (renderer.xr.isPresenting) return;
    ray.setFromCamera(new THREE.Vector2((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1), camera);
    const a = acertar(); a?.acao?.(a);
  });
  return {
    add: (a) => { alvos.add(a); return a; }, remove: (a) => alvos.delete(a),
    /** chamar a cada quadro: acende o que o primeiro controle mira. Barato: um raio contra poucos planos. */
    quadro() {
      if (!renderer.xr.isPresenting) return;
      let novo = null; for (const ctl of ctls) { ray.setFromXRController(ctl); novo = acertar(); if (novo) break; }
      if (novo !== mirado) { mirado?.mirar?.(false); novo?.mirar?.(true); mirado = novo; }
    },
    vibrar(forca = 0.8, ms = 120) { for (const c of ctls) { try { c.userData.fonte?.gamepad?.hapticActuators?.[0]?.pulse?.(forca, ms); } catch { /* sem */ } } },
  };
}

/** Posição num arco em volta de quem está no centro: `angulo` em graus (0 = à frente), `raio` em metros. */
export function noArco(obj, angulo, raio = 1.6, altura = 1.4) {
  const a = THREE.MathUtils.degToRad(angulo);
  obj.position.set(Math.sin(a) * raio, altura, -Math.cos(a) * raio);
  obj.lookAt(0, altura, 0);
  return obj;
}
