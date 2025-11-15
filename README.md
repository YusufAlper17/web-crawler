<div align="right">

[English](README.md) | [Türkçe](README.tr.md)

</div>

Web Crawler

A modern, scalable web crawler with a FastAPI backend and a React + Vite frontend. Crawl websites, analyze internal link graphs, and export your data in multiple formats.

Key features
- Crawl with depth and page limits
- Robots.txt awareness and polite rate limiting
- Content and metadata extraction
- Link graph visualization
- Export as JSON/CSV/Excel with flexible inclusion options

Repository layout
- `backend`: FastAPI service, crawler engine, SQLite/Postgres support
- `frontend`: React (Vite) UI, analytics and visualizations
- `docker-compose.yml`: Local Postgres/Redis + app stack

Quick start

Local (recommended for development)
- Prerequisites: Python 3.13+, Node 18+, Redis (optional), SQLite (bundled) or Postgres
- Backend
  1. `cd backend && python -m venv venv && source venv/bin/activate`
  2. `pip install -r requirements.txt`
  3. Copy `backend/ENV.EXAMPLE` to `backend/.env` and adjust
  4. `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Frontend
  1. `cd frontend`
  2. `npm install`
  3. Copy `frontend/ENV.EXAMPLE` to `.env` (set `VITE_API_URL`, default `http://localhost:8000/api/v1`)
  4. `npm run dev` (Vite will select a free port; typically 5173 or 300x range)

Docker (all-in-one)
- `docker compose up -d --build`
- Backend: `http://localhost:8000` (docs at `/docs`)
- Frontend: `http://localhost:3000`

Environment
- Backend: see `backend/ENV.EXAMPLE`
  - `DATABASE_URL` (SQLite or Postgres), `REDIS_URL`, `API_V1_PREFIX`, `CORS_ORIGINS`
  - `MAX_DEPTH`, `MAX_PAGES`, `REQUEST_DELAY`, `CONCURRENT_REQUESTS`, `USER_AGENT`
- Frontend: see `frontend/ENV.EXAMPLE`
  - `VITE_API_URL` to the backend API (default `http://localhost:8000/api/v1`)

Common scripts
- Backend
  - Create DB schema (SQLite): `python -c "from app.database.connection import engine, Base; Base.metadata.create_all(bind=engine)"`
  - Run dev server: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Frontend
  - Dev server: `npm run dev`
  - Build: `npm run build`
  - Preview: `npm run preview`

Screenshots
Place the following files under `docs/screenshots/` and the README will render them:
- `dashboard.png`
- `table-view.png`
- `tree-view.png`
- `download-center.png`

For example, the files you shared can be saved with these names:
- Dashboard overview → `dashboard.png`
- Table view (pages list) → `table-view.png`
- Link graph view → `tree-view.png`
- Download center → `download-center.png`

![Dashboard](docs/screenshots/dashboard.png)
Dashboard: Live stats, recent jobs and quick actions on the main control panel.
![Table view](docs/screenshots/table-view.png)
Table View: Crawled pages with status codes, titles, search and filtering controls.
![Tree view](docs/screenshots/tree-view.png)
Tree View: Explore the internal link graph interactively (zoom, pan, expand nodes).
![Download center](docs/screenshots/download-center.png)
Download Center: Options to export data as JSON/CSV/Excel with flexible scopes.

Troubleshooting
- Port already in use on 8000 (backend): stop the existing process (`lsof -ti :8000 | xargs kill -9`) and restart uvicorn.
- Vite chooses a different port: check terminal output or `frontend/frontend.log`. You can fix the port via `npm run dev -- --port 3000`.
- SQLite path resolution: `backend/app/config.py` resolves relative SQLite paths to an absolute file in the backend root.
- Frontend port conflicts (3000/5173): run `npm run dev -- --port 3000` or pick a free port.
- CORS errors: Add your frontend origin to `CORS_ORIGINS` in `backend/app/config.py` or via `.env`.
- `.env` not loading: Ensure example files are copied correctly (`backend/ENV.EXAMPLE` → `backend/.env`, `frontend/ENV.EXAMPLE` → `frontend/.env`) and restart services.
- Database connection issues: Verify `DATABASE_URL`. For Docker compose, use the service name (e.g., `db`) and correct port (`5432`) for Postgres.
- SQLite permissions: Ensure the project folder allows write access for the SQLite file.
- Exports not downloading: Check browser download permissions and backend response size limits. For very large Excel files, export a smaller scope.
- Redis required?: Optional. Recommended for rate limiting/queues; without it, related features may be limited.
- Node/Python versions: Prefer Node 18+/20+ and Python 3.13+; older versions may cause build issues.

License
Specify your license of choice, e.g., MIT.

Contributing
Issues and PRs are welcome. Please open an issue first for substantial changes.

Türkçe dokümantasyon
Türkçe sürüm için `README.tr.md` dosyasına bakın.

# Web Crawler - Gelişmiş Web Tarayıcı 🚀

Modern, ölçeklenebilir ve profesyonel bir web crawler projesi. Sitenin tüm içeriğini keşfeder, çeker ve düzenli bir şekilde veritabanında saklar. Gelişmiş analytics, export özellikleri ve kullanıcı dostu arayüzü ile kapsamlı web analizi yapın.

## ✨ Özellikler

### Backend
- ✅ **FastAPI** ile modern REST API
- ✅ **PostgreSQL/SQLite** ile esnek veritabanı yapısı
- ✅ **Async/Await** ile yüksek performanslı crawling
- ✅ **Robots.txt** kontrolü ve yasal uyumluluk
- ✅ **Adaptive Rate Limiting** ile akıllı crawling
- ✅ **Retry Mekanizması** ile güvenilir veri çekme
- ✅ **URL normalizasyonu** ile duplicate önleme
- ✅ **İçerik çıkarma** (metadata, başlıklar, linkler)
- ✅ **Link analizi** (internal/external)
- ✅ **Export API** (JSON, CSV, Excel formatları)
- ✅ **Kapsamlı logging** ve hata yönetimi
- ✅ **Çoklu concurrent request** desteği

### Frontend
- ✅ **React + TypeScript** ile modern UI
- ✅ **Material-UI** ile profesyonel tasarım
- ✅ **D3.js** ile interaktif ağaç görselleştirme
- ✅ **Real-time** durum takibi ve canlı güncelleme
- ✅ **Analytics Dashboard** - Detaylı grafikler ve istatistikler
- ✅ **Export/Download** - Verileri JSON, CSV, Excel formatında indirin
- ✅ **Settings Sayfası** - Crawler davranışını özelleştirin
- ✅ **Tablo Görünümü** - Sayfalama, filtreleme ve arama
- ✅ **Node seçimi** ve detay görüntüleme
- ✅ **Responsive** tasarım - Tüm cihazlarda mükemmel görünüm

## 📋 Gereksinimler

- Docker ve Docker Compose
- Python 3.11+ (local development için)
- Node.js 20+ (local development için)

## 🛠️ Kurulum

### Docker ile (Önerilen)

1. Projeyi klonlayın:
```bash
git clone <repo-url>
cd Web-Crawler
```

2. Docker Compose ile başlatın:
```bash
docker-compose up -d
```

3. Servisler:
   - Backend API: http://localhost:8000
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

### Local Development

#### Backend

1. Backend dizinine gidin:
```bash
cd backend
```

2. Virtual environment oluşturun:
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. Bağımlılıkları yükleyin:
```bash
pip install -r requirements.txt
```

4. `.env` dosyası oluşturun:
```bash
cp .env.example .env
```

5. PostgreSQL ve Redis'in çalıştığından emin olun

6. Uygulamayı başlatın:
```bash
uvicorn app.main:app --reload
```

#### Frontend

1. Frontend dizinine gidin:
```bash
cd frontend
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Uygulamayı başlatın:
```bash
npm run dev
```

## 📖 Kullanım

### 1. Crawl Başlatma

1. **Dashboard** sayfasında URL girin
2. Maksimum derinlik ve sayfa sayısını ayarlayın
3. "Crawl Başlat" butonuna tıklayın
4. Real-time olarak ilerlemeyi takip edin

### 2. Verileri İnceleme

**Ağaç Görünümü:**
- Crawl tamamlandıktan sonra ağaç görselleştirmesi otomatik oluşur
- Node'lara tıklayarak alt linkleri genişletebilir/daraltabilirsiniz
- Zoom ve pan özellikleriyle büyük ağaçları kolayca keşfedin

**Tablo Görünümü:**
- Tüm çekilen sayfaları tablo formatında görün
- URL ve başlık bazlı arama yapın
- Status koduna göre filtreleyin
- Sayfalama ile büyük veri setlerini yönetin

**İstatistikler:**
- Toplam sayfa, derinlik, durum bilgilerini görün
- Seçili linkleri yönetin

### 3. Analytics

- **Analytics** sayfasında detaylı grafikler ve istatistikler
- Status dağılımı (Pie Chart)
- Son job'ların performansı (Bar Chart)
- Zaman bazlı aktivite analizi (Area Chart)
- Genel performans metrikleri

### 4. Verileri İndirme

- **Export Butonları** ile verileri indirin:
  - **JSON**: Tüm veri yapısını JSON formatında
  - **CSV**: Sayfa listesini CSV olarak (Excel uyumlu)
  - **Excel**: Çoklu sayfa ile detaylı Excel raporu
- Dashboard'dan tüm job'ların özetini tek CSV dosyasında indirin

### 5. Ayarları Özelleştirme

**Settings** sayfasında crawler davranışını özelleştirin:
- Maksimum derinlik ve sayfa limitleri
- İstek gecikmesi ve timeout
- Eşzamanlı istek sayısı
- User Agent
- Robots.txt uyumu
- Retry ayarları
- Veri toplama seçenekleri

## 🗄️ Veritabanı Yapısı

### Tablolar

- **crawl_jobs**: Crawl job'ları ve durumları
- **pages**: Çekilen sayfalar ve içerikleri
- **links**: Sayfalar arası link ilişkileri
- **robots_cache**: Robots.txt cache'i

## 🔧 Yapılandırma

### Backend Ayarları

Backend ayarları `backend/app/config.py` ve `.env` dosyasında:

```python
# Database
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/webcrawler"
# veya SQLite için:
DATABASE_URL = "sqlite:///./webcrawler.db"

# Crawler Ayarları
MAX_DEPTH = 10              # Maksimum derinlik
MAX_PAGES = 10000           # Maksimum sayfa sayısı
REQUEST_DELAY = 1.0         # İstekler arası bekleme (saniye)
TIMEOUT = 30                # Request timeout (saniye)
CONCURRENT_REQUESTS = 10    # Eşzamanlı istek sayısı
USER_AGENT = "WebCrawler/1.0"  # HTTP User-Agent

# API Ayarları
API_V1_PREFIX = "/api/v1"
CORS_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]
```

### Frontend Ayarları

Frontend ayarları `.env` dosyasında:

```bash
VITE_API_URL=http://localhost:8000/api/v1
```

### Performans Profilleri

**Hızlı Tarama:**
- REQUEST_DELAY: 0.5s
- CONCURRENT_REQUESTS: 20-50
- Daha az metadata

**Dengeli (Önerilen):**
- REQUEST_DELAY: 1.0s
- CONCURRENT_REQUESTS: 10-20
- Tüm özellikler aktif

**Güvenli:**
- REQUEST_DELAY: 2-3s
- CONCURRENT_REQUESTS: 5-10
- Robots.txt strict uyum

## 📡 API Endpoints

### Crawl Yönetimi

- `POST /api/v1/crawl/start` - Yeni crawl başlat
- `GET /api/v1/crawl/{job_id}` - Crawl detayları
- `GET /api/v1/crawl/{job_id}/status` - Crawl durumu
- `GET /api/v1/crawl/{job_id}/tree` - Link ağacı
- `GET /api/v1/crawl/{job_id}/pages` - Çekilen sayfalar
- `POST /api/v1/crawl/{job_id}/pause` - Crawl duraklat
- `POST /api/v1/crawl/{job_id}/resume` - Crawl devam et
- `POST /api/v1/crawl/{job_id}/cancel` - Crawl iptal et
- `DELETE /api/v1/crawl/{job_id}` - Crawl ve verilerini sil
- `GET /api/v1/jobs` - Tüm job'ları listele

### Export/Download

- `GET /api/v1/crawl/{job_id}/export/json` - JSON formatında indir
- `GET /api/v1/crawl/{job_id}/export/csv` - CSV formatında indir
- `GET /api/v1/crawl/{job_id}/export/excel` - Excel formatında indir
- `GET /api/v1/crawl/{job_id}/export/links-json` - Sadece linkleri JSON olarak indir
- `GET /api/v1/jobs/export/summary` - Tüm job'ların özetini CSV olarak indir

Detaylı API dokümantasyonu: http://localhost:8000/docs

## 🎨 UI Özellikleri

### Genel
- **Modern Dark Theme**: Göz yormayan profesyonel karanlık tema
- **Responsive Design**: Desktop, tablet ve mobil cihazlarda mükemmel görünüm
- **Smooth Animations**: Fade ve transition efektleri ile akıcı kullanıcı deneyimi
- **Intuitive Navigation**: Kolay erişilebilir menü ve navigasyon

### Dashboard
- **Stats Cards**: Canlı istatistik kartları
- **Job History**: Geçmiş crawl'ların listesi
- **Quick Actions**: Hızlı erişim butonları
- **Real-time Updates**: Otomatik güncellenen veriler

### Crawl Detail
- **3 Farklı Görünüm**: Ağaç, Tablo ve İstatistikler
- **Interactive Tree Visualization**: 
  - Zoom ve pan desteği
  - Node genişletme/daraltma
  - Otomatik scroll
  - Status göstergeleri
- **Advanced Table View**:
  - Arama ve filtreleme
  - Sayfalama
  - Sıralama
  - Link detayları
- **Export Buttons**: Her formatta kolay indirme

### Analytics
- **Pie Charts**: Status dağılımı
- **Bar Charts**: Job performans karşılaştırması
- **Area Charts**: Zaman bazlı trend analizi
- **Metrics Dashboard**: Önemli metriklerin özeti

### Settings
- **Intuitive Controls**: Kolay ayarlanabilir parametreler
- **Presets**: Hızlı, Dengeli, Güvenli profiller
- **Visual Feedback**: Anlık değişiklik önizlemesi
- **Help Text**: Her ayar için açıklayıcı metinler

## 🔒 Yasal ve Etik

- ✅ Robots.txt kontrolü
- ✅ Rate limiting
- ✅ User-Agent belirtme
- ✅ Telif haklarına saygı
- ✅ Terms of Service uyumu

## 🚧 Geliştirme

### Test

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Linting

```bash
# Backend
flake8 app/
black app/

# Frontend
npm run lint
```

## 📝 Lisans

Bu proje eğitim amaçlıdır. Kullanmadan önce hedef sitenin kullanım şartlarını kontrol edin.

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📞 İletişim

Sorularınız için issue açabilirsiniz.

---

## 🆕 Yeni Özellikler

### v1.1.0 Güncellemeleri

✨ **Export/Download Sistemi**
- JSON, CSV ve Excel formatlarında veri indirme
- Çoklu sayfa Excel raporları (Job bilgisi, Sayfalar, Linkler)
- Tüm job'ların toplu özeti

📊 **Analytics Dashboard**
- Detaylı grafikler ve görselleştirmeler
- Status dağılımı pie chart
- Job performans karşılaştırma bar chart
- Zaman bazlı trend analizi area chart
- Genel istatistikler ve metrikler

⚙️ **Settings Sayfası**
- Crawler davranışını özelleştirme
- Performans profilleri (Hızlı, Dengeli, Güvenli)
- Güvenlik ve veri toplama ayarları
- Real-time ayar önizlemesi

🔄 **Geliştirilmiş Rate Limiting**
- Adaptive rate limiting
- Otomatik hız ayarlama
- Retry mekanizması ile güvenilirlik
- Exponential backoff

🐛 **Bug Fixes ve İyileştirmeler**
- Syntax hataları düzeltildi
- PostgreSQL desteği eklendi
- Kapsamlı logging ve hata yönetimi
- UI/UX iyileştirmeleri
- Performance optimizasyonları

## 🔮 Gelecek Planları

- [ ] Proxy desteği
- [ ] Scheduled crawl'lar (Cron job)
- [ ] Email bildirimleri
- [ ] Advanced filtreleme (CSS selector, XPath)
- [ ] Screenshot alma
- [ ] PDF export
- [ ] Çoklu dil desteği
- [ ] User authentication
- [ ] Team collaboration özellikleri

---

**Not**: Bu crawler yalnızca yasal ve etik amaçlarla kullanılmalıdır. Her zaman robots.txt dosyalarına ve sitelerin kullanım şartlarına uyun.

## 🙏 Teşekkürler

Bu projeyi kullandığınız için teşekkürler! Sorularınız veya önerileriniz için issue açmaktan çekinmeyin.

