# CrawlScope

CrawlScope is a production-ready web crawling and site intelligence dashboard. It crawls a target website, stores page/link metadata, visualizes internal link structure, tracks crawl health, and exports analysis data in JSON, CSV, or Excel.

The frontend is designed for Vercel. The crawler API is intentionally deployed as a persistent FastAPI service because crawl jobs can run longer than serverless request limits.

## What It Does

- Starts crawl jobs with depth, page limit, delay, timeout, concurrency, robots.txt, redirect, metadata, and HTML storage settings.
- Stores crawl jobs, pages, metadata, status codes, and link relationships in SQLite for local development or Postgres for production.
- Shows a professional operations dashboard with live job status, crawl history, page counts, and job controls.
- Provides real analytics from the API, including status distribution and 7-day activity metrics.
- Visualizes internal link trees with zoom, pan, expand, collapse, and node details.
- Exports crawl data as JSON, CSV, Excel, link-only JSON, or configurable advanced exports.

## Production Architecture

Recommended deployment:

- Frontend: Vercel
- API and crawler worker: Render, Railway, Fly.io, or another always-on container/Python host
- Database: Managed Postgres such as Supabase, Railway Postgres, Render Postgres, or Neon

Why not run everything on Vercel?

- Vercel is excellent for the React/Vite frontend.
- The crawler is a long-running background workload, which does not fit Vercel serverless limits.
- SQLite is not suitable for Vercel production because the filesystem is ephemeral.
- Production should use Postgres and a persistent API process.

## Repository Layout

```text
backend/        FastAPI API, crawler engine, SQLAlchemy models, exports
frontend/       React + Vite UI
vercel.json     Vercel frontend deployment config from repo root
render.yaml     Example Render API + Postgres blueprint
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

### 1. Database

Create a managed Postgres database. Supabase, Railway, Render Postgres, and Neon all work.

Use the database connection string as `DATABASE_URL` in the backend host. Keep database credentials server-side only.

### 2. Backend API

Deploy `backend/` to a persistent Python host.

For Render, the included `render.yaml` can create:

- `crawlscope-api`
- `crawlscope-postgres`

After deployment, set:

- `PUBLIC_FRONTEND_URL` to the Vercel URL
- `CORS_ORIGINS` to `["https://your-vercel-app.vercel.app"]`

### 3. Frontend on Vercel

Deploy the repo root to Vercel. The included `vercel.json` builds `frontend/` and rewrites SPA routes to `index.html`.

Set this Vercel environment variable:

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
