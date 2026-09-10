# HANDOFF

**Sessões:** 2026-09-10 · **TRÊS**: `e2b33ef8` (VPS, rota `sincronia`),
`670e1313` (VPS, rota `front`) e a do PC, que trabalhou em paralelo o dia todo.
**Último commit:** `fb2da79`, empurrado · **ÁRVORE LIMPA**
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

✅ **Nada pendente de commit.** O aviso antigo desta seção foi cumprido: são
oito commits em 10/09, todos no servidor, com as duas máquinas no mesmo ponto.

O que aconteceu: [diario/2026-09-10.md](diario/2026-09-10.md). Ponteiro, não
relatório.

## ⚠️ A lição do dia, e ela custou quatro fechamentos errados

**Medir um número plausível que responde OUTRA pergunta é indistinguível de
resposta certa.** Quatro vezes em 10/09, todas minhas:

| a pergunta | o que medi | o que conclui | por que errou |
|---|---|---|---|
| quantos empurram? | portas em escuta | "um só" | o de reporte não abre porta |
| o serviço está instalado? | uma das duas tarefas agendadas | "não" | era a outra |
| ainda são dois? | o contrato alternando | "acabou" | só parou de alternar |
| a lista prova quantos? | a própria lista | "um só" | ela se apagava com quem procurava |

**A defesa é construção, não disciplina.** Lembrar de "medir direito" falhou
quatro vezes seguidas. O que funcionou foi construir a medida que responde a
pergunta LITERAL: a lista de empurradores foi a primeira a responder "quantos?"
com um número de quantos, e desmentiu três conclusões em vinte minutos.

Da sessão do PC, ao fechar: *"sem a terceira leitura eu teria fechado errado de
novo"*.

## ⚠️ Esta sessão fica ABERTA como porta, e não como trabalho

Decisão dele ao encerrar em 10/09: *"deixa ela aberta só como uma porta da
sessão de cockpit no pc caso ele precise puxar algo"*.

`e2b33ef8` continua alcançável por `SendMessage` a partir do PC, com o contexto
limpo. **Não tem trabalho em curso, não tem rota reivindicada, e a `sincronia`
está livre no quadro.** Quem chegar aqui não herda nada: começa do zero e usa
este arquivo.

## Histórico: o que estava pendente e já foi resolvido

```
docs/ROADMAP.md      docs/ROTAS-ATIVAS.md  src/federacao.mjs
src/platform.mjs     src/web.mjs           test-federacao.mjs   test.mjs
?? docs/diario/2026-09-10.md   ?? docs/diario/2026-09-01.md
?? docs/FECHADOS-CC-451-a-455.md
```

⚠️ **`docs/FECHADOS-CC-451-a-455.md` é conteúdo que o git NÃO tem em lugar
nenhum.** Os cinco itens nunca foram commitados: viveram só na árvore, escritos
por `670e1313` em 09/09 e por `e2b33ef8` em 10/09. Ao podá-los do ROADMAP (a
regra do arquivo é "só o que está aberto"), o texto cru foi para esse arquivo.
**Perdê-lo antes do commit perde a análise dos dois lados de vez.**

Sugestão de corte, atualizada em 10/09 pela `front` (`670e1313`): **três**
commits, porque entrou uma terceira frente depois que este bloco foi escrito.

1. `feat(federacao): o estado do servico viaja, e a maquina diz onde o cockpit
   mora` — CC-452 e CC-453 (`src/federacao.mjs`, `src/platform.mjs`,
   `test-federacao.mjs`, e a parte de `test.mjs`/`src/web.mjs` que é da
   `sincronia`)
2. `feat(antigravity): a sessao remota abre no projeto certo` — CC-455, escrito
   pela `front` (o bloco `abrirAgySessao` em `src/web.mjs`, ver abaixo)
3. `docs(session): encerramento 2026-09-10`

⚠️ **`src/web.mjs` tem trabalho de DUAS rotas misturado, e o corte não é por
arquivo.** A `sincronia` acrescentou o estado do serviço no bloco que monta o
pacote (perto da linha 590); a `front` mexeu só em `abrirAgySessao` e no bloco
de comentário acima dele (perto da linha 1025). Não se separam por arquivo, e
tentar isso trava o commit. **Se separar der trabalho, commite os dois juntos**:
é melhor um commit misto do que o trabalho ficar na árvore mais um dia.

⚠️ **`~/cockpit-auth.mjs` NÃO entra em commit nenhum.** É onde mora o botão de
religar, vive só na VPS e está fora deste repositório. Backup automático em
`~/cockpit-auth.mjs.bak-*` antes de cada mudança.

### O que a `front` acrescentou em 10/09 (CC-455), e por que o gate não cobre

**Entregue e provado:** o botão "ligar sessão remota" do Antigravity passou a
abrir a sessão já dentro do projeto certo, em vez de cair num balde genérico
chamado "CLI Project". Uma linha de código muda tudo: `--project <nome da pasta
CRU>` no comando que sobe.

⚠️ **A armadilha aqui é o NOME, e eu errei antes de acertar.** Usei
`nomeCanonico()` para mandar `cockpit` em vez de `VPS_cockpit`, deduzindo dos
projetos que ele tem no PC (`vps`, `carzo`). **Ele testou e não pegou.** Quem
nomeia o projeto é o Antigravity, a partir da pasta, com o prefixo e tudo. A
conta de nome canônico deste projeto não tem nada a ver com isso. Se alguém
"consertar" isso de volta para o nome limpo, o defeito volta e é silencioso.

**A prova, no log do próprio programa** (`~/.gemini/antigravity-cli/log/`):
`--project cockpit` (inexistente) dá `Backend project ID updated dynamically to:
cockpit`, texto cru sem resolver; `--project VPS_cockpit` (existente) dá
`updated dynamically to: 304d0a08-…`, o identificador real. E a conversa criada
grava o projeto certo dentro dela, conferido nos dois casos.

⚠️ **Exige um gesto humano UMA vez por projeto, e não dá para automatizar:** a
pasta precisa existir como projeto no Antigravity antes. Quem cria é ele, pela
interface, apontando a pasta. O comando resolve projeto existente e **nunca
cria**. Enquanto uma pasta não tiver o dela, aquele projeto cai no balde, e isso
é comportamento correto do programa, não defeito nosso.

⚠️ **`npm test` não cobre nada disto, e não tem como cobrir hoje.** A prova
depende de um binário externo autenticado na conta Google dele, e da tela dele.
Toda a verificação foi manual, contra o painel rodando como serviço.

⚠️ **Sessão órfã ao reiniciar o painel, medido de verdade neste dia.** O rastro
do processo vive na memória do painel, então religar o serviço perde o pid
antigo e a sessão anterior fica de pé: apareceram duas ao mesmo tempo, uma com o
nome velho e outra com o novo. Limpei à mão. O conserto de raiz (achar sessão
órfã pelo próprio comando, sem depender da memória) **continua aberto**.

## ⚠️ A armadilha que mordeu hoje, e vai morder de novo

**O sandbox da sessão é isolado da rede e dos processos da máquina.** Diagnóstico
de infra feito de dentro dele MENTE: `ps` só vê os próprios processos, `curl` no
`127.0.0.1` falha, `~/dev.sh status` diz "FORA DO AR" com o roteador no ar.

Quase diagnostiquei o cockpit como caído com ele de pé. **Antes de concluir
qualquer coisa sobre infra desta VPS, saia do sandbox e meça de novo.**

A irmã dela, custando o dobro: `dmesg`, `journalctl -p err` e os logs em
`/var/log` exigem privilégio que esta conta não tem. **Silêncio nesses três não
é ausência de erro**, é ausência de permissão para ver.

## ⚠️ Antes de encostar em código

**1. `git fetch` faz parte do Passo 0.** Já aconteceu duas vezes uma sessão
trabalhar o dia inteiro numa cópia atrasada.

**2. Existe uma cópia INSTALADA, separada desta**, em
`%LOCALAPPDATA%\AgentCockpit` (no PC). É ela que roda e serve o painel dele;
esta pasta é a oficina. Publicar é `cc versao publicar`. **Push não é entrega**,
e publicar também não basta: o processo no ar não recarrega arquivo.

**3. `docs/ALINHAMENTO-2026-08-30.md`** é o canal entre as máquinas, porque o
recado do Routia mora em arquivo que o git ignora e nunca atravessa.

## A frente nova do dia: o botão de religar a VPS

Vive em **`~/cockpit-auth.mjs`** (fora do repo), na rota `/__religar`. Escolha
deliberada de lugar: é a camada que continua de pé quando o painel principal
morre, que é exatamente o caso em que o botão precisa existir.

**Está no ar e provado por ele** (*"funcionou!!!"*), com credencial da Contabo
gravada em `~/.contabo-api.json` (permissão `600`) e registro de auditoria em
`~/logs/religar-vps.log`.

Três travas, todas pedidas por ele, **nenhuma opcional**:

1. senha do painel digitada na hora, mesmo com o celular logado;
2. só age com sinal real de problema (memória < 10%, swap > 70%, ou painel
   principal sem responder), lido direto de `/proc/meminfo`;
3. cooldown de 24h por cima.

⚠️ **Só chama a ação `restart` da API da Contabo.** Reset e reinstall são
endpoints vizinhos, e um nome errado ali reinstala a máquina do zero, com os
sites de cliente dentro.

⚠️ **Limite dito a ele, não escondido:** o botão mora DENTRO da VPS. Sobrevive
à maioria dos problemas, inclusive ao que a derrubou em 02/09. Não sobrevive a
congelamento total. Cobrir isso exige algo hospedado fora, e é outro projeto.

## O que aprendi hoje e não pode se perder

1. **Medir na máquina real acha o que o teste não acha.** `estadoServico()`
   respondia `rodando: false` quando o `systemctl` nem conseguia conectar no
   barramento — afirmação categórica sobre algo não medido, viajando para a
   outra máquina como fato. O teste passava. **Falha ao PERGUNTAR não pode
   virar resposta negativa**; vira `null`.
2. **`disabled` sem CSS de `:disabled` é uma tela que mente.** O botão desligado
   saía com o mesmo azul do que funciona, e ele perguntou *"o que eu faço?"*
   olhando um botão vivo que estava morto.
3. **`autocomplete="current-password"` anula uma trava de segurança.** O
   navegador preenchia sozinho o campo que existia justamente para exigir que
   ele digitasse na hora.
4. **Barra no fim do endereço.** O navegador do celular acrescenta sozinho, e
   comparar `pathname` por igualdade exata devolve um `{"error":"not found"}`
   cru na cara dele, sem pista de que a diferença era um caractere.
5. **A regra do Routia pagou o preço dela.** Pedi `src/web.mjs` por recado, a
   dona estava `waiting`, não respondi por ela: parei e perguntei a ELE. A
   espera custou uma pergunta, e o aviso que veio junto (não trocar o texto do
   regex no CC-453) me poupou o conserto errado.

## ⛔ O que espera ELE, e só ele resolve

**Os três que estavam aqui saíram.** Ele autorizou no fim da sessão (*"você
consegue fazer essas tarefas então? pode seguir com todas"*), e os três se
resolveram por MEDIÇÃO, sem precisar dele. Ver a seção seguinte: em dois deles o
erro era meu.

1. **Ler e aprovar o desenho do coletor** (`docs/produto/COLETOR.md`), pendência
   herdada de 31/08.
2. **As onze pastas de projeto do PC sem o prefixo `PC_`**, pendência herdada.

## Os três da fila, fechados por medição (e dois eram erro meu)

**CC-451, dois painéis no PC — não existe mais.** E eu estava pedindo a ELE uma
medição que já chegava aqui: **o pacote da federação traz as portas em escuta do
PC**, no campo `servidores`. Um único Node na faixa 8099-8108, contra dois em
09/09. ⚠️ **Antes de pedir medição no PC, pergunte se o pacote já traz.**

**CC-454, o fibraessencia — o item nunca deveria ter existido.** O projeto está
no quadro com **13 cartões**, e o guarda passa em silêncio. Em 09/09 eu li
`grupo.itens`, campo que **não existe** (o grupo tem `projeto`, `raiz`,
`cartoes`, `fechadas`), peguei o `undefined` como "zero tarefas" e escrevi um
item de backlog inteiro pedindo DUAS decisões a ele, sobre um problema
inexistente. ⚠️ **Confira que o campo medido existe antes de concluir:
`Object.keys()` custa um segundo.**

**CC-455, as duas dúvidas viraram medida.** A captura de zero byte que travou
07/09 tinha saída simples: `--print` não precisa de terminal, então dá para ler
a resposta sem `script` nem `ttyd`. Testes espelho, com o log como prova:

- nome que **não** existe → cai **calado** em `default-cli-project`, sai com
  código 0, **não cria e não reclama**;
- nome que existe → resolve para o projeto certo, com a pasta amarrada.

⚠️ **A resposta não era nenhuma das duas que eu tinha escrito.** Um erro de
digitação no nome produz exatamente o sintoma que o item conserta, sem erro
nenhum. E o risco que me fez recusar o teste (criar projeto na conta dele) **não
existe**: o comando não cria. Nada foi criado no teste.

**O que isso abre, e não foi feito:** a queda no balde é invisível. O painel
podia avisar quando a sessão não resolveu o projeto pedido — o dado está no log,
e as duas linhas são literalmente diferentes.

## ⛔ O pedido ABERTO dele, parado num ponto exato (10/09, madrugada)

Palavras dele: *"sobre as conversas acumuladas, podemos com cuidado fechar as
que não tão sendo usadas, revisando pra não perdermos nada?"*.

**Nada foi apagado, e nada deve ser sem ele ver a lista.** O "revisando pra não
perdermos nada" é a parte que ainda não consegui entregar.

O estado: **60 conversas, 22 MB**, em
`~/.gemini/antigravity-cli/conversations/`, uma por arquivo, desde 17/08. Cada
clique em "ligar sessão remota" cria uma NOVA, e desligar não apaga nenhuma
(testado: contei, desliguei, contei de novo, e a mais antiga é de 17/08).

**Onde travou:** o conteúdo é binário e comprimido, e não consegui extrair o
assunto de cada conversa para ele revisar. O que dá para oferecer sem abrir o
conteúdo é data, tamanho e número de mensagens, o que separa bem as curtas de
teste (2 a 5 mensagens) das longas de trabalho real (84 a 206).

⚠️ **Existe um índice de títulos e ele está quase vazio.**
`conversation_summaries.db` tem as colunas certas (`title`, `preview`,
`project_id`, `step_count`), mas **um único registro** para as 60 conversas. É
por isso que o assunto não sai daqui. **Ele foi perguntado** entre revisar pelos
números ou abrir a lista no Antigravity e dizer quais podem sair pelo título;
não respondeu ainda.

### ⚠️⚠️ A armadilha mais cara deste dia, e ela quase virou estrago

**`sqlite3 <arquivo-que-não-existe>` CRIA o arquivo, vazio, e sai com código 0.**
Consultei um identificador achando que era nome de arquivo, o comando criou um
`.db` de zero byte na pasta das conversas, e o Antigravity passou a listar uma
conversa fantasma. Movido para `/tmp/claude/arquivo-vazio-que-eu-criei.db`, não
apagado, e a pasta voltou às 60.

**A causa do erro é de leitura, não de dado.** Um inventário meu imprimia um
campo que eu rotulei "primeiro pedido"; o que saía ali era identificador INTERNO
de trajetória, não o nome do arquivo. Fui procurar esses identificadores como
nomes de arquivo, não achei, e **anunciei que cinco conversas grandes tinham
sumido**. Não sumiu nada: o log do programa listava 60 antes e são 60 agora.

⚠️ **Se eu tivesse agido na primeira hipótese e partido para "recuperar", teria
mexido em 60 arquivos de dado real dele por causa de um erro meu de rótulo de
coluna.** É a regra 7 dele (medir antes de agir na hipótese) aplicada a mim
mesmo. Quem for mexer nessa pasta: **conte antes e conte depois**, e nunca trate
identificador vindo de dentro do conteúdo como nome de arquivo.

## O que ficou para outra rota

- **A tela do CC-452/453 não existe ainda.** O dado (serviço instalado/rodando,
  e onde o cockpit mora) já viaja e já chega em `raizDoCockpit`. Falta mostrar
  no cartão de máquina remota — mexe em `src/ui_novo.html`, da rota `front`.
  Sem isso é peça construída e inalcançável, o defeito que este projeto mais
  repete.
- **A sessão do Antigravity não morre com o painel**, e reiniciar o serviço
  perde o rastro dela (fica órfã, ~270 MB). Achar órfã pelo próprio comando, em
  vez de depender da memória do processo, é o conserto de raiz. Rota `front`.
- **O painel podia avisar quando a sessão cai no balde genérico.** As duas
  linhas do log são literalmente diferentes, então dá para distinguir. Hoje a
  queda é invisível, e um erro de digitação no nome do projeto produz
  exatamente o sintoma que o CC-455 conserta, sem erro nenhum.
- **`entreg4` reiniciando sem parar.** Contador em 15.893 no boot anterior, 20
  no atual. Não é memória, é briga de porta com o roteador de teste. Sem risco
  para a VPS, não tratado.
- **A metade de TELA do mapa herdado** e a distinção "varredura falhou" versus
  "não há projeto" em `web.mjs`: trabalho registrado da rota `sincronia`, não
  tratado hoje.

## Arquivos a ler

- `~/cockpit-auth.mjs` — o botão de religar (`/__religar`), **fora do repo**
- `src/federacao.mjs` — campo `servico` em `montarPacote`/`validarPacote`, e
  `raizDoCockpit` preferindo o que a máquina reporta
- `src/platform.mjs` — `estadoServicoAsync()` e `lerEstadoLinux()`
- `src/web.mjs` — onde `servico` é calculado, no ciclo que empurra o pacote
- `docs/produto/COLETOR.md` — o desenho que espera aprovação dele
