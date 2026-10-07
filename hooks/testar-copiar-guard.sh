#!/usr/bin/env bash
# Os casos do copiar-guard (02/10): bloco de código para copiar não leva explicação dentro.
#
# Ele colou três comandos na VPS e a explicação desenhada (│ └─) foi junto, quebrando o comando.
# O que precisa barrar: comando + desenho no MESMO bloco. O que tem que passar: comando sozinho,
# comentário de shell, árvore de pastas (saída, não comando) e resposta sem bloco nenhum.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== copiar-guard =="
B='```'
RUIM="Cole isto na VPS:

${B}
cp ~/a ~/b
│  │   └─ destino
│  └─ origem
└─ cp = copiar
${B}"

BOM="Cole isto na VPS:

${B}
cp ~/a ~/b
${B}

cp = copiar; ~/a é a origem; ~/b é o destino."

COMENTARIO="${B}
# faz a cópia
cp ~/a ~/b
${B}"

ARVORE="A estrutura fica assim:

${B}
projeto/
├── src/
│   └── app.mjs
└── docs/
${B}"

DOIS="${B}
ls -la
${B}

e depois:

${B}
sudo bash ~/instalar.sh
│    │    └─ o instalador
│    └─ bash = programa
└─ sudo = administrador
${B}"

echo "— o que precisa barrar —"
transcrito "$T/1.jsonl" u "me manda o comando" a "$RUIM"
prova "comando com a explicacao desenhada dentro do bloco" copiar-guard 2 "$T/1.jsonl"
FINAL_RUIM=$(node -e 'process.stdout.write(JSON.stringify({ last_assistant_message: process.argv[1] }))' "$RUIM")
transcrito "$T/1b.jsonl" u "me manda o comando" a "ok"
prova "a resposta final (do pedido do gancho) vence o disco" copiar-guard 2 "$T/1b.jsonl" "$FINAL_RUIM"
transcrito "$T/2.jsonl" u "dois comandos" a "$DOIS"
prova "um bom e um ruim na mesma resposta: barra pelo ruim" copiar-guard 2 "$T/2.jsonl"

echo "— o que tem que passar —"
transcrito "$T/3.jsonl" u "me manda o comando" a "$BOM"
prova "comando sozinho no bloco, explicacao fora" copiar-guard 0 "$T/3.jsonl"
transcrito "$T/4.jsonl" u "me manda o comando" a "$COMENTARIO"
prova "comentario de shell cola sem quebrar" copiar-guard 0 "$T/4.jsonl"
transcrito "$T/5.jsonl" u "como e a estrutura?" a "$ARVORE"
prova "arvore de pastas e saida, nao comando" copiar-guard 0 "$T/5.jsonl"
transcrito "$T/6.jsonl" u "oi" a "Feito, sem nenhum bloco de codigo."
prova "resposta sem bloco" copiar-guard 0 "$T/6.jsonl"

echo "— higiene —"
higiene copiar-guard

exit $FALHOU
