# Operação da VPS — passagem de bastão

**Escrito em 2026-08-13 por `48f6738c`, que montou tudo isto, para `5805d6bb`,
que passa a ser o dono da VPS a partir de agora.** Decisão do Felipe: centralizar
a operação da VPS numa sessão só.

Este documento é o estado real da máquina, medido, não o desejado. Onde eu não
testei, está escrito que não testei.

---

## Acesso

```bash
ssh -t -i ~/.ssh/id_ed25519_ahtleta claudedev@66.94.117.215
```

- **`claudedev`** (uid 1001) é o usuário de trabalho. **Não tem sudo**, de
  propósito: a mesma máquina serve fibraessencia, ibrics, profinance, ahtleta,
  inovallbond e um Supabase self-hosted, todos em produção.
- `root` continua acessível com a mesma chave, para tarefas de infraestrutura.
- A chave do Felipe já está autorizada nos dois.

⚠️ **`/usr/local/bin/node` aponta para dentro de `/root`, que é `drwx------`.**
Qualquer serviço rodando como usuário comum precisa de **`/usr/bin/node`**
(v20.20.2). Foi o que derrubou o serviço do painel com `status=203/EXEC` na
primeira tentativa.

## O que está no ar

| Serviço systemd | Porta | O quê |
|---|---|---|
| `agent-cockpit` | 5180 (só localhost) | painel do Cockpit |
| `cockpit-auth` | 5181 (só localhost) | portão com senha, é quem o nginx expõe |
| `nginx` | 80/443 | os sites e os dois domínios abaixo |

| Endereço | Aponta para | Protegido |
|---|---|---|
| `https://cockpit.carzo.com.br` | 5181 → 5180 | sim, senha |
| `https://testedevoo.carzo.com.br` | 5173 | não, é prévia |

Todos habilitados no boot, junto com `docker` e `certbot.timer`. Renovação de
certificado testada com `--dry-run`: passou.

⚠️ **Nunca exponha a 5180 direto no nginx.** É o painel sem autenticação
nenhuma. O `cockpit.carzo.com.br` tem que continuar apontando para a 5181.

## Autenticação do painel

Camada separada em `~/cockpit-auth.mjs`, escrita fora do código do Cockpit
justamente para não conflitar com quem mexe no repo. Sai do caminho apagando
o serviço.

```bash
cockpit-auth sessoes          # quem está logado: ip, aparelho, horário
cockpit-auth revogar          # desloga todos
cockpit-auth revogar <id>     # desloga um
cockpit-auth senha "<nova>"   # troca a senha (revoga tudo junto)
```

- Senha guardada como hash scrypt com sal, em `~/.cockpit-auth.json`. **Não é
  recuperável**: se o Felipe pedir a senha, ofereça trocar por uma nova.
- Sessão é cookie HttpOnly + Secure de 1 ano, para o celular dele ficar lembrado.
- Revogação é server-side: apagar a sessão derruba o aparelho no ato, mesmo com
  o cookie ainda guardado. Testado.
- Atraso progressivo por IP depois de 3 erros de senha.

**Pendente, e é seu:** o Felipe pediu um botão de deslogar na aba VPS do painel
do PC. Não fiz porque `ui.html` e `web.mjs` estavam na sua mão. O
`cockpit-auth json` já devolve a lista pronta, pensado para isso.

## O comando é `cockpit`, não `cc`

Em Linux `cc` **é o compilador C** (`/usr/bin/cc`, aponta pro gcc). Mascarar ele
no PATH quebra a compilação de qualquer pacote com módulo nativo, porque o
`node-gyp` invoca `cc`. Por isso, na VPS:

- o binário chama **`cockpit`**;
- `~/.npm-global/bin` está no **fim** do PATH, não no início.

O protocolo de reporte do Cockpit vale igual, só trocando `cc` por `cockpit`.
Isto é argumento forte para o rename que o Felipe quer: se o nome do binário
virar `cockpit` de vez, o problema some sozinho em todo Linux.

## Prévias para o Felipe ver no celular

```bash
~/dev.sh jogo | site | carzo    # sobe e publica em testedevoo.carzo.com.br
~/dev.sh status                 # o que está no ar
~/dev.sh parar
```

- **Um projeto por vez**, todos na porta 5173, que é para onde o nginx aponta.
  Assim trocar de projeto não exige root, que o Felipe não tem na rua.
- Usa `setsid`: o servidor **sobrevive** ao fim da sessão do Claude que o subiu.
  Sem isso ele morria junto e o Felipe ficava sem prévia. Testado matando a
  shell pai.
- Hot reload atravessa o nginx (cabeçalhos `Upgrade`/`Connection` no server
  block). Editar já reflete, sem reiniciar.
- **Não volta sozinho depois de um reboot.** O Felipe sabe e está de acordo: ele
  vê pela aba Servidores que está off e pede de novo. Se ele disser que o
  endereço não abre, rode `~/dev.sh status` antes de investigar outra coisa.
- Túnel do Cloudflare foi **abandonado** em 13/08: dava URL nova a cada
  execução. Se achar `trycloudflare` em algum lugar, está obsoleto.

## Aba VPS: modo local mais sudoers

**Estado final, fechado em 13/08.** A aba lê a máquina localmente, sem SSH e sem
chave nenhuma:

- `CC_VPS_LOCAL=1` no serviço `agent-cockpit` faz `configurada()` devolver `true`
  e `atualizarSnapshot()` rodar por `bash -lc` em vez de `ssh`.
- `/etc/sudoers.d/cockpit-pm2` libera **só** `sudo -n /usr/bin/pm2 jlist` para o
  `claudedev`. Qualquer outro comando com sudo continua pedindo senha, testado.

Medido depois de tudo no lugar: **nginx 15 · PM2 5 · docker 22**, com os
processos nomeados (`ahtleta`, `painel-int`, `inovallbond`, `pierre-svc`,
`pierre-app`).

O sudoers existe porque cada usuário tem seu próprio daemon do PM2: sem ele o
`claudedev` enxergava `[]`, e a aba ficava cega justamente para os sites de
cliente no ar. Foi a opção que o Felipe escolheu, com o critério dele: "sempre o
caminho que tem mais possibilidade de integração remota".

Docker aparece porque o grupo foi dado ao **processo** do painel
(`SupplementaryGroups=docker` no systemd), não ao usuário em shell. Isso é
deliberado: `claudedev` com acesso ao socket do Docker vira root efetivo, e uma
sessão do Claude não pode ter esse caminho.

⚠️ **Histórico, para não confundir quem achar rastro:** houve uma solução
intermediária com a chave `~/.ssh/cockpit_snapshot` presa a um forced command e
o script `/usr/local/bin/cockpit-vps-snapshot.sh`. **Tudo isso foi removido em
13/08** quando o sudoers entrou. Se encontrar menção a esses caminhos em
qualquer lugar, está obsoleta. Backup do `authorized_keys` anterior ficou em
`/root/.ssh/authorized_keys.bak-*`.

## Sandbox e segredos

O Claude na VPS roda com `sandbox.enabled: true`. Rede por allowlist
(`github.com`, npm, `api.anthropic.com`, `*.trycloudflare.com`) e escrita
limitada ao diretório de trabalho mais `~/.npm`, `~/.cache`, `~/.config`,
`~/.local`, `~/logs`, `~/projetos` e `/tmp`.

O que **não** foi levado para a VPS, de propósito: as chaves de API de IA
(`.secrets/gemini-image.env`, `groq.env`), o token do PixelLab e todos os
servidores MCP. Os `.env` dos projetos foram, e estão no `.gitignore`.

⚠️ Com Remote Control ligado, a documentação diz que o transcrito fica
armazenado nos servidores da Anthropic. Não imprima conteúdo de `.env`, da senha
do painel, nem de `~/.cockpit-auth.json`. O `segredo-guard` está ativo lá.

## Autorização entre agentes

Instalei em `~/.claude/hooks/` (no PC e na VPS) o protocolo que fecha o circuito
do Routia: quem é bloqueado numa rota de outro **registra um pedido**, o dono é
avisado no fim do turno dele e responde por comando.

```bash
node ~/.claude/hooks/rota-pedidos.mjs listar
node ~/.claude/hooks/rota-pedidos.mjs autorizar <id>
node ~/.claude/hooks/rota-pedidos.mjs negar <id> "motivo"
```

Autorizar libera só aquele arquivo, para aquela sessão, por 6 horas. Teste em
`~/.claude/hooks/testar-rota-pedidos.sh`, 10 checks, passando nas duas máquinas.

Isso existe porque **não há canal direto entre sessões**: o `SendMessage` só
alcança subagentes da própria sessão. O quadro e este documento são o canal.

## O que eu não testei

Sendo explícito, porque relatório sem isso vira ficção:

- **Reboot da VPS.** Os serviços estão `enabled`, mas não reiniciei a máquina
  para ver de fato. Ela hospeda produção e não me pareceu meu chamado derrubar.
- **A statusLine gravando uso numa sessão interativa real.** Validei o mecanismo
  injetando `rate_limits` na mão, e gravou certo. Mas `claude -p` não renderiza
  statusLine, então o caminho completo só se confirma quando o Felipe usar o
  `--rc` de verdade.
- **`cockpit set` aparecendo no painel.** Ele grava, mas com um job sintético o
  `cockpit json` continuou em 0. Deve aparecer com job real de agente; vale
  conferir na primeira vez.
