#!/bin/bash

# Script untuk akses langsung ke 10.9.23.205:3019
# Tanpa perlu npm run dev

PROJECT_DIR="/home/ridho/volt/darsi-nurse"
TARGET_URL="http://10.9.23.205:3019"
PORT=3019

echo "🚀 Dart Nurse App Access Script"
echo "================================"

# Check apakah PM2 app sudah running
pm2 list | grep -q "darsi-nurse"

if [ $? -eq 0 ]; then
    # Check status specific app
    STATUS=$(pm2 status | grep "darsi-nurse" | awk '{print $NF}')
    
    if [[ "$STATUS" == "online" ]]; then
        echo "✅ App sudah running di PM2"
    else
        echo "⚠️  App ada di PM2 tapi status: $STATUS"
        echo "🔄 Restart app..."
        pm2 restart darsi-nurse
        sleep 2
    fi
else
    echo "❌ App tidak ada di PM2"
    echo "🔄 Starting app dengan PM2..."
    cd "$PROJECT_DIR"
    npm run pm2:start
    sleep 3
fi

# Verify koneksi
echo ""
echo "🔍 Checking koneksi ke $TARGET_URL..."
if nc -z 10.9.23.205 $PORT 2>/dev/null; then
    echo "✅ Koneksi berhasil!"
    echo ""
    echo "🌐 Membuka browser..."
    xdg-open "$TARGET_URL" 2>/dev/null || open "$TARGET_URL" 2>/dev/null || echo "Silakan buka: $TARGET_URL"
else
    echo "⚠️  Port $PORT tidak accessible"
    echo "📝 Coba: npm run pm2:logs untuk lihat error"
    exit 1
fi

echo ""
echo "✨ Selesai! Akses di: $TARGET_URL"
