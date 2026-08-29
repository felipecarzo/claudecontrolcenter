# HANDOFF

**Sessão:** 2026-08-26 (noite) · Claude (Opus 5, `721fa1f4`) · **PC** (ALIENWARE-LIPE), rota `sistemas`
**Último commit:** `ce748ae` · **tudo commitado e empurrado**
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

O que aconteceu: [diario/2026-08-26.md](diario/2026-08-26.md). Ponteiro, não
relatório.

## ⚠️ Antes de encostar em código

**1. `docs/guias/PC-E-VPS.md` continua valendo.** Cinco consertos que só fazem
sentido na VPS, e desfazer volta o defeito sem erro na tela.

**2. O guia precisa de um sexto ponto, ainda não escrito lá.** Já são **seis**
lugares que supunham Linux e quebravam calados no Windows: `deOutraPlataforma`
em `src/roadmap.mjs`, `projectsBases` em `src/install.mjs`, dois testes (todos
de manhã), mais `test-anonimizar.mjs` e `hooks/commit-auto.mjs` (à noite). O
padrão comum: montar URL de módulo como `file://` mais o caminho cru, ou supor
`/` como separador. **A função certa é `pathToFileURL` do próprio Node**, sempre.

**3. Este PC estava 32 commits atrás até hoje à noite.** Se você abrir aqui
depois de trabalhar na VPS, rode `/vps-sync` antes de qualquer coisa: `npm test`
passando não prova que o código é o mais novo.

## Estado: CC-361 fechado, CC-362 aberto

**Fechado à noite:** CC-361, o botão de liberar escrita passa a existir na tela
do dia a dia. A trava do framework barrava o trabalho e mandava clicar num botão
que **só existia no painel antigo** (`src/ui.html`, servido em `/v1`). Medido com
um pedido pendente de verdade: zero ocorrência de "código travado" ou "liberar só
este" na página servida em `/`.

**Não há foto disso funcionando**, e o motivo é o CC-362 abaixo: o modo desta
sessão resolve para `restritivo`, que não trava, então o bloco não tinha como
aparecer numa captura. O que está sob teste é a peça e o caminho do clique.

**Aberto, e é o item mais importante daqui:** **CC-362, a tela diz um modo e a
trava usa outro.** `.framework/estado.json` diz `sugestivo`, o aviso de abertura
da sessão diz `sugestivo`, e `frameworkDisco.ler()` devolve `restritivo` para a
mesma sessão. A marca `🎚` da linha da rota vence o modo do projeto, e nada na
tela conta isso. O efeito medido: **marcar a própria rota afrouxou a trava de
escrita da sessão**. É "duas verdades para o mesmo projeto", que o comentário de
`vigente()` diz que o painel já pagou duas vezes, e desta vez decide se a trava
trava.

**Também fechado:** o `/vps-sync` completo nas duas pontas. As duas pastas do
projeto na sandbox (`proj_controlcenter` e `VPS_cockpit`) **são a mesma pasta**,
ligadas por atalho: puxar numa atualiza a outra, e elas nunca divergem.

## Pendências de commit

Nenhuma minha. A árvore está limpa e o remoto está em `ce748ae`.

**Fora do commit de propósito:** `docs/planos/CC-45.md`, arquivo novo dele, que
já estava aí antes desta sessão e não é trabalho meu.

**Guardado:** `stash@{0}` ("vps-sync 26/08"), o pacote de segurança do começo da
sessão. Tudo o que estava nele já voltou para a árvore e foi commitado; fica
guardado por decisão dele.

## O que só ele resolve

0. ⚠️ **REGRA GLOBAL ESPERANDO A DECISÃO DELE, anotada em 29/08.** Veio de uma
   sessão do carzo, e ele pediu para registrar aqui: *"isso é muito importante,
   todas essas regras globais mesmo, depois eu resolvo lá"*.

   **A regra:** em modelagem, use o vocabulário de programação (classe,
   atributo, relação), e não a paráfrase em português. A paráfrase parece mais
   simples e é mais lenta de ler, porque ele traduz de volta. Ele travou num
   catálogo meu e perdeu tempo por causa disso.

   **A linha que a torna compatível com a regra zero:** o nome existe fora
   deste projeto? Use. Foi inventado aqui? Traduza.

   **Junto vem uma segunda:** todo item de lista se explica sozinho, em três
   (o que é, de onde veio, para que serve). Item sem procedência é palpite com
   cara de pesquisa.

   Texto inteiro, com as palavras dele e o bloco pronto para colar no global,
   no fim de `docs/produto/COMUNICACAO.md`. **Nada foi mexido no `CLAUDE.md`
   global: a decisão é dele.**


1. **Testar se o painel sobrevive a dormir ou deslogar o PC de verdade.** Só dá
   pra fazer na próxima pausa natural dele. Se ficar sem religar, comece
   verificando se `arrancar.ps1` está mesmo rodando.
2. **Apagar o `ui.html`.** Pendente desde 20/08. **Atenção nova:** o CC-361
   levou o botão de liberar escrita para o painel novo, então essa dependência
   deixou de existir. Ainda assim, confira o que mais só existe lá antes.
3. **Os nomes dos papéis** (Designer, Modelagem de sistema, Scrum Master,
   Depurador com Perito, Pesquisador e Revisor). Pendente desde 20/08.
4. **A pasta `tools/` está com dono errado na VPS** (`nobody:nogroup`).

## O que aprendi hoje à noite e não pode se perder

1. **`grep` no HTML servido acha o código-fonte, não a renderização.** O JS é
   inline: a string está na página mesmo quando o bloco não renderiza. Cheguei a
   contar ocorrências e quase chamar isso de prova.
2. **Ao apresentar os dois lados de um conflito, dizer de ONDE vem cada um é
   parte do dado.** Inverti os rótulos e ele decidiu certo por sorte.
3. **Diferença de zero linhas ainda é diferença para o git.** Mudança de modo de
   arquivo aparece como "modificado" e some do `--stat`, o que faz os dois
   parecerem discordar. No Windows, `core.fileMode false` é o conserto.
4. **`git stash pop` com conflito NÃO apaga o pacote guardado.** O que parece
   perda de dado é o contrário: a rede continua armada.
5. **O painel na porta 8100 morreu e não voltou.** Quem responde hoje neste PC é
   a instância da 8099, viva desde 14:17. Se alguém for medir supervisão de
   processo, esse é um caso real esperando explicação.

## Próximo passo, se alguém pegar de onde parei

**1. CC-362**, acima. É o único item aberto que muda o comportamento de todas as
sessões, e a correção provavelmente é de tela: dizer qual modo está VALENDO e de
onde ele veio (projeto, rota ou capa da sessão).

**2. `docs/guias/PC-E-VPS.md` precisa do sexto ponto**, agora com seis casos e um
padrão comum nomeado (ver o topo deste arquivo).

**3. CC-352 tem a parte do PC em aberto**: o instalador perguntar a pasta de
projetos, com a configuração acessível pela bandeja. Ler o item inteiro no
ROADMAP antes: é o MESMO instalador do CC-340, não dois separados.

**4. O resíduo do CC-353** continua sem causa confirmada.

## Arquivos a ler

- `src/frameworkDisco.mjs` — a função `ler`, onde as três camadas de modo se
  sobrepõem. É o coração do CC-362
- `src/framework.mjs` — `vigente()`, e o comentário que já avisava sobre "duas
  verdades para o mesmo projeto"
- `src/ui_v2.html` — o bloco `fw-aut`, o que entrou pelo CC-361
- `docs/ROTAS-ATIVAS.md` — o ticket do resíduo de servidores instáveis
