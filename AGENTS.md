# Protocolo do agente — como alimentar o Agent Cockpit

Conferência padrão: auto:npm test
(validada em 02/10: o teste geral do cockpit)

## Escopo do projeto

Agent Cockpit: o painel dos agentes do Claude Code, onde também mora o Nisaba (backlog em dado, maestro e conferência). Uma linha por agente, agrupada por projeto. Sem dependência de runtime: só Node 18 ou mais.

- `cc.mjs`: entrada única (CLI, servidor web, daemon, `set`, `done`, `backlog`).
- `src/`: um módulo por assunto. `platform.mjs` concentra o que depende do sistema operacional. `web.mjs` é o servidor HTTP e as rotas. `ui_cockpit2.html` e `ui_novo.html` são as telas.
- `src/backlog.mjs`, `src/maestro.mjs` e `src/conferencia.mjs`: o Nisaba.
- `hooks/`: os guardas do Claude Code (`*-guard.mjs`, Routia). Hook novo entra em `src/hooksCatalogo.mjs` antes de funcionar.
- `skills/`: skills distribuídas pelo painel. `test*.mjs` na raiz: o gate.
- `docs/README.md`: mapa da documentação. `CLAUDE.md`: as armadilhas já pagas.

Regras para qualquer tarefa:

- `state.json` e `pins.json` em `~/.claude/jobs` são do CLI: só leitura. A única escrita ali é `meta.json`.
- `process.platform` só em `src/platform.mjs`. Nenhum caminho de máquina fixo. A pasta `.claude` sai de `casaClaude()`.
- Na VPS, `~/.claude` é somente leitura no sandbox: módulo que escreve lá precisa de abrigo.
- O servidor não recarrega módulo. Mexeu em `src/`, religue (`POST /api/shutdown`, o systemd sobe de novo).
- Comando que pode subir o painel vai com `CC_SEM_NAVEGADOR=1`. Teste nunca escreve em dado real: use `CC_HOME`.
- Peça nova precisa de caminho até ela na tela. `npm test` passa antes de entregar.

O `state.json` do Claude Code sabe *que* um agente está rodando. Não sabe **o
que ele está resolvendo**. Essa parte o agente escreve, em `meta.json`.

## O comando

```bash
# Windows
node D:/Documentos/Ti/projetos/PESSOAL/proj_controlcenter/cc.mjs set '<json>'

# Linux / VPS / Antigravity (agy)
node /home/claudedev/projetos/VPS_cockpit/cc.mjs set '<json>'
# ou 'cc set' se o cc estiver no PATH
```

Descobre o job sozinho por `$CLAUDE_JOB_DIR`. Fora de um job (ou em agentes
como Antigravity / Agy), passe `--job <id>` (usando o ID da sessão ou conversa).
O JSON é **merge parcial**: o que não for mencionado fica como está. Mandar
`null` num campo apaga esse campo.

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

### O tamanho de uma tarefa, e o teste que decide

Regra dele, dita em 16/08 sobre como ele acompanha o trabalho:

> "elas precisam ser **itens acessíveis no sprint**, eu preciso ver eles
> **sendo criados em tempo real** (…) senão eu saio do painel e vou fazer
> outra coisa. A ideia é manter tudo funcionando visualmente **como uma
> fábrica comigo orquestrando**."

**O teste é um só: a tarefa cabe numa linha do painel com um resultado que ele
possa conferir?** Se não cabe, ela é grande demais, e quebrar depois não
conserta: durante o tempo em que ela roda, o painel não tem nada para mostrar,
e ele sai.

Já custou caro: em 16/08 "design em cards" foi UMA tarefa que reescreveu a
tela inteira, e ele passou o trabalho todo sem nada para olhar.

Os cortes práticos:

| grande demais | do tamanho certo |
|---|---|
| `refazer a tela de agentes` | `a tela de agentes lista os agentes vivos`, depois `o clique num agente abre o detalhe dele` |
| `migrar o painel` | uma tarefa por TELA, e cada uma abre de verdade ao fechar |
| `consertar o mobile` | `o menu vira barra de baixo no telefone`, depois `os cartões param de vazar de lado` |

**Zona ou seção de tela é sempre uma tarefa própria**, com `olho: true`: é
exatamente o que ele quer revisar enquanto acontece.

E vale a divisão que ele mesmo fez: **lógica é sua, experiência humana é
dele.** Escolha técnica não vira pergunta; o que decide o uso, sim.

### Decisão humana e perguntas estruturadas (Modo Sugestivo / Direcionamento)

Quando o projeto estiver em modo **Sugestivo** ou quando for preciso perguntar
direcionamento, gosto visual ou escopo:

- **Claude Code**: use a ferramenta `AskUserQuestion`.
- **Antigravity (Agy)**: use a ferramenta nativa `ask_question`.

> **Pergunta decisiva nunca sai em prosa.** O Felipe opera o cockpit como uma
> fábrica: mouse e poucas teclas para resolver problemas complexos. Devolver
> texto em prosa com "o que você acha?" quando há ferramenta de perguntas com
> opções é erro de protocolo. As opções devem ser respostas diretas em primeira
> pessoa com a recomendada prefixada por `(Recommended)`.

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
| `item` | código do item do `docs/backlog.jsonl` em que a sessão trabalha (ex.: `CC-340`). Obrigatório em projeto que tem backlog: o aviso "espera você" mostra projeto / item / o que falta dele, e sem isto diz **sem item declarado** |
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

## Cartas para aprovar

Quando o Felipe precisa **olhar e aprovar** várias coisas de um projeto (telas, textos, fotos, decisões
de rota) e o caminho natural é uma pergunta de cada vez, o agente de **qualquer projeto** monta um
baralho. Ele aprova no Tinder do cockpit ("Decidir um por um", origem "cartas"), no celular, por toque
ou voz. Os votos ficam no próprio projeto, para o agente ler.

**Onde fica, dentro do projeto:**

- `docs/cartas/<deck>.json`: o baralho. O nome do deck usa só letras minúsculas, números e `-` (até 40).
- `docs/cartas/img/`: as imagens. Só jpg, png ou webp, e **sempre dentro de `docs/cartas/`**.
- `docs/cartas/<deck>.votos.jsonl`: os votos. **O agente nunca escreve nele**; só o cockpit acrescenta.

**O formato exato** (o que `validarDeck`, em `src/cartas.mjs`, aceita; campo a mais é recusado):

```json
{
  "titulo": "Telas do login",
  "criado": "2026-10-04T12:00:00Z",
  "cartas": [
    {
      "id": "tela-1",
      "titulo": "Tela de entrada",
      "pergunta": "Pode seguir com esta tela?",
      "olhe": "O botão de entrar e a mensagem de erro de senha.",
      "passos": ["Abra a tela no telefone", "Digite uma senha errada"],
      "img": "docs/cartas/img/tela-1.png",
      "link": "https://testedevoo.carzo.com.br/login",
      "opcoes": ["Aprovo", "Não aprovo"],
      "multipla": false
    }
  ]
}
```

Regras do formato: até 200 cartas; `id` único (letras, números, `_` e `-`, até 60); só `id` e `titulo` são
obrigatórios na carta; `passos` até 10 textos; `link` só `http` ou `https`; `opcoes` de 1 a 4 (sem
`opcoes`, valem "Aprovo" e "Não aprovo"); `multipla: true` deixa marcar várias opções. **Nenhum texto leva
travessão** (o validador recusa). Com a opção "Aprovo", deslizar para a direita já aprova.

**Como validar, antes de avisar o Felipe:**

```bash
node ~/projetos/VPS_cockpit/cc.mjs cartas validar docs/cartas/<deck>.json
```

Sai `deck válido: n cartas`, ou a lista de erros (código de saída 1). Baralho inválido não aparece no
Tinder: some em silêncio.

**Como ler os votos**, rodando dentro da pasta do projeto:

```bash
node ~/projetos/VPS_cockpit/cc.mjs cartas votos <deck>
```

Cada linha traz a data, a carta, as opções escolhidas e a nota dele, se houver. `Não aprovo` com nota é o
motivo para refazer.

**A regra:**

1. **O voto abre trabalho, e o trabalho entra no backlog ANTES de agir.** Leia os votos, registre um item
   (ou mais) no `docs/backlog.jsonl` pelo `cc.mjs backlog`, com as palavras dele na nota, e só então mexa
   no código.
2. **Carta nunca pergunta o que já tem item no backlog.** Se a resposta já está num item (decidido, em
   andamento ou pronto), a carta é ruído: confira o backlog antes de montar o baralho.
3. Pergunta que o agente faz **em sessão** continua uma a uma, pelas perguntas estruturadas. Carta é para
   aprovar material, não para substituir a pergunta.
4. Carta já votada não volta: para pedir de novo, crie outra carta com outro `id`.

## Artefatos de engenharia do sprint

Ao começar trabalho de um sprint, rode dentro da pasta do projeto:

```bash
node cc.mjs sprint artefatos
```

Ele lista o que o sprint pede (MER, mapa de telas, contrato das rotas, casos de uso, modelo de ameaças,
diagrama de sequência), para que serve e onde fica. Produza os marcados **A FAZER** no caminho indicado,
**antes** do código que depende deles. O artefato é texto em Markdown (diagrama em Mermaid quando couber).
Os já marcados "feito" você só atualiza se o seu trabalho mudar o que eles descrevem.

## Design do projeto

O painel tem uma área de design por projeto (tela Design, no menu). O que ela guarda fica **dentro do
projeto**, para você ler:

- `DESIGN.md` (ou o arquivo de design que o projeto já tem): a identidade. Ele troca cor e fonte e
  acrescenta regras pelo painel, na seção `## Regras do painel`. Siga o arquivo ao mexer em tela.
- `docs/design/telas/<tela>/v<N>.html` (ou `.png`, `.jpg`, `.webp`): as telas desenhadas antes do código.
  `<tela>` usa só letras minúsculas, números e `-`. **Cada versão nova é um arquivo novo** (v1, v2, v3);
  nunca reescreva uma versão que ele já viu. A página é um HTML sozinho, com o estilo dentro dela ou em
  arquivo da mesma pasta, sem buscar nada na internet. O painel fotografa no celular e no computador.
- `docs/design/mural.jsonl` e `docs/design/mural/`: o mural de referências dele (prints, links e recados).
  Só leitura para o agente.
- `docs/cartas/design.json`: o baralho das aprovações de design. **Quem escreve é o painel**; o agente
  nunca escreve nele nem nos votos.

**Como saber o que ele aprovou**, rodando dentro da pasta do projeto:

```bash
node ~/projetos/VPS_cockpit/cc.mjs cartas votos design
```

`Aprovo` na carta `tela-<tela>-v<N>` quer dizer: é essa versão que vira código. `Pedir ajuste`, com a nota,
pede a versão N+1. As cartas `antes-depois-...` são o antes e depois do site, das fotos do Coderoom. No
Coderoom, o painel entrega tudo isso no contexto de cada resposta, na seção "O DESIGN DESTE PROJETO".

**A regra:** código de tela só a partir da versão aprovada. O voto abre trabalho, e o trabalho entra no
backlog antes de agir, como nas cartas.

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
