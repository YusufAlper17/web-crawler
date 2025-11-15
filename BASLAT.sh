#!/bin/bash

echo "🚀 Web Crawler Başlatılıyor..."
echo ""

# Backend başlat
echo "📦 Backend başlatılıyor..."
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > crawler.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend başlatıldı (PID: $BACKEND_PID)"
cd ..

# Biraz bekle
sleep 3

# Frontend başlat  
echo "🎨 Frontend başlatılıyor..."
cd frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend başlatıldı (PID: $FRONTEND_PID)"
cd ..

echo ""
echo "═══════════════════════════════════════"
echo "✅ Tüm servisler başlatıldı!"
echo "═══════════════════════════════════════"
echo "🌐 Frontend: http://localhost:3000"
echo "📡 Backend:  http://localhost:8000"
echo "📊 API Docs: http://localhost:8000/docs"
echo "═══════════════════════════════════════"
echo ""
echo "Logları görmek için:"
echo "  Backend:  tail -f backend/crawler.log"
echo "  Frontend: npm run dev terminalinde"
echo ""
echo "Durdurmak için: Ctrl+C"
echo ""

# PID'leri kaydet
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

# Bekle
wait

