#!/usr/bin/env bash
# Os casos do anonimo-prompt (CC-92, 16/08).
#
# Este hook falha FECHADO, ao contrário de todos os outros do repositório: o que
# ele impede não tem desfazer, porque o dado no contexto já foi para a nuvem e o
# transcript guarda em texto puro. Por isso o caso "motor indisponível" também
# está aqui — ele tem que BARRAR, não liberar.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/anonimo-prompt.mjs"
T=$(mktemp -d)
mkdir -p "$T/.framework"

# $1 ligado  $2 anonimizar -> escreve o estado do framework
estado() {
  printf '{"metodo":"mvp-basico","fase":"execucao","ligado":%s,"anonimizar":%s}\n' "$1" "$2" \
    > "$T/.framework/estado.json"
}

# $1 nome  $2 prompt  $3 saída esperada
caso() {
  echo "{\"cwd\":\"$T\",\"prompt\":$(node -p 'JSON.stringify(process.argv[1])' "$2")}" \
    | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$3" ] && echo "  ok     $1" || echo "  FALHOU $1 (saiu $s, esperava $3)"
}

# texto longo o bastante para o hook olhar (o corte é 240 caracteres)
ENCHE="Segue o contrato para analise, preciso que voce olhe as clausulas de rescisao e me diga o que acha do prazo, porque o cliente quer reduzir e eu nao sei se compensa. Tambem quero sua opiniao sobre a multa, que me parece alta demais para o valor."
COM_CPF="$ENCHE O contratante e Joao da Silva, CPF 529.982.247-25."
COM_EMAIL="$ENCHE Qualquer duvida fala com maria.souza@empresa.com.br direto."

echo "— modo ligado: e para barrar —"
estado true true
caso "texto longo com CPF"            "$COM_CPF"    2
caso "texto longo com e-mail"         "$COM_EMAIL"  2
caso "texto longo e limpo passa"      "$ENCHE"      0
caso "frase curta nunca e cobrada"    "olha esse cpf 529.982.247-25" 0

echo "— o modo e opt-in por projeto —"
estado true false
caso "anonimizacao desligada"         "$COM_CPF"    0
estado false true
caso "framework desligado"            "$COM_CPF"    0

echo "— falha FECHADA: sem motor, nao passa —"
estado true true
MOTOR="$HOME/projetos/proj_controlcenter/src/anonimizar.mjs"
mv "$MOTOR" "$MOTOR.guardado" 2>/dev/null && {
  caso "mascarador indisponivel BARRA" "$COM_CPF"   2
  mv "$MOTOR.guardado" "$MOTOR"
} || echo "  pulado sem-motor (nao consegui mover o arquivo)"

echo "— projeto sem framework —"
rm -rf "$T/.framework"
caso "pasta sem framework"            "$COM_CPF"    0

rm -rf "$T"
