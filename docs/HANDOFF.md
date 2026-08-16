# HANDOFF

**Sessão:** 2026-08-16 · Claude (Opus 5, sessão interativa `ff0d68b2`) ·
**VPS**, pelo celular via Remote Control · continuação direta de 15/08
**Último commit:** `3a59383` — fix(ui): o menu do celular fechava sozinho
**Branch:** `backlog/cc-46-48-49-52-53-56-65`, **sincronizada com o remoto**
**PR #1: MERGEADO** em 16/08 (`e75c666`, 59 commits). O master está em dia.

O que aconteceu: [diario/2026-08-16.md](diario/2026-08-16.md). Ponteiro, não
relatório — o diário tem os porquês.

## Estado: nenhum item aberto e executável

O ROADMAP saiu de 2033 para ~547 linhas: 37 concluídos viraram diário, que é a
regra da linha 3 dele e estava sendo ignorada desde sempre. Sobraram dois itens,
**e nenhum dos dois é meu**:

| Item | Espera |
|---|---|
| **CC-80** visão estrutural | **decisão do Felipe.** Estudo pronto em [[produto/ESTUDO-VISAO-ESTRUTURAL]] |
| **CC-08** macOS | um Mac |

## O que espera o Felipe

1. **Abrir `/hooks` uma vez, ou reiniciar.** Sete hooks foram registrados no
   `settings.json` hoje e só valem na sessão seguinte.
2. **Deploy do Pierre.** O hash de privacidade em produção não bate com o
   repositório desde 12/08. Detalhes em
   `inovallbond/docs/AUDITORIA-ANONIMIZACAO-2026-08-15.md`.
3. **Responder o CC-80:** a tela de estrutura é para ele decidir prioridade, ou
   para o agente não quebrar nada? Se for a segunda, `cc deps` já basta.
4. **O fork do `app_escritorio`** ler `GET /api/escritorio` — é o que faz o
   escritório mostrar as duas máquinas. Contrato em
   [[guias/escritorio-e-cockpit]].

## Para o próximo agente: o que mudou no jeito de trabalhar

**Sete hooks novos vão te barrar.** Nenhum é decorativo; todos nasceram de um
erro real desta sessão:

| hook | te devolve quando |
|---|---|
| `fluxo-guard` | você para com backlog aberto sem declarar `Parada: <motivo>` |
| `gate-guard` | editou código e não rodou `npm test` DEPOIS |
| `bancada-guard` | editou código e a Bancada do nível não rodou depois |
| `edicao-guard` | usou `sed -i` ou `open(f,'w')` em arquivo do repo |
| `guia-guard` | escreveu guia de 3+ passos de interface numa mensagem só |
| `branch-guard` | `git checkout`/`reset --hard` com trabalho pendente |
| `anonimo-prompt` | (barra o Felipe) dado pessoal colado no chat |

**A rota agora reivindica arquivo.** No quadro, `📁 src/ui.html src/web.mjs` na
coluna "quem/o quê". Rota sem 📁 continua liberando a pasta inteira, como antes.

**Oficina por agente**, se forem dois trabalhando:

```bash
node cc.mjs oficina criar <nome>   # worktree + branch + node_modules por atalho
node cc.mjs oficina list           # quem está onde, derivado do git
node cc.mjs oficina fechar <nome>  # recusa se houver trabalho não commitado
```

Existe uma oficina `front` criada em 16/08, em
`~/projetos/proj_controlcenter--front`, **2 commits atrás do master**. Se for
usá-la: `git -C ~/projetos/proj_controlcenter--front merge origin/master`.

**A Bancada tem níveis.** `node cc.mjs framework bancada nivel` lista os quatro;
este projeto está em `interno`. Use `--so-mudou` para rodar só no diff.

## ⚠️ A sessão de senhas: não toca em código

O Felipe vai abrir uma sessão **só para resolver as senhas da VPS** (ele perdeu
as anotações à mão e vai passar tudo para o Bitwarden). Nela, **todas as rotas
de desenvolvimento ficam bloqueadas** — decisão dele, em 15/08.

**Isso não exige nada de novo: é o comportamento padrão do Routia.** O
`rota-guard` recusa edição de código a quem não marcou rota. Então a regra da
sessão de senhas é uma só:

> **Não marque rota nenhuma.** Sem rota marcada, o gate já barra qualquer
> `Edit`/`Write` em `src/`, e é isso que se quer ali.

Se aquela sessão precisar mexer em código por algum motivo, o certo é parar e
abrir outra — misturar credencial com edição de arquivo é como segredo vaza
para dentro de commit.

Três cuidados que valem repetir para quem abrir aquela sessão:

- **Nunca imprimir senha, chave privada ou o conteúdo de `~/.cockpit-auth.json`
  e `~/.cockpit-sessions.json`.** Vale mesmo se ele pedir: o que sai na tela
  entra no transcrito, que fica em disco e é lido pelo painel.
- **A chave SSH importa mais que a senha.** Perder `id_ed25519_ahtleta` é
  perder o acesso root a uma máquina que hospeda cinco sites de cliente.
- Se ele pedir a senha do cockpit, ela **não existe em texto** — só o hash. O
  caminho é trocar por uma nova (`cockpit-auth senha "<nova>"`), que revoga
  todos os dispositivos junto.

## O pedido de 15/08 que continua aberto

O primeiro dos dois virou o CC-93 e está fechado. O segundo, não:

> "precisamos aprimorar o contato entre agentes no mesmo projeto urgente, esse
> recadinho que a gente ta fazendo é ineficiente"

**O que mudou em 16/08, e o que não mudou.** A rota passou a reivindicar arquivo
e o `rota-pedidos` já transforma o pedido de autorização em comando. Mas o
`ROTAS-ATIVAS.md` continua sendo markdown que um agente escreve e o outro só lê
se abrir o arquivo — o cerne da queixa segue de pé.

O caminho que o próprio projeto sugere: o que virou **comando** funcionou
(`rota-pedidos`, `cc oficina`), o que continuou **texto** não. Vale olhar quais
recados sobraram e quais deles cabem num comando.

## Três armadilhas novas, registradas no CLAUDE.md

- **`<select>` aberto morre no redesenho**, e leva o popup do sistema junto —
  que nem aparece no DOM. Vale para qualquer elemento com estado do SO.
- **Hook fora do `hooksCatalogo` roda calado.** Pegou três vezes em dois dias;
  o gate agora acusa.
- **`await import` em função não-async derruba o servidor**, e o `npm test`
  passava verde porque não carregava o arquivo. O gate agora importa todo
  módulo de `src/`.

## Uma coisa sem explicação

A sessão de teste `teste_pierre_agenda` continua no ar esperando ele testar o
framework. Não foi conferida hoje.
