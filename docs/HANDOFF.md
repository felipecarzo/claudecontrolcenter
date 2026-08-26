# HANDOFF

**Sessão:** 2026-08-26 · Claude (Sonnet 5, `1d765cd1`) · **PC** (ALIENWARE-LIPE), rota `sistemas`
**Último commit:** `e78039d` · **tudo commitado e empurrado**
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

O que aconteceu: [diario/2026-08-26.md](diario/2026-08-26.md). Ponteiro, não
relatório.

## ⚠️ Antes de encostar em código

**1. `docs/guias/PC-E-VPS.md` continua valendo.** Cinco consertos que só
fazem sentido na VPS, e desfazer volta o defeito sem erro na tela.

**2. Novo hoje: `docs/guias/PC-E-VPS.md` precisa de um sexto ponto, ainda
não escrito lá — só aqui por enquanto.** Quatro lugares no código supunham
Linux e quebravam calados no Windows (`deOutraPlataforma` em
`src/roadmap.mjs`, `projectsBases` em `src/install.mjs`, e dois testes). Se
mexer em código que trata caminho de arquivo ou máquina, desconfie de
qualquer coisa que assuma `/` como separador ou `~/projetos` como
convenção. Quem for atualizar o guia formalmente, os quatro pontos estão no
diário de hoje.

## Estado: CC-351 fechado, com um achado que muda a supervisão do PC

**Fechado hoje:** CC-351 (o ícone na bandeja e o serviço supervisionado),
mais quatro consertos de plataforma que travavam `npm test` inteiro no PC
(roadmap.mjs, install.mjs, e dois testes).

**O achado que importa mais que o código:** `RestartOnFailure` da Tarefa
Agendada do Windows não funciona nesta máquina. Medido, não suposto: matei
o processo de propósito duas vezes, esperei mais de 2 minutos cada, nunca
religou sozinho. `src/arrancar.ps1` foi reescrito pra ter o próprio laço de
religamento, sem depender disso. Provado: matei o processo duas vezes
seguidas, voltou em 9 segundos as duas vezes.

**Também investigado, parcialmente resolvido:** CC-353 (servidores do PC
sumindo da tela). Achei e matei um processo fantasma vivo há quase 2 horas
numa porta vizinha (8100), invisível porque toda checagem olhava só a 8099.
Sobra um padrão menor não explicado, registrado como ticket em
`docs/ROTAS-ATIVAS.md` com um palpite não testado (keep-alive do `fetch`).

## Pendências de commit

Nenhuma. A árvore está limpa e o remoto está em `e78039d`.

## O que só ele resolve

1. **Testar se o painel sobrevive a dormir ou deslogar o PC de verdade.**
   Só dá pra fazer na próxima pausa natural dele; não posso simular daqui.
   Se ficar sem religar, a causa mais provável é a mesma família do
   `RestartOnFailure` (ver acima) — comece verificando se `arrancar.ps1`
   está mesmo rodando (`Get-CimInstance Win32_Process -Filter
   "Name='powershell.exe'"` procurando `arrancar` na linha de comando).
2. **Apagar o `ui.html`.** A raiz já é o painel novo; o antigo continua em
   `/v1` de propósito. É a única parte irreversível da troca (CC-176),
   pendente desde 20/08.
3. **Os nomes dos papéis** (Designer, Modelagem de sistema, Scrum Master,
   Depurador com Perito, Pesquisador e Revisor). Pendente desde 20/08.
4. **A pasta `tools/` está com dono errado na VPS** (`nobody:nogroup`).
   Contornado com cópia no scratchpad quando precisou, mas o conserto é
   dele.

## O que aprendi hoje e não pode se perder

1. **Checar processo por porta fixa esconde vizinho.** Se o código tenta
   portas alternativas quando a primeira está ocupada (`startWeb()` tenta
   até 10), a checagem de "só tem um processo?" tem que varrer TODAS as
   portas possíveis, não só a esperada.
2. **`RestartOnFailure` do Windows não é garantia.** Documentado acima, com
   a medição. Quem for mexer em supervisão de processo Windows de novo:
   não assuma que funciona, teste matando o processo e cronometrando.
3. **Amend é seguro quando ainda não empurrou.** Errei a mensagem de um
   commit local hoje (colei texto de outro por engano) e corrigi com
   `git commit --amend`, com autorização explícita dele, antes do push.
4. **Documento pessoal nunca entra em pasta rastreada de repositório
   público**, mesmo que a intenção seja só rascunhar antes de publicar
   como Artifact. Escrevi um sem querer dentro de `docs/produto/` e peguei
   antes do commit.

## Próximo passo, se alguém pegar de onde parei

**1. `docs/guias/PC-E-VPS.md` precisa do sexto ponto** (os quatro lugares
que supunham Linux, listados no diário de hoje). Não é urgente, mas é
exatamente o tipo de coisa que esse arquivo existe pra guardar.

**2. CC-352 tem a parte do PC em aberto**, e conecta direto com o que foi
construído hoje: o instalador perguntar a pasta de projetos, com a
configuração acessível pela bandeja (que agora existe). Antes de começar,
ler o item inteiro no ROADMAP — ele mesmo diz que é o MESMO instalador do
CC-340, não dois separados.

**3. O resíduo do CC-353** (o padrão menor de pedidos pareados) continua
sem causa confirmada. O ticket em `ROTAS-ATIVAS.md` tem o palpite do
keep-alive, não testado.

## Arquivos a ler

- `src/arrancar.ps1` — o lançador único, com o laço de religamento próprio
- `src/bandeja.ps1` — o ícone, com o desenho do traço que muda de forma
- `src/roadmap.mjs` — `deOutraPlataforma`, agora com a guarda de plataforma
- `docs/ROTAS-ATIVAS.md` — o ticket do resíduo de servidores instáveis, no
  topo da seção de tickets
