#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/home/ridho/volt/darsi-nurse"
APP_NAME="darsi-nurse"
PM2_BIN="$APP_DIR/node_modules/.bin/pm2"
NPM_BIN="npm"

cd "$APP_DIR"

mkdir -p logs

if [ ! -x "$PM2_BIN" ]; then
  echo "PM2 belum tersedia di node_modules. Menjalankan npm install..."
  "$NPM_BIN" install
fi

echo "Build aplikasi Next.js..."
"$NPM_BIN" run build

if "$PM2_BIN" describe "$APP_NAME" >/dev/null 2>&1; then
  echo "Hapus proses PM2 lama: $APP_NAME"
  "$PM2_BIN" delete "$APP_NAME"
fi

echo "Start proses PM2 baru: $APP_NAME"
"$PM2_BIN" start ecosystem.config.js --only "$APP_NAME" --update-env

echo "Simpan daftar proses PM2..."
"$PM2_BIN" save

echo

echo "Aplikasi seharusnya tersedia di: http://10.9.23.205:6767"
echo "Cek status: $PM2_BIN status"
echo "Lihat log : $PM2_BIN logs $APP_NAME"
