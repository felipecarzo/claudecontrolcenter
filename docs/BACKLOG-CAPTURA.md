---
tags: [processo]
tipo: captura
atualizado: 2026-08-13
estado: append-only, item resolvido sai daqui
resumo: Ideias que o Felipe solta no meio de outra tarefa, anotadas na hora com as palavras dele para não se perderem. O que eu apuro depois entra embaixo como "Apurado", sem reescrever o que ele disse.
---

# Backlog de captura

Ideias e observações do Felipe ditas no meio de outra tarefa, anotadas na hora
pra não se perder e tratadas depois. **Append-only**: item novo entra no fim,
item resolvido sai daqui e vira linha no diário ou item do [[ROADMAP]].

Regra de uso: registrar com as palavras dele. Se eu apurei algo que contradiz
ou completa, entra como **Apurado**, embaixo, sem reescrever o que ele disse.

---

## 2026-08-13

### 1. Renomear Control Center para Agent Cockpit (AC)

> "o control center (que vamos chamar agora de agent cockpit ou AC)"

Decisão de nome, ainda não aplicada em lugar nenhum. Alcance a definir: nome do
repositório (`claudecontrolcenter`), o binário `cc`, os arquivos
`control-center-*.json` em `~/.claude`, o bloco de protocolo no `CLAUDE.md`
global e nos `CLAUDE.md` de todos os projetos, mais a skill `cc-sync`.

Não tocar em nada disso sem decisão explícita: renomear o binário e os arquivos
de estado quebra todos os projetos que já reportam.

### 2. Colocar o opencode na VPS por causa do registro de uso

> "o control center [...] usa o open code né, pra fazer a, a, o registro do
> estudo uso então a gente teria que colocar, o open code na vps também"

**Apurado, e a premissa não se confirma.** O registro de uso não passa por
opencode:

- `src/uso.mjs` é quem registra uso. Fonte declarada no próprio cabeçalho: os
  `rate_limits` que o Claude Code entrega no JSON do **statusLine**, a cada
  resposta. O comentário diz "não há chamada de rede aqui, nem leitura de
  credencial", e é o número oficial da conta, o mesmo do `/usage`.
- `src/opencode.mjs` é outra coisa: delegação de tarefas pro opencode
  (decompor e enriquecer to-do), escopo CC-29, consumido por CC-30 e CC-36,
  ambos ainda abertos no ROADMAP.
- `docs/produto/FRAMEWORK-HOOKS.md:37` já decidiu o contrário do que a ideia
  propõe: "`opencode` roda **local** nesta máquina, nunca via SSH/VPS."

**O que de fato falta pro AC funcionar na VPS** (este é o item real, não o
opencode):

1. Instalar o `cc` na VPS (hoje não existe lá).
2. Configurar a `statusLine` no `settings.json` do usuário `claudedev`. Ela foi
   deliberadamente removida na migração de 2026-08-13 porque apontava pro
   `cc.mjs` instalado via npm no Windows. **Sem statusLine não há registro de
   uso**, com ou sem opencode.
3. Decidir se o painel web do AC roda na VPS, no Windows, ou nos dois, e como
   os dois estados se juntam (dois `control-center-*.json` distintos, um por
   máquina).
4. Só então, se ainda fizer sentido, avaliar opencode na VPS. E aí revisitar a
   decisão do FRAMEWORK-HOOKS antes, não depois.

### 3. Frase interrompida, falta o final

> "e a gente conseguiria fazer o também"

A frase foi cortada. Não sei o que era "o". Perguntar quando ele voltar ao
assunto.

### 4. Cloudflare é dispensável se o domínio já aponta pra VPS

> "usar o Cloudflare porque se a gente já usa o endereço da nossa VPS? faz
> sentido isso? é ruim?"

**Ele tinha razão, e já foi resolvido em 2026-08-13.** O túnel
`trycloudflare.com` foi abandonado: dava URL nova a cada execução, e o
`~/dev.sh` precisava ficar informando endereço novo. Trocado por
`https://testedevoo.carzo.com.br`, com registro A na Hostinger apontando direto
pro IP da VPS e certificado Let's Encrypt emitido por validação na porta 80.
Zero Cloudflare no caminho.

**Achado que atrapalhou e vale registrar:** a credencial Cloudflare que existe
na VPS (`/root/.secrets/cloudflare.ini`) só alcança 3 zonas: `ahtleta.com.br`,
`boxboutique.com.br` e `ghoscode.com.br`. Os domínios `carzo.com.br` e
`inovallbond.com.br` estão na **Hostinger** (`dns-parking.com`), fora do alcance
de qualquer automação da VPS. Sobrou um certificado curinga
`*.dev.ahtleta.com.br` emitido antes dessa descoberta, hoje sem uso: decidir se
apaga ou aproveita.

### 5. `cockpit.carzo.com.br` reservado, painel ainda não instalado

Ele criou o registro A e ele já está no nginx apontando pra `127.0.0.1:5180`.
Não há nada escutando nessa porta: o Agent Cockpit não está instalado na VPS.
Enquanto não estiver, o endereço responde erro, o que é esperado.

Isto se conecta ao item 2: instalar o `cc` na VPS e configurar a `statusLine`
são o que falta de verdade, e este subdomínio é onde o painel apareceria.

---

### 6. `cc` colide com o compilador C em Linux, e isso afeta o rename

**Achado ao instalar na VPS em 2026-08-13, e é o argumento mais forte a favor do
rename do item 1.**

`cc` é o compilador C do sistema em qualquer Linux (`/usr/bin/cc`, aponta pro
gcc). Colocar o binário do painel antes dele no `PATH` quebra a compilação de
qualquer pacote com módulo nativo, porque o `node-gyp` invoca `cc`. No Windows
o problema não existe, e por isso passou despercebido até agora.

Na VPS o comando ficou **`cockpit`**, e o `PATH` do npm global foi posto no
**fim**, não no início, justamente pra não mascarar binário do sistema.

Consequência prática pro rename: se o nome do binário virar `cockpit` de vez, o
problema some sozinho. Se continuar `cc`, todo Linux vai precisar dessa gambiarra.
O bloco de protocolo do `CLAUDE.md` da VPS já foi escrito com `cockpit`.

### 7. Achados menores da instalação na VPS

- **Node do root é inacessível.** `/usr/local/bin/node` aponta pra
  `/root/.hermes/node/bin/node`, e `/root` é `drwx------`. Qualquer serviço que
  rode como usuário não-root precisa usar `/usr/bin/node` (v20.20.2). O serviço
  systemd do painel falhava com `status=203/EXEC` por causa disso.
- **`opencode` funciona sem login**, versão 1.18.18, com os modelos `*-free`.
  Mas exige `< /dev/null` quando chamado de dentro de script: sem isso ele
  consome o resto do script como entrada e executa o que vier depois. Isso foi
  observado de verdade, não é teoria.
- **A `statusLine` não roda com `claude -p`.** Só em sessão interativa. Logo o
  `control-center-uso.json` não atualiza em execuções headless, e isso não é
  defeito. O mecanismo em si foi validado injetando `rate_limits` na mão: gravou
  certo (5h e semana).
- **`cockpit set` exige um job real** em `~/.claude/jobs/<id>`. Com diretório
  sintético ele grava o JSON mas o job não aparece em `cockpit json`. Vale
  conferir se isso é intencional ou se falta um caminho de fallback.

### 8. Botão de deslogar dispositivos na aba VPS (pendente)

Pedido dele:

> "coloca login e senha com autenticação maxima pra salvar no dispositivo mas me
> permitir deslogar pelo control center do pc na aba VPS"

**Metade entregue.** A autenticação está no ar e a revogação funciona, testada:
o mesmo cookie vira 401 no ato. Falta o botão na aba VPS do painel do PC.

Não fiz agora porque `src/ui.html` e `src/web.mjs` estavam com alterações não
commitadas de outra sessão em 2026-08-13, e editá-los criaria conflito.
`src/vps.mjs` está livre.

Enquanto o botão não existe, o comando equivalente, rodado do PC:

    ssh -i ~/.ssh/id_ed25519_ahtleta claudedev@66.94.117.215 "cockpit-auth revogar"
    ssh -i ~/.ssh/id_ed25519_ahtleta claudedev@66.94.117.215 "cockpit-auth sessoes"

Para integrar: `cockpit-auth json` já devolve a lista pronta em JSON, pensando
nisso. O caminho é `vps.mjs` chamar esse comando no mesmo SSH do snapshot, e a
aba mostrar a lista com um botão por linha mais um "deslogar todos".

### 9. Auditoria das abas na VPS: o que está vazio e por quê

Todas as 12 abas respondem, nenhuma quebrada. As vazias, e a causa real:

| Aba | Estado | Causa |
|---|---|---|
| Agentes, To-dos, Tempo, Hooks, Rotinas, Servidores, Escritório | ok | |
| Docker | **corrigido** | faltava o grupo; resolvido com `SupplementaryGroups=docker` só no serviço |
| Cockpit | vazio | depende de jobs de agente, enche com o uso |
| Gráficos | vazio | depende de histórico acumulado |
| Agenda | não configurado | exige OAuth do Google, não feito |
| VPS | não configurado | ver abaixo |
| **Processos** | **indisponível por design** | `processos.mjs` é só Windows (`Get-Process`) |

Duas decisões pendentes:

- **Processos em Linux.** Hoje a aba some fora do Windows, o que o próprio código
  documenta como intencional. Implementar o equivalente com `ps` é feature nova.
  Vale? Numa VPS, saber o que pesa a máquina tem uso real.
- **Aba VPS dentro da própria VPS.** Ela existe pra ver a VPS de fora, por SSH.
  Rodando na VPS ficaria olhando pra si mesma, e exigiria gerar uma chave SSH pro
  `claudedev` apontando pra localhost. Além disso é redundante com Servidores e
  Docker ali. Deixei desconfigurada de propósito. Decidir se vale.

## Como isso entrou aqui

Pedido dele, no meio da migração pra VPS:

> "vai anotando como comentários meus pra gente ir colocando pro final da fila,
> e aí a gente pode criar um arquivinho pra ir anotando essas coisas pra não
> perder. E aí depois você faz [...] pra não atrapalhar o seu processamento"

---

## 2026-08-18

### Abrir sessão de projeto + agente pelo painel, como ele já abre o Remote Control

> "a minha ideia depois de resolver os dois é fazer eu abrir sessão do projeto e
> do agente (agy ou opencode) igual eu abro o rc do Claude, e quando abrir o
> /opencode ou /agy já abrir c os projetos abertos. (verifica se eles tem remote
> o algum app standalone, seria bom)"

Dito em 18/08, logo depois que os atalhos do opencode e do agy entraram na aba
de agentes. O que ele descreve é um nível acima do atalho: hoje o botão abre a
ferramenta na pasta em que o servidor subiu, e ele quer escolher **projeto E
agente** antes de entrar, do mesmo jeito que o botão de Remote Control já abre
sessão do Claude numa pasta.

Duas apurações pendentes, nas palavras dele ("verifica se eles tem remote"):

- **opencode**: tem `opencode attach <url>` e descoberta por mDNS, além do
  servidor com API. Falta apurar se existe app de celular ou desktop oficial.
- **agy (Antigravity)**: tem o editor de janela para computador e a linha de
  comando. Falta apurar se o editor conecta num servidor remoto, que é o que
  tornaria "abrir do celular" possível sem passar pelo terminal.

O caminho técnico já existe do lado do opencode: a API aceita abrir sessão e
terminal com pasta escolhida (o campo `directory` aparece na resposta de
`/api/pty`), então o painel poderia oferecer a lista de projetos e mandar a
pasta junto.

### Rodar uma sessão do Claude com modelo gratuito, sem perder o Remote Control

> "existe um fork de um negócio que se chama alguma coisa router que permite
> trocar o modelo do Claude pra outros gratuitos como o bigpickle e outros.
> teria como colocar pra uma sessão do Claude rodar com um modelo desses
> gratuitos e ainda usar o remote control?"

Pergunta de viabilidade, não tarefa. O que ele chama de "alguma coisa router" é
provavelmente o `claude-code-router`, que redireciona as chamadas de modelo do
CLI para outro servidor.

A dúvida real é a segunda metade, e ela precisa ser MEDIDA, não opinada: o
Remote Control é canal da conta na Anthropic, e o roteador troca justamente o
endereço para onde as chamadas vão. Se os dois canais forem o mesmo, uma coisa
quebra a outra. Apurar antes de prometer.

**Apurado em 18/08, nas duas frentes que ele mandou verificar:**

- **opencode tem os dois.** App de celular existe (`opencode-remote`, self-hosted,
  cliente Expo para iOS e Android, ainda alpha) e o app de computador conecta em
  servidor remoto por SSH com encaminhamento de porta. Mas nenhum dos dois é
  necessário para o que ele quer: `opencode serve` já entrega a tela completa no
  navegador do celular, que é o caminho que ficou no ar em `/opencode`.
- **agy tem editor de computador, não tem app de celular.** O editor é fork do
  VS Code e aceita a extensão Remote SSH igual ao original, então dá para editar
  na VPS a partir do PC dele. O Agent Manager (a superfície 2.0) NÃO suporta
  conexão remota. Do celular, o caminho continua sendo o terminal.

**Apurado sobre o roteador, e a resposta é não:** desde a versão 2.1.196 do
Claude Code, o Remote Control é desligado sempre que `ANTHROPIC_BASE_URL` aponta
para um servidor que não é da Anthropic, e também enquanto houver credencial de
gateway configurada. O próprio projeto do roteador documenta isso. Ou seja: dá
para rodar o Claude com modelo gratuito, mas o preço é perder o Remote Control
naquela sessão. Os dois não convivem, e não é questão de configuração.
