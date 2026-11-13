#!/usr/bin/env bash
# Ручное обновление: bash deploy/update.sh (обычно не нужно, игра обновляется сама из GitHub).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
cp -r "$SRC/server.js" "$SRC/admin.js" "$SRC/admin.json" "$SRC/package.json" "$SRC/public" /opt/nordika/
systemctl restart nordika
echo "Обновлено. Игроки и их прогресс не затронуты."
