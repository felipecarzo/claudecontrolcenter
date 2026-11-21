---
name: ajudantes
description: "Divide o trabalho de uma sessão por tipo de tarefa para gastar menos token, em qualquer projeto: o que é decidir fica na sessão principal (modelo forte), o que é executar vai para o ajudante executor e o que é conferir vai para o conferidor (modelo mais barato, contexto limpo). Também cria ajudante novo a partir do catálogo e instala no PC ou na VPS. Use quando o Felipe disser /ajudantes, 'usa os ajudantes', 'delega', 'economiza token', 'sub agente', 'cria um ajudante', ou antes de uma sequência de micro tarefas já decididas."
---

# Ajudantes: decidir aqui, executar e conferir fora

O catálogo dos tipos (`dados/tipos-de-tarefa.json`, no repositório do cockpit) diz, para cada tipo, o modelo, o esforço
e o ajudante. São três tipos:

| tipo | quem faz | modelo/esforço |
|---|---|---|
| Decidir (achar a causa, escolher, planejar, desambiguar) | esta sessão | opus/high |
| Executar (rodar, ajustar até a meta, gerar, exportar) | ajudante `executor` ou uma especialização `executor-<área>` | sonnet/medium |
| Conferir (testar, contar, fotografar, atualizar painel) | ajudante `conferidor` | sonnet/low |

O comando do cockpit: `cc` no PC, `node ~/projetos/VPS_cockpit/cc.mjs` na VPS (chamado de `cc` abaixo).

## Como trabalhar

1. **Classifique cada tarefa antes de fazer:** `cc ajudantes qual "<texto da tarefa>"`. Ele diz o tipo, o modelo, e os
   ajudantes que servem (o genérico e as especializações instaladas).
2. **Decidir:** faça aqui. Nunca delegue decisão, desenho ou escolha de referência.
3. **Executar ou Conferir:** chame o ajudante pela ferramenta de agente (`subagent_type` com o nome dele). Prefira a
   especialização da área quando existir (`executor-blender` para Blender). O pedido ao ajudante leva:
   - o que fazer, já decidido, com os arquivos exatos;
   - a meta medível e o critério de parada;
   - a conferência a rodar, se for o conferidor.
4. **Confira o que voltou** antes de dizer "feito": o ajudante devolve número e caminho do print, e você abre o print.

**Quando NÃO delegar:** checagem de um comando só, ou tarefa cuja saída cabe em poucas linhas. Uma chamada isolada
(`claude -p`) medida em 21/11 carregou de 186 a 206 mil tokens de contexto, e o custo variou de US$ 0,07 a 0,69
conforme o cache. Para ajudante chamado de dentro da sessão o custo não foi medido. Delegue o que geraria saída
grande aqui: log longo, varredura de muitos arquivos, laço de ajuste com várias tentativas.

## Ajudante novo

```
cc ajudantes novo executor-<área> --tipo Executar --faz "<área, em palavras>"
```

O modelo, o esforço e as ferramentas vêm do catálogo, nunca escolhidos à mão. O nome começa por `executor` ou
`conferidor`. O arquivo nasce em `agents/` do repositório do cockpit, que é a fonte; commit e pull levam para a outra
máquina.

## Instalar (PC e VPS)

```
cc ajudantes instalar
```

Copia as skills e os ajudantes do repositório para `~/.claude/`. O painel faz isso sozinho ao subir, nas duas
máquinas. Na VPS, dentro da caixa de proteção, `~/.claude` é somente leitura: o comando diz "falhou" e a instalação
fica para o painel religar, ou para ele rodar o comando no terminal. **Ajudante instalado só aparece na sessão aberta
depois**: a lista é carregada quando a sessão abre.

`cc ajudantes` lista os que existem e marca os instalados.
