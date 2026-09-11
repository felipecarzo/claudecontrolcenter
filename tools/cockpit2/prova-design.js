const { pagina } = require('D:\\Arquivos e Programas (D)\\browser-tools\\nav.js');
const BASE = 'http://127.0.0.1:18150/cockpit2?static=1&v=' + Date.now();
(async () => {
  const saida = {};
  async function medir(hash, larg, alt, fn) {
    const { navegador, pagina: p } = await pagina(BASE + hash, { largura: larg, altura: alt });
    await p.waitForTimeout(7000);
    const r = await p.evaluate(fn);
    await navegador.close();
    return r;
  }
  saida.inicio1280 = await medir('#inicio', 1280, 900, () => {
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const links = [...document.querySelectorAll('#view-inicio a')].map((a) => ({ t: a.innerText.slice(0, 24), cor: getComputedStyle(a).color, sub: getComputedStyle(a).textDecorationLine }));
    const cores = {}; for (const l of links) cores[l.cor + '/' + l.sub] = (cores[l.cor + '/' + l.sub] || 0) + 1;
    const notas = document.querySelector('#view-inicio .c2-nota');
    const cortada = notas ? notas.scrollHeight > notas.clientHeight : null;
    const blocos = [...document.querySelectorAll('#view-inicio .c2-duas')].map((d) => [...d.children].map((c) => Math.round(c.getBoundingClientRect().height)));
    const fora = [...document.querySelectorAll('#view-inicio *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).length;
    return { accent: acc, coresDosLinks: cores, totalLinks: links.length, notaCortadaSemAviso: cortada, alturasDasDuasMetades: blocos, elementosForaDaTela: fora };
  });
  saida.projetos1280 = await medir('#projetos2', 1280, 900, () => {
    const insp = document.getElementById('c2-insp'); const ri = insp.getBoundingClientRect();
    const botoes = [...insp.querySelectorAll('button, a')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.innerText.slice(0, 12), foraDireita: Math.round(r.right - ri.right) }; }).filter((b) => b.foraDireita > 0);
    const tabelas = [...insp.querySelectorAll('.c2-tab')].map((t) => ({ larguraTabela: Math.round(t.getBoundingClientRect().width), larguraInspetor: Math.round(ri.width), estoura: t.scrollWidth > t.clientWidth + 1 }));
    const celulasAltas = [...insp.querySelectorAll('.c2-tab td')].filter((td) => td.getBoundingClientRect().height > 40).map((td) => td.innerText.slice(0, 16));
    return { larguraInspetor: Math.round(ri.width), botoesForaDoInspetor: botoes, tabelas, celulasComMaisDeDuasLinhas: celulasAltas.length, exemplos: celulasAltas.slice(0, 4) };
  });
  saida.inicio390 = await medir('#inicio', 390, 844, () => {
    const h = document.querySelector('.main-content > header, #painel > header, header'); const r = h ? h.getBoundingClientRect() : null;
    const primeiro = document.querySelector('#view-inicio .c2-duas');
    return { alturaDoTopo: r ? Math.round(r.height) : null, ondeComecaOPrimeiroBloco: primeiro ? Math.round(primeiro.getBoundingClientRect().top) : null, alturaDaTela: innerHeight, scrollX: document.documentElement.scrollWidth };
  });
  saida.servidores1280 = await medir('#servidores2', 1280, 900, () => {
    const links = [...document.querySelectorAll('#c2-serv a')].map((a) => getComputedStyle(a).color + '/' + getComputedStyle(a).textDecorationLine);
    return { coresDosLinks: [...new Set(links)], linhas: document.querySelectorAll('#c2-serv tbody tr').length };
  });
  console.log(JSON.stringify(saida, null, 1));
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
