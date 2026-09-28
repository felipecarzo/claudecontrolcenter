# HANDOFF

**Sessão:** 2026-09-23 a 28/09 · VPS (`47373acb`), rota `decisoes` (liberada no
encerramento). Ponteiro, não relatório: o que foi feito está em
`docs/diario/2026-09-28.md` e no `docs/backlog.jsonl`.
**Último commit:** o deste encerramento (depois de `76d8e3a`)
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

## Pendência de commit desta sessão

Nenhuma: tudo vai no commit do encerramento (código, docs e fotos das provas).

## Task em andamento e próximo passo exato

Não há task pela metade. O próximo trabalho é a **fila do agente**
(especificação primeiro, CC-557, decisão dele em 28/09):

```
node cc.mjs backlog fila
```

Hoje: 20 itens que o agente faz e prova sozinho, em ordem; 16 esperam ele;
nenhum sem especificação. O próximo é o CC-234 (propor fechar pendência dele
quando o painel acha prova). A abertura de sessão no modo continuativo já diz
isso sozinha. Item sem especificação: `node cc.mjs backlog especificar <ID>
--pronto "..." --conferir "auto:..."` antes de fazer.

Na fila também: CC-564 (responder pelo painel as perguntas das sessões do PC)
e CC-541 a 544 (registro central de projeto, pela metade desde 12/09).

## Arquivos a ler

- `docs/produto/PADROES-DO-PAINEL.md`: as 14 regras de tela, tiradas dos
  pedidos dele; toda tela nova segue
- `src/backlog.mjs` (`filaDoAgente`, `especificar`, `leitorDoDia`)
- `src/remotecontrol.mjs` (`saudeDaTela`, `rascunhoDaTela`)
- `src/armario.mjs`, `hooks/permissao-painel.mjs`

## Estado do ROADMAP

Gerado de `docs/backlog.jsonl` (`node cc.mjs backlog gerar`), em dia neste
commit.

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
