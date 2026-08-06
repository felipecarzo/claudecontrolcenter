# ROADMAP

Só o que está **aberto**. Concluído sai daqui e vira linha no diário.

## Agora

### CC-08 — macOS e Linux nunca rodaram
O código existe em `src/platform.mjs` — launchd e systemd de usuário, `lsof`/`ss`
no lugar do PowerShell, `SIGTERM` no lugar do `taskkill`, `.command`/`.desktop`
no lugar do `.lnk`. Nada disso foi executado: a máquina de desenvolvimento é
Windows. O README diz isso na cara.

Quando houver um Mac ou Linux à mão, conferir nesta ordem: `cc` (só leitura,
tem que funcionar de primeira) → `cc open` → `cc daemon install` → aba de
servidores → encerrar um processo de teste.

### CC-09 — Repositório é privado
`npm i -g github:felipecarzo/claudecontrolcenter` só funciona em máquina com
credencial do GitHub configurada. Para instalar em qualquer lugar sem login, o
repositório precisa virar público — e aí vale revisar `docs/diario/`, que cita
nomes de clientes e um domínio de produção.

### CC-10 — Commitar o trabalho de 2026-08-06
Sete arquivos modificados e três novos (`src/notes.mjs`, `src/tempo.mjs`,
`test-ui.mjs`) na árvore de trabalho, tudo funcionando e testado, nada
commitado. É a primeira coisa da próxima sessão.

## Depois

Nada bloqueando. O que segue é oportunidade, não dívida.

### CC-11 — Aba de custo ainda é a antiga
A aba `tempo` foi refeita e passou a calcular custo real por token, lido dos
transcripts, com quebra por tipo e recorte por período. A aba `custo` continua
mostrando só `state.tokens` acumulado desde sempre, sem preço e sem recorte —
ficou atrás da vizinha. Decidir se ela vira a visão financeira (custo por
modelo, por período, por projeto, com a série histórica) ou se some, já que a
aba de tempo passou a responder a mesma pergunta melhor.

### CC-12 — Converter horas em dinheiro
A aba de tempo entrega horas e custo de API em dólar. Falta o passo que o
Felipe pediu pra adiar até ver o custo real: taxa horária configurável (global
e por projeto) pra sair valor de projeto direto da tela. Decisão dele, não
técnica — o código é uma linha depois da taxa definida.

### CC-04 — Verificar o aviso de silêncio com agente travado de verdade
A faixa de atividade saiu da tela em 06/08 (era o CC-07: construída e nunca
usada). O que sobrou do silêncio é a nota `sem sinal há Xm` na linha do agente,
que também nunca apareceu numa captura — não houve agente travado enquanto o
design era feito. Conferir na primeira vez que acontecer.

### CC-05 — Tabela do terminal ainda é a versão antiga
O redesenho por zonas foi só na web. O `tui.mjs` continua agrupando por projeto.
Decidir se vale portar as zonas pro terminal ou se as duas telas podem divergir
de propósito — a do terminal é consultada de relance, a web com calma.

## Depois

### CC-06 — Ideias sem dono
- Avisar quando um agente passa de N minutos sem sinal (hoje só pinta)
- Ordenar por token gasto, pra achar o agente caro
- `sync` em massa nos 14 projetos com `CLAUDE.md`: não foi rodado porque o bloco
  global já cobre todos, e repetir a instrução em 14 arquivos contraria "um fato
  mora em um lugar só". A ferramenta existe se mudar de ideia.

### CC-04 — Ideias sem dono
- Agrupar por rota dentro do projeto, quando um projeto tiver muitos agentes
- Avisar quando um agente passa de N minutos sem sinal (hoje só pinta de amarelo)
- Ordenar por token gasto, pra achar o agente caro

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
- Categoria é texto livre, sem lista fechada — vocabulário novo nasce sem
  precisar mexer no código.
- `todos` substitui a lista inteira em vez de fazer merge item a item. Evita
  duplicata; o preço é o agente precisar mandar a lista completa.

---

Última atualização: **2026-08-06** — bloco de notas com checklist, e três abas
refeitas: to-dos (lista densa, edição inline), agentes (barra de gasto,
ordenação, ações na linha) e tempo (horas por projeto lidas dos transcripts,
com custo real de token). CC-07 fechado — a faixa de atividade saiu da tela.
Aberto: CC-10 (commitar o dia), CC-08 (macOS/Linux sem teste), CC-09
(repositório privado), CC-11 (aba de custo ficou atrás) e CC-12 (taxa horária).
