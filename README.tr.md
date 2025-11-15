<div align="right">

[English](README.md) | [Türkçe](README.tr.md)

</div>

Web Crawler

FastAPI tabanlı backend ile React + Vite arayüzüne sahip modern ve ölçeklenebilir bir web tarayıcı. Web sitelerini tarayın, iç link ağacını görselleştirin ve verileri farklı formatlarda dışa aktarın.

Öne çıkanlar
- Derinlik ve sayfa sınırıyla tarama
- robots.txt uyumu ve nazik hız sınırlama
- Metin ve metadata çıkarımı
- Link ağacı görselleştirme
- Esnek seçeneklerle JSON/CSV/Excel dışa aktarma

Depo yapısı
- `backend`: FastAPI servisi, tarayıcı motoru, SQLite/Postgres desteği
- `frontend`: React (Vite) arayüzü, analiz ve görseller
- `docker-compose.yml`: Yerelde Postgres/Redis + uygulama

Hızlı başlangıç

Yerel (geliştirme için önerilir)
- Gerekli araçlar: Python 3.13+, Node 18+, Redis (opsiyonel), SQLite veya Postgres
- Backend
  1. `cd backend && python -m venv venv && source venv/bin/activate`
  2. `pip install -r requirements.txt`
  3. `backend/ENV.EXAMPLE` dosyasını `backend/.env` olarak kopyalayıp düzenleyin
  4. `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Frontend
  1. `cd frontend`
  2. `npm install`
  3. `frontend/ENV.EXAMPLE` dosyasını `.env` olarak kopyalayıp `VITE_API_URL` değerini ayarlayın (varsayılan `http://localhost:8000/api/v1`)
  4. `npm run dev` (Vite boş bir port seçecektir; genelde 5173 veya 300x)

Docker (hepsi bir arada)
- `docker compose up -d --build`
- Backend: `http://localhost:8000` (dokümantasyon `/docs`)
- Frontend: `http://localhost:3000`

Ortam değişkenleri
- Backend: `backend/ENV.EXAMPLE` içine bakın
  - `DATABASE_URL`, `REDIS_URL`, `API_V1_PREFIX`, `CORS_ORIGINS`
  - `MAX_DEPTH`, `MAX_PAGES`, `REQUEST_DELAY`, `CONCURRENT_REQUESTS`, `USER_AGENT`
- Frontend: `frontend/ENV.EXAMPLE`
  - `VITE_API_URL` backend API adresi (varsayılan `http://localhost:8000/api/v1`)

Komutlar
- Backend
  - Şema oluştur (SQLite): `python -c "from app.database.connection import engine, Base; Base.metadata.create_all(bind=engine)"`
  - Geliştirme sunucusu: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Frontend
  - Geliştirme: `npm run dev`
  - Derleme: `npm run build`
  - Önizleme: `npm run preview`

Ekran görüntüleri
Şu dosyaları `docs/screenshots/` içine yerleştirin:
- `dashboard.png`
- `table-view.png`
- `tree-view.png`
- `download-center.png`

Paylaştığınız görüntüler için önerilen isimler:
- Ana gösterge paneli → `dashboard.png`
- Tablo görünümü (sayfa listesi) → `table-view.png`
- Ağaç görünümü (link grafiği) → `tree-view.png`
- İndirme merkezi → `download-center.png`

![Dashboard](docs/screenshots/dashboard.png)
Dashboard: Canlı istatistikler, son job'lar ve hızlı aksiyonların bulunduğu ana kontrol paneli.
![Table view](docs/screenshots/table-view.png)
Tablo Görünümü: Çekilen sayfalar, status kodları, başlıklar ve arama/filtreleme kontrolleri.
![Tree view](docs/screenshots/tree-view.png)
Ağaç Görünümü: Site içi link ağacını interaktif şekilde keşfetme (zoom, pan, node genişletme).
![Download center](docs/screenshots/download-center.png)
İndirme Merkezi: JSON/CSV/Excel olarak veri indirme seçenekleri ve kapsam ayarları.

Sorun giderme
- 8000 portu dolu (backend): Mevcut süreci kapatın (`lsof -ti :8000 | xargs kill -9`) ve uvicorn’u yeniden başlatın.
- 3000/5173 portu dolu (frontend): `npm run dev -- --port 3000` veya 5173 ile farklı bir port seçin.
- Vite farklı port seçiyor: Terminal çıktısını veya `frontend/frontend.log` dosyasını kontrol edin. İsterseniz `npm run dev -- --port 3000` ile sabitleyin.
- CORS hatası: `backend/app/config.py` içindeki `CORS_ORIGINS` veya `.env` üstünden izin verilen origin’lere frontend adresini ekleyin.
- `.env` okunmuyor: Örnek dosyayı doğru konuma kopyaladığınızdan emin olun (`backend/ENV.EXAMPLE` → `backend/.env`, `frontend/ENV.EXAMPLE` → `frontend/.env`) ve servisleri yeniden başlatın.
- Veritabanına bağlanamıyor: `DATABASE_URL` değerini kontrol edin. Postgres kullanıyorsanız Docker’da servis adını (`db`) ve doğru portu (`5432`) kullandığınızdan emin olun.
- SQLite yolu: `backend/app/config.py` göreli SQLite yolunu backend köküne mutlak olarak sabitler. Yazma izinleri için proje klasöründe yetkileri kontrol edin.
- Export indirilemiyor: Tarayıcı popup/indirme izinlerini ve backend cevap boyut limitlerini kontrol edin. Büyük Excel çıktıları için daha küçük kapsam seçin.
- Redis gerekli mi?: Opsiyoneldir; rate limiting ve queue için önerilir. Yoksa ilgili özellikler devre dışı kalabilir.
- Node/Python sürümleri: Node 18+/20+ ve Python 3.13+ önerilir. Farklı sürümlerde derleme sorunları yaşayabilirsiniz.

Katkı
Önemli değişiklikler için önce bir konu açın. PR’lar memnuniyetle karşılanır.


