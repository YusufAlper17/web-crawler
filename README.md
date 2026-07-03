# CrawlScope

CrawlScope is a production-ready web crawling and site intelligence dashboard. It crawls a target website, stores page/link metadata, visualizes internal link structure, tracks crawl health, and exports analysis data in JSON, CSV, or Excel.

There are two ways to deploy CrawlScope:

1. **Vercel-only (serverless)** — the whole app (frontend + a lightweight step-based crawler API) runs on Vercel. Best for small/medium crawls and a single public link with zero extra hosting. Uses Vercel Python Functions under `api/` and a managed Postgres (Supabase) for persistence.
2. **Hybrid (persistent API)** — the frontend runs on Vercel and the full FastAPI backend (`backend/`) runs on an always-on host (Railway, Render, Fly.io). Best for large/deep crawls and full features (Excel/advanced exports).

## What It Does

- Starts crawl jobs with depth, page limit, delay, timeout, concurrency, robots.txt, redirect, metadata, and HTML storage settings.
- Stores crawl jobs, pages, metadata, status codes, and link relationships in SQLite for local development or Postgres for production.
- Shows a professional operations dashboard with live job status, crawl history, page counts, and job controls.
- Provides real analytics from the API, including status distribution and 7-day activity metrics.
- Visualizes internal link trees with zoom, pan, expand, collapse, and node details.
- Exports crawl data as JSON, CSV, Excel, link-only JSON, or configurable advanced exports.

## Production Architecture

Option 1 — Vercel-only (serverless):

- Frontend + API both on Vercel (`api/index.py` is a self-contained Python Function).
- Crawling runs in a "step" model: the UI advances the crawl in small batches, so total crawl time can exceed the per-request limit.
- Database: Managed Postgres (Supabase recommended) via the `DATABASE_URL` env var. Without it, an ephemeral `/tmp` SQLite is used (data is not persistent).
- Limits: designed for small/medium crawls; Excel/advanced exports are not available in serverless (use the hybrid option for those).

Option 2 — Hybrid (persistent API):

- Frontend: Vercel
- API and crawler worker: Render, Railway, Fly.io, or another always-on Python host (`backend/`)
- Database: Managed Postgres such as Supabase, Railway Postgres, Render Postgres, or Neon

## Repository Layout

```text
api/            Vercel serverless API (lightweight step crawler, self-contained)
backend/        Full FastAPI API, crawler engine, SQLAlchemy models, exports
frontend/       React + Vite UI
requirements.txt  Slim deps for the Vercel Python Function
vercel.json     Vercel config: frontend build + /api routing
render.yaml     Example Render API + Postgres blueprint (hybrid)
docker-compose.yml
```

## Local Development

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ENV.EXAMPLE .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
cp ENV.EXAMPLE .env
npm run dev
```

Local URLs:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

## Environment Variables

Frontend (`frontend/.env` or Vercel env):

```bash
VITE_API_URL=https://your-api-host.com/api/v1
```

Backend (`backend/.env` or API host env):

```bash
APP_NAME=CrawlScope
DEPLOYMENT_TARGET=production
PUBLIC_FRONTEND_URL=https://your-vercel-app.vercel.app
DATABASE_URL=postgresql://user:password@host:5432/database
API_V1_PREFIX=/api/v1
CORS_ORIGINS=["https://your-vercel-app.vercel.app"]
MAX_DEPTH=10
MAX_PAGES=10000
REQUEST_DELAY=1.0
TIMEOUT=30
CONCURRENT_REQUESTS=10
USER_AGENT=CrawlScope/1.0 (+https://your-domain.com/bot)
```

## Deploy

### Option 1 — Vercel-only (serverless, simplest)

Everything runs on Vercel. Real crawling works for small/medium sites.

1. Create a free Postgres on [Supabase](https://supabase.com) → Project Settings → Database → copy the connection string (URI).
2. Import the GitHub repo on [vercel.com](https://vercel.com) (framework preset: **Other**). `vercel.json` already sets the build and `/api` routing.
3. In Vercel → **Settings → Environment Variables**, add:

```bash
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres
# optional:
DEPLOYMENT_TARGET=vercel
```

4. Deploy. The frontend automatically calls the same-origin `/api/v1` — **no `VITE_API_URL` needed**.

Notes:
- Without `DATABASE_URL`, an ephemeral `/tmp` SQLite is used (data resets between cold starts). Set Supabase for persistence.
- Crawls run in batches from the crawl detail page; keep that page open while a job runs.
- Excel/advanced exports require Option 2.

### Option 2 — Hybrid (persistent API for large crawls)

#### 1. Database

Create a managed Postgres database (Supabase, Railway, Render, Neon). Use its connection string as `DATABASE_URL` on the backend host.

#### 2. Backend API (Railway — no card required)

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select `web-crawler`.
3. Open the new service → **Settings** → set **Root Directory** to `backend`.
4. **New** → **Database** → **PostgreSQL** (adds Postgres to the same project).
5. In the **backend service** → **Variables**, add:

```bash
DEPLOYMENT_TARGET=railway
PUBLIC_FRONTEND_URL=https://your-vercel-app.vercel.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ORIGINS=["https://your-vercel-app.vercel.app"]
```

6. Deploy. Copy the public URL (e.g. `https://web-crawler-production-xxxx.up.railway.app`).

The included `backend/railway.toml` sets the start command and health check. **Alternative:** Render via `render.yaml`.

#### 3. Frontend on Vercel

Set this Vercel environment variable to point at the persistent API:

```bash
VITE_API_URL=https://your-api-host.com/api/v1
```

## API Highlights

- `POST /api/v1/crawl/start`
- `GET /api/v1/crawl/{job_id}`
- `GET /api/v1/crawl/{job_id}/status`
- `GET /api/v1/crawl/{job_id}/tree`
- `GET /api/v1/crawl/{job_id}/pages`
- `GET /api/v1/analytics/summary`
- `GET /api/v1/settings`
- `GET /api/v1/crawl/{job_id}/export/json`
- `GET /api/v1/crawl/{job_id}/export/csv`
- `GET /api/v1/crawl/{job_id}/export/excel`
- `POST /api/v1/crawl/{job_id}/export/advanced`
- `POST /api/v1/crawl/bulk-export`

## Operational Notes

- Respect target sites' robots.txt and terms of service.
- Keep `REQUEST_DELAY` conservative for public websites.
- Use lower `CONCURRENT_REQUESTS` for small hosts.
- Prefer Postgres for any public deployment.
- Do not put secret database URLs or service role keys in Vercel frontend variables.

## License

Add your preferred license before public distribution.
