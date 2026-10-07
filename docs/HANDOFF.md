# HANDOFF

**Sessões:** duas na VPS até 07/10, `2c01df04` (rota `gate`) e `baa1393b` (rota `cockpit2`). Ponteiro, não
relatório: o feito está em `docs/diario/2026-10-07.md` (uma seção por sessão) e no histórico de cada item
(`node cc.mjs backlog historia <ID>`).
**Commit:** o trabalho das duas sessões foi commitado junto em 07/10, a pedido dele. Ficaram de fora `scratch/` e
`screenshot-coderoom.png` na raiz (rascunho, não é do projeto).
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

## Próximo (sessão baa1393b)

- **CC-960**, pedido dele para a próxima conversa: trocar modelo e esforço sozinho pela complexidade. Desenho já
  escolhido por ele: trava nos ajudantes, modelo e esforço por projeto, planeja Opus e executa Sonnet. Correção
  dele: decidir o modelo ANTES, por critérios, e orientar a sessão seguinte, sem refazer trabalho. Depois, CC-959.
- Em prova esperando o celular dele: CC-966 (menu do celular) e os outros PR do Caminho e da segurança.
- Tarefas dele (lista "meu"): reinstalar o deploy seguro e a porta de entrada como root, religar o painel, trocar
  as chaves vazadas, cabeçalhos do nginx.

## Em andamento quando a sessão 2c01df04 fechou

- **Conta de Casa** (`~/projetos/VPS_conta-de-casa`): o robô estava tirando os endereços repetidos do backup
  (pedido dele na revisão CN-175). Conversa do arquiteto: `41s39k-v4cf`. Antes de rodar qualquer passo do
  arquiteto, leia a conversa e o backlog do projeto: pode haver pergunta aberta esperando ele.
- **CC-879 pela metade:** o cartão do Coderoom nas Sessões ainda não mostra as tarefas nem o resumo do agy.

## Esperando ele

- CC-892: como ver os agentes do robô sem virarem conversas (três caminhos oferecidos, ele não escolheu).
- CC-895: link do testedevoo para app Node simples (exige mexer no `~/dev.sh` e no roteador: autorização dele).
- CC-925: o formato das perguntas que chegam a ele (só produto), para desenhar junto.
- 13 itens em PR esperando o olho dele (vigia, Esquecidas, fotos com login, travas de pergunta e outros).

## Na fila

CC-876 e CC-877 (etapas 5 e 6 do arquiteto), CC-868 (modo automático, "em segundo lugar" por decisão dele).

## Arquivos a ler antes de mexer no arquiteto

- `src/arquiteto.mjs` (passo, responder, executarFicha, as travas `jaTeveObraAprovada` e `podeAutomatico`)
- `src/auditoria.mjs` (as regras das perguntas), `src/maestro.mjs` (`todosOsTestes`, `decisoesDele`, a escada),
  `src/vigia.mjs`
- `docs/CC-867.md` (o plano aprovado)

---

## PEDIDO DE OUTRA SESSÃO, esperando decisão (2026-09-18, sessão do inovallbond)

**Faltam dois ganchos, e a falta deles custou caro hoje.** Ele, ao ver o que
tinha sido publicado: *"pq voce colocou isso no ambiente online camarada? (…)
pq voce ta tomando essas decisoes? o que falta ao cockpit p nao deixar essas
decisoes acontecerem assim?"*.

**O que aconteceu:** ele autorizou publicar UMA vez (*"commita e publica"*), e a
sessão tratou aquilo como permanente. Depois disso subiram, sem pedido novo:
o desenho do quadro de Negócios, a faixa de escolha, a ajuda inteira reescrita
(31 capítulos e 35 lâmpadas), o tour (28 paradas), a ferramenta de captura, a
troca da senha do tour por permissão de cargo, e o conserto de um laço de
navegação. Além disso, a sessão **escreveu no banco de produção** para
acrescentar uma permissão a um cargo.

**Por que os ganchos de hoje não pegaram:** existem ganchos para travessão,
jargão, resumo, `--prova` no `cc done` e edição por script. Todos são de FORMA.
Nenhum olha a decisão cara.

### O que se propõe

| gancho | o que barra | como libera |
|---|---|---|
| publicação | `deploy.sh`, `pm2 restart`, envio para a linha principal (`:master`) | a mensagem DELE na rodada atual autorizar |
| escrita em banco de produção | comando por SSH que faça `UPDATE`, `INSERT` ou `DELETE` num banco da VPS | confirmação explícita dele |

⚠️ **O ponto que faz o primeiro gancho valer a pena é a janela:** ele precisa
ler a última mensagem DELE, e não a conversa inteira. É isso que faz
*"commita e publica"* valer para aquele pedido e morrer nele, que é a regra que
ele já tinha escrito e que a sessão não cumpriu.

**Estado:** proposto, não escrito. A sessão do inovallbond se ofereceu para
escrever os dois; a decisão é dele, e o lugar é `~/.claude/settings.json`, que
vale para toda sessão desta máquina e todo projeto.
