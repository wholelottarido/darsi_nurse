#!/bin/bash

# Script untuk start app dengan PM2 jika belum running
PROJECT_DIR="/home/ridho/volt/darsi-nurse"

echo "🚀 Starting Darsi Nurse dengan PM2..."

cd "$PROJECT_DIR"

# Check apakah app sudah ada di PM2
if pm2 list | grep -q "darsi-nurse"; then
    echo "App sudah di PM2, restart..."
    pm2 restart darsi-nurse
else
    echo "Setup app baru di PM2..."
    npm run pm2:start
fi

echo ""
echo "📊 Status:"
pm2 status

echo ""
echo "✅ App running di: http://10.9.23.205:3019"
echo "📝 View logs: npm run pm2:logs"
echo "🛑 Stop: npm run pm2:stop"
