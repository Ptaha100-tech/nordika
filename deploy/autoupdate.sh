#!/usr/bin/env bash
# Каждые 3 минуты смотрит, появились ли в GitHub новые файлы игры. Если да, обновляет игру.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SRC"
git fetch --quiet origin
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse '@{u}')"
if [ "$LOCAL" != "$REMOTE" ]; then
  git merge --ff-only --quiet '@{u}'
  bash "$SRC/deploy/update.sh"
  echo "Обновлено до $(git rev-parse --short HEAD)"
fi
