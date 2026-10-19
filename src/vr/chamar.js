/**
 * CC-1063, M4 ("ser chamado"): quando um pedido NOVO passa a esperar por ele, a sala avisa com som, vibração no
 * controle e um pulso no cabeçalho. Plano em docs/CC-1063.md.
 *
 * Só pedido novo chama. O que já estava na tela ao entrar não chama, e o que some e volta em poucos minutos também
 * não: o pacote do PC às vezes vem sem um cartão por um ciclo (CC-1060), e cada volta tocaria de novo.
 * Sem three.js: a conta `novos` roda no Node (test-vr.mjs).
 */

export const MEMORIA_MS = 10 * 60 * 1000; // cartão visto há menos disso não chama de novo

/**
 * Os ids que devem chamar agora. `vistos` é um Map id -> último instante visto, atualizado aqui. Na primeira leitura
 * (`vistos` vazio e `primeira` verdadeiro) só memoriza: o que já esperava ao entrar não é novidade.
 */
export function novos(vistos, ids, agora = Date.now(), primeira = false) {
  const out = [];
  for (const id of ids) {
    const ult = vistos.get(id);
    if (!primeira && (ult === undefined || agora - ult > MEMORIA_MS)) out.push(id);
    vistos.set(id, agora);
  }
  for (const [id, t] of vistos) if (agora - t > MEMORIA_MS) vistos.delete(id);
  return out;
}

/**
 * O aviso em si. O som usa Web Audio (dois tons curtos, sem arquivo), e o navegador só deixa tocar depois de um
 * gesto: `destravar()` vai no clique de entrar na sala. `vibrar(forca, ms)` vem do raio do kit.
 */
export function criarChamado({ vibrar } = {}) {
  let ctx = null, ligado = true;
  function destravar() {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch { ctx = null; }
  }
  function tom(freq, ini, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime + ini;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function chamar() {
    if (!ligado) return false;
    if (ctx && ctx.state === 'running') { try { tom(660, 0, 0.18); tom(880, 0.16, 0.26); } catch { /* sem som */ } }
    vibrar?.(0.7, 120); setTimeout(() => vibrar?.(0.7, 120), 220);
    return true;
  }
  return { destravar, chamar, get ligado() { return ligado; }, alternar() { ligado = !ligado; return ligado; } };
}
