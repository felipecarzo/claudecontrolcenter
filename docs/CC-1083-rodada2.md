# CC-1083, rodada 2 da pesquisa de práticas de mercado

Para uma sessão NOVA (cota de busca nova). Pedido do Felipe em 03/11/2026: a pesquisa tem de iterar até saturar, cobrindo
o máximo de produtos reais por tipo de plataforma. Escolha dele para esta rodada: "sessão nova + demos".

## O que já existe (rodada 1)

- Base em `~/projetos/VPS_cockpit/dados/roteiro-mercado/<familia>.json`: 9 famílias, 65 tipos, 835 padrões.
  Formato e método em `/home/claudedev/projetos/ecommerce_apps/docs/produto/pesquisa-mercado-2026-11-03/BRIEF.md`
  (cópia permanente; a pasta temporária original pode ter sumido).
- Limite da rodada 1: quase tudo veio de TEXTO de central de ajuda, sem ver tela. Muitos tipos ficaram com 2 a 7 produtos
  (a meta é 8 a 10). A prevalência "X de Y" é piso.

## O que fazer nesta rodada

1. Para cada família, leia o `.json` e liste os tipos com menos de 8 produtos e os padrões marcados com confiança baixa.
2. Complete olhando TELA, não só texto, pelo que abre desta VPS:
   - demonstrações públicas (ex.: painel do WooCommerce em demo, Odoo demo, Django admin demo, templates de admin abertos);
   - imagens e GIFs das centrais de ajuda oficiais (abra a página e descreva o que a imagem mostra);
   - vídeos de tour oficiais (título, descrição e capítulos);
   - o navegador sem tela desta VPS (skill `remote-browser`) para sites que não bloqueiam. Os grandes (Amazon, Magalu,
     Shopee, Netshoes, Zara, Casas Bahia, Etsy, iFood, Decolar) bloqueiam endereço de servidor: não insista nem contorne.
3. Para cada padrão: atualize `presente_em`, `prevalencia` e o `como_olhou` de cada produto (TELA VISTA, IMAGEM DA AJUDA,
   VÍDEO, DEMO, TEXTO). Padrão novo entra com o mesmo formato.
4. **Saturação:** por tipo, conte quantos padrões NOVOS a rodada trouxe. Se for menos de 10% dos que já existiam, o tipo
   está saturado; senão, marque para rodada 3. Escreva isso em `saturacao` no topo do arquivo da família.
5. Prioridade: painel-de-loja (clientes, cupons, relatórios e configurações ficaram com 4 a 7 produtos), sistemas-de-gestao
   (ERP 4, CRM 7), comercio (marketplace, reserva e agendamento com 3 a 5), midia e comunidade-e-comunicacao.

## Onde gravar

- Por cima dos arquivos em `~/projetos/VPS_cockpit/dados/roteiro-mercado/` (com `"rodada": 2`), um de cada vez, conferindo
  que o JSON continua válido (`node -e "JSON.parse(require('fs').readFileSync('<arquivo>','utf8'))"`).
- Depois avise a sessão do ecommerce_apps (`ecommerce-apps-b5`), que pediu o caminho da rodada 2.

## Regras

- Português do Brasil, nunca travessão. Nada inventado: produto sem comportamento visto não conta.
- Pode usar subagentes em paralelo (um por família), cada um com a sua parte, e conferir ao juntar.
