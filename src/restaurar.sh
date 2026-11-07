#!/bin/sh
# restaurar.sh: restaura esta cápsula de projeto. sh puro, sem Node e sem IA.
# Uso: sh restaurar.sh [--aplicar] [--destino <pasta>] [--sobrescrever] [--projeto-compose <nome>] [--sem-docker]
#                      [--sem-servidor] [--incluir-candidatos] [--nginx-dir <pasta>] [--sem-pastas] [--externos-originais]
# Sem --aplicar é só um ensaio: confere as somas e mostra o que faria. Não muda nada.
# A parte Docker (imagens, volumes, banco) só roda com --aplicar. --sem-docker restaura só a pasta do projeto.
# Volumes e contêineres nascem sob um projeto Compose NOVO (--projeto-compose; sem ele, "<original>-restaurado").
# Nunca troca volume nem contêiner de mesmo nome: só com --sobrescrever, que também usa o nome original.
# Servidor (nginx, certificado, PM2, unidades de usuário, cron): com --aplicar E como root, instala os blocos do nginx,
# roda nginx -t (se falhar, desfaz tudo) e só então recarrega, reemite o certificado com o certbot, sobe o PM2, instala as
# unidades e o cron. SEM root não tenta nada disso: imprime os comandos com sudo, prontos para colar. Só os blocos "certo"
# entram; os "candidato" só com --incluir-candidatos. Bloco nginx que já existe só é trocado com --sobrescrever.
# --nginx-dir muda a pasta do nginx (padrão /etc/nginx). --sem-servidor pula tudo isso.
# Pastas de fora do projeto (publicado/ do nginx e montagens/ dos contêineres, listadas no pastas.tsv): voltam ao CAMINHO ORIGINAL se
# você consegue escrever nele; senão (por exemplo /var/www e /opt, sem root) NADA é tentado e os comandos com sudo são impressos.
# Com --destino vão para <destino>/_externo/<caminho original> e os blocos do nginx passam a apontar para lá; --externos-originais
# mantém o caminho original mesmo com --destino. Pasta que existe com conteúdo DIFERENTE recusa tudo (saída 12) sem --sobrescrever.
# --sem-pastas pula esta parte (--sem-servidor pula as publicadas e --sem-docker as montadas).
# Segredos de fora do projeto (os .env de dentro dessas pastas, cifrados no segredos.tar.gpg, linhas "segredo" do pastas.tsv): voltam depois
# das pastas, ao mesmo caminho (ou sob <destino>/_externo), com a mesma regra de root; sem permissão de escrita NADA é tentado e o comando com
# sudo é impresso. Arquivo que já existe é mantido (se diferente, só --sobrescrever o troca; sem ele, saída 6). Precisam da senha.
# Saída: 0 ok | 2 uso errado | 3 soma diferente ou parte faltando | 4 destino recusado
#        5 falta ferramenta ou falhou ao extrair | 6 restaurou, mas SEM os segredos
#        7 recusado: já existe volume ou contêiner Docker de mesmo nome | 8 falhou um passo do Docker
#        9 recusado: já existe bloco nginx de mesmo nome | 11 falhou um passo do servidor (nginx -t, certbot, pm2)
#        12 recusado: pasta de fora do projeto já existe com conteúdo diferente | 13 falhou ao recolocar uma pasta de fora do projeto
set -u

AQUI=$(cd "$(dirname "$0")" && pwd) || exit 5
MANI="$AQUI/manifesto.json"
APLICAR=0
SOBRE=0
SEM_DOCKER=0
SEM_SERVIDOR=0
SEM_PASTAS=0
EXT_ORIG=0
INCL=0
NGINX_DIR=""
DEST=""
PROJ_NOVO=""
T=""
NT=""
limpar() { [ -n "$T" ] && rm -rf "$T"; [ -n "$NT" ] && rm -rf "$NT"; return 0; }
trap limpar EXIT
TAB=$(printf '\t')
NL='
'
while [ $# -gt 0 ]; do
  case "$1" in
    --aplicar) APLICAR=1 ;;
    --sobrescrever) SOBRE=1 ;;
    --sem-docker) SEM_DOCKER=1 ;;
    --sem-servidor) SEM_SERVIDOR=1 ;;
    --incluir-candidatos) INCL=1 ;;
    --sem-pastas) SEM_PASTAS=1 ;;
    --externos-originais) EXT_ORIG=1 ;;
    --nginx-dir)
      shift
      [ $# -gt 0 ] || { echo "falta a pasta depois de --nginx-dir" >&2; exit 2; }
      NGINX_DIR="$1" ;;
    --destino)
      shift
      [ $# -gt 0 ] || { echo "falta a pasta depois de --destino" >&2; exit 2; }
      DEST="$1" ;;
    --projeto-compose)
      shift
      [ $# -gt 0 ] || { echo "falta o nome depois de --projeto-compose" >&2; exit 2; }
      PROJ_NOVO="$1" ;;
    -h|--ajuda) sed -n '2,29p' "$0"; exit 0 ;;
    *) echo "opção desconhecida: $1 (veja: sh restaurar.sh --ajuda)" >&2; exit 2 ;;
  esac
  shift
done

case "$PROJ_NOVO" in
  *[!a-z0-9_-]*) echo "--projeto-compose só aceita letras minúsculas, números, - e _" >&2; exit 2 ;;
esac

[ -f "$MANI" ] || { echo "não achei o manifesto.json ao lado do restaurar.sh" >&2; exit 3; }
for F in tar gzip; do
  command -v "$F" >/dev/null 2>&1 || { echo "falta a ferramenta: $F" >&2; exit 5; }
done

soma_de() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1
  else return 1; fi
}
campo() { sed -n "s/^ *\"$1\": *\"\(.*\)\",\{0,1\}\$/\1/p" "$MANI" | head -n 1; }
numero() { sed -n "s/^ *\"$1\": *\([0-9][0-9]*\).*\$/\1/p" "$MANI" | head -n 1; }

echo "== 1. conferindo as somas sha256"
# o bloco "sha256" do manifesto: uma parte por linha, "caminho": "soma"
LISTA=$(sed -n '/^  "sha256": {/,/^  }/p' "$MANI" | sed -n 's/^ *"\([^"]*\)": *"\([0-9a-f]\{64\}\)".*$/\1 \2/p')
echo "$LISTA" | grep -q '^projeto.tar.gz ' || { echo "o manifesto não traz a soma de projeto.tar.gz" >&2; exit 3; }
TEM_SEG=0
echo "$LISTA" | grep -q '^segredos.tar.gpg ' && TEM_SEG=1
while read -r P ESP; do
  [ -n "$P" ] || continue
  case "$P" in
    *..*|/*) echo "parte com caminho suspeito no manifesto: $P. Parei." >&2; exit 3 ;;
  esac
  [ -f "$AQUI/$P" ] || { echo "FALTA a parte $P" >&2; exit 3; }
  REAL=$(soma_de "$AQUI/$P") || { echo "falta sha256sum (ou shasum)" >&2; exit 5; }
  if [ "$REAL" = "$ESP" ]; then
    echo "   ok  $P"
  else
    echo "SOMA DIFERENTE em $P (esperada $ESP, achada $REAL). A cápsula foi alterada ou corrompida. Parei." >&2
    exit 3
  fi
done <<EOF
$LISTA
EOF

echo "== 2. destino"
if [ -z "$DEST" ]; then DEST=$(campo caminho_origem); ORIGEM=1; else ORIGEM=0; fi
[ -n "$DEST" ] || { echo "não sei o destino: use --destino <pasta>" >&2; exit 2; }
case "$DEST" in
  *\\*) echo "o caminho de origem tem barra invertida; use --destino <pasta>" >&2; exit 2 ;;
esac
[ "$ORIGEM" -eq 1 ] && echo "   destino padrão (pasta de origem): $DEST" || echo "   destino: $DEST"
if [ -e "$DEST" ] && [ ! -d "$DEST" ]; then
  echo "RECUSADO: $DEST existe e não é uma pasta." >&2
  exit 4
fi
VAZIO=1
if [ -d "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
  VAZIO=0
  if [ "$SOBRE" -ne 1 ]; then
    echo "RECUSADO: $DEST já existe e não está vazio. Use --sobrescrever (troca os arquivos de mesmo nome, não apaga os outros) ou outro --destino." >&2
    exit 4
  fi
  echo "   $DEST existe e não está vazio: segue por cima (--sobrescrever)"
elif [ -d "$DEST" ]; then
  echo "   $DEST existe e está vazio"
else
  echo "   $DEST não existe: será criado"
fi

# ---- a parte Docker: lê o plano (docker/plano.tsv, campos separados por tab, "-" quando vazio)
PLANO="$AQUI/docker/plano.tsv"
DOCK=0
[ -f "$PLANO" ] && [ "$SEM_DOCKER" -ne 1 ] && DOCK=1
ORIG=""; WORKDIR="."; COMPOSES=""; IMAGENS=""; VOLUMES=""; BANCOS=""
if [ "$DOCK" -eq 1 ]; then
  while IFS="$TAB" read -r K A B C D; do
    case "$K" in
      projeto) ORIG="$A" ;;
      workdir) WORKDIR="$A" ;;
      arqcompose) COMPOSES="$COMPOSES$A$TAB$B$NL" ;;
      imagem) IMAGENS="$IMAGENS$A$TAB$B$NL" ;;
      volume) VOLUMES="$VOLUMES$A$TAB$B$TAB$C$NL" ;;
      banco) BANCOS="$BANCOS$A$TAB$B$TAB$C$TAB$D$NL" ;;
    esac
  done < "$PLANO"
  if [ -z "$PROJ_NOVO" ]; then
    if [ "$SOBRE" -eq 1 ] && [ -n "$ORIG" ]; then PROJ_NOVO="$ORIG"; else PROJ_NOVO="${ORIG:-projeto}-restaurado"; fi
  fi
fi

# ---- a parte servidor: lê servidor/plano.tsv (campos separados por tab, "-" quando vazio)
EH_ROOT=0
[ "$(id -u 2>/dev/null)" = "0" ] && EH_ROOT=1
ND="${NGINX_DIR:-/etc/nginx}"
ORIG_PATH=$(campo caminho_origem)
SPLANO="$AQUI/servidor/plano.tsv"
SERV=0
[ -f "$SPLANO" ] && [ "$SEM_SERVIDOR" -ne 1 ] && SERV=1
NGX=""; SNIPS=""; SEGEXT=""; PM2S=""; UNIDS=""; USR_ORIG=""; NG_ORIG="/etc/nginx"
if [ "$SERV" -eq 1 ]; then
  while IFS="$TAB" read -r K A B C D E; do
    case "$K" in
      nginx) NGX="$NGX$A$TAB$B$TAB$C$TAB$D$TAB$E$NL" ;;
      nginxdir) NG_ORIG="$A" ;;
      snippet) SNIPS="$SNIPS$A$NL" ;;
      segredo) SEGEXT="$SEGEXT$A$TAB$B$NL" ;;
      pm2) PM2S="$PM2S$A$TAB$B$TAB$C$TAB$D$TAB$E$NL" ;;
      unidade) UNIDS="$UNIDS$A$NL" ;;
      usuario) USR_ORIG="$A" ;;
    esac
  done < "$SPLANO"
fi

# só o bloco "certo" entra; "candidato" só com --incluir-candidatos
quer() { [ "$1" = "certo" ] || [ "$INCL" -eq 1 ]; }
# troca o caminho de ORIGEM pelo de destino (root/alias do nginx, caminhos de unidade e de cron). SEDSCRIPT guarda um "s|a|b|g" por linha:
# o do projeto e o de cada pasta de fora do projeto que mudou de lugar. ponytail: sem borda de palavra, "/var/www/a" também pega "/var/www/ab".
SEDSCRIPT=""
SEDPRINT=""
add_troca() {
  case "$1$2" in *"|"*|*"&"*|*"\\"*|"") return 0 ;; esac
  [ "$1" != "$2" ] || return 0
  SEDSCRIPT="${SEDSCRIPT}s|$1|$2|g$NL"
  SEDPRINT="$SEDPRINT -e 's|$1|$2|g'"
  return 0
}
troca_origem() {
  if [ -n "$SEDSCRIPT" ]; then sed "$SEDSCRIPT"; else cat; fi
}
sedcopia() { troca_origem < "$1" > "$2"; }
remap() {
  if [ -n "$ORIG_PATH" ]; then
    case "$1" in
      "$ORIG_PATH"|"$ORIG_PATH"/*) printf '%s' "$DEST${1#"$ORIG_PATH"}"; return 0 ;;
    esac
  fi
  printf '%s' "$1"
}
# o segredo que o nginx aponta (htpasswd) volta para o mesmo lugar dentro da pasta do nginx
remap_nginx() {
  case "$1" in
    "$NG_ORIG"/*) printf '%s' "$ND${1#"$NG_ORIG"}" ;;
    *) printf '%s' "$1" ;;
  esac
}

# ---- as pastas de fora do projeto: lê pastas.tsv (tipo, certeza, d|f, parte, bytes, caminho original; separados por tab)
PLANOP="$AQUI/pastas.tsv"
PAST=0
[ -f "$PLANOP" ] && [ "$SEM_PASTAS" -ne 1 ] && PAST=1
PASTAS=""
[ "$PAST" -eq 1 ] && PASTAS=$(cat "$PLANOP")
# com --destino as pastas de fora vão para <destino>/_externo/<caminho original>; sem ele (ou com --externos-originais), ao caminho original
if [ "$ORIGEM" -eq 1 ] || [ "$EXT_ORIG" -eq 1 ]; then DEST_EXT=""; else DEST_EXT="${DEST%/}/_externo"; fi
alvo_de() { printf '%s%s' "$DEST_EXT" "$1"; }
# dá para escrever aí? o ancestral mais próximo que existe precisa aceitar escrita (é o que separa /var/www e /opt de uma pasta sua)
escrevivel() {
  EV="$1"
  while [ ! -e "$EV" ] && [ "$EV" != "/" ] && [ -n "$EV" ]; do EV=$(dirname "$EV"); done
  [ -w "$EV" ]
}
# o que está no destino já tem TUDO o que a cápsula traz? Arquivo a mais no destino não conta (restaurar não apaga nada); arquivo que falta ou
# difere conta. Precisa do diff; sem ele, vale como "diferente" e recusa.
ja_igual() {  # $1 = d|f, $2 = parte, $3 = alvo
  command -v diff >/dev/null 2>&1 || return 1
  JX=$(mktemp -d) || return 1
  JR=1
  if tar -xzpf "$AQUI/$2" -C "$JX" 2>/dev/null; then
    if [ "$1" = "f" ]; then
      diff -q "$JX/${3##*/}" "$3" >/dev/null 2>&1 && JR=0
    else
      diff -rq "$JX" "$3" > "$JX.dif" 2>/dev/null
      if [ $? -le 1 ]; then
        JR=0
        while IFS= read -r JL; do
          [ -n "$JL" ] || continue
          case "$JL" in "Only in $3"*) ;; *) JR=1; break ;; esac
        done < "$JX.dif"
      fi
      rm -f "$JX.dif"
    fi
  fi
  rm -rf "$JX"
  return "$JR"
}
# dois arquivos com o mesmo conteúdo? sem cmp nem diff na máquina vale como "diferente" (o lado seguro: nada é trocado)
igual_arq() {
  if command -v cmp >/dev/null 2>&1; then cmp -s "$1" "$2"
  elif command -v diff >/dev/null 2>&1; then diff -q "$1" "$2" >/dev/null 2>&1
  else return 1; fi
}
restaura_pasta() {  # $1 = d|f, $2 = parte, $3 = alvo
  if [ "$1" = "f" ]; then
    mkdir -p "$(dirname "$3")" && tar -xzpf "$AQUI/$2" -C "$(dirname "$3")"
  else
    mkdir -p "$3" && tar -xzpf "$AQUI/$2" -C "$3"
  fi
}
# a decisão de cada pasta: FAZ (grava), SUDO (só imprime), IGUAL (já é igual), CONFLITO (existe com outro conteúdo)
PASTAS_ACOES=""
PASTAS_CONFLITOS=""
SEGPAST=""
if [ "$PAST" -eq 1 ]; then
  while IFS="$TAB" read -r PT PC PK PP PB PCAM; do
    [ -n "$PT" ] || continue
    case "$PT" in
      publicado) [ "$SEM_SERVIDOR" -eq 1 ] && continue ;;
      montagem) [ "$SEM_DOCKER" -eq 1 ] && continue ;;
      segredo)  # a segunda coluna diz de onde veio (publicado ou montagem)
        case "$PC" in
          publicado) [ "$SEM_SERVIDOR" -eq 1 ] && continue ;;
          montagem) [ "$SEM_DOCKER" -eq 1 ] && continue ;;
        esac ;;
    esac
    case "$PP" in *..*|/*) echo "parte com caminho suspeito no pastas.tsv: $PP. Parei." >&2; exit 3 ;; esac
    case "$PCAM" in
      /*) ;;
      *) echo "caminho que não é absoluto no pastas.tsv: $PCAM. Parei." >&2; exit 3 ;;
    esac
    case "$PCAM" in */../*|*/..) echo "caminho suspeito no pastas.tsv: $PCAM. Parei." >&2; exit 3 ;; esac
    PALVO=$(alvo_de "$PCAM")
    if [ "$PT" = "segredo" ]; then SEGPAST="$SEGPAST$PP$TAB$PB$TAB$PALVO$TAB$PCAM$NL"; continue; fi
    EXISTE=0
    if [ "$PK" = "f" ]; then
      [ -e "$PALVO" ] && EXISTE=1
    elif [ -d "$PALVO" ] && [ -n "$(ls -A "$PALVO" 2>/dev/null)" ]; then
      EXISTE=1
    fi
    if [ "$EXISTE" -eq 1 ] && [ "$SOBRE" -ne 1 ]; then
      if [ "$APLICAR" -eq 1 ] && ja_igual "$PK" "$PP" "$PALVO"; then ST=IGUAL; else ST=CONFLITO; PASTAS_CONFLITOS="$PASTAS_CONFLITOS $PALVO"; fi
    elif [ "$EH_ROOT" -eq 1 ] || escrevivel "$PALVO"; then
      ST=FAZ
    else
      ST=SUDO
    fi
    PASTAS_ACOES="$PASTAS_ACOES$ST$TAB$PK$TAB$PP$TAB$PB$TAB$PT$TAB$PALVO$TAB$PCAM$NL"
    add_troca "$PCAM" "$PALVO"
  done <<EOF
$PASTAS
EOF
fi
[ -n "$ORIG_PATH" ] && add_troca "$ORIG_PATH" "$DEST"

NGX_CONFLITOS=""
if [ "$SERV" -eq 1 ]; then
  while IFS="$TAB" read -r NOME CERT ARQ SEMSSL DOMS; do
    [ -n "$NOME" ] || continue
    quer "$CERT" || continue
    for DD in sites-available sites-enabled; do
      if [ -e "$ND/$DD/$NOME" ] || [ -L "$ND/$DD/$NOME" ]; then NGX_CONFLITOS="$NGX_CONFLITOS $DD/$NOME"; fi
    done
  done <<EOF
$NGX
EOF
fi

# nome do volume no projeto novo: troca o prefixo "<original>_" por "<novo>_"; volume sem esse prefixo (externo) mantém o nome
nome_novo_vol() {
  case "$1" in
    "${ORIG}"_*) printf '%s_%s' "$PROJ_NOVO" "${1#"${ORIG}"_}" ;;
    *) printf '%s' "$1" ;;
  esac
}

CONFLITOS=""
TEM_DOCKER_BIN=0
command -v docker >/dev/null 2>&1 && TEM_DOCKER_BIN=1
if [ "$DOCK" -eq 1 ] && [ "$TEM_DOCKER_BIN" -eq 1 ]; then
  # só leitura: nada é criado nem trocado aqui
  while IFS="$TAB" read -r VN ARQ IMG; do
    [ -n "$VN" ] || continue
    NV=$(nome_novo_vol "$VN")
    docker volume inspect "$NV" >/dev/null 2>&1 && CONFLITOS="$CONFLITOS volume:$NV"
  done <<EOF
$VOLUMES
EOF
  if [ -n "$(docker ps -a -q --filter "label=com.docker.compose.project=$PROJ_NOVO" 2>/dev/null)" ]; then
    CONFLITOS="$CONFLITOS contêineres-do-projeto-compose:$PROJ_NOVO"
  fi
fi

if [ "$APLICAR" -ne 1 ]; then
  echo "== ENSAIO: nada foi criado nem alterado."
  echo "   restauraria o projeto em $DEST (esperado: $(numero entradas) entradas)"
  [ "$TEM_SEG" -eq 1 ] && echo "   pediria a senha para abrir os segredos (sem senha, restauraria sem eles)"
  if [ "$DOCK" -eq 1 ]; then
    echo "   Docker: o projeto Compose original ($ORIG) voltaria como \"$PROJ_NOVO\""
    printf '%s' "$IMAGENS" | while IFS="$TAB" read -r ARQ REF; do [ -n "$ARQ" ] && echo "     carregaria a imagem $REF ($ARQ)"; done
    printf '%s' "$VOLUMES" | while IFS="$TAB" read -r VN ARQ IMG; do [ -n "$VN" ] && echo "     criaria o volume $(nome_novo_vol "$VN") com o conteúdo de $ARQ"; done
    printf '%s' "$COMPOSES" | while IFS="$TAB" read -r REL COPIA; do [ -n "$REL" ] && echo "     subiria o compose $COPIA em $DEST/$WORKDIR com o nome \"$PROJ_NOVO\""; done
    printf '%s' "$BANCOS" | while IFS="$TAB" read -r SERV USR DB ARQ; do [ -n "$SERV" ] && echo "     restauraria o banco $DB (serviço $SERV, usuário $USR) com pg_restore de $ARQ"; done
    [ "$TEM_DOCKER_BIN" -eq 1 ] || echo "     (o comando docker não está instalado aqui: --aplicar vai recusar)"
    [ -n "$CONFLITOS" ] && [ "$SOBRE" -ne 1 ] && echo "     RECUSARIA, já existe:$CONFLITOS (use outro --projeto-compose, ou --sobrescrever)"
  elif [ -f "$PLANO" ]; then
    echo "   Docker: a cápsula tem a parte Docker, mas --sem-docker foi dado: não seria restaurada"
  fi
  if [ "$SERV" -eq 1 ]; then
    echo "   Servidor (nginx em $ND):"
    printf '%s' "$NGX" | while IFS="$TAB" read -r NOME CERT ARQ SEMSSL DOMS; do
      [ -n "$NOME" ] || continue
      if quer "$CERT"; then echo "     instalaria o bloco $NOME ($CERT) em $ND/sites-available/$NOME"; else echo "     NAO instalaria $NOME (candidato; use --incluir-candidatos)"; fi
    done
    printf '%s' "$PM2S" | while IFS="$TAB" read -r NOME SC CW IT AR; do [ -n "$NOME" ] && echo "     subiria o processo PM2 $NOME ($SC)"; done
    printf '%s' "$UNIDS" | while read -r U; do [ -n "$U" ] && echo "     instalaria a unidade de usuário $U"; done
    [ -f "$AQUI/servidor/cron.txt" ] && echo "     acrescentaria $(wc -l < "$AQUI/servidor/cron.txt" | tr -d ' ') linha(s) de cron"
    [ -n "$NGX_CONFLITOS" ] && [ "$SOBRE" -ne 1 ] && echo "     RECUSARIA (como root), já existe:$NGX_CONFLITOS (use --sobrescrever)"
    if [ "$EH_ROOT" -eq 1 ]; then
      echo "     como root: instalaria, testaria com nginx -t (e desfaria tudo se falhar), recarregaria e reemitiria o certificado com o certbot"
    else
      echo "     sem root: não tentaria nada disso; imprimiria os comandos com sudo, prontos para colar"
    fi
  elif [ -f "$SPLANO" ]; then
    echo "   Servidor: a cápsula tem a parte servidor, mas --sem-servidor foi dado: não seria restaurada"
  fi
  if [ "$PAST" -eq 1 ] && [ -n "$PASTAS_ACOES" ]; then
    echo "   Pastas de fora do projeto (publicadas pelo nginx e montadas pelos contêineres):"
    printf '%s' "$PASTAS_ACOES" | while IFS="$TAB" read -r ST PK PP PB PT PALVO PCAM; do
      [ -n "$ST" ] || continue
      case "$ST" in
        FAZ) echo "     recolocaria ($PT, $((PB / 1024)) KB) $PCAM em $PALVO" ;;
        SUDO) echo "     $PCAM ($PT, $((PB / 1024)) KB) vai para $PALVO, que fica fora de casa: sem root imprimiria os comandos com sudo" ;;
        CONFLITO) echo "     RECUSARIA $PALVO: já existe e não está vazio (--aplicar recusa se o conteúdo for diferente; use --sobrescrever)" ;;
      esac
    done
  elif [ -f "$PLANOP" ] && [ -z "$SEGPAST" ]; then
    echo "   Pastas de fora do projeto: a cápsula as tem, mas --sem-pastas (ou --sem-docker/--sem-servidor) as pulou: não seriam restauradas"
  fi
  if [ -n "$SEGPAST" ]; then
    echo "   Segredos de fora do projeto (cifrados no segredos.tar.gpg; pediria a senha, e sem ela eles não voltam):"
    printf '%s' "$SEGPAST" | while IFS="$TAB" read -r PP PB PALVO PCAM; do
      [ -n "$PP" ] || continue
      if [ -e "$PALVO" ] && [ "$SOBRE" -ne 1 ]; then echo "     $PALVO já existe: manteria (só --sobrescrever o troca; diferente do da cápsula, sairia com 6)"
      elif [ "$EH_ROOT" -eq 1 ] || escrevivel "$(dirname "$PALVO")"; then echo "     recolocaria o segredo $PCAM em $PALVO"
      else echo "     $PALVO fica fora de casa: sem root imprimiria o comando com sudo"; fi
    done
  fi
  echo "   para executar: sh restaurar.sh --aplicar"
  exit 0
fi

if [ "$DOCK" -eq 1 ]; then
  if [ "$TEM_DOCKER_BIN" -ne 1 ]; then
    echo "esta cápsula tem parte Docker e o comando docker não está instalado (ou o seu usuário não o alcança). Instale/ajuste, ou use --sem-docker para restaurar só a pasta do projeto." >&2
    exit 5
  fi
  if [ -n "$CONFLITOS" ] && [ "$SOBRE" -ne 1 ]; then
    echo "RECUSADO: já existe no Docker:$CONFLITOS. Nada foi restaurado. Use outro --projeto-compose, ou --sobrescrever (restaura por cima, sem apagar)." >&2
    exit 7
  fi
fi

if [ "$SERV" -eq 1 ] && [ "$EH_ROOT" -eq 1 ] && [ -n "$NGX_CONFLITOS" ] && [ "$SOBRE" -ne 1 ]; then
  echo "RECUSADO: já existe no nginx:$NGX_CONFLITOS. Nada foi restaurado. Use --sobrescrever (guarda o antigo e desfaz se o nginx -t falhar), ou --sem-servidor." >&2
  exit 9
fi

if [ "$PAST" -eq 1 ] && [ -n "$PASTAS_CONFLITOS" ] && [ "$SOBRE" -ne 1 ]; then
  echo "RECUSADO: já existe, com conteúdo diferente do da cápsula:$PASTAS_CONFLITOS. Nada foi restaurado. Confira, ou use --sobrescrever (grava por cima, sem apagar), ou --sem-pastas." >&2
  exit 12
fi

echo "== 3. restaurando o projeto"
mkdir -p "$DEST" || exit 5
tar -xzpf "$AQUI/projeto.tar.gz" -C "$DEST" --strip-components=1 || { echo "falhou ao extrair projeto.tar.gz" >&2; exit 5; }
N=$(find "$DEST" ! -path "$DEST" | wc -l)
N=$((N + 0))
echo "   $N entradas em $DEST (esperado: $(numero entradas))"

SEG=nao
FALTA=""
if [ "$TEM_SEG" -eq 1 ]; then
  echo "== 4. segredos"
  SENHA=""
  if [ -t 0 ]; then
    printf 'Senha dos segredos (Enter vazio pula): ' >&2
    stty -echo 2>/dev/null
    IFS= read -r SENHA
    stty echo 2>/dev/null
    echo >&2
  else
    IFS= read -r SENHA || true
  fi
  if [ -z "$SENHA" ]; then
    echo "   sem senha: o projeto voltou SEM os segredos."
    FALTA="$FALTA segredos(sem senha)"
  elif ! command -v gpg >/dev/null 2>&1; then
    echo "   gpg não está instalado: o projeto voltou SEM os segredos."
    FALTA="$FALTA segredos(sem gpg)"
  else
    T=$(mktemp -d) || exit 5
    if printf '%s\n' "$SENHA" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 -o "$T/seg.tar" --decrypt "$AQUI/segredos.tar.gpg" >/dev/null 2>"$T/gpg.err" \
       && tar -xpf "$T/seg.tar" -C "$DEST" --exclude=_servidor --exclude=_externo; then
      SEG=sim
      # os arquivos de segredo do servidor (htpasswd, EnvironmentFile) ficam à parte, para a etapa do servidor
      # os segredos de fora do projeto (_externo) ficam à parte, para a etapa 4c
      mkdir -p "$T/ext" && { tar -xpf "$T/seg.tar" -C "$T/ext" _servidor 2>/dev/null; tar -xpf "$T/seg.tar" -C "$T/ext" _externo 2>/dev/null; true; }
      echo "   segredos restaurados:"
      tar -tf "$T/seg.tar" | grep -v '^_servidor' | grep -v '^_externo' | sed 's/^/     /'
    else
      echo "   senha errada ou segredos ilegíveis: o projeto voltou SEM os segredos."
      FALTA="$FALTA segredos(senha errada)"
    fi
  fi
else
  echo "== 4. segredos: esta cápsula não tem"
fi

PAST_N=0
PAST_SUDO=0
PAST_FALHOU=""
if [ "$PAST" -eq 1 ] && [ -n "$PASTAS_ACOES" ]; then
  echo "== 4b. pastas de fora do projeto (antes do Docker e do nginx, que dependem delas)"
  while IFS="$TAB" read -r ST PK PP PB PT PALVO PCAM; do
    [ -n "$ST" ] || continue
    case "$ST" in
      IGUAL) echo "   $PALVO já está igual ao da cápsula: mantida" ;;
      FAZ)
        echo "   recolocando $PCAM em $PALVO"
        if restaura_pasta "$PK" "$PP" "$PALVO"; then PAST_N=$((PAST_N + 1)); else PAST_FALHOU="$PAST_FALHOU $PALVO"; echo "   FALHOU ao recolocar $PALVO" >&2; fi ;;
      SUDO)
        PAST_SUDO=$((PAST_SUDO + 1))
        if [ "$PK" = "f" ]; then PD=$(dirname "$PALVO"); else PD="$PALVO"; fi
        echo "   $PALVO fica fora de casa e você não é root: NADA foi tentado. Cole (sudo):"
        echo "   sudo mkdir -p '$PD' && sudo tar -xzpf '$AQUI/$PP' -C '$PD'" ;;
      CONFLITO) echo "   $PALVO já existe e não está vazio: mantida (use --sobrescrever)" ;;
    esac
  done <<EOF
$PASTAS_ACOES
EOF
elif [ -f "$PLANOP" ] && [ -z "$SEGPAST" ]; then
  echo "== 4b. pastas de fora do projeto: puladas"
fi

# 4c. os .env de dentro dessas pastas, vindos do segredos.tar.gpg (já aberto no passo 4). Nunca são impressos.
SEG_FORA_N=0
SEG_FORA_SUDO=0
if [ -n "$SEGPAST" ]; then
  echo "== 4c. segredos de fora do projeto"
  if [ "$SEG" != "sim" ]; then
    echo "   sem a senha (ou sem o gpg) os segredos de fora do projeto NÃO voltaram:"
    printf '%s' "$SEGPAST" | while IFS="$TAB" read -r PP PB PALVO PCAM; do [ -n "$PP" ] && echo "     $PALVO"; done
    FALTA="$FALTA segredos-de-fora(sem senha)"
  else
    while IFS="$TAB" read -r PP PB PALVO PCAM; do
      [ -n "$PP" ] || continue
      SRC="$T/ext/$PP"
      if [ ! -f "$SRC" ]; then echo "   segredo $PCAM não veio no segredos.tar.gpg" >&2; FALTA="$FALTA segredo-de-fora(ausente:$PCAM)"; continue; fi
      if [ -e "$PALVO" ] && [ "$SOBRE" -ne 1 ]; then
        if igual_arq "$SRC" "$PALVO"; then echo "   segredo $PALVO já está igual ao da cápsula: mantido"
        else echo "   segredo $PALVO já existe e é DIFERENTE do da cápsula: mantido (use --sobrescrever para trocar)"; FALTA="$FALTA segredo-de-fora(diferente:$PALVO)"; fi
        continue
      fi
      if [ "$EH_ROOT" -eq 1 ] || escrevivel "$(dirname "$PALVO")"; then
        if mkdir -p "$(dirname "$PALVO")" && cp -p "$SRC" "$PALVO.cap-novo" && mv -f "$PALVO.cap-novo" "$PALVO"; then
          SEG_FORA_N=$((SEG_FORA_N + 1)); echo "   segredo recolocado em $PALVO"
        else
          rm -f "$PALVO.cap-novo"; echo "   FALHOU ao recolocar o segredo $PALVO" >&2; PAST_FALHOU="$PAST_FALHOU $PALVO"
        fi
      else
        SEG_FORA_SUDO=$((SEG_FORA_SUDO + 1))
        echo "   $PALVO fica fora de casa e você não é root: NADA foi tentado. O conteúdo não é impresso; cole (o gpg pede a senha, o sudo pede a sua):"
        echo "   gpg --decrypt '$AQUI/segredos.tar.gpg' | tar -xOf - '$PP' | sudo tee '$PALVO' >/dev/null && sudo chmod 600 '$PALVO'"
      fi
    done <<EOF
$SEGPAST
EOF
  fi
fi

FALHOU_DOCKER=""
if [ "$DOCK" -eq 1 ]; then
  echo "== 5. Docker (projeto Compose novo: $PROJ_NOVO)"
  WD="$DEST"
  [ "$WORKDIR" != "." ] && WD="$DEST/$WORKDIR"

  while IFS="$TAB" read -r ARQ REF; do
    [ -n "$ARQ" ] || continue
    echo "   carregando a imagem $REF"
    docker load -i "$AQUI/$ARQ" >/dev/null || FALHOU_DOCKER="$FALHOU_DOCKER imagem:$REF"
  done <<EOF
$IMAGENS
EOF

  while IFS="$TAB" read -r VN ARQ IMG; do
    [ -n "$VN" ] || continue
    NV=$(nome_novo_vol "$VN")
    if ! docker volume inspect "$NV" >/dev/null 2>&1; then
      docker volume create "$NV" >/dev/null || { FALHOU_DOCKER="$FALHOU_DOCKER volume:$NV"; continue; }
    fi
    echo "   volume $NV recebe $ARQ"
    docker run --rm -i --network none -v "$NV:/v" --entrypoint tar "$IMG" xzf - -C /v < "$AQUI/$ARQ" || FALHOU_DOCKER="$FALHOU_DOCKER volume:$NV"
  done <<EOF
$VOLUMES
EOF

  set --
  while IFS="$TAB" read -r REL COPIA; do
    [ -n "$REL" ] || continue
    # o arquivo que acabou de voltar para a pasta do projeto vence a cópia guardada na cápsula
    if [ "$REL" != "-" ] && [ -f "$DEST/$REL" ]; then set -- "$@" -f "$DEST/$REL"; else set -- "$@" -f "$AQUI/$COPIA"; fi
  done <<EOF
$COMPOSES
EOF
  if [ $# -gt 0 ]; then
    echo "   subindo o compose como \"$PROJ_NOVO\""
    docker compose -p "$PROJ_NOVO" --project-directory "$WD" "$@" up -d || FALHOU_DOCKER="$FALHOU_DOCKER compose:$PROJ_NOVO"
  fi

  while IFS="$TAB" read -r SERV USR DB ARQ; do
    [ -n "$SERV" ] || continue
    CID=$(docker ps -q --filter "label=com.docker.compose.project=$PROJ_NOVO" --filter "label=com.docker.compose.service=$SERV" | head -n 1)
    if [ -z "$CID" ]; then
      echo "   banco $DB: o serviço $SERV não está de pé, não deu para restaurar"
      FALHOU_DOCKER="$FALHOU_DOCKER banco:$DB"
      continue
    fi
    I=0
    until docker exec "$CID" pg_isready -U "$USR" >/dev/null 2>&1; do
      I=$((I + 1))
      [ "$I" -gt 60 ] && break
      sleep 2
    done
    docker exec "$CID" createdb -U "$USR" "$DB" >/dev/null 2>&1 || true
    echo "   banco $DB: pg_restore em $SERV"
    docker exec -i "$CID" pg_restore --clean --if-exists --no-owner -U "$USR" -d "$DB" < "$AQUI/$ARQ"
    RC=$?
    [ "$RC" -eq 0 ] || echo "   ATENCAO: pg_restore do banco $DB saiu com código $RC (avisos de objeto que não existia são comuns; confira o que apareceu acima)"
  done <<EOF
$BANCOS
EOF
elif [ -f "$PLANO" ]; then
  echo "== 5. Docker: pulado (--sem-docker)"
fi

# ---- servidor
SERV_FALHOU=""
if [ "$SERV" -eq 1 ]; then
  echo "== 6. servidor"
  if [ "$EH_ROOT" -ne 1 ]; then
    echo "   Você não é root: NADA do servidor foi tentado. Cole os comandos abaixo (sudo onde precisa):"
    printf '%s' "$NGX" | while IFS="$TAB" read -r NOME CERT ARQ SEMSSL DOMS; do
      [ -n "$NOME" ] || continue
      if ! quer "$CERT"; then echo "   # candidato, NÃO incluído (revise; para incluir rode de novo com --incluir-candidatos): $NOME"; continue; fi
      if [ -n "$SEDSCRIPT" ]; then
        echo "   sed$SEDPRINT '$AQUI/servidor/nginx/$ARQ' | sudo tee '$ND/sites-available/$NOME' >/dev/null"
      else
        echo "   sudo cp '$AQUI/servidor/nginx/$ARQ' '$ND/sites-available/$NOME'"
      fi
      echo "   sudo ln -s '$ND/sites-available/$NOME' '$ND/sites-enabled/$NOME'"
      [ "$SEMSSL" != "-" ] && echo "   # se o nginx -t reclamar do certificado (servidor novo), use a versão só-HTTP: sudo cp '$AQUI/servidor/nginx/$SEMSSL' '$ND/sites-available/$NOME'"
    done
    printf '%s' "$SNIPS" | while read -r S; do [ -n "$S" ] && echo "   sudo cp -n '$AQUI/servidor/nginx/$S' '$ND/$S'   # só se ainda não existir"; done
    printf '%s' "$SEGEXT" | while IFS="$TAB" read -r MEMBRO CAM; do
      [ -n "$MEMBRO" ] && echo "   # segredo: abra o segredos.tar.gpg (gpg --decrypt) e copie $MEMBRO para $(remap_nginx "$CAM") com sudo (modo 640)"
    done
    echo "   sudo nginx -t && sudo nginx -s reload"
    printf '%s' "$NGX" | while IFS="$TAB" read -r NOME CERT ARQ SEMSSL DOMS; do
      [ -n "$NOME" ] || continue
      quer "$CERT" || continue
      if [ "$DOMS" != "-" ]; then
        CB=""; for D in $DOMS; do CB="$CB -d $D"; done
        echo "   sudo certbot --nginx$CB   # o DNS destes domínios precisa apontar para ESTE servidor antes"
      fi
    done
    printf '%s' "$PM2S" | while IFS="$TAB" read -r NOME SC CW IT AR; do
      [ -n "$NOME" ] || continue
      LI=""; [ "$IT" != "-" ] && LI=" --interpreter '$IT'"
      LA=""; [ "$AR" != "-" ] && LA=" -- $AR"
      echo "   pm2 start '$(remap "$SC")' --name '$NOME' --cwd '$(remap "$CW")'$LI$LA"
    done
    [ -n "$PM2S" ] && echo "   pm2 save"
    if [ -n "$UNIDS" ]; then
      echo "   mkdir -p ~/.config/systemd/user"
      printf '%s' "$UNIDS" | while read -r U; do [ -n "$U" ] && echo "   cp '$AQUI/servidor/systemd/$U' ~/.config/systemd/user/$U"; done
      echo "   systemctl --user daemon-reload   # e para ligar: systemctl --user enable --now <unidade>"
    fi
    [ -f "$AQUI/servidor/cron.txt" ] && echo "   (crontab -l 2>/dev/null; cat '$AQUI/servidor/cron.txt') | crontab -"
    [ -n "$USR_ORIG" ] && [ "$USR_ORIG" != "-" ] && echo "   # PM2, unidades e cron acima eram do usuário '$USR_ORIG' na origem: rode-os como o usuário que vai ser o dono deles"
  else
    NT=$(mktemp -d) || exit 5
    BAK="$NT/bak"; mkdir -p "$BAK"
    NGX_FEITOS=""; SNIP_NOVOS=""; SEG_NOVOS=""

    instalar_conf() {  # $1 = nome no nginx, $2 = arquivo na cápsula
      for DD in sites-available sites-enabled; do
        if [ -e "$ND/$DD/$1" ] || [ -L "$ND/$DD/$1" ]; then
          case " $NGX_FEITOS " in
            *" $1 "*) rm -f "$ND/$DD/$1" ;;
            *) mkdir -p "$BAK/$DD" && mv "$ND/$DD/$1" "$BAK/$DD/$1" || return 1 ;;
          esac
        fi
      done
      sedcopia "$2" "$ND/sites-available/$1" && ln -s "$ND/sites-available/$1" "$ND/sites-enabled/$1" || return 1
      case " $NGX_FEITOS " in *" $1 "*) ;; *) NGX_FEITOS="$NGX_FEITOS $1" ;; esac
    }
    desfazer_nginx() {
      for N in $NGX_FEITOS; do
        rm -f "$ND/sites-available/$N" "$ND/sites-enabled/$N"
        for DD in sites-available sites-enabled; do
          if [ -e "$BAK/$DD/$N" ] || [ -L "$BAK/$DD/$N" ]; then mv "$BAK/$DD/$N" "$ND/$DD/$N"; fi
        done
      done
      for S in $SNIP_NOVOS; do
        [ -f "$ND/$S" ] && rm -f "$ND/$S"
        rmdir "$(dirname "$ND/$S")" 2>/dev/null   # rmdir só tira pasta VAZIA: se o nginx já tinha snippets, ela fica
      done
      for S in $SEG_NOVOS; do [ -f "$S" ] && rm -f "$S"; done
      return 0
    }

    if [ -n "$(printf '%s' "$NGX" | head -n 1)" ]; then
      if [ ! -d "$ND/sites-available" ] || [ ! -d "$ND/sites-enabled" ] || ! command -v nginx >/dev/null 2>&1; then
        echo "   nginx: não está instalado aqui ($ND/sites-available ou o comando nginx faltam). Nada instalado."
        SERV_FALHOU="$SERV_FALHOU nginx(não instalado)"
      else
        # snippets que os blocos incluem, só se ainda não existirem
        while read -r S; do
          [ -n "$S" ] || continue
          if [ ! -e "$ND/$S" ]; then mkdir -p "$(dirname "$ND/$S")" && cp "$AQUI/servidor/nginx/$S" "$ND/$S" && SNIP_NOVOS="$SNIP_NOVOS $S" && echo "   snippet $S instalado"; fi
        done <<EOF
$SNIPS
EOF
        # segredos que os blocos apontam (htpasswd): voltam para o mesmo lugar, se ainda não existirem
        while IFS="$TAB" read -r MEMBRO CAM; do
          [ -n "$MEMBRO" ] || continue
          CAM2=$(remap_nginx "$CAM")
          if [ -n "$T" ] && [ -f "$T/ext/$MEMBRO" ]; then
            if [ -e "$CAM2" ]; then
              echo "   segredo $CAM2 já existe, mantido"
            elif mkdir -p "$(dirname "$CAM2")" && cp "$T/ext/$MEMBRO" "$CAM2" && chmod 640 "$CAM2"; then
              SEG_NOVOS="$SEG_NOVOS $CAM2"; echo "   segredo restaurado em $CAM2"
            fi
          else
            echo "   segredo $CAM2 NÃO voltou (sem a senha dos segredos): crie-o à mão"
            FALTA="$FALTA servidor(segredo $CAM2)"
          fi
        done <<EOF
$SEGEXT
EOF
        FALHA_INST=""
        while IFS="$TAB" read -r NOME CERT ARQ SEMSSL DOMS; do
          [ -n "$NOME" ] || continue
          if quer "$CERT"; then
            echo "   instalando o bloco $NOME ($CERT)"
            instalar_conf "$NOME" "$AQUI/servidor/nginx/$ARQ" || FALHA_INST="$FALHA_INST $NOME"
          else
            echo "   candidato NÃO instalado: $NOME (use --incluir-candidatos)"
          fi
        done <<EOF
$NGX
EOF
        TESTE_OK=0; TROCOU=""
        if [ -n "$FALHA_INST" ]; then
          echo "   não consegui copiar:$FALHA_INST" >&2
          echo "falha ao copiar$FALHA_INST" > "$NT/t.err"
        elif nginx -t >"$NT/t.out" 2>"$NT/t.err"; then
          TESTE_OK=1
        else
          # servidor novo sem o certificado: tenta a versão só-HTTP dos blocos que têm
          TEM_VAR=0
          while IFS="$TAB" read -r NOME CERT ARQ SEMSSL DOMS; do
            [ -n "$NOME" ] && quer "$CERT" && [ "$SEMSSL" != "-" ] && TEM_VAR=1
          done <<EOF
$NGX
EOF
          if [ "$TEM_VAR" -eq 1 ]; then
            echo "   nginx -t falhou com a configuração original (falta o certificado aqui?):"
            sed 's/^/     /' "$NT/t.err"
            echo "   trocando pelos blocos só-HTTP; o certbot acrescenta o HTTPS depois"
            while IFS="$TAB" read -r NOME CERT ARQ SEMSSL DOMS; do
              [ -n "$NOME" ] || continue
              quer "$CERT" || continue
              [ "$SEMSSL" != "-" ] || continue
              instalar_conf "$NOME" "$AQUI/servidor/nginx/$SEMSSL" && TROCOU="$TROCOU $NOME"
            done <<EOF
$NGX
EOF
            if nginx -t >"$NT/t.out" 2>"$NT/t.err"; then TESTE_OK=1; fi
          fi
        fi
        if [ "$TESTE_OK" -ne 1 ]; then
          desfazer_nginx
          echo "   nginx -t FALHOU: a instalação do nginx foi DESFEITA (o que existia voltou). Motivo:" >&2
          sed 's/^/     /' "$NT/t.err" >&2
          SERV_FALHOU="$SERV_FALHOU nginx(-t falhou, desfeito)"
        else
          if nginx -s reload >/dev/null 2>"$NT/r.err"; then echo "   nginx recarregado"; else echo "   nginx -s reload falhou:" >&2; sed 's/^/     /' "$NT/r.err" >&2; SERV_FALHOU="$SERV_FALHOU nginx(reload)"; fi
          if [ -z "$TROCOU" ]; then
            echo "   certificado: o nginx -t passou com o certificado original, o certbot não foi preciso"
          else
            while IFS="$TAB" read -r NOME CERT ARQ SEMSSL DOMS; do
              [ -n "$NOME" ] || continue
              case " $TROCOU " in *" $NOME "*) ;; *) continue ;; esac
              if [ "$DOMS" = "-" ]; then
                echo "   $NOME ficou só em HTTP: o certificado dele não é do certbot. Instale o certificado à mão (a chave privada nunca vai na cápsula)."
                continue
              fi
              CB=""; for D in $DOMS; do CB="$CB -d $D"; done
              echo "   certbot --nginx$CB   (o DNS destes domínios precisa apontar para ESTE servidor, senão o certbot falha)"
              if command -v certbot >/dev/null 2>&1; then
                certbot --nginx $CB || SERV_FALHOU="$SERV_FALHOU certbot($NOME)"
              else
                echo "   certbot não está instalado: instale e rode o comando acima"
                SERV_FALHOU="$SERV_FALHOU certbot(não instalado)"
              fi
            done <<EOF
$NGX
EOF
          fi
        fi
      fi
    fi

    if [ -n "$(printf '%s' "$PM2S" | head -n 1)" ]; then
      if ! command -v pm2 >/dev/null 2>&1; then
        echo "   pm2 não está instalado aqui: instale e rode os 'pm2 start' do RESTAURAR.md"
        SERV_FALHOU="$SERV_FALHOU pm2(não instalado)"
      else
        FEZ_PM2=0
        while IFS="$TAB" read -r NOME SC CW IT AR; do
          [ -n "$NOME" ] || continue
          if pm2 describe "$NOME" >/dev/null 2>&1; then echo "   pm2: $NOME já existe, mantido (nunca troco um processo que está de pé)"; continue; fi
          set -- start "$(remap "$SC")" --name "$NOME" --cwd "$(remap "$CW")"
          [ "$IT" != "-" ] && set -- "$@" --interpreter "$IT"
          if [ "$AR" != "-" ]; then set -- "$@" -- $AR; fi
          echo "   pm2 $*"
          if pm2 "$@" >/dev/null; then FEZ_PM2=1; else SERV_FALHOU="$SERV_FALHOU pm2($NOME)"; fi
        done <<EOF
$PM2S
EOF
        if [ "$FEZ_PM2" -eq 1 ]; then pm2 save >/dev/null && echo "   pm2 save feito"; fi
      fi
    fi

    if [ -n "$(printf '%s' "$UNIDS" | head -n 1)" ]; then
      UD="${HOME:-/root}/.config/systemd/user"
      mkdir -p "$UD"
      while read -r U; do
        [ -n "$U" ] || continue
        if [ -e "$UD/$U" ] && [ "$SOBRE" -ne 1 ]; then echo "   unidade $U já existe em $UD, mantida"; else sedcopia "$AQUI/servidor/systemd/$U" "$UD/$U" && echo "   unidade $U instalada em $UD"; fi
      done <<EOF
$UNIDS
EOF
      systemctl --user daemon-reload >/dev/null 2>&1 || echo "   (systemctl --user daemon-reload não rodou: rode você)"
      echo "   as unidades NÃO foram ligadas. Para ligar: systemctl --user enable --now <unidade>"
      if [ -n "$USR_ORIG" ] && [ "$USR_ORIG" != "-" ]; then echo "   ATENÇÃO: instalei no usuário de quem rodou o script; na origem o dono era '$USR_ORIG'"; fi
    fi

    if [ -f "$AQUI/servidor/cron.txt" ]; then
      if command -v crontab >/dev/null 2>&1; then
        crontab -l 2>/dev/null > "$NT/cron.atual" || : > "$NT/cron.atual"
        cp "$NT/cron.atual" "$NT/cron.novo"
        ADD=0
        while IFS= read -r L; do
          [ -n "$L" ] || continue
          LL=$(printf '%s\n' "$L" | troca_origem)
          if ! grep -Fxq -- "$LL" "$NT/cron.atual"; then printf '%s\n' "$LL" >> "$NT/cron.novo"; ADD=$((ADD + 1)); fi
        done < "$AQUI/servidor/cron.txt"
        if [ "$ADD" -gt 0 ]; then crontab "$NT/cron.novo" && echo "   cron: $ADD linha(s) acrescentada(s) (valor de senha ou token, se havia, está como ***)"; else echo "   cron: as linhas já existiam"; fi
      else
        echo "   crontab não está instalado aqui"; SERV_FALHOU="$SERV_FALHOU cron(não instalado)"
      fi
    fi
  fi
elif [ -f "$SPLANO" ]; then
  echo "== 6. servidor: pulado (--sem-servidor)"
fi

echo "== 7. resumo"
echo "   restaurou: o projeto em $DEST ($N entradas)"
if [ -d "$DEST/.git" ] && command -v git >/dev/null 2>&1; then
  GN=$(git -C "$DEST" --no-optional-locks status --porcelain 2>/dev/null | wc -l)
  echo "   git: $(git -C "$DEST" --no-optional-locks rev-parse --short HEAD 2>/dev/null), $((GN + 0)) alterações (na origem eram $(numero total))"
fi
if [ "$DOCK" -eq 1 ]; then
  echo "   Docker: projeto Compose \"$PROJ_NOVO\" (imagens, volumes, compose e bancos acima)"
else
  echo "   não faz parte desta cápsula (ou foi pulado): imagens, volumes e bancos Docker"
fi
NC=$(numero nao_coletado_total)
if [ -n "$NC" ] && [ "$NC" -gt 0 ]; then
  echo "   NÃO COLETADO na origem (precisava de root): $NC item(ns), a lista está no RESTAURAR.md"
fi
if [ "$SERV" -eq 1 ]; then
  if [ "$EH_ROOT" -eq 1 ]; then echo "   servidor: feito acima (nginx, certificado, PM2, unidades, cron)"; else echo "   servidor: NÃO feito (você não é root); os comandos estão em '== 6. servidor'"; fi
fi
if [ "$PAST" -eq 1 ] && [ -n "$PASTAS_ACOES" ]; then
  echo "   pastas de fora do projeto: $PAST_N recolocada(s)$( [ "$PAST_SUDO" -gt 0 ] && printf ', %s para colar com sudo (veja == 4b)' "$PAST_SUDO" )"
fi
if [ -n "$SEGPAST" ]; then
  echo "   segredos de fora do projeto: $SEG_FORA_N recolocado(s)$( [ "$SEG_FORA_SUDO" -gt 0 ] && printf ', %s para colar com sudo (veja == 4c)' "$SEG_FORA_SUDO" )"
fi
echo "   não faz parte desta cápsula: DNS no registrador, e-mail, serviços de terceiros, e as pastas de fora do projeto que o RESTAURAR.md (seção 2) marca como NÃO coletadas"
if [ -n "$FALHOU_DOCKER" ]; then
  echo "   FALHOU no Docker:$FALHOU_DOCKER" >&2
  exit 8
fi
if [ -n "$SERV_FALHOU" ]; then
  echo "   FALHOU no servidor:$SERV_FALHOU" >&2
  exit 11
fi
if [ -n "$PAST_FALHOU" ]; then
  echo "   FALHOU nas pastas de fora do projeto:$PAST_FALHOU" >&2
  exit 13
fi
if [ -n "$FALTA" ]; then
  echo "   FALTA:$FALTA"
  exit 6
fi
echo "   falta: nada do que esta cápsula guardou"
exit 0
