# HANDOFF

**Sessão:** 2026-08-30 · Claude (Opus 5, `2d4e7b74`) · **PC** (ALIENWARE-LIPE), rota `framework`
**Último commit:** `85765b2` · **nada empurrado ainda**
**Branch:** `backlog/cc-46-48-49-52-53-56-65` · **versão `0.3.0`**

O que aconteceu: [diario/2026-08-30.md](diario/2026-08-30.md), da metade para
baixo (a primeira parte é da sessão da VPS). Ponteiro, não relatório.

## ⚠️ Antes de encostar em código

**1. `git fetch` faz parte do Passo 0.** Esta sessão trabalhou o dia inteiro
numa cópia **46 commits atrás** da viva, e refez dois consertos que já existiam,
um deles com diagnóstico pior. O histórico local prova que a pasta é
consistente, nunca que ela é a mais nova. O aviso já estava escrito e não foi
seguido.

**2. Existe uma cópia INSTALADA, separada desta.** Em
`%LOCALAPPDATA%\AgentCockpit`. É ela que roda e que serve o painel dele; esta
pasta é a oficina. Publicar é `cc versao publicar`, que roda o portão antes e
recusa se falhar. Voltar é `cc versao voltar`.

**3. `docs/ALINHAMENTO-2026-08-30.md`** é o canal entre as máquinas, porque o
recado do Routia mora num arquivo que o git ignora e nunca atravessa. Ler antes
de supor o que a outra ponta fez.

## O que este dia entregou

Detalhe item a item no ROADMAP. Em uma linha cada:

- **A trava do framework alcança código na raiz** (CC-435), e a **entrevista
  chegou ao agente**: antes a recusa mandava preencher o MVP à mão.
- **Ele escolhe as pastas de projeto** pelo terminal, pela bandeja e na
  instalação (CC-436).
- **Os 11 projetos com framework que sumiam** no caminho até a VPS passaram a
  chegar (CC-437): eram 3 no retrato, hoje são 24.
- **A cópia que roda separada da que se edita** (CC-439), com `cc versao`.
- **O cockpit abre como PROGRAMA**, em janela própria (CC-441), e o ícone da
  barra volta junto ao religar o painel (CC-442).
- **O programa abre o cockpit INTEIRO**, não o painel desta máquina (CC-443).
- **O contrato entre as pontas e o pacote rico** (CC-440): o roadmap viaja com
  581 frentes e 107 sprints, em vez de contagem e seis títulos.
- **O método e o MVP do PC chegam na VPS** (CC-445, e responde o CC-433).
- **As travas do PC saíram da pasta velha** e rodam da instalada (CC-444).

Portão: **387 verificações**. Era 172 no começo do dia nesta cópia, e 363 na
viva.

## ⛔ O que espera ELE, e só ele resolve

1. **Um comando num terminal como ADMINISTRADOR.** A supervisão do Windows ainda
   aponta para a pasta velha, e volta a subi-la no próximo logon. Sem isso a
   bagunça de painéis duplicados volta:

   ```
   cd "C:\Users\lfeli.ALIENWARE-LIPE\AppData\Local\AgentCockpit"
   node cc.mjs daemon servico --port 8099
   ```

2. **As onze pastas de projeto do PC não têm o prefixo `PC_`**, que a regra dele
   de 23/08 pede. Levantado pela sessão da VPS. Renomear com sessão aberta
   quebra caminho, então é decisão e mão dele.

3. **O desenho do coletor** (`docs/produto/COLETOR.md`) espera ele ler e
   aprovar. Os dois primeiros passos da ordem sugerida já saíram.

4. **Os caminhos 2 e 3 do CC-433**: editar o MVP de um projeto do PC pela VPS
   exigiria afrouxar a lista fechada de ações da fila, que é decisão de risco.

## Pendências de commit

**Nada empurrado.** Onze commits meus mais o merge com a VPS. `docs/planos/CC-45.md`
continua fora do commit de propósito, é arquivo dele.

## O que ficou para outra rota, com ticket no quadro

- **A tela do MVP remoto** (CC-433): o dado chega pronto em `framework[].mvp` e
  `framework[].metodo`, falta desenhar no cartão. É da rota `front`.
- **A tela mínima do coletor** e a resposta da VPS dizendo o contrato dela:
  moram em `src/web.mjs`, que é da mesma rota.

## O que aprendi hoje e não pode se perder

1. **Prova que para no que o remetente monta não é prova.** Duas vezes o dado
   saiu rico e chegou magro, sem erro nenhum, porque quem recebe recorta campo a
   campo. A rede tem que medir a travessia.
2. **`String.replace(de, para)` interpreta `$&` e cifrão-crase no texto NOVO.**
   Um comentário meu com uma regex dentro fez um arquivo ganhar uma cópia
   inteira de si mesmo no meio de uma linha.
3. **`CC_HOME` isola o config e NÃO isola o autostart.** Um teste com porta
   diferente reescreveu o atalho de logon dele, calado.
4. **O comando que procura aparece na busca.** Uma contagem de processos disse
   "1 vivo" com zero de pé, porque o próprio comando continha o texto procurado.
5. **Matar não é conferir, e "0 removidas" pode ser sucesso aparente.** Um script
   de limpeza procurou o caminho no campo errado e disse que estava limpo.
6. **Numeração de item não sobrevive a trabalho em paralelo.** As duas sessões
   escolheram `CC-434` no mesmo dia, cada uma lendo o próprio arquivo, e as duas
   leituras estavam certas.

## Arquivos a ler

- `docs/produto/COLETOR.md` — o desenho que espera aprovação dele
- `docs/ALINHAMENTO-2026-08-30.md` — o que a VPS fez, escrito por ela
- `src/publicar.mjs` — a cópia que roda, e a regra de quando a versão sobe
- `src/federacao.mjs` — o contrato, o pacote rico, o retrato do framework
