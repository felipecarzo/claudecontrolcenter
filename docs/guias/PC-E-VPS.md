---
tags: [processo, multi-maquina]
tipo: guia
atualizado: 2026-08-19
estado: escrito na VPS, para a sessão do PC ler ANTES de mexer
resumo: O que mudou na VPS entre 13 e 19/08, e o que não pode ser "consertado" no PC sem quebrar a VPS. Existe porque o PC vai abrir este repositório achando que está corrigindo, e vai desfazer coisa medida.
termos:
  casa: a pasta ~/.claude, onde o Claude Code guarda estado
  abrigo: o lugar alternativo onde a sessão grava quando a casa está trancada
  sandbox: a caixa isolada em que o Claude Code roda comandos
---

# PC e VPS: o que não desfazer

**Leia isto antes de mexer no código, se você é a sessão do PC.**

Este projeto passou seis dias sendo construído **só na VPS** (Linux, usuário
`claudedev`, sem `sudo`). São 24 commits que o PC nunca viu. Boa parte deles
conserta coisa que **só acontece na VPS**, e todo conserto desses tem a mesma
cara para quem chega de fora: código estranho, com caminho alternativo, que
parece defensivo demais.

Não é. Cada um saiu de uma medição, e desfazer volta o defeito.

## A regra que vale acima de todas

**Não existe "o jeito certo" que serve para as duas máquinas por dedução.**
Windows e Linux discordam em coisas que não parecem sistema operacional:
onde dá para escrever, o que mata um processo, como um comando escapa aspas.
Este projeto já pagou por cada uma dessas.

`process.platform` continua só podendo aparecer em `src/platform.mjs`. Isso
não mudou e não pode mudar. Todo comando de sistema passa por lá.

---

## As cinco coisas que o PC provavelmente vai querer "consertar"

### 1. O abrigo: a sessão grava em dois lugares, e isso é obrigatório

**O que parece:** `gravarMetaSessao` tenta gravar em `~/.claude/…` e, se
falhar, tenta de novo em `~/.local/share/agent-cockpit/sessoes`. Parece
remendo, e a leitura ficou mais cara (olha os dois lugares e compara data).

**Por que existe, medido em 19/08:** dentro do sandbox do Claude Code, a
pasta `~/.claude` está montada **somente leitura**. Não é permissão de disco:
a pasta é gravável, e o mesmo `touch` funciona fora do sandbox. O erro é
`EROFS`.

**O estrago que ele evita:** sem o abrigo, **nenhuma sessão aparece no
painel**, e não aparece erro nenhum. O Felipe passou uma tarde achando que
uma sessão dele estava rodando "por fora de todo o sistema".

**No PC pode ser diferente**, e é justamente por isso que o código tenta a
casa primeiro: onde a casa funciona, nada muda. Se no PC a casa grava normal,
o abrigo nunca é usado, e apagar o caminho alternativo não traz benefício
nenhum, só quebra a VPS.

**Se for mexer:** só encoste aqui depois de rodar, no Windows, um `cc set`
com uma sessão de verdade e conferir onde o arquivo caiu. Ver `CC-157` no
`docs/ROADMAP.md`.

### 2. Falha de rede que avisa, em vez de sumir

**O que parece:** quatro `catch` que agora chamam `toast(...)`. Parece
ruído: erro de rede em painel local quase nunca acontece.

**Por que existe, medido em 19/08:** acontece toda vez que o painel
reinicia, e o painel reinicia a cada mudança de código. E o pior caso não era
"nada acontece": a lista de projetos virava `[]`, e lista vazia **imprime
"nenhum projeto encontrado nesta máquina"**. Uma afirmação falsa com cara de
fato. O Felipe leu aquilo e concluiu que não existia opção de ligar o
framework num projeto.

**Não troque de volta por silêncio.** É a mesma família do `total: 0` do
CC-124: resposta vazia com ar de resposta completa. Ver `CC-158`.

### 3. Os hooks: a cópia global e a do repositório precisam bater

**O que parece:** existe `hooks/routia/rota-guard.mjs` no repositório E uma
cópia em `~/.claude/hooks/rota-guard.mjs`. Duplicação óbvia.

**Por que existe:** o `settings.json` do Claude Code aponta para caminho
absoluto. Alguns hooks apontam para o repositório (e aí editar o repo já
serve o código novo), outros apontam para `~/.claude/hooks/` (e aí editar o
repo **não faz nada** até alguém copiar).

**A armadilha que isso cria, e ela é silenciosa:** você edita o hook no
repositório, testa, o teste passa (porque o teste chama o do repo), e o
Claude Code continua executando a cópia velha. Aconteceu em 19/08.

**No PC os caminhos são outros.** Não reescreva os caminhos do
`settings.json` da VPS achando que está normalizando: eles estão certos para
esta máquina. Se precisar mexer, mexa no `settings.json` da SUA máquina.

### 4. O reinício do painel sem `sudo`

**O que parece:** o código chama `POST /api/shutdown` para reiniciar o
painel. Parece frágil, e um `systemctl restart` seria mais limpo.

**Por que existe:** na VPS o usuário `claudedev` **não tem `sudo`**, de
propósito, porque a mesma máquina serve seis sites de cliente em produção. O
serviço tem `Restart=always`, então derrubar o processo faz o sistema subir
de novo em segundos, com o código novo, sem senha nenhuma.

**No PC não existe systemd.** Se você trocar isso por um comando de Windows,
**mantenha a rota `/api/shutdown` funcionando**: é o único jeito de reiniciar
o painel da VPS a partir de uma sessão remota, e sem ela o trabalho remoto do
Felipe trava esperando ele chegar num terminal.

### 5. O que é da VPS e não deve viajar

Estes existem só nesta máquina e não devem ser replicados nem "corrigidos"
no PC:

| O que | Onde | Por quê |
|---|---|---|
| serviço `agent-cockpit` | systemd de usuário | não existe no Windows |
| porta de entrada com senha | `~/cockpit-auth.mjs`, porta 5181 | o painel da VPS é público na internet; o do PC não |
| `~/dev.sh` | home do `claudedev` | sobe projeto em `testedevoo.carzo.com.br` |
| chave SSH da VPS | `~/.ssh` | nunca sai daqui |

---

## O que fazer no PC, na ordem

1. **`git pull` primeiro, e leia o `docs/ROADMAP.md` antes de decidir
   qualquer coisa.** São 24 commits, e os itens CC-133 a CC-158 são todos
   novos para você.
2. **Rode `npm test`.** É o único gate. Se ele passar no Windows, o que a VPS
   construiu está compatível. Se falhar, o que falhou é informação valiosa:
   registre o que falhou ANTES de consertar, porque provavelmente é uma
   diferença real de sistema operacional, e não um erro.
3. **Confira o que o painel do PC enxerga**, com `cc json`. Se aparecer
   `total: 0` com agentes rodando, é o CC-124 de novo, e a causa é sempre a
   mesma: uma das duas fontes de agente não está sendo lida.
4. **Só então mexa em código.**

## A integração PC + VPS, que é o que ele quer construir

O caminho já existe pela metade, e o que falta está escrito:

- **A federação já funciona** (`src/federacao.mjs`, CC-47 a CC-58): um pacote
  com os agentes, servidores e rotas de uma máquina viaja para a outra, e a
  tela junta os dois. As rotas de trabalho de outra máquina já aparecem no
  quadro, levemente apagadas e sem botão de liberar, de propósito.
- **A topologia é torta de um lado só, e isso decide o desenho:** o PC alcança
  `cockpit.carzo.com.br`; a VPS **nunca** alcança o PC atrás do NAT. Então a
  VPS é obrigatoriamente o servidor, e o PC é cliente que empurra e puxa.
  Qualquer desenho que ignore isso não sai do papel. Está em `CC-104`.
- **O que falta é o serviço do lado do Windows** que empurra o pacote da
  federação de tempos em tempos. `src/platform.mjs` já tem o caminho de
  autostart do Windows, usado pelo daemon.
- **Cuidado medido, e ele vale ouro aqui:** servidor subido por tarefa de
  background do Claude Code **nunca termina**, e a sessão fica "ativa" para
  sempre. Já custou 11 horas de relógio correndo. Instância de teste sobe e
  morre dentro do mesmo comando.

## Se der conflito de merge

O Felipe trabalha nas duas máquinas, às vezes no mesmo dia. Quando o mesmo
arquivo divergir:

- **`docs/ROADMAP.md` e o diário: fique com os dois lados.** São append, e
  perder um item é perder trabalho registrado.
- **`src/ui.html`: cuidado dobrado.** É o maior arquivo do projeto e o mais
  disputado. Ver quem tem a rota em `docs/ROTAS-ATIVAS.md` antes.
- **`docs/ROTAS-ATIVAS.md` em si: nunca sobrescreva.** Ele diz quem está
  mexendo em quê agora, nas duas máquinas.
