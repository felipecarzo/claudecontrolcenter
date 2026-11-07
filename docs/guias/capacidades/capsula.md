# Cápsula de projeto: backup que volta igual, sem IA

itens: CC-1080
codigo: src/capsula.mjs, src/capsulaDocker.mjs, src/capsulaServidor.mjs, src/capsulaPastas.mjs, src/capsulaPainel.mjs, src/capsulaJob.mjs, src/restaurar.sh, cc.mjs, test-capsula.mjs, test-capsula-painel.mjs, tools/capsula/docker-falso.mjs, tools/capsula/servidor-falso.mjs
atualizado: 2026-11-03
gerado: a mao
manual:

Plano de origem: `docs/CC-1080.md` (passos 1, 2 e 3 e a lacuna do site publicado construídos; faltam o 4 pela metade e o 5). Modelo do guia: skill `guia-de-capacidades`.

## 1. Estado e para quem vale

Passo 1 (pasta do projeto) pronto e provado em 02/11/2026. Passo 2 (parte Docker, tela Cápsulas, baixar) **escrito e provado
só com um Docker FALSO**: `test-capsula.mjs` (250 verificações, contando os passos 3, a lacuna do site publicado e os segredos de fora) e `test-capsula-painel.mjs` (32) passam, a tela foi
fotografada em 390 px e o painel foi religado com o código. **O Docker de verdade nunca rodou nesta construção**: a sessão do
Claude não executa `docker`, nem para ler, por decisão dele. O primeiro uso real é quando ele apertar "Fazer cápsula" na tela.
Passo 3 (configuração de servidor) **escrito e provado só com nginx, PM2, crontab e unidades FALSOS** nos testes; a LEITURA
do `/etc/nginx` de verdade foi feita (só leitura) para `VPS_ahtleta`, `VPS_dengonator2000` e `VPS_inovallbond`. A parte que
escreve (instalar bloco, `nginx -t`, certbot, `pm2 start`) **nunca rodou de verdade**: a sessão não tem root nem pode rodar
nginx, certbot, systemctl ou pm2 start, e o `restaurar.sh` só foi exercitado com root SIMULADO (um `id` falso) e binários falsos.
A lacuna do site publicado (pastas que o nginx serve e pastas que os contêineres montam) também só foi provada com pastas e Docker
FALSOS; a LEITURA real (só medir) foi feita para `VPS_ahtleta`, mas nenhuma coleta real de `publicado/` ou `montagens/` rodou.
Também NÃO foi conferida a cifra gpg AES256 real (a caixa de proteção da sessão nega o socket do gpg-agent; o teste usa um gpg
de mentira) e o `pg_dump` real nunca falou com um Postgres real.
Em 03/11 entraram duas correções (ver `docs/CC-1080.md`): os `.env` de dentro das pastas publicadas e montadas passaram a ir cifrados
no mesmo `segredos.tar.gpg` (só provado com pastas falsas e o gpg de mentira), e o Estimar passou a rodar em processo filho, com
id, andamento e teto de 120 s (medido de verdade no `VPS_ahtleta`: 13,8 s de medição, e a lista do painel respondeu em 4 a 56 ms
durante ela). O `restaurar.sh` recolocando um `.env` em `/var/www` com root de verdade nunca rodou.

## 2. O que é, e o que não é

É um arquivo `<nome>-<AAAAMMDD-HHMM>.capsula.tar.gz` que, aberto e passado a `restaurar.sh` (sh puro), recoloca a pasta do
projeto e, quando o projeto roda no Docker Compose, também as imagens, os volumes nomeados e os bancos Postgres, num projeto
Compose NOVO. Quando o painel faz a cápsula, também guarda a configuração de servidor do projeto: os blocos do nginx ligados a
ele (cada um com o motivo da ligação), os domínios, os processos PM2 do usuário, as unidades de usuário do systemd e as linhas
de cron que citam a pasta. Guarda também o site que está no ar: a pasta do `root` e de cada `alias` dos blocos de ligação certa que fica fora do projeto
(por exemplo `/var/www/ahtleta`) em `publicado/`, e as pastas que os contêineres montam do disco (bind mount) em `montagens/`.
Os `.env` que estejam dentro dessas pastas não vão no tar da pasta: vão cifrados no mesmo `segredos.tar.gpg` e voltam ao lugar de origem. NÃO guarda certificado nem chave privada (só o nome do domínio, e a chave que estiver dentro dessas pastas fica de fora), DNS, nem e-mail. NÃO apaga nada: a limpeza é outra etapa. NÃO
tem timer nem serviço: só roda quando ele aperta o botão.

## 3. Vocabulário

- **Cápsula:** o arquivo `.capsula.tar.gz`. Partes: `RESTAURAR.md`, `restaurar.sh`, `manifesto.json`, `projeto.tar.gz`, `segredos.tar.gpg` (se houver segredo, do projeto ou de dentro das pastas de fora dele), `docker/` (compose, imagens, volumes, `plano.tsv`) e `dados/*.dump` (se houver Docker), `servidor/` (se o painel leu o servidor), `publicado/`, `montagens/` e `pastas.tsv` (se houver pasta de fora do projeto).
- **Pasta de fora do projeto:** pasta que o nginx serve (`root`, `alias`) ou que um contêiner monta (bind) e que não está dentro da pasta do projeto. Vira `publicado/<caminho codificado>.tar.gz` ou `montagens/<...>.tar.gz` (`/` vira `__`, o resto fora de letra, número, `_` e `-` vira `_`), com o caminho original, tamanho e sha256 no manifesto e uma linha no `pastas.tsv`.
- **Estado de uma pasta (no manifesto):** `coletada`; `coberta` (está dentro de outra já coletada); `excluida` (sistema, `/etc/letsencrypt`, chave); `nao-coletada` (não existe, ampla demais, ilegível = "precisa de root", ou o tar falhou); `candidata-nao-incluida`.
- **Ruído:** domínio citado em 3 ou mais projetos (contando o próprio) deixa de gerar candidato por citação. Registrado em `servidor.ruido`.
- **Segredo:** `.env` ou `.env.*` (menos `.env.example`). Vai só cifrado, com a senha dele, esteja ele na pasta do projeto (volta ao projeto) ou DENTRO de uma pasta publicada ou montada (membro `_externo/<n>-<nome>` do `segredos.tar.gpg`, caminho original em `manifesto.segredos.pastas[]` e na linha `segredo` do `pastas.tsv`; volta ao caminho original no passo `4c` do `restaurar.sh`). A senha do banco NUNCA é lida: o despejo roda dentro do contêiner pelo socket local.
- **Medição (Estimar):** o `ensaio`, agora em processo filho. `POST /api/capsula/ensaio` devolve `{ id }`; o resultado vem em `GET /api/capsula/estado/:id`, campo `resultado`, com `tipo: 'ensaio'`.
- **Projeto Compose dono da pasta:** o rótulo `com.docker.compose.project` dos contêineres cujo `working_dir` está na pasta. Tudo o que o Docker faz é filtrado por ele.
- **Servidor falso:** `tools/capsula/servidor-falso.mjs`, pasta de nginx com 9 arquivos de blocos, PM2, crontab e unidades de mentira, mais binários falsos (nginx, certbot, pm2, crontab, systemctl, id) que registram cada chamada.
- **Prova:** restauração automática numa pasta temporária, ao lado da cápsula, comparada com a origem. Nunca encosta no Docker (`restaurar.sh --sem-docker`); abre cada imagem (`tar -tf`), volume e despejo (`pg_restore -l`). Vai em `provada` no manifesto.
- **Não coletado, precisa de root:** o que o usuário do painel não consegue ler. Fica de fora, vai para `nao_coletado` no manifesto e para o `RESTAURAR.md`, e a cápsula segue.
- **Bloco ligado:** bloco `server` do nginx que a descoberta liga ao projeto. **Certo** = o projeto prova a ligação (porta que o Docker publica, `PORT` do `.env` do projeto, `ExecStart`/`PORT` de unidade ou argumento do PM2 dele; `root`/`alias` dentro da pasta do projeto ou em `/var/www/<nome da pasta>`; o desvio de http com o mesmo `server_name` de um bloco certo). **Candidato** = ligação só provável (porta só no `package.json`/`ecosystem`, nome de pasta parecido, `server_name` só citado em arquivo do projeto): vem com o motivo e NÃO é instalado por padrão.
- **Variante sem SSL:** `servidor/nginx/<arquivo>.sem-ssl.conf`, o mesmo bloco com o 443 virado em 80 e sem certificado, para servidor novo; o certbot acrescenta o HTTPS.
- **Docker falso:** `tools/capsula/docker-falso.mjs`, um sh que ocupa o lugar do binário (`CC_DOCKER_BIN`) e registra cada comando.

## 4. O ciclo de ponta a ponta

1. Tela Cápsulas (`#capsulas`) lê `GET /api/capsula/lista`: projetos do registro que têm pasta nesta máquina, cápsulas existentes, disco livre.
2. **Estimar** (`POST /api/capsula/ensaio`, que devolve um id na hora; a tela pergunta `GET /api/capsula/estado/:id` de 1 em 1 s e mostra "Medindo… N s"; uma medição por vez, teto de 120 s, depois a mensagem diz que foi interrompida): mede, num processo filho, a pasta e a parte Docker (só leitura), diz total, disco livre, "cabe" e o que não dá para ler. Mostra também os blocos do nginx achados (certos e candidatos, com o motivo), os domínios, as pastas publicadas (certas e candidatas em listas separadas, com tamanho e se o painel consegue ler) e as pastas montadas, para ele conferir antes. O tamanho delas entra no total e na conta do disco; `cabe_com_candidatos` diz como ficaria marcando os candidatos. PM2 e cron só são lidos ao fazer, para o painel não travar.
3. **Fazer cápsula** abre uma caixa FORA do bloco redesenhado: estimativa, a caixa "incluir os candidatos" (só se houver pasta de candidato), senha duas vezes, mínimo 12 caracteres, botão só abre se cabe no disco (com os candidatos, se marcou). `POST /api/capsula/fazer {projeto, senha, incluirCandidatos?}` devolve um id na hora.
4. O painel dispara `src/capsulaJob.mjs` como processo filho (o painel não trava). A senha vai só por stdin; o andamento vai para `~/.local/share/agent-cockpit/capsulas/.estado/<id>.json`, que nunca recebe a senha. Um por vez.
5. O filho descobre o projeto Compose, inventaria, estima, confere o disco (3x o total: partes soltas, cápsula, e a prova que reabre e regrava), copia, lê a configuração de servidor (as portas do Docker ajudam a ligar os blocos), empacota, apaga as partes soltas e prova. Os segredos que os blocos apontam (htpasswd, EnvironmentFile) entram só no `segredos.tar.gpg`, em `_servidor/`.
6. `GET /api/capsula/estado/:id` mostra a fase e, no fim, o resultado da prova. `GET /api/capsula/baixar/:arquivo` entrega o arquivo (só `.capsula.tar.gz` direto da pasta, sem `..`).

## 5. Onde cada coisa mora

- `src/capsula.mjs`: `fazer` (assíncrona), `provar`, `ensaio`, `ensaioCompleto`, `varrer`, `gerarRestaurar` (9 seções), `RESTAURAR_SH` (lido de `src/restaurar.sh`).
- `src/capsulaDocker.mjs`: `executorPadrao` (recusa em sessão de IA), `guardar` (lista do que PODE), `descobrir`, `inventariar`, `estimar`, `coletar`, `ensaioDocker`.
- `src/capsulaServidor.mjs`: `descobrir` (tudo, só leitura), `descobrirNginx`, `descobrirPm2`, `descobrirUnidades`, `descobrirCron`, `coletar` (grava `servidor/` e o rascunho dos segredos externos), `resumir`, `contar`, `leitorPadrao` (recusa /etc/letsencrypt, `.key`, `.pem`, /private/), `pm2Padrao`, `crontabPadrao`, `redigir`. Leitores injetáveis: `nginxDir`, `unitDir`, `pm2`, `crontab`, `leitor`, `portasDocker`; variáveis `CC_NGINX_DIR`, `CC_UNIT_DIR`, `CC_PM2_BIN`, `CC_CRONTAB_BIN` trocam os padrões (o teste do painel usa).
- `servidor/` na cápsula: `nginx/<arquivo>.conf` (+ `.sem-ssl.conf`, `snippets/`), `pm2.json`, `systemd/`, `cron.txt`, `dominios.txt`, `plano.tsv` (linhas `nginx`, `nginxdir`, `snippet`, `segredo`, `pm2`, `unidade`, `usuario`, lidas pelo `restaurar.sh`).
- `src/capsulaPastas.mjs`: o motor das pastas de fora do projeto. `avaliar(caminho, { raizes, mapear })` mede sem gravar (situação: ok, sistema, excluida, ampla, nao-existe, precisa-root, nao-guardavel), `coletar(lista, stage, dir, { tipo })` grava uma parte por pasta, `bytesDe` soma sem contar pasta dentro de pasta duas vezes, `varrer` e `sha256Arquivo` (antes em `capsula.mjs`, que os reexporta). Constantes `SISTEMA_RE` e `CHAVE_PRIVADA`. `mapear` troca o caminho antes de tocar o disco (só os testes usam).
- `src/capsulaServidor.mjs` acha as pastas publicadas (`descobrir(...).publicado`, uma entrada por caminho com `certeza`, `origens` e `av`) e `coletar` as grava (`incluirCandidatos`, `descoberta` para não ler duas vezes); `citacoesEmOutros(raiz)` conta os projetos irmãos que citam um domínio. `src/capsulaDocker.mjs` acha as montagens em `inventariar` (`inv.montagens`), soma em `estimar` e grava em `coletar`; não ganhou comando docker nenhum.
- `pastas.tsv` na cápsula: uma linha por pasta coletada, campos separados por tab: tipo (`publicado` ou `montagem`), certeza, `d` (pasta) ou `f` (arquivo), parte, bytes, caminho original. Escrito por `fazer`, lido pelo `restaurar.sh`.
- `src/capsulaPainel.mjs`: `lista`, `iniciarEnsaio` (a rota do Estimar: id na hora, filho, teto, uma medição por vez), `medir` (a medição em si, síncrona em boa parte: só o filho e os testes a chamam), `ensaio` (medir pelo nome, no processo de quem chama), `ensaioAtivo`, `iniciar`, `estado` (devolve também `resultado` e `tipo: 'ensaio'`), `arquivoParaBaixar`, `projetosLocais` (do registro `cockpit-projetos.json`). `ENSAIO_TETO_MS` = 120000; `CC_CAPSULA_ENSAIO_TETO_MS` e `CC_CAPSULA_ENSAIO_ATRASO_MS` (bloqueio síncrono simulado no filho) só os testes usam.
- `src/capsulaJob.mjs`: o processo filho, em dois modos: fazer (senha por stdin) e `ensaio` (sem senha, escreve `resultado` no arquivo de estado). `src/web.mjs`: o bloco `#capsula` (5 rotas). `src/ui_cockpit2.html`: item de menu, `#view-capsulas`, `#cap-dlg` (a caixa da senha), bloco JS "tela Cápsulas". `docs/produto/PALAVRAS-DA-TELA.md`: seção `tela: capsulas` (o "?").
- `docker/plano.tsv` na cápsula: uma linha por coisa, campos separados por tab (`projeto`, `workdir`, `arqcompose`, `imagem`, `volume`, `banco`), lida pelo `restaurar.sh` sem JSON.

## 6. A interface, item por item

- Rotas: `GET /api/capsula/lista`, `POST /api/capsula/ensaio {projeto, incluirCandidatos?}` (devolve `{ id, projeto }`; o resultado vem em `estado/:id`, campo `resultado`), `POST /api/capsula/fazer {projeto, senha, incluirCandidatos?}`, `GET /api/capsula/estado/:id`, `GET /api/capsula/baixar/:arquivo`. `projeto` é o id ou o nome do registro, nunca um caminho.
- `sh restaurar.sh [--aplicar] [--destino <pasta>] [--sobrescrever] [--projeto-compose <nome>] [--sem-docker] [--sem-servidor] [--incluir-candidatos] [--nginx-dir <pasta>] [--sem-pastas] [--externos-originais]`. Saídas: 0 ok, 2 uso errado, 3 soma diferente, 4 destino recusado, 5 falta ferramenta (inclui `docker` ausente com parte Docker), 6 sem os segredos (inclui `.env` de fora que já existia diferente e não foi trocado), 7 já existe volume ou contêiner Docker de mesmo nome, 8 falhou um passo do Docker, 9 já existe bloco nginx de mesmo nome, 11 falhou um passo do servidor (nginx -t, reload, certbot, pm2), 12 pasta de fora do projeto já existe com conteúdo diferente, 13 falhou ao recolocar uma pasta de fora do projeto.
- Em código: `fazer(pasta, { senha, saida, livre, docker: { executar }, servidor: { nginxDir, unitDir, pm2, crontab, leitor, mapear, outros }, incluirCandidatos, projetoCompose, progresso })`; `executar(args, { para }) -> { codigo, saida, erro }` (`para` manda a saída para um arquivo).
- Linha de comando (`cc capsula fazer|provar|ensaio`): só a pasta do projeto. NÃO liga o Docker nem o servidor, de propósito.

## 7. Regras e limites

- O que o código do Docker pode chamar: `ps`, `inspect`, `image inspect`, `volume inspect/ls`, `version`, `exec` (só `pg_dump` e `psql`, só em contêiner do projeto), `run` (só `--rm --network none`, volume `:ro` do projeto, entrypoint `tar` ou `du`) e `save` (só imagem do projeto). Nada de stop, restart, rm, kill, pull, load nem compose. O teste varre o código-fonte e recusa esses nomes.
- Servidor, só leitura: o código chama apenas `pm2 jlist` e `crontab -l`. Nunca nginx, certbot, systemctl, pm2 start/stop/restart/delete (o teste varre o código-fonte). Certificado e chave privada nunca são lidos: o leitor padrão lança `PROIBIDO` antes de tocar o disco, e o teste confere que nenhum caminho de letsencrypt, `.key` ou `.pem` foi acessado.
- Servidor, segredos: do PM2 só o NOME das variáveis; em nginx (cabeçalho de autorização, token), unidade (`Environment=`) e cron o valor vira `***`. O arquivo que o bloco aponta (`auth_basic_user_file`) ou a unidade (`EnvironmentFile`) NÃO vai para `servidor/`: se o usuário o lê, entra no `segredos.tar.gpg`; se não, "não coletado, precisa de root".
- Servidor, restaurar: com `--aplicar` E root, instala só os blocos "certo" em `sites-available` com atalho em `sites-enabled`, roda `nginx -t`, e se falhar tenta a variante sem SSL, e se falhar de novo DESFAZ tudo (o que existia antes volta) e sai 11. Só recarrega depois de passar. Reemite o certificado com `certbot --nginx -d ...` só se precisou da variante sem SSL (o DNS precisa apontar). Sem root: não tenta nada, imprime os comandos com sudo. Bloco que já existe é recusado (saída 9) antes de mudar qualquer coisa, a não ser com `--sobrescrever`. PM2 que já existe nunca é trocado. As unidades são instaladas mas NÃO ligadas.
- Pastas de fora do projeto, coletar: só LEITURA de pasta (nenhum comando novo de docker, nginx ou pm2). Nunca entram: sistema (`docker.sock`, `/etc/localtime`, `/etc/timezone`, `/proc`, `/sys`, `/dev`, `/run`), `/etc/letsencrypt` e chave privada (`.key`, `.pem`, `privkey`, `id_rsa`, `.p12`, `.pfx`, `/private/`): ficam FORA do tar mesmo dentro de uma pasta coletada, e o manifesto lista o nome (`excluidos`). O `.env` também fica fora do tar, mas NÃO é descartado: vai para `segredos` (manifesto, `segredos_total`) e é cifrado no `segredos.tar.gpg`; `.env` solto (arquivo montado num contêiner) tem estado `segredo-cifrado`. Pasta ampla demais (`/`, `/var/www`, `/opt`, a casa, ou uma que contém o projeto) não é coletada. Arquivo ilegível vira "não coletado, precisa de root" e a pasta segue sem ele. Pasta de candidato só com `incluirCandidatos`. Pasta dentro de outra já coletada é `coberta`.
- Pastas de fora do projeto, restaurar: sem `--destino`, vão ao caminho original SE o usuário consegue escrever no ancestral mais próximo que existe (`[ -w ]`); senão o script não tenta nada e imprime `sudo mkdir -p <pasta> && sudo tar -xzpf <parte> -C <pasta>`. Com `--destino`, vão para `<destino>/_externo/<caminho original>` (e o `root`/`alias` do nginx copiado é trocado para lá); `--externos-originais` mantém o caminho. O passo "4b" roda ANTES do Docker (os bind mounts precisam delas) e do nginx. Existe e não está vazio: o `diff` decide se já tem tudo o que a cápsula traz (mantida) ou não (recusa tudo, saída 12, antes de restaurar o projeto); sem `diff` na máquina recusa por segurança. Arquivo a mais no destino não conta, porque restaurar não apaga nada. `--sem-docker` pula as montadas, `--sem-servidor` as publicadas, `--sem-pastas` as duas.
- Segredos de fora do projeto, restaurar (passo `4c`, depois do `4b`): precisam da senha (sem ela, ou sem gpg, o script avisa e sai 6). Mesma regra de root das pastas: sem permissão de escrita no ancestral, NADA é tentado e imprime `gpg --decrypt segredos.tar.gpg | tar -xOf - '<membro>' | sudo tee '<caminho>'` mais `sudo chmod 600`, sem o conteúdo. Existe e é igual: mantido. Existe e é diferente: mantido e sai 6, só `--sobrescrever` troca (difere das pastas, que recusam tudo com a saída 12 antes de mudar algo, porque comparar exige a senha). Escreve em arquivo temporário vizinho e renomeia. O modo de origem volta; dono e grupo NÃO (como root, o arquivo fica do root). `--sem-pastas` pula, `--sem-servidor` pula os de pasta publicada e `--sem-docker` os de montagem.
- Senha: nunca em argumento, variável, arquivo ou log (o teste procura a senha em todo o disco da casa falsa, inclusive no log do servidor e na cápsula aberta). Valor de variável de ambiente nunca entra no manifesto, só o nome.
- Restaurar: volume ou contêiner de mesmo nome recusa (saída 7) ANTES de restaurar qualquer coisa. Sem `--projeto-compose`, o nome é `<original>-restaurado`; o nome original só com `--sobrescrever`, que restaura por cima sem apagar.
- Limites do servidor: (i) a ligação por `server_name` citado é só candidato; (ii) porta que só aparece no código (`process.env.PORT || 3001`) não é achada; (iii) PM2 do root e blocos `include` de arquivos fora de `snippets/` não são coletados; (iv) a variante sem SSL é feita linha a linha (diretiva em linha própria); (v) argumentos de PM2 são guardados juntos por espaço, então argumento com espaço quebra; (vi) só vale o `root`/`alias` que aparece no bloco: caminho montado por `$variavel`, `try_files` ou `fastcgi` não é achado; (viii) pasta publicada que o nginx serve por link simbólico vai para o caminho do bloco como pasta comum (o link se perde); (ix) a medição de uma pasta grande é síncrona e lenta a frio (13 a 15 s no `VPS_ahtleta`), por isso ela só roda no processo filho, com teto de 120 s; o `fazer` também roda no filho; (x) `--sobrescrever` em pasta publicada grava por cima sem apagar o que sobrou; (vii) PM2, unidades e cron são instalados para quem roda o script (root), não para o dono original.
- Limites conhecidos: (a) o `provar` reabre e regrava a cápsula toda, por isso o pico de disco é 3x o total; (b) o arquivo do compose (`docker/compose/`) fica em claro, como na pasta do projeto: senha escrita direto nele não é cifrada; (c) `docker save` e o tar do volume gravam em disco antes de empacotar; (d) volume de banco copiado com o banco ligado é cópia "de queda" (consistente só se parado), por isso o `pg_dump` é o que vale; (e) `container_name` ou porta fixos no compose esbarram no original ao restaurar ao lado.
- Cápsula de pasta com arquivos mudando (tar sai com código 1): segue, avisa no manifesto, e a prova diz se a árvore bateu.

## 8. O que a combinação torna possível

Com o registro de projetos, o painel lista todo projeto desta máquina com a última cápsula e a marca "provada" (vermelho se
não). O passo 5 pode tirar a cápsula de todos antes de qualquer limpeza, e quem recebe o arquivo restaura num servidor limpo só
com `sh`, `tar`, `gzip`, `sha256sum`, `docker` e `gpg`.

## 9. O que ainda não existe

- Conferência com o Docker REAL: `ps`/`inspect` de verdade, `pg_dump` em Postgres real (no Supabase o socket local pode exigir senha: nesse caso a coleta do banco falha e fica registrada, e o volume é copiado mesmo assim), `docker load` e `compose up` reais. Também a cifra gpg real.
- A parte de ESCRITA do servidor com root de verdade: `nginx -t`, reload, `certbot --nginx`, `pm2 start`, instalar unidade e cron nunca rodaram fora de binários falsos. Também o PM2 do root não é lido (a sessão não tem root); a descoberta avisa "precisa de root" quando o nginx leva uma porta ao projeto e nenhum processo do usuário a explica.
- Passo 4: enviar uma cápsula e restaurar pelo painel (hoje só baixa).
- Download de cápsula de GBs pelo nginx da frente (limites de tempo e de buffer não foram medidos).
- Cápsula dos projetos de cliente que moram em `/opt` e `/var/www` (fora do registro) e a limpeza (passo 5).
- Coleta REAL de `publicado/` e `montagens/` (só foram medidos `/var/www/ahtleta` e vizinhos, em leitura), com bind mounts reais do Docker, e o `restaurar.sh` escrevendo em `/var/www` como root de verdade.
- Chave privada de dentro de uma pasta publicada/montada fica de fora de propósito e não é cifrada em lugar nenhum: quem restaura precisa repor à mão (a lista está na seção 9 do `RESTAURAR.md`). O `.env` não entra nessa conta desde 03/11: vai cifrado.
- Dono e grupo do `.env` de fora do projeto não são restaurados (só o modo); `.env` de uma pasta que um bloco "candidato" serve só entra se `incluirCandidatos` estiver marcado, como a pasta.
- Montagem dentro de pasta publicada (e o contrário) é guardada duas vezes: a cobertura só vale dentro de cada tipo.

## 10. Receitas curtas

- Ver o que cabe: tela Cápsulas, "Estimar" (ou `node cc.mjs capsula ensaio <pasta>`, que não conta o Docker).
- Fazer com Docker: só pelo botão "Fazer cápsula" da tela, que pede a senha.
- Restaurar ao lado do original: `tar -xzf <cápsula> -C trabalho && cd trabalho && sh restaurar.sh --destino /srv/x --projeto-compose x-novo` (ensaio) e depois com `--aplicar`.
- Ver o que o servidor guardou: tela Cápsulas, "Estimar" (blocos certos e candidatos com o motivo, domínios) e, depois de feita, as seções 2, 7 e 9 do `RESTAURAR.md`.
- Restaurar o servidor num servidor novo: `sudo sh restaurar.sh --aplicar --destino /srv/x` (ou sem sudo, para só imprimir os comandos); para incluir os candidatos, `--incluir-candidatos`.
- Restaurar só a pasta: `sh restaurar.sh --aplicar --destino /srv/x --sem-docker --sem-pastas`.
- Restaurar o site publicado de volta em `/var/www` num servidor novo: `sudo sh restaurar.sh --aplicar --destino /srv/x --externos-originais`.
- Ver as pastas que a cápsula de um site guardaria, sem gravar: tela Cápsulas, "Estimar", ou `ensaioCompleto(pasta, { servidor: { lerPm2: false, crontab: () => ({ ok: false }) } })` de `src/capsula.mjs` (lê o nginx de verdade, só leitura; `servidor.publicado_achado`).

## 11. Como provar que continua funcionando

`node test-capsula.mjs` (250 verificações; o bloco `(y)` é o dos segredos de fora: `.env` de pasta publicada não aparece em claro em parte nenhuma, volta com a senha certa no lugar certo, não volta com a errada nem sem senha, recusa sem senha, sudo só imprime, existente igual/diferente/`--sobrescrever`): o passo 1; o Docker falso (só comandos permitidos, `:ro`, `pg_dump` sem senha na
linha, filtro pelo projeto, prefixo novo na restauração, conflito recusado, soma adulterada, arquivo de root); e o servidor
falso (liga só o que é do projeto, candidato marcado como candidato com o motivo, nenhum valor de variável de ambiente nem
acesso a letsencrypt, restaurador sem root só imprime os comandos, root simulado instala, `nginx -t` que falha desfaz, bloco
existente recusado, `sh -n` e `dash -n`); e as pastas de fora (pasta publicada com root e alias, candidata só com a opção, ilegível = "precisa de root", chave e `.env` dentro da pasta fora do tar, montagem bind coletada e as de sistema, `/etc/letsencrypt` e `/opt` fora, domínio em 3 projetos não vira candidato, prova que acusa soma e tar adulterados, `--destino` sem root, `/var/www` só imprime os comandos com sudo, conflito recusado com saída 12, `--sobrescrever`). `node test-capsula-painel.mjs` (32; inclui `iniciarEnsaio`, o teto de tempo, a vez de cada projeto e a prova de que, durante uma medição lenta de 2,5 s, a lista e `/api/jobs` respondem em menos de 1 s): as cinco rotas pelo servidor de verdade, o
ensaio com os blocos do nginx e as pastas publicadas (certas e candidatas), fazer o site publicado e a opção de incluir candidatos, senha fora do disco, `baixar` recusa `..`, tela sem campo dentro do bloco redesenhado.
Os dois estão no `npm test`. Rode também fora da caixa de proteção para conferir o gpg real. Prova real do passo 3 só de
leitura: `descobrir('<pasta do projeto>', { lerPm2: false })` de `src/capsulaServidor.mjs` contra o `/etc/nginx` verdadeiro.
Prova real completa: o botão da tela, e depois `sudo sh restaurar.sh` num servidor limpo.
