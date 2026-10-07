#!/bin/bash
# CC-933: cria o arquivo central do registro de auditoria. Rode COMO ROOT. Os instaladores do
# deploy seguro e da porta de entrada já chamam este, então rodar sozinho só serve para conferir.
#
#   sudo bash /home/claudedev/projetos/VPS_cockpit/tools/auditoria/instalar.sh
#
# O que faz, e nada além disso:
#   1. cria /var/log/cockpit/auditoria.jsonl (dono root, grupo claudedev, escrita do grupo)
#   2. liga o atributo "só acréscimo" (chattr +a): nem o dono nem o grupo apagam ou reescrevem linha,
#      só acrescentam. Quem roda como claudedev (a porta de entrada, os agentes) consegue ADICIONAR
#      linhas, mas não consegue esconder as que já estão lá
#   3. diz à porta de entrada (cockpit-auth) onde gravar, por um arquivo de complemento do systemd
#      (o deploy seguro recebe o mesmo caminho no próprio instalar.sh dele)
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "rode como root (sudo bash $0)"; exit 1; }
LOG=/var/log/cockpit/auditoria.jsonl

install -d -m 755 /var/log/cockpit
[ -f "$LOG" ] || install -m 664 -o root -g claudedev /dev/null "$LOG"
if chattr +a "$LOG" 2>/dev/null; then
  echo "== registro central pronto, só acréscimo: $LOG"
else
  echo "== AVISO: este sistema de arquivos não aceitou 'chattr +a'. O registro funciona, mas nada impede de apagar linha."
fi

install -d -m 755 /etc/systemd/system/cockpit-auth.service.d
cat > /etc/systemd/system/cockpit-auth.service.d/auditoria.conf <<'CONF'
[Service]
Environment=COCKPIT_AUDITORIA=/var/log/cockpit/auditoria.jsonl
ReadWritePaths=/var/log/cockpit
CONF
systemctl daemon-reload
echo "== a porta de entrada vai gravar no registro central depois do próximo restart do cockpit-auth"
