# HANDOFF

**Última sessão:** `5ba0551c`, 08/10. Ponteiro, não relatório: o feito está em `docs/diario/2026-10-08.md`
e no histórico de cada item (`node cc.mjs backlog historia <ID>`).
**Commit:** NADA commitado desta sessão (ele não pediu). Fora também: `scratch/` e `screenshot-coderoom.png`.
**Branch:** `backlog/cc-46-48-49-52-53-56-65`. Rotas `modelo` e `cockpit2` marcadas por 5ba0551c: liberar ao commitar.

## Próximo

- Em prova esperando o olho dele: CC-984, CC-991 a CC-997 (lista no diário de 08/10).
- Próximo da fila: CC-985 (guia de cada projeto), Sonnet esforço alto.
- Em prova esperando o celular dele: CC-986 (área de ideias no Caminho), CC-987 (abas como apps), CC-983, CC-988,
  CC-990, CC-975, CC-976 e os PR anteriores.
- Tarefas dele (lista "meu"): modelo padrão global em opusplan e reinstalar a porta de entrada (comandos nas tarefas),
  trocar as chaves vazadas, cabeçalhos do nginx.
- Regra nova de economia: memória `modelo-padrao-opusplan`. Os projetos da VPS abrem em opusplan (Conta de Casa em
  Opus) pelo `.claude/settings.local.json` de cada um.

## Sessão 599331d1 (07 e 08/10, rota `gate`, liberada ao fechar)

- **Em prova:** CC-879 (cartão do Coderoom com resumo e tarefas do robô), CC-980 (conversa de micro tarefa que
  acabou é arquivada), CC-1004 (robô não culpa nem desfaz por foto de design do painel), CC-1005 (robô não
  repropõe conserto já aprovado). Detalhe no diário de 08/10.
- **Código SEM commit desta sessão:** `src/maestro.mjs`, `src/arquiteto.mjs`, `src/cockpit2.mjs`,
  `test-tarefa.mjs`, `test-cockpit2.mjs` (parte do `ui_cockpit2.html` e do `gate.mjs` entrou no 37c8164 de outra
  sessão).
- **Conta de Casa:** Coderoom com uma conversa só (`41s39k-v4cf`). Os itens de backup dele fecharam; o cartão
  fica "parou" até o próximo passo do robô. Na próxima rodada, conferir se sumiram as reprovações "fora do
  declarado" por `docs/cartas/`.
- **Na fila:** CC-978 (checklist do agente no cartão), CC-979 (pedido dado por falho em app sem build).

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
