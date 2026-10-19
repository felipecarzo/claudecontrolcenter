/**
 * CC-1063, M1 ("ver") e M2 ("decidir"): o arco "Esperando você" e a mesa dos agentes (docs/CC-1063.md).
 *
 * Arco: os cartões que pedem decisão, à frente, em semicírculo a 1,6 m. Embaixo de cada cartão, os botões do que dá
 * para responder dali (M2): as opções da pergunta, ou permitir, sempre e negar, com o comando à vista no cartão.
 * Cada cartão é preso ao ID do pedido e fica no MESMO lugar enquanto existir (regra 13 de design: o que está na mão
 * dele não foge). Preso à posição, um pedido novo empurrava os outros e o mesmo ponto do raio passava a decidir outro
 * pedido (revisão do M2, achado 1).
 * Mesa: cada agente é uma esfera numa roda à frente, baixa e perto, como uma mesa de trabalho: gira devagar quando
 * trabalha, pulsa em âmbar quando espera, fica cinza parada, vermelha quando falhou, sempre com o nome e a palavra do
 * estado (regra 10). Tocar uma esfera abre o chat dela (M3). A mesa fica abaixo da linha entre o olho (ou a mão) e os
 * botões dos cartões: antes ela ficava na frente deles (achado 3).
 *
 * Recebe o dado de /api/vr/estado (src/vrEstado.mjs) e só repinta o que mudou. As ações saem por `aoAgir(envio)`, e
 * quem chama as rotas é a página: esta peça não faz rede.
 */
import * as THREE from 'three';
import { painel, botao, linhas, caber, arredondado, noArco, descartar, COR, ESTADO } from './kit.js';

/* Alturas relativas ao chão de quem está SENTADO (olho em ~1,2 m); o "recentrar" desloca a sala inteira para a altura
   real da cabeça. */
export const OLHO = 1.2;
const ARCO_RAIO = 1.6, ARCO_ALTURA = OLHO + 0.1, MAX_CARTOES = 5;
const MESA_RAIO = 0.9, MESA_ALTURA = OLHO - 0.6, MAX_AGENTES = 12;
const CARTAO_L = 0.78, CARTAO_A = 0.6, BT_L = 0.37, BT_A = 0.11;
// cor dos botões de resposta: fora das cores de estado (regra 10)
const COR_BOTAO = '#5cc8ff', COR_NEGAR = '#9aa4b5';
const ESPERA_DEPOIS_DE_MUDAR = 1500; // toque num cartão que acabou de mudar não vale: ele pode estar lendo o antigo

// as contas puras moram em ./puro.js, para o Node testar sem three.js
import { angulosDoArco, angulosDaMesa, botoesDoCartao } from './puro.js';
export { angulosDoArco, angulosDaMesa, botoesDoCartao };
const VAGAS = angulosDoArco(MAX_CARTOES); // vaga 0 no centro, depois direita e esquerda alternando

/** Quebra em largura fixa letra a letra: comando não tem espaço onde quebrar, e cortar o fim esconderia o perigo. */
function quebrarDuro(ctx, texto, larg, max) {
  const out = []; let l = '';
  for (const ch of String(texto || '')) { if (ctx.measureText(l + ch).width > larg) { out.push(l); l = ch; } else l += ch; }
  if (l) out.push(l);
  return out.slice(0, max);
}

function pintarCartao(ctx, w, h, c, envio) {
  ctx.fillStyle = COR.fundo; arredondado(ctx, 0, 0, w, h, 40); ctx.fill();
  const decide = c.rotulo === 'pergunta' || c.rotulo === 'permissão';
  const corEst = decide ? COR.atencao : COR.apagado;
  ctx.fillStyle = corEst; ctx.fillRect(0, 0, 14, h); // faixa do estado na borda
  const m = 40; let y = 64;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = COR.apagado; ctx.font = '600 34px system-ui';
  ctx.fillText(caber(ctx, `${c.projeto}${c.maquina ? ', ' + c.maquina : ''}`, w - 2 * m - 220), m, y);
  ctx.fillStyle = corEst; ctx.font = '700 30px system-ui'; ctx.textAlign = 'right'; ctx.fillText(String(c.rotulo || '').toUpperCase(), w - m, y); ctx.textAlign = 'left';
  y += 66;
  const rodape = envio ? envio.texto : (c.acao && c.acao.tipo === 'no-painel' ? c.acao.motivo : (!c.acao ? 'nada a decidir aqui: veja a conversa no painel' : ''));
  const fim = h - 30 - (rodape ? 2 : 0) * 44; // onde o corpo precisa parar
  if (c.comando) {
    // permissão: o que ele quer fazer, o comando inteiro e as marcas de perigo (o painel mostra o mesmo antes do botão)
    ctx.fillStyle = COR.texto; ctx.font = '40px system-ui';
    ctx.fillText(caber(ctx, (c.ferramenta ? c.ferramenta + ': ' : '') + c.pergunta, w - 2 * m), m, y); y += 56;
    ctx.font = '34px ui-monospace, monospace';
    const ls = quebrarDuro(ctx, c.comando, w - 2 * m - 32, 4);
    ctx.fillStyle = '#0b0e14'; arredondado(ctx, m - 8, y - 34, w - 2 * m + 16, ls.length * 42 + 18, 16); ctx.fill();
    ctx.fillStyle = COR.texto; ls.forEach((l) => { ctx.fillText(l, m + 8, y); y += 42; });
    y += 14;
    ctx.font = '34px system-ui'; ctx.fillStyle = COR.erro;
    for (const p of c.perigos || []) { if (y > fim) break; ctx.fillText(caber(ctx, 'perigo: ' + p, w - 2 * m), m, y); y += 42; }
  } else {
    ctx.fillStyle = COR.texto; ctx.font = '46px system-ui';
    const ds = ((c.acao && c.acao.descricoes) || []).filter(Boolean);
    for (const l of linhas(ctx, c.pergunta, w - 2 * m, ds.length ? 2 : 5)) { if (y > fim) break; ctx.fillText(l, m, y); y += 58; }
    // a explicação de cada opção, como o painel mostra embaixo da pergunta
    ctx.font = '34px system-ui';
    ((c.acao && c.acao.opcoes) || []).forEach((o, i) => {
      const d = (c.acao.descricoes || [])[i];
      if (!d || y > fim) return;
      const rot = o + ': '; ctx.fillStyle = COR.texto; ctx.fillText(rot, m, y);
      const x = m + ctx.measureText(rot).width; ctx.fillStyle = COR.apagado; ctx.fillText(caber(ctx, d, w - m - x), x, y); y += 42;
    });
  }
  if (rodape) {
    ctx.fillStyle = envio ? (envio.erro ? COR.erro : COR.acento) : COR.apagado; ctx.font = '36px system-ui';
    const ls = linhas(ctx, rodape, w - 2 * m, 2); const y0 = h - 34 - (ls.length - 1) * 44; // encostado no fundo do cartão
    ls.forEach((l, i) => ctx.fillText(l, m, y0 + i * 44));
  }
}

function pintarRotuloAgente(ctx, w, h, a) {
  const e = ESTADO[a.estado] || ESTADO.parada;
  ctx.fillStyle = 'rgba(11,14,20,.82)'; arredondado(ctx, 0, 0, w, h, 20); ctx.fill(); // fundo próprio: legível sobre o quarto
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COR.texto; ctx.font = '600 40px system-ui'; ctx.fillText(caber(ctx, a.projeto, w - 16), w / 2, 46);
  ctx.fillStyle = e.cor; ctx.font = '34px system-ui'; ctx.fillText(caber(ctx, e.palavra + (a.maquina ? ', ' + a.maquina : ''), w - 16), w / 2, 90);
}

/**
 * Monta a sala dentro de `grupo`. `raio` é o do kit (para registrar o que se aperta); `aoAgir(envio)` recebe
 * { rota, corpo } e devolve uma promessa { ok, erro, talvez, resolvido }. `aoTocarAgente(agente)` abre o chat dele.
 */
export function criarSala(grupo, { raio, aoAgir, aoTocarAgente } = {}) {
  const porId = new Map(); const agentes = new Map();
  const g = new THREE.Group(); grupo.add(g);
  // os cartões num grupo próprio: o chat (M3) esconde todos de uma vez, e escondido o raio não os aperta
  const gc = new THREE.Group(); g.add(gc);
  /* O que aconteceu com a resposta, por PEDIDO (id da sessão + id da pergunta): sobrevive à releitura, e a pergunta
     nova da mesma sessão começa limpa (achado 8). */
  const envios = new Map();
  const chaveEnvio = (dado) => (dado?.id || '') + '|' + (dado?.acao?.id || '');

  function tirarBotoes(card) {
    for (const b of card.botoes || []) { raio?.remove(b); card.grupo.remove(b.mesh); descartar(b.mesh); }
    card.botoes = [];
  }
  function montarBotoes(card) {
    tirarBotoes(card);
    // sempre duas colunas, no máximo duas linhas: os botões não descem até a altura da mesa
    botoesDoCartao(card.dado.acao).slice(0, 4).forEach((d, i) => {
      const b = botao(d.rotulo, () => agir(card.dado.id, d), { larg: BT_L, alt: BT_A, cor: d.perigo ? COR_NEGAR : COR_BOTAO });
      b.mesh.position.set(((i % 2) - 0.5) * (BT_L + 0.03), -CARTAO_A / 2 - 0.08 - Math.floor(i / 2) * (BT_A + 0.03), 0.005);
      card.grupo.add(b.mesh); raio?.add(b); card.botoes.push(b);
    });
  }
  const mostrarBotoes = (card, sim) => card.botoes.forEach((b) => { b.mesh.visible = sim; });
  const repintar = (card) => { const ev = envios.get(chaveEnvio(card.dado)) || null; card.painel.atualizar(JSON.stringify([card.dado, ev]), card.dado, ev); };

  async function agir(id, d) {
    const card = porId.get(id); if (!card) return;
    // o cartão acabou de mudar: o que ele mirou pode ser o pedido anterior
    if (Date.now() - card.mudouEm < ESPERA_DEPOIS_DE_MUDAR) return;
    const k = chaveEnvio(card.dado);
    if (envios.get(k)?.indo) return;
    envios.set(k, { indo: true, texto: 'enviando "' + d.rotulo + '"…' }); mostrarBotoes(card, false); repintar(card);
    let r; try { r = await aoAgir?.(d.envio); } catch { r = { ok: false, erro: 'o painel não respondeu' }; }
    if (r && r.ok) envios.set(k, { texto: r.aviso || 'enviado: a sessão confirma e o cartão sai sozinho' });
    // sem confirmação no prazo: pode ter ido, e um segundo toque mandaria teclas de novo para o mesmo terminal (achado 5)
    else if (r && r.talvez) envios.set(k, { erro: true, talvez: true, texto: r.erro });
    else if (r && r.resolvido) envios.set(k, { texto: r.erro });
    else envios.set(k, { erro: true, texto: 'não foi: ' + ((r && r.erro) || 'o painel não disse por quê') });
    // o cartão é procurado de novo pelo id: a lista pode ter mudado enquanto a resposta ia
    const agora = porId.get(id); if (!agora) return;
    const ev = envios.get(chaveEnvio(agora.dado));
    if (ev && ev.erro && !ev.talvez) mostrarBotoes(agora, true);
    repintar(agora);
  }

  function tirarCartao(id) {
    const c = porId.get(id); if (!c) return;
    tirarBotoes(c); gc.remove(c.grupo); descartar(c.grupo); porId.delete(id);
  }

  function atualizar(est) {
    const cs = (est?.cartoes || []).slice(0, MAX_CARTOES);
    const vivos = new Set(cs.map((c) => c.id));
    for (const k of [...envios.keys()]) if (!vivos.has(k.split('|')[0])) envios.delete(k);
    for (const id of [...porId.keys()]) if (!vivos.has(id)) tirarCartao(id);
    const ocupadas = new Set([...porId.values()].map((c) => c.vaga));
    for (const c of cs) {
      let card = porId.get(c.id);
      if (!card) {
        const vaga = VAGAS.findIndex((_, i) => !ocupadas.has(i)); ocupadas.add(vaga);
        card = { vaga, grupo: new THREE.Group(), painel: painel(CARTAO_L, CARTAO_A, (ctx, w, h, dado, envio) => pintarCartao(ctx, w, h, dado, envio)), botoes: [], mudouEm: 0 };
        card.grupo.add(card.painel.mesh); gc.add(card.grupo); porId.set(c.id, card);
        noArco(card.grupo, VAGAS[vaga], ARCO_RAIO, ARCO_ALTURA);
      }
      const antes = card.dado ? JSON.stringify([card.dado.pergunta, card.dado.comando, card.dado.acao]) : null;
      const mudou = antes !== JSON.stringify([c.pergunta, c.comando, c.acao]);
      card.dado = c;
      if (mudou) { if (antes !== null) card.mudouEm = Date.now(); montarBotoes(card); }
      const ev = envios.get(chaveEnvio(c));
      if (ev && (ev.indo || ev.talvez || !ev.erro)) mostrarBotoes(card, false);
      repintar(card);
    }

    const as = (est?.agentes || []).slice(0, MAX_AGENTES); const ids = new Set(as.map((a) => a.id)); const angM = angulosDaMesa(as.length);
    for (const [id, o] of agentes) if (!ids.has(id)) { raio?.remove(o.alvo); g.remove(o.grupo); descartar(o.grupo); agentes.delete(id); }
    as.forEach((a, i) => {
      let o = agentes.get(a.id);
      if (!o) {
        const esf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), new THREE.MeshStandardMaterial({ color: 0x6b7484, flatShading: true, emissive: 0x000000 }));
        const rot = painel(0.3, 0.11, (ctx, w, h, dado) => pintarRotuloAgente(ctx, w, h, dado));
        const grupoA = new THREE.Group(); grupoA.add(esf, rot.mesh); g.add(grupoA);
        o = { grupo: grupoA, esf, rot, fase: Math.random() * Math.PI * 2 };
        // a esfera é alvo do raio: acende ao mirar, e tocar abre o chat daquele agente (M3)
        o.alvo = { mesh: esf, mirar: (sim) => { o.mirado = sim; }, acao: () => aoTocarAgente?.(o.dado) };
        esf.userData.alvo = o.alvo; raio?.add(o.alvo);
        agentes.set(a.id, o);
      }
      o.dado = a; o.estado = a.estado;
      const e = ESTADO[a.estado] || ESTADO.parada; o.esf.material.color.set(e.cor); o.esf.material.emissive.set(a.estado === 'esperando' ? e.cor : '#000000');
      o.rot.atualizar(JSON.stringify(a), a);
      // vizinhos em alturas alternadas pela posição de AGORA: quem sai do meio não deixa dois nomes na mesma altura
      o.rot.mesh.position.set(0, i % 2 ? -0.22 : -0.1, 0);
      noArco(o.grupo, angM[i], MESA_RAIO, MESA_ALTURA);
    });
  }

  /** Movimento barato por quadro: só rotação e escala das esferas, nada de textura. */
  function quadro(t) {
    for (const o of agentes.values()) {
      if (o.estado === 'trabalhando') o.esf.rotation.y = t * 0.0012 + o.fase;
      const pulso = o.estado === 'esperando' ? 0.18 * (0.5 + 0.5 * Math.sin(t * 0.006 + o.fase)) : 0;
      o.esf.scale.setScalar(1 + pulso + (o.mirado ? 0.25 : 0));
      if (o.estado === 'esperando') o.esf.material.emissiveIntensity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.006 + o.fase));
    }
  }
  return {
    atualizar, quadro, agentes,
    // os cartões na ordem das vagas (o do centro primeiro)
    get cartoes() { return [...porId.values()].sort((a, b) => a.vaga - b.vaga); },
    mostrarCartoes: (sim) => { gc.visible = sim; },
  };
}
