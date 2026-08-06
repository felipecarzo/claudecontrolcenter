# Arquitetura

## O caminho do dado

```
~/.claude/jobs/<id>/state.json   escrito pelo Claude Code   ── leitura ──┐
~/.claude/jobs/<id>/meta.json    escrito pelo agente        ── leitura ──┤
~/.claude/jobs/pins.json         escrito pelo Claude Code   ── leitura ──┤
                                                                        ▼
                                                            src/jobs.mjs (núcleo)
                                                                        │
                                                    ┌───────────────────┴────────┐
                                                    ▼                            ▼
                                            src/tui.mjs                    src/web.mjs
                                          tabela terminal              http + SSE + POST
                                                                              │
                                                                        src/ui.html
```

`jobs.mjs` é o único que toca disco. As duas telas consomem o mesmo objeto —
por isso não existe divergência entre o que o terminal e o navegador mostram.

## Por que não lê o terminal

A primeira ideia era embutir o CLI numa interface que lesse a saída do terminal
e reorganizasse. Não foi preciso: `state.json` já é JSON estruturado, com mais
campo do que a aba exibe. Parser de PTY teria sido trabalho jogado fora, e
frágil a cada mudança de layout do CLI.

## Campos derivados, e de onde saem

| Campo | Origem | Observação |
|---|---|---|
| projeto / subprojeto | `originCwd` | procura `CLIENTS`/`PESSOAL`/`ESTUDO`/`intersec` no caminho e pega o segmento seguinte |
| rota | `worktreeBranch` | tira o prefixo `worktree-`; sem worktree, é `main` |
| modelo | `respawnFlags` | não existe campo próprio: sai de `--model` |
| status | `state` | normalizado em 5 buckets; rótulo desconhecido passa direto |
| assunto | `meta.subject` > `name` (do usuário) > `name` (automático) > último pedido | |
| último pedido | transcript (`linkScanPath`) | lê a cauda do `.jsonl`, não o `intent` |
| `intentTrustworthy` | transcript | `false` quando o `intent` não bate com o começo da sessão |
| travado | `updatedAt` | `working` sem sinal há mais de 10 min |

## Por que o pedido vem do transcript, não do `intent`

`state.intent` guarda o **primeiro** prompt da sessão e nunca é atualizado. Numa
sessão longa que mudou de assunto, ele mostra algo velho — e num job respawnado
apareceu contendo prompt de **outra conversa** (job `492627c0`: intent `"pq nao
ta trocando o modelo?"` numa sessão de auditoria de rotas).

O transcript em `linkScanPath` é nomeado pelo `sessionId`, então não tem como
misturar sessão. Dele saem duas coisas:

- **último pedido** — a última mensagem humana; é o que o painel mostra
- **primeiro pedido** — só para comparar com o `intent` e marcar quando o campo
  do CLI não é confiável

O arquivo passa de 25 MB, então nunca é lido inteiro: cauda de 256 KB (cache por
tamanho + mtime) e cabeça de 256 KB (cache eterno — o começo não muda). Linha
cortada ao meio pela leitura parcial é descartada; o resto é NDJSON válido.

Mensagem "humana" exclui resultado de tool (`toolUseResult`) e qualquer texto
começando com `<`, que é `<system-reminder>` e parentes.

## Fronteira de escrita

O núcleo só escreve `meta.json`, e sempre atômico: grava `.tmp` e renomeia. Um
processo morto no meio deixa o arquivo anterior intacto, nunca um JSON pela
metade.

Nada mais em `~/.claude/jobs/` pode ser escrito. É a regra que garante que o
painel não derruba o CLI. Ver [../produto/VISAO.md](../produto/VISAO.md).

## Estado no cliente

A página guarda no `localStorage` só quais linhas estão abertas. Todo o resto
vem do servidor a cada evento SSE. Marcar um to-do no navegador faz `POST
/api/meta`, que cai no mesmo `writeMeta` que o agente usa — um caminho de
escrita só, não dois.
