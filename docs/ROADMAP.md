# ROADMAP

Só o que está **aberto**. Concluído sai daqui e vira linha no diário.

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
- O repositório é público com os nomes de cliente e as horas de cada um no
  diário de 06/08. Decisão do Felipe em 08/08, com o conteúdo na mão.
- O custo em real usa a cotação de hoje, inclusive para trabalho de semanas
  atrás. Converter cada dia pela cotação daquele dia exigiria série histórica
  de câmbio, para mudar um número que é referência de esforço, não fatura.
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

---

Última atualização: **2026-08-08** — dia de fechar backlog. O trabalho de 06/08
foi commitado (CC-10), a aba de tempo ganhou valor em R$ (CC-12), a aba de
custo foi apagada (CC-11) e o repositório virou público (CC-09). O que sobrou
depende de máquina ou de acaso: CC-08, CC-04 e CC-05.
