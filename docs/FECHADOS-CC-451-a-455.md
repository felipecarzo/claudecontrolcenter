# CC-451 a CC-455 — os cinco fechados em 10/09, tirados do ROADMAP

Guardados aqui porque a regra do roadmap é "só o que está aberto", e estes
cinco foram concluídos.

⚠️ **Eles nunca chegaram a ser commitados**: viveram só na árvore de trabalho,
escritos por `670e1313` em 09/09 e por `e2b33ef8` em 10/09. O git não tem como
devolvê-los se sumirem daqui, e é por isso que este arquivo existe.

⚠️ **O lugar certo seria `docs/legacy/`, e ela está intocável**: a pasta é de
`nobody:nogroup` nesta VPS, mesma avaria que a `tools/` já tem registrada na
lista dele. Mover para lá quando o dono for consertado.

O relato em linguagem corrente está em [diario/2026-09-10.md](diario/2026-09-10.md).
Este arquivo é o texto cru, para arqueologia.

---

### CC-451 ✅ 10/09: dois painéis rodando no PC ao mesmo tempo

**Fechado, e o sintoma não existe mais.** Medido em 10/09, e a medição não
precisou dele: **o pacote da federação já traz as portas em escuta do PC**, no
campo `servidores`. Eu estava pedindo a ele que rodasse `Get-NetTCPConnection`
no PowerShell, com o dado chegando aqui a cada 30 segundos.

Pacote de 3 segundos de idade, quatro processos de Node em escuta no PC:

| porta | projeto |
|---|---|
| 2789, 2835, 2836, 3001 | ibrics |
| 3000, 9834 | fibraessencia |
| 3020, 5750 | inovallbond |
| **8099** | **(nenhum) — o painel** |

**Um só na faixa 8099-8108**, contra os dois de 09/09. Os outros três são
servidores de desenvolvimento de verdade, com projeto. Ele confirmou pelo lado
dos processos no mesmo dia: um único `node` rodando `cc.mjs` (pid `219960`).

⚠️ **A lição vale mais que o item:** eu tinha isto medível daqui o tempo todo e
pedi a ele. **Antes de pedir medição no PC, pergunte se o pacote já traz.** Ele
traz jobs, servidores, uso, tempo, rotas, backlogs, agentes, travas, framework
e, desde hoje, o estado do serviço.

A causa provável continua registrada, para quando voltar: um painel sobe pelo
serviço automático e outro pelo atalho, e a porta ocupada faz o segundo
escorregar calado para a seguinte. A recusa de subir quando já há um respondendo
na 8099 continua sendo a melhoria certa, e não foi feita.

**O registro original, preservado:**

Ele perguntou: *"consegue entender pq o serviço no desktop nao ta
funcionando?"*. Medido no pacote que o PC empurra, não suposto.

**A primeira leitura estava errada, de novo.** "Não está funcionando" sugeria
PC mudo, e o PC está reportando: o último pacote tinha 4 segundos de idade
quando olhei, com 8 agentes, 38 portas, 15 projetos e as 39 travas, tudo cheio.

**O que a medida mostrou:** entre as portas em escuta no PC há DOIS processos
de Node sem projeto associado, um na **8099** e outro na **8100**. A 8099 é a
porta padrão do painel (`startWeb({ port = 8099, tries = 10 })`); quando ela
está ocupada, o segundo cai na seguinte, calado, porque tentar 10 portas é o
comportamento desenhado. Provavelmente um subiu pelo serviço automático
(`arrancar.ps1`, que sobe painel mais bandeja) e o outro pelo atalho.

**Isto é a assinatura exata do CC-342**, defeito que ELE viu em 25/08: *"o botão
do framework nas sessões do PC fica ativado um tempo e depois some, e depois
volta"*. A causa medida na época foi dois empurradores defasados no PC, um com
código novo e outro com o velho, sobrescrevendo o dado um do outro. O conserto
de então tratou a herança do campo; a **origem** (dois processos subindo) ficou
de pé.

⚠️ **Falta a confirmação dele**: fechar os dois, deixar subir um só, e dizer se
o sintoma some. Sem isso, isto é a hipótese mais provável, não a causa provada.

Conserto a discutir, e o barato vem primeiro: o painel recusar subir quando já
existe um respondendo na 8099 desta mesma máquina, em vez de escorregar pra
porta seguinte sem avisar. As 10 tentativas existem por um motivo real (subir
instância de teste isolada), então a recusa precisa distinguir "o daemon já
está de pé" de "quero uma instância separada de propósito".

### CC-452 ✅ 10/09: ninguém consegue dizer se o serviço está instalado no PC

**Fechado.** O campo `servico` (instalado, rodando, detalhe) viaja no pacote,
recortado campo a campo como todo o resto, e herda por 2 minutos — a mesma
validade curta de `travas`/`framework`, pelo mesmo motivo do CC-342: uma
máquina pode ter mais de um empurrador, e sem prazo curto um serviço
desinstalado continuaria "instalado" para sempre.

`estadoServicoAsync()` nasceu junto, gêmea de `estadoServico()`: a original usa
`execFileSync` e travaria o event loop dentro do ciclo de 30s, junto com o
stream dos agentes.

**Um defeito extra apareceu na prova de ponta a ponta, e não no teste.** Rodando
na VPS de verdade, `estadoServico()` respondia `rodando: false` quando o
`systemctl` nem conseguia conectar no barramento (`Failed to connect to bus`, o
que acontece em sessão sem login gráfico). Afirmação categórica sobre algo que
ela não chegou a medir, e que viajaria para a outra máquina como fato. Hoje o
que separa os dois é o TEXTO da resposta: o systemd responde uma palavra só
(`active`, `inactive`, `failed`…), e qualquer outra coisa é erro dele, não
estado do serviço — vira `null`. É o princípio do CC-340 entrando pela porta
dos fundos, e a lição de sempre: **medir na máquina real acha o que o teste
não acha**.

#### O registro original, de 09/09, quando o item nasceu

Achado junto com o CC-451, e é a razão de a pergunta dele não ter resposta em
tela nenhuma.

`estadoServico()` existe em `src/platform.mjs:908`, sabe responder "instalado?
rodando? onde?", e **nunca é colocado no pacote que viaja entre as máquinas**.
Conferido campo a campo no pacote real do PC: vêm jobs, servidores, uso, tempo,
rotas, backlogs, agentes, travas, framework e limites. Estado de serviço, não.

**É o mesmo buraco que as travas tiveram até 25/08**, e o CC-340 conta a
história: ele perguntou se os ganchos estavam registrados no PC, ninguém tinha
como saber, e a pendência ficou 10 dias sem poder ser confirmada nem fechada.
As travas ganharam travessia naquele dia. O serviço ficou pra trás.

Consequência prática de hoje: com dado chegando, é impossível distinguir daqui
"o serviço está de pé e empurrando" de "o serviço está morto e quem empurra é o
painel que ele abriu à mão". As duas coisas produzem exatamente o mesmo sinal.

Conserto: campo novo no pacote, com recorte próprio na validação de entrada
(o pacote é validado campo a campo de propósito, então campo que não é
declarado é descartado calado). Entra naturalmente no CC-340, que já pede
"um jeito de ligar, desligar e ver a última sincronia".

### CC-453 ✅ 10/09: o cartão de instalar o serviço nunca aparece, por nome de pasta velho

**Fechado, e pelo caminho robusto: a máquina passou a DIZER onde o cockpit dela
está** (`servico.raiz`, no mesmo campo novo do CC-452), em vez de a VPS
adivinhar por texto no caminho de um agente qualquer. O valor sai de
`RAIZ_DO_PAINEL`, que vem do caminho do próprio arquivo — não depende de nome
de pasta, nem de haver agente rodando lá dentro, nem de palpite.

A busca antiga por `proj_controlcenter` **fica como último recurso**, e não é
zelo: máquina rodando versão anterior a hoje não manda o campo, e para essas o
palpite velho ainda é melhor que nada. Some sozinha quando as duas pontas
estiverem em dia.

⚠️ A armadilha registrada aqui foi respeitada, e a sessão dona do arquivo
avisou dela por recado antes de liberar: **trocar o texto por `cockpit` seria o
conserto errado** — quebra de novo no próximo renome, e o PC já tem duas pastas
com essa palavra no nome. Há teste guardando os quatro casos, inclusive o de
pasta renomeada com histórico velho, onde o reportado tem que vencer.

#### O registro original, de 09/09, quando o item nasceu

Terceiro achado do mesmo dia, e é peça construída e inalcançável de novo, o
formato de defeito que este projeto mais repete.

Existe um cartão pronto na tela, **INSTALAR O SERVIÇO EM `<máquina>`**
(`src/ui_novo.html:7962`), com o comando montado, botão de copiar e a explicação
de por que a VPS não instala sozinha lá. Ele só aparece quando a VPS descobre
onde o cockpit mora naquela máquina, e essa descoberta é assim
(`src/federacao.mjs:940`):

```
raizDoCockpit: (p.jobs || []).map(j => j.cwd).find(c => c && /proj_controlcenter/i.test(c)) || null
```

**Procura o texto `proj_controlcenter` no caminho.** Ele renomeou a pasta em
23/08, quando tirou o prefixo de tipo (`proj_`, `app_`, `web_`) e adotou máquina
mais nome. Medido no pacote de hoje: o PC reporta 15 projetos, um deles chamado
**`cockpit`** (e um `cockpit--front`, que parece cópia de trabalho). O texto
velho só sobrevive no histórico de horas, dado antigo de quando a pasta tinha
esse nome. A busca devolve `null`, sempre, e o cartão some sem erro nenhum.

São **duas causas empilhadas**, e a segunda fica escondida atrás da primeira:
nenhum dos 8 agentes do PC roda dentro da pasta do cockpit agora, então mesmo o
nome certo não bastaria hoje. Consertar só o texto daria a impressão de
resolvido enquanto continua vazio.

⚠️ **Trocar `proj_controlcenter` por `cockpit` no regex é o conserto errado**, e
por dois motivos medidos: volta a quebrar no próximo renome, e casaria com
qualquer pasta que tenha "cockpit" no nome (o PC já tem duas). O jeito robusto é
a máquina REPORTAR onde o cockpit dela está, em vez de a VPS adivinhar por texto
no caminho de um agente qualquer. Cabe no mesmo campo novo do CC-452.

### CC-455 ✅ 10/09: o "CLI Project" vazio, resolvido pela pasta apontada por ele

Ele mandou um print do app gráfico do Antigravity no PC dele, com um cartão
**"Open in Remote Control"**: um QR code e um link, sob a frase *"Continue your
work from another device with Remote Control"*. E perguntou se tinha a ver com
o que estávamos fazendo. Tem tudo, e é o mesmo recurso visto do outro lado.

**O que o print prova sobre o desenho do Antigravity.** O botão nasce DENTRO de
um projeto que já existe na interface, e o que ele oferece é continuar AQUELE
trabalho noutro aparelho. O link é `accounts.google.com/AccountChooser?Email=…`,
ou seja, o caminho é garantir que o outro aparelho entre com a MESMA conta, e
só então cair no trabalho de origem. **A ligação é pela conta e pelo projeto de
partida, não pela máquina.**

Isso confirma, por evidência do produto e não por dedução minha, a teoria que
ELE mesmo levantou em 07/09: *"o antigravity obriga que voce crie um projeto ali
na interface e coloque as conversas ali dentro (…) o ligar sessao remota abre
uma nova sessao"*. Eu tinha tratado como hipótese; o print é a prova.

**A peça que falta, achada perguntando ao próprio programa.** O comando aceita
`--project`, que a ajuda descreve como *"Project ID or project name for the
current CLI session"*, e também `--new-project`. **A sessão que o botão abre
hoje não declara projeto nenhum**, e é por isso que o site inventa um genérico e
mostra "CLI Project" vazio: não há o que ele reconheça como projeto de origem.

**O que testei, e o que NÃO consegui ver.** Subi a sessão com
`--project VPS_cockpit` numa tela falsa: ela sobe, fica viva e fica na pasta
certa (três processos, conferidos por `/proc/<pid>/cwd`). O que não consegui:
LER a resposta do comando, porque o arquivo de captura veio com zero byte, então
não sei se ele aceitou o nome, reclamou, ou criou um projeto novo com ele.

---

## 10/09 (noite): as duas dúvidas viraram medida, e a resposta é pior do que se supunha

Autorização dele na hora: *"você consegue fazer essas tarefas então? pode
seguir com todas"*.

**A captura de zero byte tinha saída, e ela era simples:** `--print` (o modo que
imprime e sai) **não precisa de terminal nenhum**, então dá para ler a resposta
sem `script`, sem `ttyd` e sem o problema de captura. Foi o que faltou em 07/09.

**Teste 1, nome que NÃO existe** (`--project "teste-cc455-pode-apagar"`):

```
Backend project ID updated dynamically to: default-cli-project
project: dynamically resolved and registered default project (id=default-cli-project)
project: synced active project to "CLI Project" (id=default-cli-project)
```

Saiu com código **0**, respondeu normalmente, **não criou nada** (a pasta de
projetos ficou idêntica, conferida antes e depois) e **não reclamou uma linha**.

**Teste 2, o espelho, com o nome que existe** (`--project "VPS_cockpit"`):

```
Conversation using project ID: 304d0a08-fc34-4dcd-a1d4-bf3dd49fdc7e
project: synced active project to "VPS_cockpit" (id=304d0a08-…)
```

⚠️ **A resposta à dúvida 2 não era nenhuma das duas que eu tinha escrito.**
`--project` com nome desconhecido **não cria e não falha: ele cai calado no
balde padrão**. Ou seja, um erro de digitação no nome produz EXATAMENTE o
sintoma que este item existe para consertar, sem erro em lugar nenhum, e com o
comando saindo `0` como se tivesse funcionado.

**A dúvida 1 também está respondida, e sem risco:** o nome é o da pasta, e o
projeto `VPS_cockpit` já existe com a pasta amarrada dentro
(`folderUri: file:///home/claudedev/projetos/VPS_cockpit`, ramo `master`). É o
que `abrirAgySessao` já passa. **Nenhum projeto lixo foi criado no teste**, e o
risco que me fez recusar o teste antes (criar coisa na conta dele sem pedir)
simplesmente não existe: o comando não cria.

**E o "CLI Project" está provado vazio no disco**, não por dedução:
`default-cli-project.json` tem `"projectResources": {}` — chaves vazias, nenhuma
pasta. Contra o do projeto de verdade, que carrega o `gitFolder`.

**O que isto abre, e não foi feito:** hoje a queda no balde é invisível. O painel
podia dizer, no cartão, quando a sessão NÃO resolveu o projeto pedido — o dado
está no log, e a diferença entre as duas linhas acima é literal. Sem isso,
continua sendo peça que falha em silêncio, que é o formato de defeito que este
projeto mais repete.

**10/09: o "CLI Project" não é invenção do site, é um ARQUIVO no disco.**
Achado seguindo o rastro de erro do próprio programa, e não por dedução:

```
~/.gemini/config/projects/default-cli-project.json
{ "id": "default-cli-project", "name": "CLI Project" }
```

87 bytes, criado na instalação (17/08 17:48), com **`id` e `name` e mais nada**.
Nenhum campo de pasta, caminho ou raiz. É por isso que ele aparece vazio: não
está vazio por falta de sessão, está vazio porque **este projeto não tem pasta
nenhuma associada, por construção**. Ele é o balde padrão de quem roda o `agy`
sem declarar projeto.

O log confirma o outro lado da mesma moeda, repetido em três execuções
diferentes: `GetProject: failed to read standalone project file: open
~/.gemini/config/projects/outside-of-project.json: no such file or directory`.
O programa procura um projeto chamado `outside-of-project`, não acha, e cai no
padrão.

**Isto derruba o bloqueio nº 1 escrito abaixo.** A lista de projetos NÃO existe
só no navegador: é uma pasta de arquivos JSON, um por projeto, e dá para ler
sem abrir nada. Nesta VPS há exatamente um, o padrão. No PC dele, o mesmo
caminho (`%USERPROFILE%\.gemini\config\projects\`) responde quais nomes existem
lá, que é a informação que faltava para escolher.

#### ⚠️ Ele testou e o nome NÃO pegou. A causa, medida no log do programa

Print dele em 10/09, conectado na VPS (a instância aparece verde no rodapé, ou
seja, a parte de ligar funciona): a lista de projetos tem **só** "CLI Project",
vazio. *"nenhum projeto cockpit"*.

**`--project` não cria projeto, e nem sequer procura pelo nome que eu passei.**
Três medidas, nesta ordem:

1. O registro do programa mostra `SetProjectID called with projectID: ""` a cada
   sessão que sobe: o nome chega VAZIO do outro lado, mesmo com
   `agy --project "cockpit"` conferido em `ps`;
2. criei o arquivo `~/.gemini/config/projects/cockpit.json`, no formato exato do
   que já existia. **A hora de acesso prova que o programa nunca o leu**:
   último acesso 00:37:16, que é o instante em que EU o criei, e a sessão subiu
   às 00:37:27, onze segundos depois, sem tocar nele. Arquivo removido em
   seguida, e o original conferido intacto contra cópia de segurança;
3. e o erro que a outra sessão tinha achado ganhou hora certa:
   `failed to read standalone project file: open …/outside-of-project.json` sai
   às **00:36:03**, que é quando ELE conectou pelo navegador. Não é a sessão
   subindo, é a conexão remota sendo atendida.

**O que isso reposiciona.** `outside-of-project` (nome de exibição "Outside of
Project", confirmado nos textos do programa) é o identificador que o Antigravity
usa quando **a pasta não pertence a projeto nenhum**. Então a ligação que falta
não é sessão para nome, é **pasta para projeto**, e mora numa estrutura de dados
que tem um campo `projectResources` cujo formato não descobri.

#### ✅ RESOLVIDO em 10/09

Perguntado qual caminho seguir, ele escolheu o de ler um arquivo escrito pelo
próprio programa, e relatou o que fez na tela: *"ao inves de criar eu só apontei
pra pasta e apareceu"*.

O arquivo que nasceu deu o formato inteiro, e derrubou DUAS suposições minhas:

```json
{ "id": "304d0a08-fc34-4dcd-a1d4-bf3dd49fdc7e",
  "name": "VPS_cockpit",
  "projectResources": { "resources": [ { "gitFolder": {
      "folderUri": "file:///home/claudedev/projetos/VPS_cockpit",
      "defaultBranch": "master" } } ] },
  "settings": {}, "isWorkspaceOnly": false }
```

1. **O identificador é um UUID, não o nome.** O nome do arquivo é o UUID.
2. **O nome é o da pasta CRU, com o prefixo da máquina:** `VPS_cockpit`, não
   `cockpit`. Eu tinha deduzido o contrário dos projetos do PC dele (`vps`,
   `carzo`) e mandado o nome limpo, e foi exatamente por isso que o teste dele
   falhou. Quem nomeia é o Antigravity a partir da pasta; a conta de nome
   canônico deste projeto não tem nada a ver com isso, e usá-la ali foi erro meu.

**A correção e a prova, lado a lado no log do programa.** Duas rodadas, mesma
máquina, minutos de diferença:

| o que foi passado | o que o programa fez |
|---|---|
| `--project cockpit` (não existe) | `Backend project ID updated dynamically to: cockpit` — usou o texto cru, não resolveu nada |
| `--project VPS_cockpit` (existe) | `Backend project ID updated dynamically to: 304d0a08-fc34-4dcd-a1d4-bf3dd49fdc7e` — **resolveu para o UUID do projeto de verdade** |

A linha seguinte confirma pelo outro lado: `no grants for project "VPS_cockpit"`,
com o nome certo no lugar do genérico. `npm test` sem falha.

⚠️ **O que isto exige de quem usa, e não dá para esconder:** a pasta precisa
existir como projeto no Antigravity ANTES. Não é limitação nossa, é como o
programa funciona: o `--project` resolve para projeto existente e nunca cria.
Enquanto uma pasta não tiver o dela, aquele projeto cai no balde, corretamente.

⚠️ **Sessão órfã ao reiniciar o painel, medido neste teste.** O rastro do
processo vive na memória do painel, então religar o serviço perde o pid antigo e
a sessão anterior fica de pé: apareceram duas ao mesmo tempo, uma com o nome
velho e outra com o novo. Já estava escrito como risco no código; aqui aconteceu
de verdade. Limpei à mão, mas o conserto de raiz (achar sessão órfã pelo próprio
comando, sem depender da memória) continua em aberto.

#### O que foi IMPLEMENTADO em 10/09, e o que ficou provado

O botão passou a declarar o projeto ao abrir a sessão. O nome sai de
`nomeCanonico()`, a conta que este projeto já tinha para isso, e não de uma
regra nova: `VPS_cockpit` vira `cockpit`, `VPS_carzo` vira `carzo`. **A escolha
de tirar o prefixo saiu da tela dele**, não de preferência minha: os projetos na
conta dele chamam-se `vps` e `carzo`, e o segundo print mostra os dois.

Provado ao vivo, contra o painel de verdade rodando como serviço:

| o que | resultado |
|---|---|
| o comando que sobe | `agy --project "cockpit"`, conferido em `ps` |
| a pasta do processo | `/home/claudedev/projetos/VPS_cockpit`, por `/proc/<pid>/cwd` |
| a instância no site | ativa, "Authenticated as …" 1s depois de subir |
| reclamação do comando | nenhuma, com a captura forçada a descarregar (`script -f`) |
| `npm test` | sem falha |

⚠️ **"Não reclamou" não é "funcionou", e a diferença aparece na tela dele.** O
que consigo provar daqui é que o comando aceitou o nome e ficou de pé. Se o
Antigravity criou mesmo um projeto chamado `cockpit` do lado da conta, só o
navegador dele mostra. A pasta local **não** ganhou arquivo novo depois de
subir, o que tem duas leituras possíveis e não sei qual vale: ou o projeto nasce
no servidor e o arquivo local é só cache do padrão, ou o nome foi ignorado e a
sessão caiu no balde de novo.

⚠️ **Por que a instância aparecia "Offline há 2 dias" no print dele:** fui eu.
O teste de 07/09 terminou com um `desligar` para não deixar sessão órfã comendo
memória, e nada religou desde então. O log do serviço mostra o par exato,
`Stopped` em 07/09 15:57 e `Started` em 10/09 00:15. Não é defeito, mas é um
efeito colateral a lembrar: **limpar o ambiente depois de testar deixa o recurso
desligado para ele**, e ele descobre isso abrindo a tela e vendo "Offline".

⚠️ **O que continua a decidir com ele**, e agora com a pergunta melhor posta:

1. **Qual nome usar.** Segue sendo dele, mas deixou de ser adivinhação: basta
   listar a pasta acima no PC para ver os nomes reais. O palpite natural
   continua sendo o nome da pasta de trabalho (`VPS_cockpit`).
2. **Se `--project` deve criar quando não existe**, ou falhar avisando. A ajuda
   do comando separa `--project` ("Project ID or project name for the current
   CLI session") de `--new-project` ("Create a new project for this session"),
   o que sugere fortemente que o primeiro NÃO cria — mas isso é leitura de
   ajuda, não medição, e não confirmei rodando **de propósito**: um teste com
   nome inexistente pode criar projeto de verdade na conta dele, e criar coisa
   na conta dele sem ele pedir é exatamente o tipo de ação que não se faz por
   conta própria. Criar calado repetiria o defeito que estamos consertando: a
   tela diz uma coisa e o outro lado faz outra.

### CC-454 ✅ 10/09: o fibraessencia sumiu do quadro, e não é defeito de código

**Fechado, e o diagnóstico de 09/09 abaixo estava ERRADO.** Medido em 10/09,
com ele autorizando seguir:

O projeto está no quadro **com 13 cartões**, e a verificação que deu o alarme
passa em silêncio (`quadro-guard`, código de saída 0). Não havia trabalho
escondido: havia medição minha errada.

**O erro foi meu, e é instrutivo.** Em 09/09 eu escrevi que o quadro mostrava
zero itens, e conclui que o roadmap daquele projeto estava desatualizado.
**Eu li um campo que não existe:** perguntei por `grupo.itens`, e o grupo montado
tem `projeto`, `raiz`, `cartoes` e `fechadas` — nunca `itens`. Campo inexistente
em JavaScript devolve `undefined`, não erro, e `undefined` pareceu "nenhuma
tarefa". Em cima disso escrevi um item de backlog inteiro, com duas decisões
opostas para ELE tomar, sobre um problema que não existia.

**A causa real do vaivém do nome era outra, e some sozinha:** existiam DUAS
pastas do mesmo projeto nesta máquina (`fibraessencia` e `VPS_fibraessencia`), e
a regra de desempate escolhia ora uma ora outra conforme qual roadmap tinha
sinal mais novo. Hoje só resta `fibraessencia`, e o nome parou de alternar.

⚠️ **A lição, e ela é a regra da casa aplicada contra mim:** *"campo derivado
que não existe é indistinguível de dado vazio na leitura"*. Antes de escrever
item de backlog a partir de uma medição, **confira que o campo medido existe** —
`Object.keys()` custa um segundo. Duas decisões foram pedidas a ele à toa.

O conteúdo do roadmap do fibraessencia realmente tem a Fase 2 marcada `🚧 ATUAL`
com as 6 caixas dela fechadas, e as 9 abertas moram nas Fases 5, 6 e 7. Isso é
higiene do roadmap dele, não defeito do leitor, e **não impede o projeto de
aparecer** — que era a queixa. Fica como observação, não como tarefa.

**O registro original, com o diagnóstico errado preservado:**

Levantado pela verificação que compara o quadro de hoje com o da volta anterior:
`VPS_fibraessencia` aparecia e parou de aparecer. Investiguei antes de tratar
como regressão, porque o aviso diz "ou o roadmap mudou de formato, ou o código
que o lê parou de entender", e nenhuma das duas se confirmou.

**É conteúdo desatualizado no roadmap daquele projeto.** A única fase marcada
como aberta lá é `## Fase 2 — Fundação do Rebuild 🚧 ATUAL`, e a única frente
por baixo dela (`### FB-01 Entregáveis`) tem as 5 caixas todas marcadas `[x]`.
O cabeçalho da fase nunca foi atualizado depois que o checklist fechou, então o
leitor conclui, corretamente, que não sobrou trabalho aberto ali.

**Decisão é dele, e são duas saídas opostas:** marcar a Fase 2 como concluída
(se ela terminou mesmo) ou promover a Fase 3 a atual (se o trabalho seguiu e
ninguém anotou). Não mexi: é arquivo de outro projeto, e adivinhar qual das
duas mudaria o mapa de trabalho dele sem ele saber.