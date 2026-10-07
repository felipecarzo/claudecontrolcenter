---
name: nisaba
description: "Avalia e põe o Nisaba (o sistema de projetos do Felipe) dentro do projeto desta sessão, aos poucos e sem risco. Use quando ele pedir /nisaba, 'põe o nisaba aqui', 'avalia o projeto para o nisaba', ou quando o projeto ainda não tiver backlog em dado, roteiro gerado ou conferência padrão."
---

# Nisaba: pôr o sistema dentro deste projeto

O Nisaba é a estrutura de projetos do Felipe: tarefa em dado (`docs/backlog.jsonl`),
roteiro gerado dele (`docs/ROADMAP.md`), diário de cada tarefa (`docs/eventos.jsonl`),
e um robô que confere cada pedido antes de dizer "feito". A regra que manda: **a IA
sugere, a regra decide**.

Você está DENTRO da sessão do projeto, então você sabe o que ninguém de fora sabe:
quais testes existem, quais tocam produção, qual build vale, se há endereço de teste.
É por isso que esta avaliação roda aqui, e não em lote pelo painel.

O comando do painel é `node ~/projetos/VPS_cockpit/cc.mjs` (chamado de `cc` abaixo).

## Regras que não se quebram

1. **Nada que já está pronto e no ar é reaberto.** O Nisaba vale para o que vem daqui
   para frente.
2. **Não instale dependência, não mude versão, não rode teste que toque produção**
   (banco real, site no ar, envio de mensagem, pagamento). Se o caminho exigir isso,
   vira tarefa DELE no backlog e você para.
3. **Conferência só se declara depois de passar no estado atual.** Conferência que
   nasce reprovada trava todo pedido.
4. **Nada de commit** sem ele pedir.
5. **Projeto inicial não tem login nem senha** (regra dele, 07/10). Login só entra quando
   o projeto já guarda informação de alguém; não proponha antes disso.

## Passo 1. Ler o que existe (só leitura)

Responda para si, medindo, não supondo:

- `docs/backlog.jsonl` existe? (`cc backlog` dentro do projeto mostra o retrato)
- `docs/ROADMAP.md` começa com "GERADO por src/backlog.mjs"?
- `AGENTS.md` existe? Tem `## Escopo do projeto`? Tem linha `Conferência padrão:`?
- O que prova que o projeto FUNCIONA: `package.json` (raiz ou `apps/*`) com `build`
  ou `test`, `node_modules` instalado, endereço no testedevoo (`~/dev.sh status`)?

## Passo 2. Backlog em dado

- Sem `docs/backlog.jsonl` e com ROADMAP escrito à mão: `cc backlog migrar --ensaio`,
  mostre a ele quantos itens sairiam, e só então rode sem `--ensaio`. O ROADMAP
  original vai antes para `docs/legacy/ROADMAP-antes-da-migracao.md`.
- Sem nada: o backlog nasce vazio e o roteiro sai dele (`cc backlog gerar`).

## Passo 3. Escolher a conferência padrão

A lista é FECHADA (o robô recusa qualquer outra coisa):

| Escreva | Quando |
|---|---|
| `auto:npm test` | os testes são seus conhecidos e não tocam produção |
| `auto:node test-x.mjs` | um teste específico basta |
| `auto:build` / `auto:build apps/web apps/painel` | build na raiz / dentro de cada app do monorepo |
| `auto:abre <url>` | a página abre sem erro de código (só testedevoo ou 127.0.0.1) |
| `auto:anda <url>` | jogo: apertar W move a cena |

Teste cujo nome ou conteúdo sugere produção ("smoke", "e2e" contra URL real, "deploy")
NÃO entra: leia o teste antes. Na dúvida, prefira o build.

## Passo 4. Validar e declarar

1. Rode a conferência escolhida no estado atual:
   `node -e "import('$HOME/projetos/VPS_cockpit/src/conferencia.mjs').then(async C=>console.log(await C.rodarConferencia(process.cwd(), C.lerConferencia('auto:build apps/web'))))"`
2. Passou: declare.
   `node -e "import('$HOME/projetos/VPS_cockpit/src/maestro.mjs').then(async M=>console.log(await M.declararConferencia(process.cwd(),'auto:build apps/web','validada em <data> pela sessão do projeto')))"`
3. Falhou: NÃO declare. Registre o defeito no backlog do projeto
   (`cc backlog novo "build quebrado: <erro>" --natureza DEF --area maquinas --tamanho P --pronto "o build passa" --conferir "dele:..."`)
   e conte a ele.

## Passo 5. Escopo no AGENTS.md

Se faltar `## Escopo do projeto`, escreva até 25 linhas: o que o projeto é, onde fica
cada parte (arquivo e papel), e as regras que valem para qualquer tarefa. É isso que
cada micro tarefa do maestro lê, porque ela roda sem ver a conversa.

## Passo 6. Relatório para ele

Curto, uma linha por item, em português simples:

- o que ficou no padrão (backlog, roteiro, escopo, conferência e qual);
- o que ficou de fora e por quê;
- o que depende DELE (instalar algo, autorizar um teste).

O interruptor do Nisaba por projeto fica na tela Projetos do cockpit: desligado, o
maestro recusa pedido ali.
