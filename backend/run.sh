#!/bin/bash

# Database bağlantısını bekle
echo "Database bağlantısı bekleniyor..."
sleep 5

# Database tablolarını oluştur
echo "Database tabloları oluşturuluyor..."
python -c "from app.database.connection import engine, Base; Base.metadata.create_all(bind=engine)"

# Uygulamayı başlat
echo "Backend başlatılıyor..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

