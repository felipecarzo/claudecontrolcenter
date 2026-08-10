# ROADMAP

Só o que está **aberto**. Concluído sai daqui e vira linha no diário.

## Aberto

### CC-14 — O tray do Claude Code mostra porcentagem errada
Botão direito no ícone do Claude Code na bandeja → "Plano Max uso" mostra um
percentual que **não bate** com o real. Não é bug deste projeto. Agora dá para
conferir: o painel mostra o número oficial no topo, vindo do `rate_limits` do
statusLine — se o tray discordar dele, o errado é o tray.

### CC-15 — O statusline.log do Felipe está com 284 MB
Achado em 08/08 enquanto se investigava o uso do plano. O `statusline.sh`
(gerado pelo cc-statusline) grava o JSON de entrada inteiro a cada render —
155 mil execuções acumuladas. Não é arquivo deste projeto, mas cresce sem
teto no disco dele. Também vale desligar o trecho de `ccusage`: o binário não
está instalado, então cai num `npx --yes ccusage@latest` que baixa pacote a
cada chamada — é a parte lenta da statusline, e a estimativa dele por custo é
justamente a que dá números errados. O dado oficial já vem no próprio JSON de
entrada, e o painel passou a usar esse.

### CC-08 — macOS e Linux nunca rodaram
O código existe em `src/platform.mjs` — launchd e systemd de usuário, `lsof`/`ss`
no lugar do PowerShell, `SIGTERM` no lugar do `taskkill`, `.command`/`.desktop`
no lugar do `.lnk`. Nada disso foi executado: a máquina de desenvolvimento é
Windows. O README diz isso na cara.

Quando houver um Mac ou Linux à mão, conferir nesta ordem: `cc` (só leitura,
tem que funcionar de primeira) → `cc open` → `cc daemon install` → aba de
servidores → encerrar um processo de teste.

### CC-04 — Verificar o aviso de silêncio com agente travado de verdade
A faixa de atividade saiu da tela em 06/08 (era o CC-07: construída e nunca
usada). O que sobrou do silêncio é a nota `sem sinal há Xm` na linha do agente,
que também nunca apareceu numa captura — não houve agente travado enquanto o
design era feito. Conferir na primeira vez que acontecer.

### CC-05 — Tabela do terminal ainda é a versão antiga
O redesenho por zonas foi só na web. O `tui.mjs` continua agrupando por projeto.
Decidir se vale portar as zonas pro terminal ou se as duas telas podem divergir
de propósito — a do terminal é consultada de relance, a web com calma.

### CC-06 — Ideias sem dono
- Agrupar por rota dentro do projeto, quando um projeto tiver muitos agentes
- Avisar quando um agente passa de N minutos sem sinal (hoje só pinta de amarelo)
- Ordenar por token gasto, pra achar o agente caro
- `sync` em massa nos 14 projetos com `CLAUDE.md`: não foi rodado porque o bloco
  global já cobre todos, e repetir a instrução em 14 arquivos contraria "um fato
  mora em um lugar só". A ferramenta existe se mudar de ideia.

### CC-17 — O "último pedido" no cartão nem sempre é o último
Reclamação do Felipe em 09/08: o cartão mostra um texto que ele não reconhece
como o que pediu por último. A linha mistura duas fontes — `lastPrompt`, lido
do transcript, e `meta.status`, escrito pelo agente — e a precedência escolhe
uma sem dizer qual está mostrando. Decidir: ou rotular a origem, ou mostrar só
o que o agente declarou.

### CC-18 — Projeto sem ROADMAP.md fica sem mapa
O mapa lateral lê `docs/ROADMAP.md`. Dos projetos com agente ativo,
`renanMarchon` não tem — clicar no projeto abre um painel que só explica a
ausência. Ou se aceita isso, ou o painel passa a oferecer criar o arquivo a
partir de um modelo.

### CC-19 — Os agentes ainda não declaram `frente`
O campo entrou no protocolo em 09/08 e vale para todos os projetos pelo bloco
global, mas só passa a aparecer conforme cada agente novo reporta. Conferir em
alguns dias: se a maioria dos cartões continuar sem frente, o problema é o
texto do protocolo — foi exatamente o que aconteceu com os to-dos.

## Limites aceitos hoje

Escritos aqui porque são escolha, não descuido:

- Polling de 2s nas duas telas. Com dezenas de jobs, reler 8 arquivos é mais
  barato que a complexidade de `fs.watch`. Revisar se passar de ~100 jobs.
- A aba de tempo só recalcula cortes a partir de 2 minutos. O cache guarda
  blocos contíguos desse grão; cortes menores exigiriam guardar cada marca de
  tempo (dezenas de milhares por projeto) pra ganhar uma precisão que ninguém
  usa pra cobrar.
- O tempo ativo conta agente rodando sozinho como trabalho, e não conta tempo
  lendo código ou em reunião. É a medida que o transcript permite; melhorar
  exigiria o Felipe marcar ponto, que é pior que o erro.
- A taxa em R$ é uma só por projeto, sem histórico. Reajuste no meio do projeto
  recalcula tudo pela taxa nova. Guardar taxa com data de vigência resolveria,
  e é complexidade que só se paga quando um reajuste acontecer de verdade.
- O repositório é público com os nomes de cliente e as horas de cada um no
  diário de 06/08. Decisão do Felipe em 08/08, com o conteúdo na mão.
- O custo em real usa a cotação de hoje, inclusive para trabalho de semanas
  atrás. Converter cada dia pela cotação daquele dia exigiria série histórica
  de câmbio, para mudar um número que é referência de esforço, não fatura.
- A barra de mídia consulta a cada 4s, fora do stream de 2s dos agentes. Cada
  leitura custa ~0,5s no Windows, e pendurar isso no tique dos agentes atrasaria
  o que o painel tem de mais importante.
- O painel passou a ATUAR na máquina (pausar mídia, mexer em volume de app),
  além de encerrar servidor. Continua não mexendo em agente: criar, matar ou
  pausar job segue fora de escopo.
- A sobra usa a assinatura rateada pelas horas do mês, não o preço de API.
  Filtrar meio mês infla o custo/hora daquele mês: o rateio só enxerga as horas
  dentro do recorte. Guardar o total de horas do mês fora do filtro resolveria,
  ao preço de o número mudar conforme o que está na tela.
- A assinatura é um valor só, sem histórico. Mudança de plano recalcula meses
  antigos pelo valor novo. Mesma decisão da taxa horária: data de vigência só
  se paga quando houver uma mudança real.
- O rateio do tempo entre tarefas da mesma sessão continua por igual, mesmo com
  o `feitoEm` carimbado. Usar os carimbos para dividir por intervalo só vale
  quando houver sessões inteiras marcadas item a item — hoje há uma. Revisar
  quando o hook tiver uma semana de uso.
- O histórico guarda o job, não o transcript. Se o Claude Code apagar o `.jsonl`
  da sessão, as horas daquele job somem mesmo com o job arquivado. Copiar
  transcript seria dobrar 800 MB para ganhar pouco.
- O nível de senioridade é palpite a partir de esforço, não de entendimento do
  problema: uma tarefa difícil resolvida em duas linhas parece fácil. Por isso
  a sugestão é corrigível e a correção vence para sempre. Melhorar de verdade
  exigiria classificar o conteúdo do trabalho, não seus sinais.
- O valor/hora vem de duas páginas de blog raspadas. É referência de freelance
  no Brasil, não pesquisa salarial: pode envelhecer sem aviso, e a tela mostra
  a fonte e a idade justamente por isso.
- Por sessão, a média inclui sessões de recado ("rode o server por favor") ao
  lado de sessões de trabalho longo. Filtrar as curtas mudaria a média para
  cima; deixar é mais honesto, já que recado também consome tempo.
- Os gráficos não têm filtro próprio. Período e corte de ociosidade vêm da aba
  de tempo, e valem para todos os cartões de uma vez. Filtro por cartão seria
  outro estado por gráfico, para uma pergunta que ainda não apareceu.
- Categoria é texto livre, sem lista fechada — vocabulário novo nasce sem
  precisar mexer no código.
- `todos` substitui a lista inteira em vez de fazer merge item a item. Evita
  duplicata; o preço é o agente precisar mandar a lista completa.
- **Mídia e sensores são só Windows.** `midia.ps1` usa SMTC e WASAPI; a GPU usa
  `nvidia-smi`. No macOS o caminho seria `MediaRemote`/AppleScript; no Linux,
  MPRIS via D-Bus. Não é tradução — são três implementações. Fora do Windows a
  barra do player e os módulos simplesmente não aparecem.
- Temperatura de CPU e de memória dependem do LibreHardwareMonitor ABERTO. Sem
  ele o Windows não expõe esses sensores, e o campo some da tela em vez de
  mostrar zero. O código já lê de lá quando existe.
- Ler os sensores deixa um buraco de ~300ms no event loop, por causa do spawn
  de processo no Windows. Era de 2,7s antes do `quietAsync`. Aceitável a cada
  5s; se incomodar, o caminho é amostrar em background e servir só o cache.
- O mapa lê só `##` (grupos) e `###` (frentes) do ROADMAP.md, e conta item de
  lista. Parágrafo solto é explicação, não tarefa — por isso não entra na conta.
- **O painel passou a SUBIR servidor**, e com isso executa comando na máquina.
  A trava é a pasta: só dentro da base de projetos, ou de um caminho que
  contenha uma pasta de `CC_PROJECT_DIRS`. Não há lista fechada de comandos —
  o campo é editável de propósito, porque projeto real sobe de jeito que
  nenhuma lista adivinha. Continua valendo que agente não se cria nem se mata
  pelo painel.
- Servidor duplicado é o MESMO tipo no MESMO projeto, e fica o mais recente.
  `next` e `vite` lado a lado não contam: monorepo sobe os dois de propósito.
  Quem vai morrer aparece na tela antes do clique de confirmação.
- Apelido e explicação de servidor são editados por `prompt()` do navegador,
  não por campo na página. Não é preguiça: `render()` reescreve o `#main` a
  cada evento do stream, e um campo de texto ali perderia o cursor no meio da
  digitação — a mesma razão pela qual as notas moram fora do `#main`.
- "Recentes" nasce da varredura, não de histórico próprio: a primeira vez que
  um servidor com pasta é visto, o par pasta+comando vai pro config. O carimbo
  só se renova a cada hora, senão seriam quatro escritas por minuto.
- A lista de "por pasta" só oferece scripts que sobem algo (`dev`, `start`,
  `serve`, `preview`, `watch`). Projeto que sobe com outro nome de script não
  aparece — o comando é editável antes de subir, e é por ali que se resolve.
- O vínculo agente↔roadmap é pelo TÍTULO da seção, não por ID. Dos 43 roadmaps,
  só 6 têm IDs; numerar todos seria trabalho grande para pouco ganho, e ID
  envelhece quando a lista muda.

---

Última atualização: **2026-08-10** — a aba de servidores virou útil de
verdade, a pedido direto do Felipe (não estava numerada no roadmap). Cada
processo agora diz o que é de fato (`next rodando em inovallbond/apps`, não
"node"), aceita apelido e explicação, agrupa por projeto, marca favorito, fecha
duplicados do mesmo tipo com um clique, abre a pasta em quatro formatos
(explorador/editor/terminal/copiar caminho) e sobe servidor novo por pasta,
favorito ou recente. No caminho, três bugs reais na detecção de projeto
(`.bin` fantasma, drive Windows perdido em barra normal, pasta que era na
verdade um arquivo) — corrigidos com teste, achados só porque a varredura
real do disco foi conferida, não só o `npm test`.

CC-17 (último pedido ambíguo) segue como próxima task — não foi tocada hoje.
Aberto: CC-17, CC-18 (projeto sem roadmap), CC-19 (conferir adesão ao
`frente`), mais CC-04, CC-05, CC-08 e os dois do Felipe (CC-14, CC-15).
