/**
 * CC-1063: as contas puras da sala, sem three.js nem navegador, para o Node testar (test-vr.mjs).
 * A peça src/vr/sala.js importa daqui.
 */

/** Ângulos dos cartões no arco: o primeiro no centro, os outros alternando direita e esquerda. */
export function angulosDoArco(n, passo = 34) {
  const out = []; for (let i = 0; i < n; i++) out.push(i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * passo);
  return out;
}

/** Ângulos da mesa: espalhados num leque de até 160 graus à frente, centrados, passo de no máximo 24 graus. */
export function angulosDaMesa(n, leque = 160) {
  if (n <= 1) return n ? [0] : [];
  const passo = Math.min(24, leque / (n - 1)); const ini = -passo * (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => ini + i * passo);
}

/**
 * Os botões de um cartão, a partir da ação que o servidor descreveu (src/vrEstado.mjs, acaoDoCartao). Cada um diz a
 * rota e o corpo, iguais aos que o painel manda.
 */
export function botoesDoCartao(acao) {
  if (!acao) return [];
  if (acao.tipo === 'pergunta') return acao.opcoes.map((o, j) => ({ rotulo: o, envio: { rota: 'responder', corpo: { conversa: acao.conversa, id: acao.id, respostas: [{ opcao: j }] } } }));
  if (acao.tipo === 'escolha') return acao.opcoes.map((o) => ({ rotulo: o, envio: { rota: 'permitir', corpo: { conversa: acao.conversa, id: acao.id, decisao: 'escolha:' + o } } }));
  if (acao.tipo === 'permissao') {
    const b = [{ rotulo: 'permitir uma vez', envio: { rota: 'permitir', corpo: { conversa: acao.conversa, id: acao.id, decisao: 'sim' } } }];
    if (acao.sempre) b.push({ rotulo: 'sempre permitir', envio: { rota: 'permitir', corpo: { conversa: acao.conversa, id: acao.id, decisao: 'sempre' } } });
    b.push({ rotulo: 'negar', envio: { rota: 'permitir', corpo: { conversa: acao.conversa, id: acao.id, decisao: 'nao' } }, perigo: true });
    return b;
  }
  return [];
}
