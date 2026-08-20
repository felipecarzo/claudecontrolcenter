# HANDOFF

**Sessão:** 2026-08-21 · Claude (Opus 5, `c4e8a125`) · **VPS**, rota `front`
**Último commit:** `00b2a89` · **o trabalho desta sessão ainda NÃO está commitado**
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

O que aconteceu: [diario/2026-08-21.md](diario/2026-08-21.md). Ponteiro, não
relatório.

## ⚠️ Duas coisas antes de encostar em código

**1. O painel novo é o painel.** A raiz (`cockpit.carzo.com.br` e
`localhost:8099`) serve o `ui_v2.html`. O antigo continua inteiro em `/v1`, e a
troca são duas linhas em `src/web.mjs`. Mexer em `ui.html` achando que é a tela
de todo dia é trabalho jogado fora.

**2. [guias/PC-E-VPS.md](guias/PC-E-VPS.md) continua valendo.** Cinco consertos
que só fazem sentido na VPS, e desfazer volta o defeito sem erro na tela.

## Estado: 14 itens fechados hoje, todos vindos de apontamento dele

CC-218 a CC-231, cada um com a prova no [ROADMAP.md](ROADMAP.md). **Nada
executável em aberto.**

**A lição que atravessa o dia inteiro:** o painel novo herdou o código do antigo
e **não herdou as redes**. Isso apareceu quatro vezes, e as quatro viraram
verificação:

| o gate media | não media | virou |
|---|---|---|
| largura no `ui.html` | grade inline no `ui_v2.html` | CC-222 |
| — | classes do motor de gráficos | CC-224 |
| sintaxe do `ui.html` | sintaxe do `ui_v2.html` | CC-227 |
| — | erro de EXECUÇÃO | CC-231, em `npm run test:endereco` |

**Ao mexer no painel novo, pergunte primeiro o que o gate ainda mede só no
antigo.**

## Pendências de commit

**Todo o trabalho desta sessão está sem commit**, 19 arquivos. Ele não pediu
commit, e a regra é não commitar sem pedido explícito.

| grupo | arquivos |
|---|---|
| tela | `src/ui_v2.html` |
| servidor | `src/web.mjs`, `src/jobs.mjs`, `src/meu.mjs`, `src/glossario.mjs`, `src/metaSessao.mjs`, `src/platform.mjs` |
| hooks | `reporte-guard.mjs`, `fila-guard.mjs`, `tarefa-vaga-guard.mjs`, `testar-reporte-guard.sh` |
| gate | `test.mjs`, `test-endereco.mjs` (novo), `package.json` |
| docs | `ROADMAP.md`, `diario/2026-08-21.md`, `HANDOFF.md`, `ROTAS-ATIVAS.md`, `CLAUDE.md`, `produto/PALAVRAS-DA-TELA.md` (novo), `guias/PC-E-VPS.md` |

Nada aqui é de outra sessão: a rota `front` foi marcada no início e liberada no
fim.

## O que só ele resolve

1. **Conferir os nove apontamentos** que ele mesmo levantou hoje. Ele disse "já
   já confiro" e não voltou em cima dos primeiros.
2. **Apagar o `ui.html`.** A raiz já é o painel novo; o antigo continua em `/v1`
   de propósito. É a única parte irreversível da troca (CC-176), pendente desde
   20/08.
3. **Os nomes dos papéis** (Designer, Modelagem de sistema, Scrum Master,
   Depurador com Perito, Pesquisador e Revisor). A primeira lista foi reprovada
   por ser rasa; esta ele não avaliou. Pendente desde 20/08.
4. **A pasta `tools/` está com dono errado na VPS** (`nobody:nogroup`), então
   nada dentro dela pode ser editado sem senha de administrador. Contornei com
   cópia no scratchpad, mas o conserto é dele.

## O que aprendi hoje e não pode se perder

**Ele encontra o que o gate não encontra, e o padrão é sempre o mesmo:** a tela
afirmando com confiança algo que não sabe. PC desligado como "trabalhando",
bloco vazio embaixo de cabeçalho prometendo conteúdo, `?` que some sem avisar.
**Nenhum desses quebra nada; todos mentem.**

**Erro de execução não é erro de sintaxe.** Removi uma variável e deixei o uso
dela: `renderViewAgora` lançava no meio, a tela Agora ficava com bloco de 12
pixels, e a página carregava, navegava e não acusava nada. Foi ele quem achou.
Hoje `npm run test:endereco` abre as 24 telas e ouve os erros do Chrome.

**A instrução escrita não segura, e agora tem número.** Dos 16 agentes no
painel, **2** escreviam o próprio assunto. A regra existia desde 16/08. O que
mudou o comportamento foi a cobrança automática, não o texto.

**Medir antes de inverter salvou dois consertos errados hoje:** a captura de
página inteira desenha caixa deslizante fora do lugar (a tela parecia abrir na
terceira coluna com a rolagem em zero), e o arquivo do motor de gráficos parece
binário por causa de bytes nulos que são separador de chave, de propósito.

## Onde as decisões novas moram

- `seloDe(nome)` e `selo(job)` em `ui_v2.html`: a etiqueta de máquina, **sem
  exceção**. As duas economias que eu tinha inventado foram removidas por
  pedido dele, e o gate guarda isso.
- `lerPalavrasDaTela()` em `src/glossario.mjs`: cada `##` de
  `docs/produto/PALAVRAS-DA-TELA.md` é uma explicação clicável. Escrever a
  seção é o que faz o "?" nascer.
- `termoDaTela(id)` em `ui_v2.html`: `view-agentes` procura `tela: agentes`. Por
  isso as seções de tela usam o id **sem acento**.
- `data-explica="termo"` num rótulo: `espalharAjudas()` insere o "?" em todos.
  Rótulo desenhado por JavaScript usa `ajuda('termo')` na hora.
- `subjectEm` em `src/jobs.mjs`: quando o assunto foi escrito. Fica fora do que
  o agente manda, senão a anotação seguinte apagaria.
- `mdCurto()` em `ui_v2.html`: markdown mínimo. Parágrafo só termina em linha
  vazia, lista ou citação, senão as frases aparecem partidas ao meio.
- `lerMetaSessao(id)`: a ÚNICA leitura correta do reporte de sessão, porque ele
  mora em dois lugares. Dois hooks liam só a casa e cobravam lista congelada.

## Próximo passo exato

1. `git pull` e conferir que a VPS e o PC estão no mesmo commit.
2. `npm test`. Passa nos dois sistemas.
3. `npm run test:endereco` com o painel no ar. Precisa de Chrome; na VPS ele sai
   do cache do Playwright, achado por `chromePath()`.
4. **Decidir com ele o que fazer com os 19 arquivos sem commit.**

**Se for mexer em tela**, entre no perfil Designer (`cc framework perfil
designer`): ele exige print nas duas larguras e cobra a forma que ele nomeou.

**Se for medir tela estreita**, use `tools/capturar-tela.mjs` — lembrando que a
pasta está somente leitura nesta VPS. Captura feita à mão mente por 28% no PC.

**Se for espalhar mais "?"**, são 50 explicações prontas e 12 pontos usados. Um
rótulo novo custa `data-explica="termo"`, e o gate recusa termo sem explicação.

## Arquivos a ler

- [diario/2026-08-21.md](diario/2026-08-21.md), o dia inteiro
- [ROADMAP.md](ROADMAP.md), CC-218 a CC-231 com a prova de cada um
- [produto/PALAVRAS-DA-TELA.md](produto/PALAVRAS-DA-TELA.md), as 50 explicações
  e como escrever mais
- [guias/PC-E-VPS.md](guias/PC-E-VPS.md), o que não desfazer
- `CLAUDE.md`, as armadilhas que custaram tempo (três novas hoje)
