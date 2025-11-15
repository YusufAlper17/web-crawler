"""
Database migration: pages tablosuna site_type kolonu ekler
"""
import sqlite3
import os
from pathlib import Path

# Database dosyasının yolunu bul
db_path = Path(__file__).parent / "webcrawler.db"

if not db_path.exists():
    print(f"❌ Database dosyası bulunamadı: {db_path}")
    exit(1)

print(f"📊 Database: {db_path}")

try:
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Mevcut kolonları kontrol et
    cursor.execute("PRAGMA table_info(pages)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'site_type' in columns:
        print("✅ site_type kolonu zaten mevcut")
    else:
        print("➕ site_type kolonu ekleniyor...")
        # SQLite'da ALTER TABLE ile kolon ekle
        cursor.execute("ALTER TABLE pages ADD COLUMN site_type VARCHAR")
        conn.commit()
        print("✅ site_type kolonu başarıyla eklendi!")
    
    # Kolonları göster
    cursor.execute("PRAGMA table_info(pages)")
    print("\n📋 pages tablosu kolonları:")
    for row in cursor.fetchall():
        print(f"  - {row[1]} ({row[2]})")
    
    conn.close()
    print("\n✅ Migration tamamlandı!")

except sqlite3.Error as e:
    print(f"❌ Migration hatası: {e}")
    exit(1)

