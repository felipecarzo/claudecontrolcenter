# Protocolo do agente — como alimentar o Agent Cockpit

O `state.json` do Claude Code sabe *que* um agente está rodando. Não sabe **o
que ele está resolvendo**. Essa parte o agente escreve, em `meta.json`.

## O comando

```bash
node D:/Documentos/Ti/projetos/PESSOAL/proj_controlcenter/cc.mjs set '<json>'
```

Descobre o job sozinho por `$CLAUDE_JOB_DIR`. Fora de um job, passe
`--job <id>`. O JSON é **merge parcial**: o que não for mencionado fica como
está. Mandar `null` num campo apaga esse campo.

## Quando escrever

Três momentos. Não mais que isso — o painel é para o Felipe ler de relance,
não um log.

**1. Ao entender a tarefa** (antes da primeira edição) — **`subject`, `frente`
e `todos` juntos, não só o assunto**. `frente` é o que liga o cartão ao mapa
do projeto; sem ele, o cartão vira texto solto pra quem não tem o contexto na
cabeça:

```bash
node .../cc.mjs set '{"subject":"portais no map editor","category":"feature","frente":"Map editor","route":"B86-portais","todos":[{"text":"o portal ganha icone proprio na paleta do editor","done":false,"olho":true},{"text":"o portal pode ser arrastado e posicionado no mapa","done":false},{"text":"o save grava o portal e o load devolve ele no mesmo lugar","done":false}]}'
```

> **Cada tarefa é uma frase inteira: quem faz, o que muda, e onde.** Não é
> título de commit. O Felipe leu "profissão escolhe quem entra" em 17/08 e
> respondeu: *"os cards nunca fazem sentido (…) não tem o contexto de que é na
> verdade, tipo 'a profissão do agente define se ele entra na tarefa'"*.
>
> O sinal mecânico é a palavra de ligação (artigo, preposição, possessivo):
> sem elas o sujeito e o objeto desaparecem. Menos de duas na frase e o turno
> é devolvido para você reescrever.
>
> | ❌ telegrama | ✅ frase |
> |---|---|
> | `elenco em disco` | `o elenco de agentes é gravado em disco e sobrevive ao reinício` |
> | `corrigir layout mobile` | `os cartões param de vazar de lado no telefone` |
> | `profissao escolhe quem entra` | `a profissão do agente define se ele entra na tarefa` |

Cada to-do aceita dois campos além do texto, e os dois mudam o que o Felipe vê:

- **`olho: true`** quando a entrega muda tela, texto ou comportamento que ELE
  usa. O painel põe essas primeiro, com a marca "confira". Sem o campo, a
  tarefa é técnica: fica acessível, mas ele não é cobrado a olhar.
- **`pronto`**: como se saberá que acabou, escrito ANTES de fazer.

Dependência entre tarefas se escreve NO TEXTO, do jeito que o Felipe escreve:
`"protocolo atualizado, depende da s03"` ou `"depende do CC-112_s02"`. O
painel deriva sozinho e põe o selo "espera s03" no quadradinho; quando a
esperada fecha, vira "s03 feita". Não existe campo separado: reescrever a
lista nunca perde a dependência, porque ela nasce do texto a cada leitura.

E ao marcar rota no `docs/ROTAS-ATIVAS.md`, a reivindicação `📁` aceita
`arquivo#parte` para dividir um arquivo por escrito:
`📁 src/ui.html#viewTrabalho`. Quem TAMBÉM declarou o mesmo arquivo na
própria rota edita; quem não declarou continua barrado. Sem `#`, o arquivo é
posse inteira da rota, como sempre foi.

**2. Assim que cada to-do fecha** — um comando, sem reenviar a lista:

```bash
node .../cc.mjs done "icone proprio"
node .../cc.mjs set '{"blockers":["Supabase fora do ar, leads nao gravam"]}'
```

`done` casa por texto, sem acento e sem caixa: `"icone proprio"` fecha
`"ícone próprio"`. Reabrir é `undone "texto"`.

**3. Ao entregar** — status, links **e a lista fechada**:

```bash
node .../cc.mjs done "round-trip do save"
node .../cc.mjs set '{"status":"entregue","blockers":null,"links":[{"label":"painel","url":"http://localhost:8099"}]}'
```

> **Entregar deixando to-do aberto é erro.** Ou você fecha o que terminou, ou
> explica em `blockers` o que ficou pra trás. A aba de preço mede tempo por
> tarefa concluída: lista em aberto num agente entregue não é "cauteloso", é
> métrica perdida — e o painel denuncia na aba de to-dos.
>
> **Entregar sem `frente` também é erro**, se o projeto tem `docs/ROADMAP.md`
> com seções `###`. Sem `frente`, o mapa lateral não sabe onde encaixar este
> trabalho — mesmo problema que os `todos` tiveram antes de virar checklist de
> entrega: só documentar o campo no passo 1 não bastou, o reforço no momento
> de entregar é o que funcionou.

## Campos

| Campo | Regra |
|---|---|
| `subject` | 3 a 6 palavras, em português, o **problema** — não o comando rodado |
| `frente` | título da seção do `docs/ROADMAP.md` onde isto entra — é o que liga o cartão ao mapa do projeto |
| `category` | `feature` · `bug` · `deploy` · `research` · `refactor` · `docs` · `ops` · o que fizer sentido |
| `route` | a rota de `docs/ROTAS-ATIVAS.md` que este agente possui, quando o projeto usa esse protocolo |
| `status` | uma frase do passo atual — vence o `detail` automático |
| `todos` | `[{text, done}]`. Sempre mande a **lista inteira**; ela substitui a anterior |
| | *o painel também aceita `t`, `title`, `task`, `label` no lugar de `text`, e string solta — mas escreva `text`* |
| `blockers` | o que trava, com o motivo. `null` limpa |
| `links` | `[{label, url}]` — preview, PR, deploy |
| `notes` | armadilha que a próxima sessão precisa saber |

`todos` é a única lista que substitui em vez de somar — assim marcar um item
como feito não vira concatenação duplicada. Os checkboxes do painel web
escrevem por esse mesmo caminho.

## Onde isso está ligado

Já vale para **todos os projetos**: o bloco está no `~/.claude/CLAUDE.md`
global, entre os marcadores `<!-- control-center:start/end -->`. O painel
agrupa por projeto sozinho, a partir do diretório de trabalho.

Para reforçar num projeto específico (vocabulário próprio, rotas), use
`/cc-instalar`. Para atualizar o bloco em todo lugar depois de mudar este
protocolo, `/cc-sync`.

## Quando está desligado

`cc.mjs off` faz o `set` virar **no-op silencioso**: sai com código 0, não
escreve nada, não reclama. Então **chame sempre** — não precisa checar antes,
nem tratar erro. Um projeto pode estar desligado sozinho
(`cc.mjs off --project X`) sem que o agente saiba ou precise saber.
