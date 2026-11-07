# Ganchos de conferência: a palavra da IA nunca é a última que vale

itens: CC-1069, CC-1070, CC-1073
codigo: hooks/teto-robo.mjs, hooks/autonomia.mjs, hooks/quebra-guard.mjs, hooks/modelo-guard.mjs, hooks/confere-pedido.mjs, hooks/confere-fala.mjs, hooks/confere-omissao.mjs, hooks/conferente.mjs, hooks/anonimo-prompt.mjs, hooks/parada.mjs, src/registroTurno.mjs, src/conferente.mjs
atualizado: 2026-10-28

Guia de capacidades (para a IA e para quem escreve o manual de usuário depois). Não é manual de usuário. Plano de origem:
`docs/CC-1069.md`, `docs/CC-1070.md` e `docs/CC-1073.md`.

## 1. Estado e para quem vale

Pronto e coberto por teste (`test-cc1069.mjs`, `test-cc1070.mjs`, `test-cc1073.mjs`). Vale para toda sessão do Claude Code desta VPS, em
qualquer projeto, porque os ganchos moram em `hooks/` e são chamados pelo `settings.json` já registrado
(`anonimo-prompt.mjs`, `quebra-guard.mjs`, `modelo-guard.mjs` e `parada.mjs`). O `settings.json` é somente leitura para a
sessão, então ganchos NOVOS entram dentro de um despachante já registrado, nunca como entrada nova.
Cada gancho tem interruptor no catálogo (`src/hooksCatalogo.mjs`) e na aba Hooks do painel.

## 2. O que é, e o que não é

É um conjunto de travas que tiram da IA o direito de ter a última palavra sobre o que fez: uma barra gasto e ação que ele
não pediu; outra confere o pedido com ele antes de agir; outras comparam, no fim da resposta, o que a IA DISSE com o que
o transcrito prova que ela FEZ.
Não é garantia de 100%: gancho de texto não prova verdade, só cobra prova e registra. Não chama modelo, exceto o
conferente (`claude -p --model haiku`), que tem teto. Não decide nada por ele.

## 3. Vocabulário

- **Gancho / guarda**: programa que o Claude Code roda em um evento (UserPromptSubmit, PreToolUse, Stop).
- **Barrar**: sair com código 2 e a mensagem no stderr; o Claude Code devolve a mensagem ao modelo.
- **Uma volta só**: o gancho de fim de resposta barra uma vez; na volta seguinte o campo `stop_hook_active` vem verdadeiro e ele passa.
- **Robô**: conversa `claude -p` (variável `CLAUDE_CODE_ENTRYPOINT=sdk-cli`), sem humano. Sessão aberta dele é `cli`.
- **Registro do turno**: o que o turno fez de verdade (editou, rodou, derrubou, ligou, errou), lido do transcrito, independente do texto da resposta.
- **Turno**: do último pedido real dele até agora. Pedido real exclui saída de ferramenta, injeção de skill e resumo de compactação.
- **Falha aberta**: se o gancho der erro, a sessão segue e o erro vai para um log.

## 4. O ciclo de ponta a ponta

1. Ele manda um pedido. `anonimo-prompt.mjs` (UserPromptSubmit) roda duas coisas: o `teto-robo` (só robô) e o `confere-pedido`, que abre uma pendência por sessão se o texto pede ação.
2. Com a pendência aberta, `modelo-guard.mjs` (PreToolUse) recusa toda ferramenta que muda coisa até a sessão abrir a caixa de escolha (AskUserQuestion) e ele responder "É isso".
3. Durante o turno, `quebra-guard.mjs` (Bash) recusa ligar trabalho automático e derrubar sessão ou serviço sem a frase dele; `modelo-guard.mjs` faz o mesmo para `CronCreate` e `ScheduleWakeup`.
4. No fim da resposta, `parada.mjs` roda em sequência `confere-fala`, `confere-omissao` e `conferente`. Cada um barra uma vez. O `conferente` tem dois gatilhos: a resposta afirma algo (segunda passada) ou o registro do turno tem ação de risco (primeira passada).
5. `confere-omissao` também grava o registro do turno, que o painel lê em `/api/registro`.

## 5. Onde cada coisa mora

| O quê | Onde |
|---|---|
| Teto de robôs | `hooks/teto-robo.mjs`, chamado por `hooks/anonimo-prompt.mjs`; config `~/.config/agent-cockpit/teto-robo.json` (`{ "porHora": 20 }`); interruptor geral: arquivo `~/.config/agent-cockpit/robo-desligado`; log `~/logs/teto-robo.log` |
| Ligar só com frase dele, derrubar só o nomeado | `hooks/autonomia.mjs` (detectores), chamado por `hooks/quebra-guard.mjs` e `hooks/modelo-guard.mjs` |
| Conferência do pedido | `hooks/confere-pedido.mjs`; pendência em `~/.local/share/agent-cockpit/confere/<sessao>.json` |
| Conferir a fala | `hooks/confere-fala.mjs`; o detector de afirmação mora em `src/conferente.mjs` (`afirma`, `limpar`) |
| Registro do turno | `src/registroTurno.mjs`; gravado em `~/.local/share/agent-cockpit/registro/<sessao>.jsonl` (1 linha por turno, últimas 200) |
| Cobrança de omissão | `hooks/confere-omissao.mjs` |
| Conferente separado | `hooks/conferente.mjs` e `src/conferente.mjs`; detectores de risco `apaga`, `publica` e `riscoDoRegistro` em `src/registroTurno.mjs`; log `~/logs/conferente.log`; marca de "já rodou neste turno" em `~/.local/share/agent-cockpit/conferente-marca/` |
| Despacho do fim de resposta | `hooks/parada.mjs` (lista `GUARDAS`) |
| Interruptores e textos da aba Hooks | `src/hooksCatalogo.mjs` e `src/hooksExplica.mjs` |

## 6. A interface, item por item

Não há tela própria para as travas; elas aparecem em três lugares.
- **Caixa de escolha "É isso / Não é isso"**: aparece no começo de todo pedido de ação (inclusive ordem curta como "commit"); "É isso" libera as ferramentas que mudam coisa.
- **Aba Hooks do painel**: uma linha por gancho, com interruptor liga/desliga (`teto-robo`, `autonomo-guard`, `escopo-guard`, `confere-pedido`, `confere-fala`, `confere-omissao`, `conferente`) e a frase de `hooksExplica.mjs`.
- **Bloco "O que a sessão fez de verdade"** na conversa do Coderoom: últimos 8 turnos gravados e quantos robôs nasceram nas últimas 24 h na pasta (rota `GET /api/registro?sessao=&cwd=`).

## 7. Regras e limites

- **teto-robo**: só em `claude -p`. Mais de 20 conversas de robô na última hora na VPS inteira bloqueia a seguinte. Sessão aberta dele nunca é barrada. O conferente (`CC_CONFERENTE=1`) não conta.
- **autonomo-guard**: liga trabalho automático (timer do systemd, `cc regente ligar`, POST em `/api/regente`, escrita de `*.timer`, `crontab`, `plantao-ativo`, `CronCreate`, `ScheduleWakeup`) só se a última mensagem dele tem verbo de ligar e objeto de robô. Só olha o começo de cada segmento do comando; `bash -c "..."` não é aberto.
- **escopo-guard**: `tmux kill-session`, `pkill/kill` em `claude` e `systemctl stop|disable|mask` só passam se a mensagem dele nomeia o alvo ou diz o genérico ("sessão", "serviço"). "desliga tudo" sozinho não autoriza.
- **confere-pedido**: pergunta pura, comando de barra e "ok/valeu" não abrem conferência. Não vale em robô. Ferramentas recusadas: Edit, Write, NotebookEdit, Agent, Task, CronCreate, ScheduleWakeup e Bash que muda coisa.
- **confere-fala**: barra uma vez resposta que afirma feito ou estado (fiz, pronto, está ligado, N commits, "todas/tudo" perto de estado). "não conferi" na resposta passa.
- **confere-omissao**: barra uma vez se o registro tem erro de comando, teste falho, coisa derrubada ou ligada que a resposta não cita. `grep`, `diff`, `find`, `test` com saída 1 não contam como erro.
- **conferente**: chama o modelo, no máximo 30 vezes por hora e uma por turno (as duas portas somadas); falha do modelo passa e vai para o log. Roda por dois gatilhos, gravados no log como `gatilho`:
  - `fala`: a resposta afirma algo; só na segunda passada, ou já na primeira se o `confere-fala` estiver desligado.
  - `risco` (CC-1073): o REGISTRO do turno, não a fala, tem ação de risco, mesmo que a resposta não afirme nada. Só na primeira passada. Risco é: derrubou (`kill`, `pkill`, `tmux kill-session`, `systemctl stop|disable|mask`), ligou (timer, regente, crontab, `plantao-ativo`, `systemctl start`; `CronCreate`, `ScheduleWakeup` e Agent ficam no registro, para a cobrança de omissão, mas NÃO contam como risco: decisão dele em 28/10, porque já têm trava própria que barra antes de rodar e a conferência neles repetia o trabalho e gastava crédito), apagou (`rm`, `rmdir`, `unlink`, `git reset --hard`, `git branch -D`, push forçado, DROP em `psql`/`mysql`/`sqlite3` e afins), enviou arquivo (`SendUserFile`), commitou ou publicou (`git commit`, `git push` sem `--dry-run`, comando de `node|bash|npm|vercel|cc` com `deploy`). Os detectores de derrubar e ligar são os de `hooks/autonomia.mjs`; os de apagar e publicar moram em `src/registroTurno.mjs`.
  - No gatilho de risco, `sem_prova` não conta (não há afirmação a provar); barram `desmentidas`, `feito_nao_contado`, `pedido_nao_feito` e `feito_nao_pedido`.
  - Mesmo interruptor (`conferente`) e mesmo teto e log. Turno de leitura, conversa ou edição comum não chama o modelo.
- Nenhuma mensagem de gancho narra o raciocínio do modelo (`hooks/mensagens-guia.md`).

## 8. O que a combinação torna possível

- **Pedido, ação e fala fecham um circuito**: `confere-pedido` fixa o que foi autorizado; `autonomo-guard` e `escopo-guard` impedem o que passa do autorizado; `confere-omissao` e `conferente` cobram que o que foi feito apareça na resposta. Uma sessão só mente por omissão se os três falharem juntos.
- **O registro do turno é a fonte única de "o que foi feito"**: o mesmo `registroDoTurno` alimenta a cobrança de omissão, o conferente e o bloco do painel. Qualquer gancho novo de fim de resposta pode pedir o registro sem reler o transcrito (há memória de uma entrada no processo do `parada.mjs`).
- **Teto de gasto vale para o gasto que as próprias travas fazem**: o conferente tem teto próprio e não conta no `teto-robo`, e dentro dele nenhum gancho de fim roda (`CC_CONFERENTE=1`), então não há laço.
- **Dá para medir robô**: o `teto-robo` e a função `robosDaPasta` contam as mesmas conversas `claude -p`; o painel mostra quantas nasceram nas últimas 24 h numa pasta.

## 9. O que ainda não existe

- Nenhum gancho julga se o que foi feito está CERTO, só se foi dito e se bate com o pedido.
- O conferente só roda quando o detector `afirma` acha uma afirmação ou o registro tem ação de risco; resposta que mente sem usar essas palavras, sobre ação fora dessa lista (por exemplo um Edit errado), não chega nele.
- Os detectores de risco olham o começo de cada segmento do comando: `bash -c "..."`, corpo de heredoc e `xargs rm` não são abertos. `rm` de arquivo temporário também conta.
- Não há aviso de "o contexto vai ser limpo": não é um evento que a sessão consiga registrar.
- Ganchos novos precisam entrar dentro de um já registrado (`parada.mjs`, `anonimo-prompt.mjs`...), enquanto o `settings.json` for somente leitura.

## 10. Receitas curtas

- Ver o que um turno fez: ler `~/.local/share/agent-cockpit/registro/<sessao>.jsonl` (última linha) ou `GET /api/registro?sessao=<id>`.
- Mudar o teto de robôs: gravar `{ "porHora": N }` em `~/.config/agent-cockpit/teto-robo.json`.
- Parar todo robô: criar o arquivo `~/.config/agent-cockpit/robo-desligado`; religar: apagar o arquivo.
- Desligar uma trava: interruptor dela na aba Hooks (grava em `control-center.json`, chave `hooks.<id>`).
- Ver o que o conferente concluiu: `~/logs/conferente.log` (uma linha por chamada, com modelo, status e veredito).

## 11. Como provar que continua funcionando

```
node test-cc1069.mjs
node test-cc1070.mjs
node test-cc1073.mjs
node test-parada.mjs
```
`test-cc1070.mjs` e `test-cc1073.mjs` usam um `claude` falso no PATH: nenhum modelo é chamado. Outros documentos: `docs/CC-1069.md`,
`docs/CC-1070.md`, `docs/CC-1073.md`, `hooks/mensagens-guia.md` (como se escreve a mensagem de uma trava), `docs/guias/capacidades/INDICE.md`.
