const { pagina } = require('D:\\Arquivos e Programas (D)\\browser-tools\\nav.js');
const fs = require('fs');
const path = require('path');
const BASE = process.argv[3] || 'http://127.0.0.1:18150/cockpit2';
const OUT = process.argv[2];

(async () => {
  const relat = [];
  async function foto(hash, larg, alt, nome, esperaMs = 6500) {
    const { navegador, pagina: p } = await pagina(BASE + '?static=1&v=' + Date.now() + hash, { largura: larg, altura: alt });
    const erros = [];
    p.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 160)); });
    await p.waitForTimeout(esperaMs);
    const info = await p.evaluate(() => {
      const v = document.querySelector('.view-section.active');
      const bb = [...document.querySelectorAll('#barra-baixo .bb-item')].map((b) => { const r = b.getBoundingClientRect(); return Math.round(r.left + r.width / 2); });
      const t = (v?.innerText || '').replace(/\s+/g, ' ');
      return { largura: innerWidth, ativa: v?.id, titulo: document.getElementById('header-title')?.innerText, chars: t.length, texto: t.slice(0, 200), scrollW: document.documentElement.scrollWidth, altura: document.documentElement.scrollHeight, centrosBarra: bb, vazios: [...document.querySelectorAll('.view-section.active .c2-vazio')].map((e) => e.innerText).slice(0, 8), naoLeu: [...document.querySelectorAll('.view-section.active .c2-vazio')].filter((e) => /não deu/.test(e.innerText)).length };
    });
    console.error('medido', nome, JSON.stringify(info));
    const cdp = await p.context().newCDPSession(p);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT, nome), Buffer.from(data, 'base64'));
    await cdp.detach();
    relat.push({ nome, ...info, erros });
    await navegador.close();
  }
  await foto('#inicio', 1280, 900, 'cockpit2-inicio-1280.png');
  await foto('#inicio', 1280, 1500, 'cockpit2-inicio-1280-inteiro.png');
  await foto('#projetos2', 1280, 900, 'cockpit2-projetos-1280.png');
  await foto('#servidores2', 1280, 900, 'cockpit2-servidores-1280.png');
  await foto('#inicio', 390, 844, 'cockpit2-inicio-390.png');
  await foto('#projetos2', 390, 844, 'cockpit2-projetos-390.png');
  console.log(JSON.stringify(relat.map((r) => ({ nome: r.nome, titulo: r.titulo, chars: r.chars, scrollW: r.scrollW, altura: r.altura, naoLeu: r.naoLeu, erros: r.erros })), null, 1));
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
