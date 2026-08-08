# HANDOFF

**Sessão:** 2026-08-08 · agente Claude (Opus 5) · máquina ALIENWARE-LIPE
**Branch:** `master` · **árvore limpa** — nada pendente de commit
**Estado:** backlog limpo. Fecharam CC-10, CC-12, CC-11 e CC-09 no mesmo dia.
O que sobrou depende de máquina (CC-08) ou de acaso (CC-04), fora o CC-05.

O que aconteceu: [diario/2026-08-08.md](diario/2026-08-08.md).

## O que mudou e você precisa saber

**O repositório é público.** Os nomes de cliente e as horas de cada um estão no
diário de 06/08, e ficam visíveis. Foi decisão sua com o conteúdo na mão. Todo
diário novo daqui pra frente é escrito sabendo disso.

**A aba de custo não existe mais.** Quem tinha ela guardada no navegador cai em
agentes. A aba de tempo responde o que ela respondia, melhor.

**A taxa em R$ está zerada.** O campo está lá, na barra da aba de tempo (global)
e dentro de cada projeto (só dele). Digitar um número faz a coluna de valor
aparecer.

**O painel passou a falar com a rede, uma vez a cada 12h.** Só pra cotação do
dólar, e só a rota `/api/tempo` dispara. Sem rede, vale o último valor com a
data na tela. O campo `dólar` aceita valor digitado, que congela a busca.

## Depois de mexer no código

O painel de todo dia serve o **pacote instalado**, não este repositório:

```
npm i -g D:\Documentos\Ti\projetos\PESSOAL\proj_controlcenter
node cc.mjs daemon restart
```

Para validar o repositório sem tocar no painel de todo dia:
`node cc.mjs --web-only --port 8123`.

## Armadilhas que vão te pegar de novo

- **Here-string de PowerShell (`@'…'@`) não funciona na ferramenta Bash** — o
  `@` entra na mensagem de commit. Para mensagem longa, `git commit -F arquivo`.
- **`npm run test:ui <id-do-job>`** escreve num job real e no arquivo de notas,
  e restaura os dois no fim — do estado do **começo** da rodada. Não fique
  editando o painel enquanto ele corre.
- O resto está em `CLAUDE.md`, seção Armadilhas.

## Arquivos a ler antes

- `CLAUDE.md` — armadilhas
- `docs/ROADMAP.md` — o que está aberto, e o que espera decisão
- `src/tempo.mjs` — o módulo com a lógica menos óbvia (cache por blocos)

## Regras que não podem quebrar

- `process.platform` só aparece em `src/platform.mjs`
- `~/.claude/jobs` é somente leitura, exceto `meta.json`
- `pins.json` e `state.json` são do Claude Code — nunca escrever
- Depois de editar `src/`, reinicie o servidor: ele não recarrega módulo

## Estado do ROADMAP

| Task | Estado |
|---|---|
| CC-10 commitar o dia 06/08 | concluído — três commits |
| CC-12 taxa horária em R$ | concluído — falta você digitar o número |
| CC-11 apagar a aba de custo | concluído |
| CC-09 repositório público | concluído |
| CC-08 macOS e Linux | aberto — precisa de máquina |
| CC-04 aviso de silêncio nunca visto | aberto — precisa de agente travado |
| CC-05 tabela do terminal ainda agrupa por projeto | aberto |
