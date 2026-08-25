# HANDOFF

**Sessão:** 2026-08-25 · Claude (Opus 5, `21e88ed9`) · **VPS**, rota `remote-control`
**Último commit:** `7334998` · **tudo commitado e empurrado**
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

O que aconteceu: [diario/2026-08-25.md](diario/2026-08-25.md). Ponteiro, não
relatório.

## 📮 Recado de fora: a aba Servidores não vê nenhum Next.js (25/08, sessão do VPS_fibraessencia)

**Não é meu projeto e eu não toquei em nada aqui.** Diagnosticado a pedido do
Felipe, que estranhou um servidor de pé não aparecer no painel.

**O sintoma:** um `next dev` escutando em `127.0.0.1:5199`, respondendo 200,
**não aparecia** na aba Servidores. Nem ele, nem os cinco sites de cliente que
rodam nesta VPS em produção, que também são Next. A lista aparece completa e não
avisa que está faltando gente.

**A causa, medida:** `portasUnix()` em `src/platform.mjs:320` prefere o `lsof` e
só cai no `ss` quando o `lsof` não existe. Nesta VPS o `lsof` existe, então é ele
que manda — e ele enxerga 10 portas onde o `ss` enxerga mais de 25.

O Next renomeia o próprio processo para `next-server (v16.2.11)`, e o kernel
trunca `comm` em 15 caracteres. O resultado, lido de `/proc/<pid>/stat`:

```
538678 (next-server (v1) S 538626 ...
        └── o formato é `pid (comm) estado`, e o comm truncado traz um "(" sem fechar
```

Quem lê esse arquivo balanceando parênteses se perde e descarta o processo em
silêncio. O `ss` não passa por `/proc/stat` (lê do kernel via netlink) e enxerga
normalmente.

**Provas, todas reproduzíveis:**

| teste | `ss` | `lsof` |
|---|---|---|
| `node -e "...listen(5201)"` (processo chamado `node`) | vê | **vê** |
| `next dev -p 5199` (processo `next-server (v1`) | vê | **não vê** |
| next de produção, pid 1149 | vê | **não vê** (`lsof -p 1149` devolve 0 linhas) |

Descartado com medida, para não repetir o caminho: não é permissão (mesmo dono,
`/proc/<pid>/fd` legível), não é namespace (`mnt`/`pid`/`net`/`user` idênticos
aos do painel) e não é contêiner (o processo de teste rodava fora de qualquer um).

**Conserto sugerido, não aplicado:** no Linux, usar o `ss` sempre, ou fundir as
duas fontes por PID. O parse do `ss` já existe logo abaixo, em
`src/platform.mjs:347-354`, e é o ramo que hoje quase nunca roda. Se preferir
manter o `lsof`, o mínimo é dizer na tela que a lista pode estar incompleta,
porque hoje ela cala.

## ⚠️ Duas coisas antes de encostar em código

**1. O painel novo é o painel.** A raiz (`cockpit.carzo.com.br` e
`localhost:8099`) serve o `ui_v2.html`. O antigo continua inteiro em `/v1`, e a
troca são duas linhas em `src/web.mjs`. Mexer em `ui.html` achando que é a tela
de todo dia é trabalho jogado fora.

**2. [guias/PC-E-VPS.md](guias/PC-E-VPS.md) continua valendo.** Cinco consertos
que só fazem sentido na VPS, e desfazer volta o defeito sem erro na tela.

## Estado: quatro itens fechados, dois abertos, e um deles é meu erro pendente

Fechados hoje: **CC-334** (o framework tinha dois interruptores), **CC-336** (o
cartão desentortou e o criar projeto subiu para a barra), **CC-337** (sessão
ociosa posava de trabalhando), mais **as quatro ações do controle remoto** com
caminho de volta ao encerrar.

Abertos: **CC-335**, a fusão de Central e Projetos, registrada por escolha dele e
com a primeira fatia já no ar; e **CC-338**, a rolagem que ele diz travar no
aplicativo do PC e que **eu não consegui reproduzir em oito cenários**.

## Pendências de commit

Nenhuma. A árvore está limpa e o remoto está em `7334998`.

O sétimo commit levou o trabalho não commitado das OUTRAS sessões (escritório,
vazamento de memória, as duas travas de 23/08, dois testes), a pedido explícito
dele para poder baixar no PC. Antes disso, os seis commits meus foram separados
bloco a bloco para não enterrar o trabalho delas.

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

1. **`.catch` engole erro de execução do `.then`.** A carga do framework marcava
   a lista como "erro" e a tela dizia "não consegui ler os projetos" com o
   servidor respondendo 200. A causa real era um nome trocado numa função que eu
   tinha acabado de mover. Ao ver "erro" numa carga, desconfie do render antes da
   rede.
2. **Arrastar com o botão do mouse não rola container.** Testar toque assim dá
   falso negativo, e quase virou conserto de defeito inexistente. Toque de
   verdade se simula por `Input.dispatchTouchEvent`, no protocolo do Chrome.
3. **Inércia de rolagem falsifica medição.** Medir logo após um gesto mistura o
   fling com o que se quer medir. Posicione sem gesto (`scrollTop = N`) e espere.
4. **Hora de criação não é hora de atividade.** Custou o trabalho dele. O tmux
   informa `session_created`; a última fala sai do arquivo da conversa.

## Onde as decisões novas moram

- [produto/CENTRAL-E-PROJETOS.md](produto/CENTRAL-E-PROJETOS.md) — a fusão das
  duas telas, com as palavras dele, o custo medido das leituras (0,6s somadas) e
  as decisões que faltam. **"Ligado" já foi decidido por ele: ter sessão de
  agente no ar**, não conversa aberta
- [produto/PALAVRAS-DA-TELA.md](produto/PALAVRAS-DA-TELA.md) — verbetes novos:
  framework, modo do framework (os onze), papel (os sete), entrevista, módulos do
  framework e um por módulo

## Próximo passo exato

**1. O CC-338, e só ele destrava o resto.** Falta o print da tela travada, com
"todos os projetos" no filtro, tirado no aplicativo do PC. Duas coisas nele
decidem o caminho: se aparece barra de rolagem à direita, e qual é o último
projeto visível. Último sempre igual quer dizer corte de conteúdo; último
variando quer dizer gesto interrompido. **Não repita o que já foi descartado**,
está listado no item do ROADMAP.

**2. Se ele trouxer o print, comece por reproduzir na largura exata dele.** As
oito larguras que testei estão no item; nenhuma falhou.

**3. O CC-335 continua aberto para as duas decisões que faltam:** o que o cartão
mostra num projeto de outra máquina, e o que aparece dobrado nos ligados.

## Arquivos a ler

- `src/ui_v2.html` — `pjCard`, `blocoFramework`, `acoesDeSessao`, `renderProjetos`
  e `seletorEstado`. É onde a tela única vive
- `src/remotecontrol.mjs` — as quatro ações e o caminho de volta
- `src/projetos.mjs` — `vivos` contra `ociosos`, o conserto do CC-337
- `test-remoto.mjs` e `test-framework-unico.mjs` — as duas provas novas, ambas
  fora do gate diário
