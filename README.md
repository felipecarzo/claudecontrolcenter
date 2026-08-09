# Control Center

Painel dos agentes do Claude Code rodando em background. No lugar de navegar
aba por aba (`←` `←`), uma tela que responde **o que precisa de você agora** —
mais to-dos, horas e custo por projeto, e os servidores locais abertos na máquina.

Duas superfícies do mesmo dado: tabela no terminal e painel web.

## Instalação

```bash
npm install -g github:felipecarzo/claudecontrolcenter
cc daemon install     # sobe sozinho no login + atalho na área de trabalho
cc open               # abre agora
```

Atualizar: rode o `npm install -g` de novo.

Requisito: **Node 18+**. Quem usa Claude Code já tem, porque o próprio CLI é npm.
Nada mais é instalado — sem dependências de runtime.

### Sem instalar global

```bash
git clone https://github.com/felipecarzo/claudecontrolcenter
cd claudecontrolcenter
node cc.mjs
```

Onde este README escreve `cc`, use `node cc.mjs`.

## Uso normal

Depois de instalado, não se sobe servidor à mão:

- **atalho "Control Center"** na área de trabalho
- ou `/cc` no Claude Code
- ou `cc open`

Os três garantem o painel no ar antes de abrir: se o processo tiver morrido, ele
sobe e só então o navegador abre. O atalho não é um endereço solto — chama o
`cc open` justamente pra não abrir "não foi possível conectar".

## Comandos

```bash
cc                       # tabela no terminal + web, imprime o link
cc --no-web              # só terminal
cc --web-only            # só web
cc --port 9000           # troca a porta (padrão 8099)
cc open                  # garante no ar e abre no navegador
cc status                # painel no ar? reporte ligado?
cc daemon install        # subir no login + atalho
cc daemon restart        # depois de mexer no código
cc daemon uninstall      # parar de subir no login
cc on | off              # liga/desliga o reporte dos agentes
cc off --project X       # desliga só num projeto
cc done "tarefa"         # fecha um to-do sem reenviar a lista inteira
cc undone "tarefa"       # reabre
cc check                 # avisa se vai encerrar com to-do aberto (usado pelo hook)
cc statusline --wrap "<cmd>"   # colhe o uso do plano e repassa para sua statusline
cc install [dir]         # põe o protocolo no CLAUDE.md de um projeto
cc sync [--dry-run]      # o mesmo, em todos os projetos
cc json                  # despeja o estado atual e sai
npm test                 # gate de qualidade
```

Em primeiro plano, se 8099 estiver ocupada ele sobe na próxima livre. O daemon
usa porta fixa, porque o atalho precisa de endereço previsível.

## Sistemas

| | Windows | macOS | Linux |
|---|---|---|---|
| painel e leitura dos jobs | sim | sim | sim |
| subir no login | pasta Startup | launchd | systemd (usuário) |
| atalho | `.lnk` | `.command` | `.desktop` |
| listar portas | PowerShell | `lsof` | `lsof` ou `ss` |
| encerrar processo | `taskkill` | `SIGTERM` | `SIGTERM` |

**Só o caminho do Windows foi verificado em máquina real.** macOS e Linux usam
os comandos padrão de cada sistema, mas nunca rodaram — se você usar num deles e
algo falhar, é bug esperado, não surpresa.

## Configuração

Nada é obrigatório: o painel descobre a pasta de projetos pelos diretórios onde
seus agentes já rodaram. Para forçar:

| Variável | Serve para |
|---|---|
| `CC_PROJECTS_BASE` | a pasta que contém seus projetos |
| `CC_PROJECT_DIRS` | nomes de pasta que contêm projetos (padrão: `projetos,projects,repos,dev,code,workspace,src`) |
| `CC_PROJECT_GROUPS` | camada de agrupamento entre a pasta e o projeto, se você usa |

## Abas

| Aba | Responde |
|---|---|
| agentes | o que precisa de mim agora |
| to-dos | o que falta, em tudo que está rodando (kanban) |
| projetos | como está um cliente por inteiro |
| tempo | quantas horas cada projeto levou, quanto custou e quanto vale |
| gráficos | os mesmos dados cruzados como você quiser, e salvos |
| preço | quanto vale cada problema resolvido, por nível de senioridade |
| servidores | o que está escutando porta nesta máquina |
| escritório | os agentes desenhados trabalhando, aqui e na VPS |

No rodapé, quando há algo tocando: **barra de mídia** com o que toca, botões de
faixa e volume **do aplicativo** (não o do Windows). Só Windows por enquanto.

Clicar num agente abre um painel lateral com o detalhe em níveis. `Esc` fecha.

A aba **servidores** lista as portas em escuta, com o projeto de origem quando
dá pra saber, link pra abrir e botão pra encerrar. Encerrar pede confirmação e
só vale pra servidor de desenvolvimento — processo do Windows fica fora de
propósito, porque a lista contém `lsass` e `svchost`.

A aba **escritório** embute o [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents),
que lê os transcritos e desenha cada sessão do Claude Code como um personagem
num escritório: anda até a mesa, senta, digita quando edita arquivo, levanta
bandeira quando trava esperando resposta.

Dois painéis: o desta máquina e o da VPS. O da VPS não roda aqui — é um túnel
SSH, porque lá o Pixel Agents escuta só em `127.0.0.1`, de propósito. O botão
**ligar** sobe um ou abre o outro; **desligar** derruba.

O botão **PiP** solta a tela numa janela flutuante que fica por cima de tudo
(*Document Picture-in-Picture*, só em navegador Chromium — em outro, abre aba
comum). Serve pra acompanhar de canto de olho enquanto se trabalha noutra coisa.

Ligar e desligar painel não contradiz "não gerencia agente": painel é servidor
local, a mesma categoria que a aba de servidores já encerra. O agente em si
segue intocado.

As portas e comandos ficam em `src/paineis.mjs` e podem ser trocados por
`paineis` no `control-center.json`.

## Parâmetros da página

| | |
|---|---|
| `?static=1` | não abre o SSE — necessário pra captura headless e impressão |
| `?expand=1` | abre todas as zonas, inclusive as recolhidas |
| `?open=<id>` | abre o painel lateral de um agente |
| `?tab=<id>` | abre direto numa aba |
| `?tema=<id>` | força o tema: `noite` `carvao` `ambar` `floresta` `papel` `areia` |
| `?novo=1` `?indice=1` | abrem o construtor de gráficos e o índice de dados |

## Skills

| Skill | Faz |
|---|---|
| `/cc` | abre, status, liga/desliga, reinicia |
| `/cc-instalar` | põe o protocolo no `CLAUDE.md` do projeto atual |
| `/cc-sync` | atualiza o bloco em todos os projetos |

O protocolo já está no `~/.claude/CLAUDE.md` global — **todo projeto reporta por
padrão**. As duas últimas skills são reforço, para projeto com vocabulário
próprio, não requisito.

## Liga/desliga

Desligado, o `cc.mjs set` que os agentes chamam vira **no-op silencioso**: eles
continuam chamando, nada é escrito, nada quebra. Config em
`~/.claude/control-center.json`, com lista de exceções por projeto.

Desligar não derruba o painel — só para de coletar.

## De onde vem o dado

`~/.claude/jobs/<id>/state.json` — escrito pelo próprio Claude Code. Já traz
mais do que a aba mostra:

| Campo | Vira |
|---|---|
| `state` | bolinha de status (ativo / esperando / falhou / pronto / parado) |
| `name` + `nameSource` | assunto (nome que você deu vence o automático) |
| `intent` | o pedido original, no painel expandido |
| `detail` / `output.result` | o que ele está fazendo / o que entregou |
| `fan[]` | tool rodando neste instante (só enquanto está ativo) |
| `originCwd` | projeto + subprojeto |
| `worktreeBranch` | rota |
| `respawnFlags` | modelo (`--model opus[1m]`) e tipo de agente |
| `tokens` | custo acumulado |
| `createdAt` / `updatedAt` | idade e detecção de travado (>10 min sem sinal) |

`pins.json` marca os fixados.

**Nada disso é escrito por aqui.** O painel só lê. A única escrita é em
`meta.json`, arquivo novo no mesmo diretório, que o Claude Code não conhece
nem lê — por isso não tem como quebrar o CLI. Se o job for apagado, o
`meta.json` vai junto.

## meta.json — o que o agente preenche

O que o `state.json` não tem: assunto curto de verdade, categoria, to-dos,
bloqueios, links. Isso vem do agente. Ver [AGENTS.md](AGENTS.md).

```json
{
  "subject": "portais no map editor",
  "category": "feature",
  "route": "B86-portais",
  "status": "aguardando aprovação do plano",
  "todos": [{ "text": "drag-and-drop", "done": true }],
  "blockers": ["Supabase fora do ar"],
  "links": [{ "label": "preview", "url": "http://localhost:8080" }],
  "notes": "caixaDelta vem do banco, não recalcular"
}
```

Os campos preenchidos ganham da derivação automática (`subject` vence `name`,
`route` vence a branch da worktree).

## Estrutura

```
cc.mjs           entrada: CLI de todos os comandos
src/jobs.mjs     núcleo: lê jobs, deriva campos, escreve meta.json
src/tui.mjs      tabela do terminal
src/web.mjs      servidor http + SSE + POST /api/meta
src/ui.html      página (sem dependência, tema claro/escuro automático)
src/daemon.mjs   autostart no logon, atalho, abrir navegador
src/config.mjs   interruptor global e por projeto
src/install.mjs  bloco do protocolo no CLAUDE.md dos projetos
test.mjs         asserts + sintaxe do ui.html
docs/            ver docs/README.md
```

## Limites conhecidos

- Polling de 2s nos dois lados. Com centenas de jobs valeria `fs.watch`; com
  dezenas, reler 8 arquivos é mais barato que a complexidade.
- O painel web escuta só em `127.0.0.1`. Ver de outra máquina exige túnel.
- Categoria é texto livre — sem lista fechada, pra não travar vocabulário novo.
