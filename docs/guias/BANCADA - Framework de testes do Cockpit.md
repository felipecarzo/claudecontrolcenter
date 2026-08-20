Framework de Engenharia de Software IA: Módulo Agent Cockpit
Este documento formaliza a arquitetura, o escopo e as propostas de expansão para o framework de desenvolvimento integrado ao Agent Cockpit. O conceito central adota uma abordagem de orquestração semelhante ao Anaconda (em Python), dividindo a atuação da IA e das travas de segurança do software em dois níveis funcionais e complementares.

1. Arquitetura de Dois Níveis
1.1. Camada de Prevenção (Hooks Determinísticos)
Nível focado em regras imutáveis e bloqueios automáticos, operando sob o princípio central estabelecido no Agent Cockpit: "instrução escrita é sugestão, hook é regra". A camada atua de forma rigorosa, sem depender do consumo de tokens ou da capacidade variável de interpretação do LLM.
Validação de Rotas: Intercepta criações ou alterações de rotas para garantir que sigam o padrão arquitetural do projeto (ex: convenções rígidas do Next.js, Express ou rotas de API).
Integridade de Commits: Implantação de hooks de pré-commit que barram mensagens fora da taxonomia exigida ou envios de código que reprovam no linter ou testes básicos.
Travas de Segurança: Checagens estáticas rodando em background para impedir, na origem, vazamentos de credenciais, chaves de API expostas ou endpoints criados sem validação de autenticação.

1.2. Camada de Desenvolvimento (Assistência Guiada por IA)
Nível focado em alinhamento conceitual, planejamento e tomada de decisão arquitetural. O agente IA atua ativamente no ciclo de ideação junto ao engenheiro humano, antes da escrita massiva de código.
Implementação de Padrões de Mercado: O agente força a definição dos padrões estruturais através da geração guiada de documentação UML (Unified Modeling Language) e MER (Modelo de Entidade Relacionamento).
Desambiguação Precoce: Age para neutralizar o maior gerador de retrabalho mapeado na análise do ciclo: a falha de comunicação sobre substantivos e conceitos do domínio. Os diagramas servem como contrato de entendimento antes do gasto de tokens com a programação em si.

2. O Papel do Agent Cockpit como Orquestrador
O Cockpit assume o papel de painel central de gerenciamento desse ecossistema. Em vez do usuário configurar hooks e arquivos de instrução manualmente para cada repositório novo, o Cockpit distribui, monitora e controla esses níveis dinamicamente. Ele transforma diretrizes voláteis em execuções sistêmicas garantidas, agindo exatamente como um "gerenciador de ambientes" para IA, mantendo o panorama visual atualizado em sua interface.

3. Matriz de Recomendações e Riscos
Camada
Ponto de Atenção (Risco)
Diretriz Técnica / Recomendação
Prevenção
Fricção no ciclo rápido de ideação e testes
Manter o framework equipado com chave liga/desliga global por projeto. Protótipos rápidos (PoC) não devem ser engessados por regras de produção.
Prevenção
Vazamento de contexto e falha de isolamento (CWD)
Garantir que scripts de automação e validação operem em diretórios isolados, comprovando via testes canários que não afetarão o projeto principal acidentalmente (mitigando falhas vistas anteriormente com execução de processos filhos).
Desenvolvimento
Excesso de burocracia e documentação inútil
Orientação pragmática e condicional: a IA deve ser treinada para sugerir modelagem UML/MER apenas ao detectar tarefas complexas ou ambíguas, dispensando essa etapa para edições superficiais ou rotineiras.


4. Propostas de Incremento e Funcionalidades (Pipeline Futuro)
4.1. Detecção de Drift Arquitetural
O Cockpit fará a comparação contínua (em background) entre o código produzido em tempo real e os modelos de referência (MER/UML) fechados na etapa de Desenvolvimento. Se o agente gerar tabelas de banco de dados ou arquivos de domínio que não existam na documentação, o sistema lança um alerta de "Desvio de Arquitetura" na interface web. Isso impede a degradação silenciosa do projeto.

4.2. Presets de Stack ("Ambientes Conda" do Cockpit)
Implementação de uma ferramenta de injeção de perfis, operada por comandos como cc stack apply react-node-clean. A ação instala instantaneamente os linters e pre-commits da linguagem, além de atualizar o arquivo de escopo local (CLAUDE.md) com as regras da arquitetura escolhida. O tempo de setup de infraestrutura de controle cai a zero.

4.3. Wizard "Design-First" com Mermaid.js na Interface
Integração de um fluxo visual em uma das abas do Agent Cockpit web. Antes de autorizar o agente a consumir tokens gerando classes extensas, a IA deve produzir um diagrama Mermaid.js, renderizado ao vivo no painel. O código só é disparado se o usuário aprovar o modelo visual, alinhando com a regra documentada de "não confiar em relatório sem prova visual".

4.4. Painel de Telemetria da Camada de Prevenção
Criação de um módulo no frontend que contabiliza as métricas de bloqueios sistêmicos. Exibirá um score ou gráfico de "Bugs Retidos" informando o número exato de falhas de rotas, quebras de testes parciais e vazamentos de segurança interceptados silenciosamente pelos hooks. Essencial para tangibilizar o ROI (Retorno sobre Investimento) e os tokens salvos pelo framework de controle.



# Frente: Bancada

Framework de teste e auditoria agnóstico, dentro do Control Center.

> Escrito em 14/08/2026. Destino: `proj_controlcenter/docs/produto/BANCADA.md`.
> Nada aqui foi implementado.

---

## Contexto

Hoje cada projeto do Felipe testa do jeito que deu. Alguns têm `vitest`, a
maioria não tem nada, e nenhum tem auditoria de segurança. Quando um site de
cliente sobe pra VPS, ninguém confere se a chave do Supabase vazou pro bundle,
se a tabela está sem RLS, ou se `/admin` responde sem login.

O Control Center já é o lugar onde ele aperta botão para todos os projetos:
sobe servidor, mata processo, lê a VPS, sincroniza rotina. A bancada é a mesma
ideia aplicada a teste: **o cockpit instala o instrumento no projeto, dispara,
mostra o resultado e desinstala**. O projeto não ganha pipeline próprio nem
CI, ganha um instrumento que o cockpit administra.

O resultado esperado: um botão por projeto que responde "este projeto está
quebrado, ou vazando dado, ou não". Sem abrir terminal, sem lembrar de rodar,
sem descobrir na hora que o cliente ligou.

**Decisão do Felipe em 14/08:** a config mora no projeto (versionada e
portátil pra VPS), o cockpit é quem instala/roda/desinstala, e os specs de
navegador são escritos por agente, não por template genérico.

**Decisão adiada, de propósito:** onde exatamente fica o botão de disparo (aba
nova, dentro da aba `remoto`, ou pela sessão `claude --remote-control` do
celular). Não bloqueia nada: o runner e o catálogo são os mesmos nos três
casos, muda só quem chama `POST /api/bancada`.

---

## O buraco de infra que precisa ser tapado primeiro

**O painel não tem job assíncrono.** Levantamento do código:

- `platform.mjs:386` `lancarComando()` usa `stdio:'ignore'`. Sobe e esquece, não vê saída nenhuma.
- `web.mjs:439` `POST /api/enriquecer` segura a request HTTP e tem teto de 60s.
- `web.mjs:521` o SSE é snapshot de estado global a cada 2s, sem canal por job, sem `event:` nomeado.
- Não existe `AbortController`, fila, progresso nem cancelamento cooperativo em `web.mjs`.

Teste demora minutos. Sandyaa demora horas. Nada disso cabe nos padrões atuais.

**O único padrão do repo que já captura saída de processo longo** é
`opencode.mjs:77` `dispararTarefa()`: spawn com file descriptor cru apontando
pra um `.jsonl`, e quem quer saber se acabou observa o arquivo parar de
crescer (`opencode.mjs:197-211`). Funciona no Windows, está em produção, e os
comentários de `opencode.mjs:38-72` explicam por que `detached`/`unref` foram
rejeitados ali. **É esse padrão que a bancada herda.**

### Glossário das duas palavras

**Fire and forget** ("atira e esquece"). Você manda o processo começar e não
olha mais pra ele. `stdio:'ignore'` significa literalmente "jogue fora tudo
que esse processo escrever". Serve pra servidor de desenvolvimento, que fica
no ar pra sempre e não tem "terminou". Não serve pra teste, porque teste tem
resultado, e resultado jogado no lixo não serve de nada.

**Job assíncrono.** Quem pediu não fica esperando parado. Três peças:
(1) o clique responde na hora com um número de protocolo, `{id: "k3x9f"}`;
(2) o processo escreve num arquivo de log enquanto roda;
(3) a tela pergunta de tempos em tempos "como tá o k3x9f?" e o servidor lê o
arquivo. Isso dá progresso, resultado guardado e cancelamento, que é
exatamente o que fire and forget não dá.

---

## Arquitetura

```
src/bancadaCatalogo.mjs   catálogo das camadas, DADO ESTÁTICO
src/bancada.mjs           runner + instalar/desinstalar + manifesto
src/web.mjs               3 rotas novas
src/ui.html               1 aba nova
```

### O catálogo é dado, não código

Segue `hooksCatalogo.mjs`, que já é catálogo estático neste repo. Ferramenta
nova entra como mais um objeto, sem tocar no runner. **É isso que faz o
framework ser agnóstico.**

```js
{
  id: 'dependencia',
  nome: 'Dependência',
  grupo: 'suprimento',
  custo: 'grátis',            // 'grátis' | 'token' | 'tempo'
  duracao: 'segundos',        // usado pra decidir se pede confirmação
  escopo: 'global',           // 'global' = ferramenta na máquina, nada no projeto
                              // 'projeto' = artefato instalado dentro do repo
  aplicaA: (proj) => temLockfile(proj),
  verificar: 'npx cve-lite-cli --version',   // a ferramenta existe aqui?
  comando: (proj) => ['npx', 'cve-lite-cli', proj.dir, '--json'],
  instalar: null,
  desinstalar: null,
  normalizar: (saida) => ({ ok, achados: [{severidade, titulo, onde, comoConsertar}] }),
}
```

`normalizar` é o que faz camadas diferentes caberem na mesma tela. Toda camada
devolve a mesma forma, venha de JSON, SARIF ou texto solto.

### Declaração por projeto

`.cc-bancada.json` na raiz do projeto:

```json
{
  "camadas": ["unit", "dependencia", "segredo", "codigo-estatico", "navegador"],
  "alvo": { "dev": "http://localhost:3000", "producao": "https://cliente.com.br" },
  "instalado": [
    { "arquivo": "playwright.config.ts", "hash": "sha256:...", "em": "2026-08-14" },
    { "arquivo": "tests/bancada/smoke.spec.ts", "hash": "sha256:...", "em": "2026-08-14" }
  ]
}
```

`instalado` é o **manifesto**: o cockpit só apaga no desinstalar o que está
listado ali **e** cujo hash ainda bate. Arquivo mexido à mão vira aviso na
tela, nunca deleção silenciosa.

Projeto sem o arquivo aparece na aba como "não instalado", com botão de
instalar. Nunca é criado sozinho.

### Pasta gerenciada

Tudo que o cockpit escreve dentro de um projeto vive em **`tests/bancada/`**,
exceto os arquivos que a ferramenta exige na raiz por convenção
(`playwright.config.ts`). Desinstalar apaga a pasta inteira e reverte a raiz
pelo manifesto.

Motivo de não inventar pasta própria pra tudo: Playwright fora da convenção
perde o suporte de IDE e o `--ui`, e aí ninguém usa.

### Runner

`src/bancada.mjs`, reusando o que já existe:

| Precisa de | Reusa | Onde |
|---|---|---|
| trava de pasta | `pastaValida()` | `servers.mjs:332` |
| trava de escrita em projeto alheio | padrão de `alvoValido()` | `rotinas.mjs:136` |
| backup antes de sobrescrever/apagar | padrão de `.bak` | `notes.mjs:71` |
| descoberta de projeto | `findProjects()` / `projectsBase()` | `install.mjs:143` / `:26` |
| pasta a partir do nome do projeto | `cwdDoProjeto()` (hoje privada de `web.mjs`) | `web.mjs:55` |
| spawn com captura de saída longa | padrão de `dispararTarefa()` | `opencode.mjs:77` |
| matar processo | `matarProcesso()` (`taskkill /T /F`) | `platform.mjs:336` |
| escrita atômica de estado | `writeConfig()` (tmp + rename) | `config.mjs:38` |

API do módulo:

```
iniciar(projeto, camadas[], { alvo })  →  { id }        responde na hora
estado(id)                             →  { corrida }   lê o log do disco
cancelar(id)                           →  { ok }        taskkill na árvore
instalar(dir, camadaId)                →  { arquivos[] } com backup
desinstalar(dir, camadaId)             →  { apagados[], preservados[] }
```

Estado das corridas em `~/.claude/control-center-bancada.json`. **Nunca em
`~/.claude/jobs/`**, que é contrato exclusivo de `meta.json`. Mesmo lugar que
o CC-30 já reservou pro opencode.

Log de cada corrida em `os.tmpdir()/cc-bancada/<id>.jsonl`, uma linha por
evento (`{camada, fase, texto, em}`). É o arquivo que o `estado()` lê.

**Serial, uma corrida por projeto por vez.** Sem fila, sem paralelismo. Se
duas camadas rodando ao mesmo tempo virar necessidade medida, aí sim.

### Rotas

```
GET  /api/bancada?projeto=      catálogo + estado do projeto + última corrida
POST /api/bancada               { projeto, camadas[], alvo }  → { id }
POST /api/bancada/instalar      { projeto, camada, acao: 'instalar'|'desinstalar' }
POST /api/bancada/cancelar      { id }
```

`web.mjs` é cadeia de `if (url.pathname === ...)` com os helpers `send()`,
`comCorpo()` e `comCorpoAsync()`. Segue o padrão de `/api/remote-control`
(`web.mjs:188`), que já multiplexa por campo `acao` no corpo.

**Nunca no timer do stream.** Mesma regra escrita de `processos.mjs:9` e
`vps.mjs:4`: só sob clique. O SSE continua não sabendo da bancada; a aba faz
polling próprio de `/api/bancada` a cada 2s **só enquanto uma corrida estiver
viva**, e para quando ela acaba.

### Aba

Cinco edições em `ui.html`, o ponto de extensão documentado:

1. `ui.html:1342` — `{ id: 'bancada', label: 'bancada' }` em `TABS`
2. `ui.html:3566` — texto em `RODAPE`
3. `ui.html:3587` — `bancada: () => viewBancada()` no mapa `views`
4. `ui.html:4358` — `if (tab === 'bancada') carregarBancada()` na troca de aba
5. `ui.html:4916` — a mesma linha no boot

**Armadilha:** `render()` reescreve `#main` inteiro a cada evento do stream
(`ui.html:3607`). Um log rolando ali perde a posição de scroll a cada 2s, o
mesmo problema que forçou o caso especial do `escritorio`
(`ui.html:3589-3605`). Duas saídas, escolher na hora:

- redesenho parcial só do `<pre>` do log, copiando `ui.html:3589-3605`
- ou o log fora do `#main`, como as notas (`ui.html:4020`) e o player (`ui.html:3934`)

---

## O catálogo inicial

Quatro camadas foram escolhidas pelo Felipe. As outras entram no catálogo
desligadas, disponíveis sem trabalho novo de código.

### Grupo: suprimento (o que você instalou)

| # | Camada | Ferramenta | Custo | Pega o quê |
|---|---|---|---|---|
| 1 | Dependência ✅MVP | CVE Lite CLI | grátis, seg | CVE conhecido em lockfile, com comando de fix pronto |
| 2 | Pacote malicioso | `npm audit signatures` + Socket | grátis, seg | pacote **malicioso**, não só vulnerável: install script, código ofuscado, acesso de rede novo. Pega ataque de supply chain **antes** de existir CVE |
| 3 | Container e IaC | Trivy | grátis, min | imagem Docker, Dockerfile e config de infra. Ele roda Docker na VPS |

### Grupo: segredo

| # | Camada | Ferramenta | Custo | Pega o quê |
|---|---|---|---|---|
| 4 | Segredo no histórico | Gitleaks | grátis, seg | chave de API, token, senha em **qualquer commit do histórico**, não só no HEAD |
| 5 | Segredo vivo | TruffleHog | grátis, min | dos segredos achados, quais **ainda funcionam**. Faz a chamada de API e confirma. Transforma 200 alarmes em 3 reais |

Prioridade alta e imediata: o repo do Control Center é **público** e o
`control-center.json` guarda host, usuário e caminho da chave da VPS. Rodar
Gitleaks nele é a primeira prova de que a bancada serve pra alguma coisa.

### Grupo: código

| # | Camada | Ferramenta | Custo | Pega o quê |
|---|---|---|---|---|
| 6 | Estático | Semgrep | grátis, min | 2000+ regras OWASP, roda local, não sobe código. Determinístico e repetível |
| 7 | Autônomo ✅MVP | Sandyaa | token do plano Max, min a horas | bug de lógica, data-flow, exploitability, com PoC gerado |

Ordem importa: Semgrep primeiro filtra o óbvio de graça, e o Sandyaa (caro)
roda depois só no que sobrou. Rodar o caro primeiro é queimar token achando o
que o grátis já achava.

### Grupo: aplicação viva (precisa do site no ar)

| # | Camada | Ferramenta | Custo | Pega o quê |
|---|---|---|---|---|
| 8 | Navegador ✅MVP | Playwright | grátis, min | o fluxo funciona de ponta a ponta. Instala ~500MB de browser |
| 9 | Navegador remoto ✅MVP | skill `remote-browser` | grátis, min | o mesmo, contra **produção**, pelo Chrome headless da VPS. Zero instalação local |
| 10 | Exposição | Nuclei | grátis, min | `/.env`, `/.git/config`, `/_next/static/development/_buildManifest.js`, source map em produção, painel admin aberto |
| 11 | Cabeçalho e TLS | testssl.sh + checagem própria | grátis, seg | CSP ausente, HSTS ausente, cookie sem `Secure`/`HttpOnly`/`SameSite`, certificado vencendo |
| 12 | Varredura passiva | OWASP ZAP baseline | grátis, min | crawl do site e baseline passivo, o que o Nuclei por template não pega |

### Grupo: dado (o diferencial, e é código nosso)

**Nenhuma ferramenta de prateleira faz estas três.** São as que atacam
diretamente roubo de dado no stack dele, e cada uma é código curto.

| # | Camada | Custo | Pega o quê |
|---|---|---|---|
| 13 | **Sonda de RLS do Supabase** | grátis, seg | com a `anon key` **pública** do próprio bundle, lista o schema e tenta `SELECT` em **toda** tabela. Qualquer linha que voltar é vazamento aberto pra internet |
| 14 | **Caça à `service_role`** | grátis, seg | varre o bundle publicado (`.next/static/**`) atrás de JWT com `role: service_role` e de qualquer variável sem prefixo `NEXT_PUBLIC_` que vazou pro cliente |
| 15 | **Sonda de zona restrita** | grátis, seg | pega toda rota sob `/admin`, `/dashboard`, `/api/*` e chama **sem sessão**, exigindo 401/403/redirect |

Por que a 13 é a mais importante das quinze: a `anon key` é pública por
projeto, e só é segura porque o RLS deveria barrar. Tabela criada por SQL cru,
por migration ou **por ferramenta de IA nasce sem RLS**. A medição pública de
2026 põe RLS ausente como a vulnerabilidade nº 1 em app gerado por IA, com
incidência perto de 85%. São ~40 linhas contra a REST API do Supabase, e é a
diferença entre "o site tá bonito" e "a base de clientes está aberta".

A 15 é a regra do `CLAUDE.md` dele virada em teste. "Protótipo simula ambiente
real, zona restrita não fica aberta por padrão" deixa de ser texto que alguém
deveria seguir e vira falha vermelha na tela.

A 14 fecha o outro lado do hook que ele já tem: o hook bloqueia **ler** `.env`
no terminal; esta camada confere que o `.env` não vazou pro **navegador**.

### Grupo: LLM (só em projeto que tem)

| # | Camada | Ferramenta | Pega o quê |
|---|---|---|---|
| 16 | Eval de prompt | promptfoo | regressão: o prompt novo não pode quebrar o que funcionava |
| 17 | Ataque ao modelo | promptfoo redteam / Garak | jailbreak, prompt injection, vazamento de dado de treino |

`aplicaA` desliga as duas em projeto sem LLM, que hoje é a maioria. Rodar
Garak num site em Next.js é 40 minutos pra não achar nada.

---

## Playwright: como o agente escreve os specs

Decisão do Felipe: agente escreve por projeto, não template genérico.

O `instalar` da camada 8 faz três coisas:

1. escreve `playwright.config.ts` na raiz (apontando `testDir: 'tests/bancada'`) e o script `test:bancada` no `package.json`
2. cria `tests/bancada/` com um `.gitkeep` e um `LEIA-ME.md` dizendo o que vai ali
3. cria um **to-do no job aberto** via `gravarTodos()`, o mesmo caminho que os
   checkboxes já usam, com o texto: *"escrever os specs de navegador deste
   projeto em `tests/bancada/`, cobrindo os fluxos críticos"*

O painel **não escreve spec sozinho**. Padrão idêntico ao do CC-18, onde o
mapa vazio cria um to-do pedindo o `ROADMAP.md` em vez de escrever o arquivo
na pasta de outro repositório.

> ⚠️ **Assunção a vetar se estiver errada:** o `instalar` inclui **um** spec de
> fumaça de três linhas (a home responde 200, sem erro no console). Não é o
> template genérico que foi descartado. É prova de encanamento: sem nenhum
> spec, o botão "rodar" logo após instalar devolve `0 tests found`, que parece
> defeito. Se preferir zero specs, tira e o botão fica desabilitado até o
> agente escrever.

---

## Ordem de execução

Cada etapa entrega valor sozinha. As quatro camadas marcadas estão todas
dentro, ordenadas pra que a de menor risco prove o encanamento primeiro.

**Etapa 1: o runner e a aba.** Camadas 1 (CVE Lite), 4 (Gitleaks) e a unit do
próprio projeto. As três têm a forma idêntica: spawn de CLI, lê saída, mostra.
Grátis, segundos, zero escrita em projeto alheio. Se o runner assíncrono
estiver errado, aparece aqui, de graça.

**Etapa 2: instalar e desinstalar.** Camada 8 (Playwright) com manifesto, hash
e backup. Prova o caminho de escrita em repositório de terceiro, que é o mais
perigoso do plano.

**Etapa 3: as sondas de dado.** Camadas 13, 14 e 15. Código nosso, curto, e o
maior retorno de segurança de tudo aqui.

**Etapa 4: Sandyaa.** Camada 7. A cara. Precisa de confirmação explícita antes
de disparar, progresso de verdade e cancelamento funcionando, porque queima
token do plano Max e pode rodar por horas.

**Etapa 5: o resto do catálogo.** Camadas 2, 3, 5, 6, 9 a 12, 16 e 17. A
partir da etapa 1 cada uma é um objeto novo no catálogo, sem código de runner.

---

## Verificação

O projeto tem `test.mjs` na raiz, com precedente de teste de trava de caminho
em `test.mjs:997-1008`.

**Testes a acrescentar em `test.mjs`:**

- `alvoValido` da bancada rejeita `../../evil.ts`, caminho absoluto e pasta fora de `findProjects()`
- `desinstalar` **não apaga** arquivo cujo hash divergiu do manifesto, e reporta como preservado
- `desinstalar` apaga o que bate o hash, e o `.bak` existe depois
- `normalizar` de cada camada devolve a mesma forma a partir de um exemplo de saída real gravado como fixture
- `aplicaA` desliga as camadas 16 e 17 num projeto sem LLM
- corrida cancelada deixa o log fechado com `fase: 'cancelado'`, não pendurado

**Verificação de ponta a ponta, contra o próprio Control Center:**

1. subir o painel, abrir a aba `bancada`, escolher `proj_controlcenter`
2. rodar a camada 4 (Gitleaks) sozinha. O repo é público e guarda config de
   VPS: se a bancada não achar nada, ou o repo está limpo mesmo (conferir à
   mão) ou o runner não está lendo a saída
3. rodar a camada 1 (CVE Lite) e conferir que o número bate com
   `npx cve-lite-cli` rodado direto no terminal
4. instalar a camada 8 num projeto de teste, conferir os arquivos e o to-do
   criado, então desinstalar e conferir que a árvore voltou ao estado do `git status`
5. cancelar uma corrida no meio e conferir com o gerenciador de tarefas que
   nenhum processo filho sobrou

**Prova visual obrigatória:** print da aba com um achado real de segurança
antes de qualquer "feito". Teste verde com a tela quebrada já aconteceu neste
setup.

---

## Limites a aceitar por escrito

- **Serial, uma corrida por projeto.** Sem fila. Duas corridas ao mesmo tempo é complexidade que ainda não tem demanda medida.
- **Reiniciar o painel mata a corrida em andamento.** Mesma consequência assumida em `opencode.mjs:70-72`, e pelo mesmo motivo: o spawn não é `detached`, senão a captura de saída no Windows fica vazia.
- **A bancada não conserta nada sozinha.** Mostra o achado e o comando de fix. Aplicar é decisão de quem lê, igual a aba `rotinas` faz hoje.
- **Ferramenta ausente na máquina não é erro da bancada.** A camada aparece cinza com "não instalado" e o comando de instalação ao lado.
- **Camada que precisa do site no ar depende do dev server.** A aba `servidores` já sobe; a bancada só lê o `alvo` do `.cc-bancada.json` e falha limpo se não responder.
- **Nada disso roda em timer, nunca.** Mesma regra de `processos.mjs:9` e `vps.mjs:4`.

---

## Lacuna achada durante o levantamento, vale corrigir junto

`rotinas.mjs` escreve (`:156` `writeFileSync`) e apaga (`:164` `unlinkSync`)
arquivo dentro de projeto de terceiro **sem backup nenhum**. O repo já tem o
padrão certo em `notes.mjs:71-74` (`copyFileSync` pra `.bak` e
`.<data>.apagado` antes de apagar), e ele simplesmente não foi aplicado ali.

A bancada nasce com o backup desde o começo. Estender o mesmo para
`rotinas.mjs` é uma linha, e cobre as 16 cópias que ainda existem nos
projetos.

---

## Fontes da pesquisa de segurança

- [64 Open Source AppSec Tools: 2026 Guide](https://appsecsanta.com/open-source-tools)
- [Replacing Snyk with Open Source: SAST, DAST and SCA in 2026](https://falcao.org/posts/open-source-sast-dast-sca-2026/)
- [Supabase Anon Key: Is It Safe to Expose? RLS and 2026 Keys](https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster)
- [Supabase RLS Security Checklist 2026](https://unicoconnect.com/blogs/supabase-rls-security-checklist)
- [Next.js Security Checklist](https://blog.arcjet.com/next-js-security-checklist/)
- [Best Security Tools for Next.js Developers in 2026](https://zeriflow.com/blog/best-security-tools-nextjs-developers-2026)

### Ferramentas que originaram a frente

- [Sandyaa (SecureLayer7)](https://github.com/securelayer7/sandyaa)
- [CVE Lite CLI (OWASP)](https://github.com/OWASP/cve-lite-cli)
- [promptfoo](https://github.com/promptfoo/promptfoo)
- [Garak (NVIDIA)](https://github.com/NVIDIA/garak)
