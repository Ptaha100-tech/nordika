#!/usr/bin/env bash
# Установка «Nordika: сердце фьерда» на чистый сервер Ubuntu 24.04 (подойдёт и 22.04).
# Запуск от root из папки с игрой:   bash deploy/setup.sh [адрес-сайта]
# Если адрес не указан, берётся бесплатный вида 203-0-113-5.sslip.io (по IP сервера), https работает и с ним.
set -euo pipefail

if [ "$(id -u)" != "0" ]; then echo "Запустите от root (в консоли хостинга вы уже root)."; exit 1; fi

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP=/opt/nordika
DATA=/var/lib/nordika
DOMAIN="${1:-}"

export DEBIAN_FRONTEND=noninteractive
echo "== 1/6 Пакеты"
apt-get update -y
apt-get install -y curl ca-certificates git nginx certbot python3-certbot-nginx ufw

if [ -z "$DOMAIN" ]; then
  IP="$(curl -4fsS --max-time 10 https://api.ipify.org || curl -4fsS --max-time 10 https://ifconfig.me || true)"
  if [ -z "$IP" ]; then echo "Не получилось узнать IP сервера. Укажите адрес сайта: bash deploy/setup.sh ваш-адрес"; exit 1; fi
  DOMAIN="$(echo "$IP" | tr . -).sslip.io"
  echo "Адрес сайта: $DOMAIN"
fi

echo "== 2/6 Node.js"
need_node=1
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then need_node=0; fi
if [ "$need_node" = "1" ]; then
  apt-get install -y nodejs || true
fi
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== 3/6 Файлы игры"
id nordika >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin nordika
mkdir -p "$APP" "$DATA"
cp -r "$SRC/server.js" "$SRC/admin.js" "$SRC/admin.json" "$SRC/package.json" "$SRC/public" "$APP/"
chown -R nordika:nordika "$DATA"
chown -R root:root "$APP"

cat > /etc/systemd/system/nordika.service <<UNIT
[Unit]
Description=Nordika game server
After=network.target

[Service]
User=nordika
WorkingDirectory=$APP
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=TIME_MUL=10
Environment=DATA_DIR=$DATA
ExecStart=/usr/bin/env node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable nordika
systemctl restart nordika

echo "== 4/6 Сайт (nginx)"
cat > /etc/nginx/sites-available/nordika <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_HERE;
    client_max_body_size 64k;
    gzip on;
    gzip_types text/css application/javascript text/javascript application/json image/svg+xml application/manifest+json;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
NGINX
sed -i "s/DOMAIN_HERE/$DOMAIN/" /etc/nginx/sites-available/nordika
ln -sf /etc/nginx/sites-available/nordika /etc/nginx/sites-enabled/nordika
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

echo "== 5/6 Брандмауэр и ежедневная копия игроков"
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
mkdir -p /var/backups/nordika
cat > /etc/cron.daily/nordika-backup <<'CRON'
#!/bin/sh
tar -czf /var/backups/nordika/data-$(date +%F).tar.gz -C /var/lib nordika
find /var/backups/nordika -name 'data-*.tar.gz' -mtime +7 -delete
CRON
chmod +x /etc/cron.daily/nordika-backup

echo "== 6/6 HTTPS-сертификат и автообновление игры"
HTTPS=no
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then HTTPS=yes; fi

if [ -d "$SRC/.git" ]; then
  cat > /etc/systemd/system/nordika-update.service <<UNIT
[Unit]
Description=Nordika update from GitHub

[Service]
Type=oneshot
ExecStart=/bin/bash $SRC/deploy/autoupdate.sh
UNIT
  cat > /etc/systemd/system/nordika-update.timer <<'UNIT'
[Unit]
Description=Check GitHub for Nordika updates

[Timer]
OnBootSec=2min
OnUnitActiveSec=3min

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now nordika-update.timer
fi

sleep 2
systemctl --no-pager --lines=3 status nordika || true
echo
if [ "$HTTPS" = "yes" ]; then
  echo "Готово. Откройте https://$DOMAIN в браузере телефона."
else
  echo "Игра запущена: http://$DOMAIN"
  echo "Сертификат https не выпустился (чаще всего адрес ещё не указывает на сервер). Подождите 10 минут и выполните:"
  echo "  certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect"
fi
