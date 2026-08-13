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
