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

## Depois

Nada bloqueando. O que segue é oportunidade, não dívida.

### CC-07 — Abas novas ainda não vistas em uso
`tempo` e `custo` foram construídas e conferidas por captura, mas nunca usadas
de verdade com muitos agentes vivos. Rever depois de alguns dias de uso: pode
ser que `tempo` só faça sentido com dezenas de agentes, e que `custo` peça
recorte por período em vez de acumulado desde sempre.

### CC-04 — Verificar a faixa de silêncio com agente travado de verdade
O tracejado vermelho (agente `working` sem sinal há mais de 10 min) foi escrito
e tem teste de lógica, mas **nunca apareceu numa captura** — não houve agente
travado enquanto o design era feito. Conferir na primeira vez que acontecer.

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
- Categoria é texto livre, sem lista fechada — vocabulário novo nasce sem
  precisar mexer no código.
- `todos` substitui a lista inteira em vez de fazer merge item a item. Evita
  duplicata; o preço é o agente precisar mandar a lista completa.

---

Última atualização: **2026-08-05** — MVP fechado, design em zonas por urgência,
seis abas, e v0.2.0 publicada como pacote npm multiplataforma. Aberto: CC-08
(macOS/Linux sem teste) e CC-09 (repositório privado).
