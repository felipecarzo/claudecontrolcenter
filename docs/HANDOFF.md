# HANDOFF

**Sessão:** 2026-09-10 · PC (`84be1862`), depois de puxar o dia inteiro da VPS
(`e2b33ef8`/`670e1313`, que fechou e ficou como porta em standby)
**Último commit antes deste encerramento:** `b3b3249`, empurrado
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

O que aconteceu, dos dois lados: [diario/2026-09-10.md](diario/2026-09-10.md).
Ponteiro, não relatório.

## O que fechou hoje, com prova

- **CC-456, três rodadas até a causa completa.** Dois lançadores duplicados no
  login, um órfão numa porta escondida (sobra de comando manual), e um terceiro
  vindo de uma Tarefa Agendada já apagada (token de administrador, matado pelo
  Felipe). Foto final: um único processo do cockpit vivo na máquina.
- **CC-459**, o loop de bandeja relançando a cada 5s: causa e conserto
  herdados de outra sessão que ficou travada por rota, aplicado e provado
  (contagem de processo estável por 30s+).
- **CC-460**, a barra de status piscando janela preta: provado de verdade
  agora (não só publicado). Contar processo enganava (25 em 30s, era volume
  de várias sessões); contar JANELA VISÍVEL deu zero em oito rodadas.
- **CC-458**, respostas longas: já estava resolvido por outra sessão, só uma
  referência de número desatualizada.
- Merge com o trabalho da VPS (o campo `servico` correto, a lista de
  empurradores, o conserto do statusline) sem perder nada dos dois lados.

## ⏸ CC-457, decisão dele — metade provada, metade travada

Retomar sessão traz a conversa inteira: **provado**, fora do projeto, quatro
turnos em processos separados, histórico completo confirmado em disco (70
linhas, os dois dados de teste voltando certos no turno 4).

Desligar sozinho uma sessão parada: **travado de verdade**, não é dúvida
técnica resolvível agora. Nem `state.json` do Claude Code, nem
`Win32_Process.CommandLine` (vazio nesta máquina para vários processos, a
mesma armadilha do dia) guardam qual PID pertence a qual sessão. Sem isso,
não dá para garantir que o processo certo seria morto.

Caminho não testado, registrado no ROADMAP: cruzar `CreationDate` do
processo com `firstTerminalAt` do `state.json`. Não é garantia (duas sessões
podem nascer no mesmo segundo), é a única pista que sobrou.

## ⚠️ A lição do dia, e ela custou quatro fechamentos errados (e um quinto, no PC)

**Medir um número plausível que responde OUTRA pergunta é indistinguível de
resposta certa.** Já eram quatro erros do mesmo formato na VPS (ver diário);
no PC ainda apareceu um quinto: testar processo nascendo em vez de testar
janela visível, quando o CC-460 pareceu confirmar um problema que já tinha
sido resolvido.

**A defesa é construção, não disciplina.** A lista de empurradores (nova,
feita hoje) e o teste de janela visível (feito hoje) são exemplos do mesmo
princípio: construir a medida que responde a pergunta LITERAL, não confiar
em lembrar de medir direito.

## ⚠️ Antes de encostar em código

**1. `git fetch` faz parte do Passo 0.**

**2. Existe uma cópia INSTALADA, separada desta**, em
`%LOCALAPPDATA%\AgentCockpit` (no PC). É ela que roda e serve o painel dele;
esta pasta é a oficina. Publicar é `cc versao publicar`, e depois disso o
processo precisa ser religado de verdade — `cc daemon restart` já prefere a
Tarefa Agendada quando ela existe (conserto de hoje), mas religar sem
publicar antes serve código velho.

**3. Para contar processo do cockpit no Windows: vá pela PORTA
(`Get-NetTCPConnection -State Listen`) e pela ÁRVORE de processos (pai/filho),
nunca pela linha de comando.** `Win32_Process.CommandLine` vem vazio para
vários `node.exe` e `powershell.exe` nesta máquina — mordeu quatro vezes só
hoje.

**4. `docs/ALINHAMENTO-2026-08-30.md`** é o canal entre as máquinas quando o
recado do Routia (que mora em arquivo ignorado pelo git) não atravessa.

## O botão de religar a VPS (frente de ontem, continua no ar)

Vive em `~/cockpit-auth.mjs`, fora deste repositório, na rota `/__religar`.
Provado por ele em produção. Três travas: senha digitada na hora, só age com
sinal real de problema, cooldown de 24h. Só chama `restart` da API da
Contabo, nunca reset nem reinstall.

## A VPS fica como porta, não como trabalho

Decisão dele ao encerrar a sessão de lá: *"deixa ela aberta só como uma porta
da sessão de cockpit no pc caso ele precise puxar algo"*. Contexto limpo, sem
rota reivindicada. Quem for falar com ela manda o pedido completo, sem supor
que ela lembra de algo desta conversa.

## ⛔ O que espera ELE, e só ele resolve

1. **Ler e aprovar o desenho do coletor** (`docs/produto/COLETOR.md`),
   pendência herdada de 31/08.
2. **As onze pastas de projeto do PC sem o prefixo `PC_`**, pendência
   herdada de 23/08.
3. **CC-457**, a metade travada: decidir se vale investir no caminho do
   `firstTerminalAt` (sem garantia), ou deixar só a retomada manual (já
   funciona) sem o encerramento automático.
4. **O pedido das 60 conversas do Antigravity acumuladas**, aberto desde a
   madrugada de 10/09, esperando ele escolher entre revisar por números ou
   abrir a lista e apontar títulos.

## O que ficou para outra rota

- **A tela do CC-452/453 não existe ainda**: o dado (serviço instalado, onde
  o cockpit mora) já chega, falta mostrar no cartão — `src/ui_novo.html`,
  rota `front`.
- **A sessão do Antigravity não morre com o painel**, fica órfã ao reiniciar
  o serviço (~270 MB). Rota `front`.
- **O painel podia avisar quando a sessão do Antigravity cai no balde
  genérico** em vez de abrir o projeto certo — o log já distingue os dois
  casos, falta ligar na tela.
- **`entreg4` na VPS reiniciando sem parar** (briga de porta com roteador de
  teste, sem risco). Não tratado.
- **Sete arquivos com o mesmo defeito do CC-460** (`git.mjs`, `gateTurno.mjs`,
  `caixaGit.mjs`, `bancadaCatalogo.mjs`, `hooksProva.mjs`, `opencode.mjs`)
  sem `windowsHide`. Não mexidos: quatro são de outras rotas, e falta medir a
  frequência de cada um antes de decidir prioridade.

## Arquivos a ler

- `docs/ROADMAP.md`, seções CC-456 a CC-460 — a história completa de hoje,
  com as provas
- `~/cockpit-auth.mjs` — o botão de religar, fora do repositório
- `src/federacao.mjs` — `origemDoEmpurrao()`, a lista de empurradores
- `src/platform.mjs` — `estadoServico()`/`estadoServicoAsync()` (espelhadas),
  `subirDestacado()` (prefere Tarefa Agendada agora)
- `src/arrancar.ps1` — o conserto do loop de bandeja (`ExitCode`)
- `docs/produto/COLETOR.md` — o desenho que espera aprovação dele
