# Guias de capacidades: a cobrança de guia para toda função pronta

itens: CC-1071
codigo: src/guias.mjs, hooks/guia-fim.mjs, hooks/guia-contexto.mjs, hooks/parada.mjs, src/registroTurno.mjs
atualizado: 2026-10-28

Guia de capacidades da própria máquina de guias. Plano de origem: `docs/CC-1071.md`. Modelo e passo a passo: skill
`guia-de-capacidades`, em `~/.claude/skills/guia-de-capacidades/SKILL.md`.

## 1. Estado e para quem vale

**APOSENTADO em 30/10 (CC-1076):** os dois ganchos saíram da lista do `hooks/parada.mjs` e do catálogo (`padrao: false`,
`implementado: false`); os arquivos continuam em `hooks/`. O guia de cada frente agora é escrito pelo Haiku, por código:
ver `guia-por-frente.md`. O resto deste guia descreve o que eles faziam e o que `src/guias.mjs` ainda oferece.

Pronto e coberto por `test-cc1071.mjs`. Vale para toda sessão do Claude Code nesta VPS, em projeto que tenha
`docs/backlog.jsonl` (é assim que o gancho acha a raiz do projeto). Os dois ganchos rodam dentro do `hooks/parada.mjs`
(Stop), então não há entrada nova no `settings.json`.

## 2. O que é, e o que não é

É uma cobrança: no fim da resposta, se uma função ficou pronta ou o contexto está enchendo e não há guia, a sessão volta
uma vez para escrevê-lo. Não escreve o guia, não chama modelo e não cria nada que rode sozinho.

## 3. Vocabulário

- **Guia de capacidades**: arquivo `docs/guias/capacidades/<funcao>.md` para a IA entender o que a ferramenta faz sem ler o código.
- **INDICE**: `docs/guias/capacidades/INDICE.md`, uma linha por guia.
- **Cabeçalho**: três linhas logo depois do título, `itens:`, `codigo:` e `atualizado:`. É tudo o que os ganchos leem.
- **Guia velho**: guia cujo arquivo é mais antigo (mtime) que um arquivo de código listado em `codigo:`.
- **Faixa**: degrau de 10% da janela de contexto (80% é a faixa 8).

## 4. O ciclo de ponta a ponta

1. Um item vai para prova (PR) ou fecha (OK): isso vira um evento `estado` em `docs/eventos.jsonl`.
2. No fim da resposta, `guia-fim` lê os eventos deste turno (a partir do último pedido real dele, no máximo 30 minutos atrás).
3. Para cada item movido, vê se algum guia cita o id em `itens:`. Também vê se algum arquivo de `src/`, `hooks/` ou `cc.mjs` editado no turno consta em `codigo:` de um guia mais velho que ele.
4. Se falta algo, sai com código 2 e lista o que falta (uma vez; `stop_hook_active` passa).
5. Em paralelo, `guia-contexto` soma os tokens de entrada da última resposta e, passando de 75% da janela com item que foi para andando (estado EM) nas últimas 24 horas, pede o guia da função em andamento, uma vez por faixa de 10%.

## 5. Onde cada coisa mora

| O quê | Onde |
|---|---|
| Lógica compartilhada (achar raiz, ler guias, eventos, contexto) | `src/guias.mjs` |
| Gancho de função pronta | `hooks/guia-fim.mjs` (log de erro em `~/logs/guia-fim.log`) |
| Gancho de contexto cheio | `hooks/guia-contexto.mjs` (log de erro em `~/logs/guia-contexto.log`) |
| Configuração do contexto | `~/.config/agent-cockpit/guias.json`, `{ "janela": 200000, "limite": 0.75 }` |
| Última faixa avisada e se a janela da sessão é a de 1M | `~/.local/share/agent-cockpit/guias/<sessao>.json`, `{ "faixa": 8, "grande": true }` |
| Guias e lista | `docs/guias/capacidades/` |
| Interruptores | catálogo `src/hooksCatalogo.mjs` (`guia-fim`, `guia-contexto`), aba Hooks do painel |

## 6. A interface, item por item

Sem tela própria. O que aparece é a mensagem do gancho, no formato `[guia-fim] ...` ou `[guia-contexto] ...`, e os dois
interruptores na aba Hooks.

## 7. Regras e limites

- Item de natureza defeito, registro, medição ou decisão, ou com "conserto" ou "fix" no título ou na intenção, não pede guia novo.
- Só conta evento de estado PR ou OK posterior ao último pedido real dele: um item fechado em turno anterior não é cobrado de novo.
- Janela: modelo cujo nome termina em `[1m]` usa 1000000 tokens. Os outros usam a do config (200000), mas uma sessão que
  já passou de 200 mil tokens é de janela grande: o gancho grava `grande: true` e passa a usar 1000000 mesmo depois de
  compactar. Medido em 22/10: sem isso uma sessão de 372 mil tokens lia "172%" e o aviso voltava em toda resposta.
- Cair abaixo do limite (limpou ou compactou) zera a faixa gravada, e o aviso pode voltar.
- Só conta item andando que foi para EM nas últimas 24 horas (os eventos do backlog não dizem a sessão). Item andando
  parado há dias não conta. Sem item assim, `guia-contexto` não avisa e não gasta a faixa.
- Não vale no `claude -p`. Falha aberta: erro vai para o log e a resposta segue.
- Limite assumido: o evento "vai limpar" não é registrável (o arquivo de ganchos é somente leitura para a sessão), então o aviso vem antes, não no instante da limpeza.

## 8. O que a combinação torna possível

- Junto com o backlog: o fechamento de item vira o gatilho do guia, então nenhuma função fecha sem registro de capacidade.
- Junto com o `registroTurno`: a lista de arquivos editados no turno sai do mesmo registro dos ganchos de conferência (`hooks/confere-omissao.mjs`), lido uma vez por processo.
- Junto com a skill `guia-de-capacidades` e o passo 5.6 do `/end-session`: três redes para o mesmo fim (no fim da resposta, no contexto cheio, no encerramento).
- Os guias juntos formam a base para a IA escrever o manual de usuário depois, sem abstrair do código.

## 9. O que ainda não existe

- Nenhum gancho confere se o CONTEÚDO do guia está certo, só se existe, se cita o item e se é mais novo que o código listado.
- O INDICE não é conferido: guia sem linha nele passa. A regra está na skill e no passo 5.6.
- Aviso no instante exato da limpeza do contexto.
- Saber de quem é cada item andando: o evento de estado não traz a sessão. A janela de 24 horas é aproximação, e outra
  sessão que mexeu no mesmo projeto no mesmo dia conta junto.

## 10. Receitas curtas

- Escrever um guia: skill `guia-de-capacidades`, e depois a linha no INDICE.
- Mudar o limite de contexto: gravar `{ "limite": 0.6 }` em `~/.config/agent-cockpit/guias.json`.
- Desligar uma cobrança: interruptor `guia-fim` ou `guia-contexto` na aba Hooks.

## 11. Como provar que continua funcionando

```
node test-cc1071.mjs
node test-parada.mjs
```
Outros documentos: `docs/CC-1071.md`, `docs/guias/capacidades/INDICE.md`, `hooks/mensagens-guia.md`.
