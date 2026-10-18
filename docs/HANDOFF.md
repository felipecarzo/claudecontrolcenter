# HANDOFF

**Última sessão:** `2635cde4` (PC), 12 a 13/10, fechada em 16/10: sessão do PC no Cockpit (CC-732, CC-1060). Ponteiro, não
relatório: o feito está em `docs/diario/2026-10-13.md` e o plano em `docs/CC-1060.md`.
**Antes dela:** `5ba0551c`, 08 a 11/10 (`docs/diario/2026-10-08.md`); as seções abaixo são dela e continuam valendo.
**Commit:** `a099049` (CC-1060, M1 a M5) está no GitHub e na VPS. Ainda SEM commit: o conserto do ambiente limpo do
terminal (`src/platform.mjs`, `test-terminal-pc.mjs`) e, de outras sessões, `hooks/fala-guard.mjs`, `hooks/resumo-guard.mjs`,
`test-status-painel.mjs`, `hooks/claude/` e os `.bak`.
**Branch:** `backlog/cc-46-48-49-52-53-56-65`. Rota `cockpit2` continua marcada por 5ba0551c; `sincronia` foi liberada.
**Painel do PC publicado e religado:** 13/10 (`a099049`, sem o conserto do ambiente do terminal). O do PC roda uma COPIA instalada: mexeu em `src/`, é preciso
`node cc.mjs versao publicar` e `daemon restart`, senão fica no código velho (foi o CC-732).

## Próximo (sessão do PC, CC-1060)

- **M6, o único que falta no código:** em `src/ui_cockpit2.html`, trocar `daqui` por `daqui || s.escreve` no campo de
  mensagem do cartão (linhas ~20646 e ~24295) e no botão parar (~24298). O arquivo é da rota `cockpit2`; pedi por recado a
  `5ba0551c` e ela não respondeu. Sem isto a VPS aceita a mensagem pelo código, mas a tela não mostra onde digitar.
- **M7:** botão para abrir a janela do WezTerm ligada ao servidor (`wezterm connect`). **M8:** a prova dele pelo celular.
- **Antes de dar a prova por boa:** a mensagem digitada na VPS não chegou na sessão do PC enquanto existia o processo
  antigo `4292` (de administrador, já encerrado). Rodar de novo `POST /api/decisao/mensagem` na VPS com uma sessão aberta
  pelo painel do PC (`cc-teste-1060` serve de modelo, via `src/remotecontrol.mjs`) e cronometrar a chegada (alvo: até 3 s).
- Na lista dele: achar o que religa aquele processo antigo no boot, e o print do celular.
- `npm test` no PC tem 16 testes que falham sem relação com isto (CC-1061).

## Próximo

- **Esperando o olho dele na tela (nenhum visto por mim, a captura é barrada):** a aba Revisões (CC-1038) e o Editar com o
  texto atual nas cartas de texto (CC-1035), o gerador `cc baralho` (CC-1033), os atalhos e o manual `?` (CC-1018 a 1021),
  o flutuar (CC-1022), a gaveta do Caminho e a busca de tarefa (CC-1007, CC-1012, CC-1016), o topo sem a barra de busca
  (CC-992), o Tinder em duas colunas (CC-995). O resto está em `docs/diario/2026-10-08.md`.
- **Dele decidir:** natureza dos outros projetos no guia (CC-1006); apps com login no `cc baralho`; quais telas ganham
  atalhos próprios depois de Caminho e Sessões; se o console do navegador importa para o opencode do Coderoom.
- **Provado só no código/servidor, falta a prova real:** o aplicar das edições de texto pelo botão da aba Revisões
  (provado em cópia do Ahtleta Corrida, não pelo painel); o conserto da partida lenta (CC-1031: pior caso 34 s para 5,4 s).
- **Cuidado:** `~/projetos/VPS_ahtleta-corrida` tem 9 baralhos de 1.211 textos em `docs/cartas/`, sem votos ainda, e 5 entregas
  de código sem commit naquele projeto. A pasta `fibraessencia` (sem `VPS_`) tem a CC FB-033 em prova sem critério de pronto.
- Em prova esperando o celular dele: CC-986 (área de ideias no Caminho), CC-987 (abas como apps), CC-983, CC-988,
  CC-990, CC-975, CC-976 e os PR anteriores.
- Tarefas dele (lista "meu"): modelo padrão global em opusplan e reinstalar a porta de entrada (comandos nas tarefas),
  trocar as chaves vazadas, cabeçalhos do nginx.
- Regra nova de economia: memória `modelo-padrao-opusplan`. Os projetos da VPS abrem em opusplan (Conta de Casa em
  Opus) pelo `.claude/settings.local.json` de cada um.

## Sessão 599331d1 (07 e 08/10, rota `gate`, liberada ao fechar)

- **Em prova:** CC-879 (cartão do Coderoom com resumo e tarefas do robô), CC-980 (conversa de micro tarefa que
  acabou é arquivada), CC-1004 (robô não culpa nem desfaz por foto de design do painel), CC-1005 (robô não
  repropõe conserto já aprovado). Detalhe no diário de 08/10.
- **Código SEM commit desta sessão:** `src/maestro.mjs`, `src/arquiteto.mjs`, `src/cockpit2.mjs`,
  `test-tarefa.mjs`, `test-cockpit2.mjs` (parte do `ui_cockpit2.html` e do `gate.mjs` entrou no 37c8164 de outra
  sessão).
- **Conta de Casa:** Coderoom com uma conversa só (`41s39k-v4cf`). Os itens de backup dele fecharam; o cartão
  fica "parou" até o próximo passo do robô. Na próxima rodada, conferir se sumiram as reprovações "fora do
  declarado" por `docs/cartas/`.
- **Na fila:** CC-978 (checklist do agente no cartão), CC-979 (pedido dado por falho em app sem build).

## Esperando ele

- CC-892: como ver os agentes do robô sem virarem conversas (três caminhos oferecidos, ele não escolheu).
- CC-895: link do testedevoo para app Node simples (exige mexer no `~/dev.sh` e no roteador: autorização dele).
- CC-925: o formato das perguntas que chegam a ele (só produto), para desenhar junto.
- 13 itens em PR esperando o olho dele (vigia, Esquecidas, fotos com login, travas de pergunta e outros).

## Na fila

CC-876 e CC-877 (etapas 5 e 6 do arquiteto), CC-868 (modo automático, "em segundo lugar" por decisão dele).

## Arquivos a ler antes de mexer no arquiteto

- `src/arquiteto.mjs` (passo, responder, executarFicha, as travas `jaTeveObraAprovada` e `podeAutomatico`)
- `src/auditoria.mjs` (as regras das perguntas), `src/maestro.mjs` (`todosOsTestes`, `decisoesDele`, a escada),
  `src/vigia.mjs`
- `docs/CC-867.md` (o plano aprovado)

---

## PEDIDO DE OUTRA SESSÃO, esperando decisão (2026-09-18, sessão do inovallbond)

**Faltam dois ganchos, e a falta deles custou caro hoje.** Ele, ao ver o que
tinha sido publicado: *"pq voce colocou isso no ambiente online camarada? (…)
pq voce ta tomando essas decisoes? o que falta ao cockpit p nao deixar essas
decisoes acontecerem assim?"*.

**O que aconteceu:** ele autorizou publicar UMA vez (*"commita e publica"*), e a
sessão tratou aquilo como permanente. Depois disso subiram, sem pedido novo:
o desenho do quadro de Negócios, a faixa de escolha, a ajuda inteira reescrita
(31 capítulos e 35 lâmpadas), o tour (28 paradas), a ferramenta de captura, a
troca da senha do tour por permissão de cargo, e o conserto de um laço de
navegação. Além disso, a sessão **escreveu no banco de produção** para
acrescentar uma permissão a um cargo.

**Por que os ganchos de hoje não pegaram:** existem ganchos para travessão,
jargão, resumo, `--prova` no `cc done` e edição por script. Todos são de FORMA.
Nenhum olha a decisão cara.

### O que se propõe

| gancho | o que barra | como libera |
|---|---|---|
| publicação | `deploy.sh`, `pm2 restart`, envio para a linha principal (`:master`) | a mensagem DELE na rodada atual autorizar |
| escrita em banco de produção | comando por SSH que faça `UPDATE`, `INSERT` ou `DELETE` num banco da VPS | confirmação explícita dele |

⚠️ **O ponto que faz o primeiro gancho valer a pena é a janela:** ele precisa
ler a última mensagem DELE, e não a conversa inteira. É isso que faz
*"commita e publica"* valer para aquele pedido e morrer nele, que é a regra que
ele já tinha escrito e que a sessão não cumpriu.

**Estado:** proposto, não escrito. A sessão do inovallbond se ofereceu para
escrever os dois; a decisão é dele, e o lugar é `~/.claude/settings.json`, que
vale para toda sessão desta máquina e todo projeto.
