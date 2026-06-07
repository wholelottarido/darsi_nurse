#!/bin/bash

set -euo pipefail

PROJECT_DIR="/home/ridho/volt/darsi-nurse"
FRONTEND_NAME="darsi-frontend"
BACKEND_NAME="darsi-backend"
FRONTEND_HOST="10.9.23.205"
FRONTEND_PORT="6767"

cd "$PROJECT_DIR"

echo "🚀 Starting frontend (Next) with PM2..."

if pm2 list | grep -q "$FRONTEND_NAME"; then
  echo "Frontend process exists, restarting..."
  pm2 restart "$FRONTEND_NAME" --update-env
else
  pm2 start npm --name "$FRONTEND_NAME" -- run dev -- -H "$FRONTEND_HOST" -p "$FRONTEND_PORT"
fi

if [[ -n "${BACKEND_CMD:-}" ]]; then
  echo "🚀 Starting backend with PM2..."
  if pm2 list | grep -q "$BACKEND_NAME"; then
    pm2 restart "$BACKEND_NAME" --update-env
  else
    pm2 start $BACKEND_CMD --name "$BACKEND_NAME"
  fi
else
  echo "ℹ️ Backend runs inside Next.js API routes. No separate backend process started."
fi

echo ""
echo "📊 Status:"
pm2 status

echo ""
echo "✅ Frontend running at: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
