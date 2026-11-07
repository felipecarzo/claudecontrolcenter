#!/bin/bash
# Despertador do plantão (CC-1067). Roda pelo timer de usuário a cada 5 min, SEM modelo:
# quando uma sessão do painel está parada (campo vazio, sem turno em andamento, sem
# pergunta ou pedido na tela) há mais de ESPERA segundos, digita a ordem de seguir.
# Pergunta e permissão NÃO são respondidas aqui: ficam para a sessão do cockpit, que
# este script acorda mandando uma mensagem a ela. Falha do crédito: tudo para; quando
# volta, a primeira rodada que achar sessão parada manda a ordem, e o cockpit acorda.
# Registro: ~/logs/plantao-despertador.log. Desliga: apagar ~/.config/plantao-ativo.
ATIVO="$HOME/.config/plantao-ativo"
LOG="$HOME/logs/plantao-despertador.log"
ESTADO="$HOME/.cache/plantao-estado"
ESPERA=${ESPERA:-180}
[ -f "$ATIVO" ] || exit 0
mkdir -p "$ESTADO" "$(dirname "$LOG")"
ORDEM=$(cat "$ATIVO")
[ -n "$ORDEM" ] || ORDEM="Plantão: siga sem parar pelo próximo item 'agora' do backlog, commit por item. Backlog vazio: testes do projeto, depois funcionalidade (390px) e segurança. Pergunta: escolha o melhor caminho você mesmo e siga. O que depender do Felipe: registre como pendência dele e siga."
agora=$(date +%s)
log() { echo "$(date '+%d/%m %H:%M') $*" >> "$LOG"; }
acordar_cockpit=""
for s in $(tmux ls -F '#{session_name}' 2>/dev/null); do
  # 20 linhas: com 14, o marcador de turno ("✽ Booping… (4m)") ficava fora da janela quando havia bloco
  # de saída acima do campo, e sessão trabalhando era lida como parada (medido às 06:51 no Maurice).
  tela=$(tmux capture-pane -t "$s" -p 2>/dev/null | grep -v '^\s*$' | grep -v 'Tip: Use /btw\|current work' | tail -20)
  [ -z "$tela" ] && continue
  # projeto com o Regente ligado (CC-1068) é dele: a sessão interativa fica parada de propósito, sem ordem nova
  pasta=$(tmux display-message -p -t "$s" '#{pane_current_path}' 2>/dev/null)
  if [ -n "$pasta" ] && grep -q '"ligado": *true' "$pasta/.framework/regente.json" 2>/dev/null; then continue; fi
  # a sessão do cockpit mostra na tela os textos das outras (perguntas, menus): só conta como parada
  [ "$s" = "cc-remote-VPS_cockpit" ] && tela=$(grep -v 'proceed\|allow this\|Enter to\|Submit\|Not now\|Esc to close' <<<"$tela")
  est="trabalhando"
  if grep -q 'Do you want to proceed\|allow this connection\|Enter to select\|Enter to confirm\|Submit answers\|Esc to close\|Not now' <<<"$tela"; then est="pedido"
  elif grep -q 'Not logged in\|/rc failed' <<<"$tela"; then est="caiu"
  # 20/10, 08:05: a conferência do campo vazio (^❯) falhava dentro do script e nunca classificava "parada" (medido com
  # bash -x: o grep do ❯ falha e o resto nem roda). Sem menu e sem o giro do turno na tela, a sessão está parada.
  elif ! grep -qE '[✢✻✶✳✽·]\s+\S+…|Waiting for|background agent|queued messages|esc to interrupt' <<<"$tela"; then est="parada"
  fi
  arq="$ESTADO/$s"
  if [ "$est" = "trabalhando" ]; then rm -f "$arq"; continue; fi
  [ -f "$arq" ] || { echo "$agora" > "$arq"; continue; }
  desde=$(cat "$arq")
  [ $((agora - desde)) -ge "$ESPERA" ] || continue
  case "$est" in
    parada)
      if [ "$s" = "cc-remote-VPS_cockpit" ]; then
        # 20/10, 11:45: 40 chamadas enfileiradas enquanto o crédito estava fora, cada uma um turno pago ao voltar.
        # O cockpit só é acordado quando OUTRA sessão precisa dele (ramo "pedido|caiu" abaixo), e no máximo 1 vez por 30 min.
        :
      else
        tmux send-keys -t "$s" -l "$ORDEM"; tmux send-keys -t "$s" Enter
      fi
      log "$s parada há $(( (agora - desde) / 60 )) min: ordem enviada"; echo "$agora" > "$arq" ;;
    pedido|caiu) acordar_cockpit="$acordar_cockpit $s"; echo "$agora" > "$arq" ;;
  esac
done
if [ -n "$acordar_cockpit" ]; then
  c=cc-remote-VPS_cockpit
  t=$(tmux capture-pane -t $c -p 2>/dev/null | grep -v '^\s*$' | tail -6)
  ult="$ESTADO/.cockpit-acordado"; antes=$(cat "$ult" 2>/dev/null || echo 0)
  if [ -f "$HOME/.config/plantao-sem-cockpit" ]; then
    log "pedido em:$acordar_cockpit; cockpit NÃO é acordado (ele mandou parar, 20/10 12:10)"
  elif [ $((agora - antes)) -lt 1800 ]; then
    log "pedido em:$acordar_cockpit, cockpit acordado há menos de 30 min; espero"
  elif ! grep -qE '[✢✻✶✳✽·]\s+\S+…|esc to interrupt' <<<"$t"; then
    echo "$agora" > "$ult"
    tmux send-keys -t $c -l "Plantão: pedido ou pergunta pendente em:$acordar_cockpit. Leia a tela de cada uma e responda pelo melhor caminho (regras em docs/diario/plantao-2026-10-20.md)."; tmux send-keys -t $c Enter
    log "cockpit acordado para:$acordar_cockpit"
  else
    log "pedido em:$acordar_cockpit, cockpit ocupado; tento de novo"
  fi
fi
