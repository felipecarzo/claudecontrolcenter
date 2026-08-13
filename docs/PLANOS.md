# Planos do backlog, leia isto antes de pegar qualquer task

Escrito em 2026-08-13 por uma sessão Opus, para sessões Sonnet executarem. Cada
plano diz **onde mexer**, **o que reusar** e **quais armadilhas se aplicam** -
essa terceira parte é a que economiza a rodada perdida.

## Como usar

1. Escolha uma task da tabela abaixo e leia `docs/planos/{ID}.md`.
2. Marque sua rota em `docs/ROTAS-ATIVAS.md` **antes** de editar `src/`, há um
   hook que bloqueia a edição sem isso, e ele está certo.
3. Execute. O plano já traz a verificação; ela não é opcional.
4. `npm test` e conferência visual das duas telas. É o único gate do projeto.

## Regras que valem para todas

- **O servidor não recarrega módulo.** Mexeu em `src/`, reinicie. E `pkill -f`
  **não** mata Node no Git Bash do Windows: use o PowerShell (`Get-CimInstance
  Win32_Process ... | Stop-Process -Force`) e confira depois. Já custou cinco
  rodadas testando código novo contra binário velho.
- **Para validar isolado**, suba noutra porta: `node cc.mjs --web-only --port 8123`.
  Mas lembre que `CONFIG_FILE` **não** é isolado por porta: escrever config pela
  porta de teste escreve no arquivo real do Felipe.
- **Nada em timer** sem medir o custo. Varredura de disco, spawn e rede só sob
  clique, o stream de 2s é sagrado.
- **Nunca escrever em `~/.claude/jobs/`** além do `meta.json`.
- **Nunca escrever em `D:\secondbrain\vault`.** Decisão de 13/08.
- **Sem travessão** em nenhum texto, nem em comentário de código.
- **Ler arquivo do Felipe é CRLF**: `split(/\r?\n/)`, nunca regex com `.` antes
  de `\n`. Já zerou um parser inteiro.

## Ordem recomendada

**CC-23 primeiro.** É o gargalo: CC-24, CC-33 e CC-41 dependem do dado que ele
cria. Fazer os outros antes significa refazê-los depois.

| Ordem | ID | Task | Modelo | Depende de |
|---|---|---|---|---|
| 1 | [CC-23](planos/CC-23.md) | Histórico rico por projeto | Sonnet, plano pronto | - |
| 2 | [CC-33](planos/CC-33.md) | Marca de visita e o delta "desde que você saiu" | Sonnet | CC-23 |
| 3 | [CC-34](planos/CC-34.md) | Pastilhas de frente no cartão do cockpit | Sonnet | - |
| 4 | [CC-35](planos/CC-35.md) | `git log --since` na abertura do projeto | Sonnet | - |
| 5 | [CC-24](planos/CC-24.md) | Digest semanal entre projetos | Sonnet | CC-23 |
| 6 | [CC-39](planos/CC-39.md) | Consertar o `- projeto_template` | Sonnet | - |
| 7 | [CC-06](planos/CC-06.md) | As quatro ideias sem dono | Sonnet | - |
| 8 | [CC-41](planos/CC-41.md) | O painel enxerga os sinais do ciclo | Sonnet | CC-23 |
| 9 | [CC-40](planos/CC-40.md) | Índice das memórias comportamentais | Sonnet | - |
| 10 | [CC-36](planos/CC-36.md) | Enriquecimento de to-dos pelo opencode | Sonnet | - |
| - | [CC-43](planos/CC-43.md) | Decisão D1: escrever `settings.json` | **decisão do Felipe antes** | - |
| - | [CC-44](planos/CC-44.md) | As quatro `set-role` divergentes | **decisão do Felipe antes** | - |
| - | [CC-31](planos/CC-31.md) | Painel de metodologia | **conteúdo do Felipe antes** | - |

## Fora desta leva, e por quê

- **CC-21** (escrita na agenda por MCP) e **CC-25**/**CC-26** (vault espelho e
  skill de rascunho): dependem de decisões de produto que a limpeza do vault de
  13/08 reabriu. Não planejar antes de o Felipe redefinir o papel do vault.
- **CC-22** (marco manual): formato ainda em aberto no próprio roadmap.
- **CC-30** (fila do opencode): a decisão de qual evento "obriga" a chamada
  continua sem resposta.
- **CC-37**: o roadmap já diz "provavelmente não fazer". Só depois do CC-36
  provar qualidade.
- **CC-04**, **CC-08**, **CC-14**: esperam evento externo (agente travado de
  verdade, uma máquina Mac/Linux, e um bug que não é deste projeto).
