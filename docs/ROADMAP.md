# ROADMAP

Só o que está **aberto**. Concluído sai daqui e vira linha no diário.

## Esperando decisão do Felipe

### CC-09 — Repositório é privado
`npm i -g github:felipecarzo/claudecontrolcenter` só funciona em máquina com
credencial do GitHub configurada. Para instalar em qualquer lugar sem login, o
repositório precisa virar público.

A varredura de 08/08 não achou e-mail, IP, domínio nem caminho de máquina. O
que existe é **nome de cliente com horas e custo ao lado**: a tabela de
`docs/diario/2026-08-06.md` diz que o inovallbond levou 90h17 e $5,6k de API, e
o mesmo para renanMarchon, fibraessencia e ibrics. Publicar expõe quanto tempo
cada cliente consome. Ou se aceita isso, ou a tabela vira cliente A/B/C antes.

### CC-11 — Aba de custo ainda é a antiga
A aba `tempo` calcula custo real por token, com quebra por tipo, recorte por
período e agora valor em R$. A aba `custo` continua mostrando só `state.tokens`
acumulado desde sempre, sem preço e sem recorte. **Recomendação: apagar.** A
única coisa que ela mostra e a vizinha não é token por agente — e agente não é
a unidade que interessa pra dinheiro; projeto é. Manter as duas obriga a
explicar a diferença toda vez que uma discorda da outra.

## Aberto

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
- Categoria é texto livre, sem lista fechada — vocabulário novo nasce sem
  precisar mexer no código.
- `todos` substitui a lista inteira em vez de fazer merge item a item. Evita
  duplicata; o preço é o agente precisar mandar a lista completa.

---

Última atualização: **2026-08-08** — o trabalho de 06/08 foi commitado (CC-10,
em três commits) e a aba de tempo ganhou valor em R$ (CC-12): taxa por hora
global, sobreposta por projeto, com a coluna de valor sumindo quando a taxa é
zero. Aberto e esperando você: CC-09 (repositório público expõe horas por
cliente) e CC-11 (apagar a aba de custo).
