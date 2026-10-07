# Registro de auditoria e volta de versão: instalar

Itens CC-933 e CC-935. O código está pronto e testado no repositório. Falta a parte que só o
administrador faz: copiar os arquivos novos para onde os dois serviços moram e reiniciá-los.
Os agentes (usuário `claudedev`, sem sudo) não conseguem rodar nada disto.

## O que muda quando instalar

- **Registro central**: um arquivo só, `/var/log/cockpit/auditoria.jsonl`, uma linha por ação
  sensível. O dono é root e o atributo "só acréscimo" está ligado: a porta de entrada e os agentes
  conseguem **adicionar** linhas, mas ninguém apaga nem reescreve as que já estão lá.
- **O que vira linha**: login certo e errado (com IP e aparelho), saída do painel, troca de senha,
  sessão revogada, código do autenticador aceito ou recusado, ligar e desligar o código no login,
  deploy pedido, confirmado, recusado e resultado, volta de versão (mesmas quatro etapas), site
  cadastrado e religar a VPS.
- **O que nunca vira linha**: senha, código do autenticador, segredo, token e cookie. Só o fato.
- **Se o registro falhar** (disco cheio, permissão), a ação continua e o aviso sai no log do serviço
  (`journalctl`). Registro quebrado nunca derruba login nem deploy.
- **Voltar a versão de um site**: o deploy seguro já guarda uma cópia do que estava no ar antes de
  cada troca. Agora essa cópia pode ser devolvida pelo mesmo caminho do deploy (pedido, código do
  autenticador, conferência do site). Se o site não servir a versão devolvida, a que estava no ar
  volta sozinha.

## Passo a passo (como administrador)

Os dois instaladores já criam o registro central sozinhos (chamam `tools/auditoria/instalar.sh`),
então basta rodar os dois, nesta ordem.

```bash
sudo bash /home/claudedev/projetos/VPS_cockpit/tools/deploy-seguro/instalar.sh
```

- Mostra o `sha256sum` dos arquivos e confere a sintaxe antes de tocar em qualquer coisa.
- Cria `/var/log/cockpit/auditoria.jsonl` e liga o "só acréscimo".
- Guarda a versão anterior do serviço como `/opt/cockpit-deploy/deploy-seguro.mjs.antes-DATA`.
- Copia `deploy-seguro.mjs` e `auditoria.mjs` para `/opt/cockpit-deploy`, e reinicia o serviço.
- A lista de sites (`alvos.json`) e o segredo do autenticador continuam como estão: o instalador
  só pergunta se a lista do repositório for diferente da instalada.

```bash
sudo bash /home/claudedev/projetos/VPS_cockpit/tools/porta-entrada/instalar.sh
```

- Confere a sintaxe, guarda cópia do que está instalado, copia os arquivos para `/home/claudedev`
  (incluindo o novo `auditoria.mjs`) e reinicia o `cockpit-auth`.
- Se o serviço não responder depois do restart, devolve a versão anterior sozinho.
- O código do autenticador no login continua como estava (ligado ou desligado): o instalador não mexe.

### Conferir

1. Faça login no painel (o seu "dele: fazer login e ver a linha no registro"), depois:

   ```bash
   node /home/claudedev/projetos/VPS_cockpit/cc.mjs auditoria --ultimos 10
   ```

   A linha do login aparece em português, com o IP e o aparelho. (Sem `COCKPIT_AUDITORIA` no
   ambiente, o comando lê o arquivo central assim que ele existe.)
2. Se não aparecer, o serviço da porta de entrada não conseguiu gravar. Veja:

   ```bash
   journalctl -u cockpit-auth -n 30 | grep auditoria
   ```

   Se o `cockpit-auth` tiver `ProtectSystem=` no unit (`systemctl cat cockpit-auth`), o arquivo de
   complemento criado pelo instalador (`ReadWritePaths=/var/log/cockpit`) é o que libera a escrita.
3. Um login com senha errada também vira linha (ok = ERRO, "senha incorreta"). Nunca a senha digitada.

## Como pedir e provar a volta de uma versão (CC-935)

Só sites estáticos e de processo cadastrados no deploy seguro, e só depois de existir ao menos um
deploy feito por ele (é o que cria a cópia). O pedido é o mesmo do deploy, com `reverter`:

```bash
curl -s -X POST http://127.0.0.1:5193/api/pedir -d '{"alvo":"mnzs","de":"felipe","reverter":true}'
```

- O pedido aparece em `https://cockpit.carzo.com.br/deploy-seguro/` com o botão "confirmar e voltar"
  e o nome da cópia que será devolvida. Você digita o código do autenticador, como num deploy.
- Pedir de novo depois de voltar **desfaz a volta** (a versão que estava no ar fica guardada antes).
- O que o teste automático prova, em pastas temporárias: o deploy troca a versão, a volta devolve
  arquivos, pastas e conteúdo iguais, byte a byte, e a volta que o site não serve é desfeita sozinha.
  Para provar em produção: faça um deploy de teste num site de pouca importância, peça a volta,
  confirme e olhe o site e `node cc.mjs auditoria`: as linhas `rollback-pedido`,
  `rollback-confirmado` e `rollback-resultado` ficam no registro.
- Limite conhecido: num site de processo (Docker ou PM2), arquivo que só existe na versão nova fica
  na pasta depois da volta (a cópia devolve o que existia, não apaga o resto). Dados, `.env` e
  dependências nunca entram na cópia nem são tocados.

## Os dois apps de segurança no celular (CC-859)

O mesmo reinstalar traz os dois: cada `instalar.sh` já copia o `app-seguranca.mjs` (manifesto,
ícone e service worker) ao lado do serviço. Rodar os dois instaladores de novo, nada além.

- **Deploy seguro**: `https://cockpit.carzo.com.br/deploy-seguro/`, ícone azul com seta para cima.
- **Religar VPS**: `https://cockpit.carzo.com.br/__religar`, ícone laranja de ligar/desligar.

No celular (Chrome no Android): abra a página, menu de três pontos, **Instalar app**. Cada uma vira
um app próprio na tela inicial e abre direto na própria página.

O login não muda. O app não guarda senha nem código, e o service worker não guarda nenhuma página:
tudo vai para a rede. Só o manifesto, os ícones e o `sw.js` abrem sem sessão (o Chrome os busca sem
o cookie); a página de religar continua pedindo senha, e a de deploy continua pedindo o código do
autenticador, como hoje. Se o app abrir pedindo senha, é a sessão vencida: entre, e o login leva ao
painel, de onde você volta pelo ícone.

## Avisos de queda (CC-932)

A porta de entrada passa a vigiar o painel e os sites com endereço público e a mandar uma
notificação ao celular inscrito. A queda da VPS inteira não é daqui: ela fica com um monitor
externo, que não mora na máquina que caiu.

1. Reinstale a porta de entrada (o instalador agora copia `push.mjs` e `vigia.mjs`, e gera a lista
   de sites vigiados a partir da lista do deploy seguro):

   ```bash
   sudo bash /home/claudedev/projetos/VPS_cockpit/tools/porta-entrada/instalar.sh
   ```

2. No celular, abra o painel, **Ajustes**, bloco **Avisos no celular**, e toque em **Ligar avisos**.
   O navegador pede permissão de notificação: aceite. O estado na tela passa a dizer "ligado".
3. Toque em **Mandar um aviso de teste**. A notificação "teste: os avisos chegam aqui" deve chegar
   em segundos. Tocar nela abre o painel.
4. Prova de queda de verdade (a conferência é sua): derrube um serviço de teste e espere até 5
   minutos. O aviso é "fora do ar: nome", e quando voltar, "voltou: nome". Cada aviso fica no
   registro: `node cc.mjs auditoria --ultimos 10` mostra as linhas `alerta`.

O que vale saber:

- A cada 60 s a porta mede o painel e cada site (só GET, 10 s de limite; qualquer resposta abaixo
  de 500 é "no ar"). **Duas falhas seguidas** avisam; a queda não é repetida enquanto o alvo não
  voltar. Um reinício rápido do painel (menos de 1 minuto) não avisa.
- A lista de sites é uma cópia da lista do deploy seguro, gravada em `~/.cockpit-vigia-alvos.json`
  na hora da instalação (a porta não consegue ler `/etc/cockpit-deploy`). Site cadastrado depois
  só entra na vigia ao rodar o instalador de novo.
- As chaves e as inscrições ficam em `~/.cockpit-push/` (pasta 0700, arquivos 0600). Apagar a pasta
  desliga os avisos: é preciso ligar de novo no celular.
- `COCKPIT_VIGIA=off` no ambiente do serviço desliga a vigia sem desinstalar nada. O endereço de
  contato que vai junto no push é `COCKPIT_PUSH_SUB` (padrão `mailto:cockpit@carzo.com.br`).
- iPhone só recebe push com o painel instalado na tela de início (iOS 16.4 ou mais).

## Desfazer a instalação

- Deploy seguro: copie `/opt/cockpit-deploy/deploy-seguro.mjs.antes-DATA` de volta para
  `deploy-seguro.mjs` e `sudo systemctl restart cockpit-deploy`.
- Porta de entrada: os `*.antes-DATA` em `/home/claudedev` fazem o mesmo para o `cockpit-auth`.
- O registro central pode ficar: nenhum serviço antigo o usa. Para apagá-lo (ou girar o arquivo),
  primeiro `sudo chattr -a /var/log/cockpit/auditoria.jsonl`. Isso é de propósito: só o administrador
  consegue.

## Limites honestos

- O campo "de" (IP) vem do nginx (`x-real-ip`). Quem fala direto com a porta 5193 pela própria
  máquina informa o endereço da conexão, ou o que escrever no cabeçalho: serve para ler o rastro,
  não como prova contra quem controla a máquina.
- Quem tem acesso de escrita ao arquivo pode **acrescentar** linhas falsas (é o preço de deixar a
  porta de entrada gravar sem ser root). Não consegue apagar nem alterar as verdadeiras.
- O registro não gira sozinho. Em volume de uso normal são poucas linhas por dia.
