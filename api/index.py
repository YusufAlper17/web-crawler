"""
CrawlScope - Vercel Serverless API (self-contained)

Bu modül, Vercel Python serverless function olarak çalışacak hafif bir FastAPI
uygulamasıdır. Uzun süren arka plan görevleri Vercel'de mümkün olmadığı için
crawl işlemi "adım adım" (step) modelinde ilerler: frontend her adımda
POST /api/v1/crawl/{id}/step çağırır, her adım birkaç sayfayı işler ve durumu
döndürür. Bu sayede toplam tarama, tek bir isteğin süre limitini aşabilir.

Sadece hafif bağımlılıklar kullanır (httpx, beautifulsoup4, sqlalchemy, psycopg)
ki Vercel'in fonksiyon boyut limitine takılmasın.
"""
import os
import time
import enum
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from urllib.parse import urlparse, urljoin, urlunparse, parse_qs

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, Text, ForeignKey,
    Boolean, JSON, Enum as SAEnum, func, text,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

API_PREFIX = "/api/v1"

# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
def _resolve_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        # Vercel'de sadece /tmp yazılabilir; kalıcı olması için Supabase önerilir.
        return "sqlite:////tmp/crawlscope.db"
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _resolve_database_url()

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, pool_pre_ping=True)
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class JobStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class LinkType(enum.Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    ANCHOR = "anchor"


class CrawlJob(Base):
    __tablename__ = "crawl_jobs"
    id = Column(Integer, primary_key=True, index=True)
    base_url = Column(String, nullable=False, index=True)
    status = Column(SAEnum(JobStatus), default=JobStatus.PENDING, nullable=False)
    max_depth = Column(Integer, default=10)
    max_pages = Column(Integer, default=10000)
    pages_crawled = Column(Integer, default=0)
    pages_failed = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    settings = Column(JSON, nullable=True)


class Page(Base):
    __tablename__ = "pages"
    id = Column(Integer, primary_key=True, index=True)
    crawl_job_id = Column(Integer, ForeignKey("crawl_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String, nullable=False, index=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=True)
    html_content = Column(Text, nullable=True)
    meta_description = Column(String, nullable=True)
    meta_keywords = Column(String, nullable=True)
    depth = Column(Integer, default=0)
    status_code = Column(Integer, nullable=True)
    content_type = Column(String, nullable=True)
    content_length = Column(Integer, nullable=True)
    crawled_at = Column(DateTime(timezone=True), server_default=func.now())
    parent_url = Column(String, nullable=True)
    is_indexed = Column(Boolean, default=False)
    extra_metadata = Column(JSON, nullable=True)
    site_type = Column(String, nullable=True)
    crawl_job = relationship("CrawlJob", backref="pages")


class Link(Base):
    __tablename__ = "links"
    id = Column(Integer, primary_key=True, index=True)
    source_page_id = Column(Integer, ForeignKey("pages.id", ondelete="CASCADE"), nullable=False, index=True)
    target_page_id = Column(Integer, ForeignKey("pages.id", ondelete="CASCADE"), nullable=True, index=True)
    source_url = Column(String, nullable=False)
    target_url = Column(String, nullable=False, index=True)
    link_text = Column(String, nullable=True)
    link_type = Column(SAEnum(LinkType), nullable=False)
    anchor_text = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


try:
    Base.metadata.create_all(bind=engine)
except Exception:
    # Tablolar zaten varsa veya DB henüz erişilebilir değilse sessizce geç;
    # her istekte tekrar denenir.
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# URL yardımcıları (tldextract olmadan, saf stdlib)
# --------------------------------------------------------------------------- #
def normalize_url(url: str, base_url: Optional[str] = None) -> str:
    if base_url:
        url = urljoin(base_url, url)
    parsed = urlparse(url)
    query_parts = []
    if parsed.query:
        query_dict = parse_qs(parsed.query, keep_blank_values=False)
        for k, v in sorted(query_dict.items()):
            query_parts.append(f"{k}={v[0]}" if len(v) == 1 else f"{k}={','.join(v)}")
    normalized_query = "&".join(query_parts)
    return urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower(),
        parsed.path.rstrip("/") or "/",
        parsed.params,
        normalized_query,
        "",
    ))


def registrable_domain(url: str) -> str:
    """Public suffix listesi olmadan basit kayıtlı-alan tahmini (son iki etiket)."""
    host = urlparse(url).netloc.lower().split(":")[0]
    labels = host.split(".")
    if len(labels) <= 2:
        return host
    return ".".join(labels[-2:])


def is_same_domain(url1: str, url2: str) -> bool:
    return registrable_domain(url1) == registrable_domain(url2)


def is_valid_url(url: str) -> bool:
    try:
        r = urlparse(url)
        return bool(r.scheme in ("http", "https") and r.netloc)
    except Exception:
        return False


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def _job_dict(job: CrawlJob) -> dict:
    return {
        "id": job.id,
        "base_url": job.base_url,
        "status": job.status.value,
        "max_depth": job.max_depth,
        "max_pages": job.max_pages,
        "pages_crawled": job.pages_crawled or 0,
        "pages_failed": job.pages_failed or 0,
        "created_at": _iso(job.created_at) or datetime.utcnow().isoformat(),
        "started_at": _iso(job.started_at),
        "completed_at": _iso(job.completed_at),
        "settings": job.settings,
    }


def _status_dict(job: CrawlJob) -> dict:
    total = (job.pages_crawled or 0) + (job.pages_failed or 0)
    progress = (job.pages_crawled / job.max_pages * 100) if job.max_pages else 0
    return {
        "job_id": job.id,
        "status": job.status.value,
        "pages_crawled": job.pages_crawled or 0,
        "pages_failed": job.pages_failed or 0,
        "total_pages": total,
        "progress": min(progress, 100.0),
    }


# --------------------------------------------------------------------------- #
# Step crawler
# --------------------------------------------------------------------------- #
STEP_TIME_BUDGET = float(os.environ.get("STEP_TIME_BUDGET", "12"))   # saniye
STEP_MAX_PAGES = int(os.environ.get("STEP_MAX_PAGES", "6"))          # adım başına sayfa


def _setting(job: CrawlJob, key: str, default):
    value = (job.settings or {}).get(key)
    return default if value is None else value


def _extract(html: str, page_url: str):
    """Başlık, açıklama ve linkleri çıkarır."""
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else None
    description = None
    tag = soup.find("meta", attrs={"name": "description"})
    if tag and tag.get("content"):
        description = tag["content"].strip()
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        links.append({"url": href, "text": (a.get_text() or "").strip()[:200]})
    return title, description, links


def _build_frontier(db, job: CrawlJob, visited: set) -> List[Dict]:
    """DB'deki linklerden henüz taranmamış iç URL'lerin sınırını (frontier) türetir."""
    base_norm = normalize_url(job.base_url)
    if not visited:
        return [{"url": base_norm, "depth": 0, "parent_url": None}]

    rows = (
        db.query(Link.target_url, Page.depth, Link.source_url)
        .join(Page, Link.source_page_id == Page.id)
        .filter(Page.crawl_job_id == job.id, Link.link_type == LinkType.INTERNAL)
        .all()
    )
    best: Dict[str, Dict] = {}
    for target_url, source_depth, source_url in rows:
        if target_url in visited:
            continue
        depth = (source_depth or 0) + 1
        if depth > job.max_depth:
            continue
        cur = best.get(target_url)
        if cur is None or depth < cur["depth"]:
            best[target_url] = {"url": target_url, "depth": depth, "parent_url": source_url}
    return sorted(best.values(), key=lambda x: x["depth"])


async def _crawl_one(client: httpx.AsyncClient, db, job: CrawlJob, item: Dict, site_type_holder: Dict):
    url = item["url"]
    depth = item["depth"]
    parent_url = item.get("parent_url")
    try:
        resp = await client.get(url)
    except Exception:
        job.pages_failed = (job.pages_failed or 0) + 1
        return

    content_type = (resp.headers.get("content-type") or "").lower()

    if resp.status_code >= 400:
        page = Page(
            crawl_job_id=job.id, url=url, depth=depth, status_code=resp.status_code,
            content_type=content_type, content_length=0, parent_url=parent_url,
            extra_metadata={"error": f"HTTP {resp.status_code}"},
        )
        db.add(page)
        job.pages_failed = (job.pages_failed or 0) + 1
        return

    if "text/html" not in content_type:
        # HTML olmayan içerik sayılmaz.
        return

    html = resp.text or ""
    if not html.strip():
        job.pages_failed = (job.pages_failed or 0) + 1
        return

    title, description, raw_links = _extract(html, url)

    save_html = bool(_setting(job, "save_html_content", True))
    page = Page(
        crawl_job_id=job.id,
        url=url,
        title=title,
        content=(BeautifulSoup(html, "html.parser").get_text(" ", strip=True)[:50000]) or None,
        html_content=(html[:100000] if save_html else None),
        meta_description=description,
        depth=depth,
        status_code=resp.status_code,
        content_type=content_type,
        content_length=len(html),
        parent_url=parent_url,
        extra_metadata={"title": title, "description": description},
        site_type=site_type_holder.get("type"),
    )
    db.add(page)
    db.flush()  # page.id gerekli
    job.pages_crawled = (job.pages_crawled or 0) + 1

    # Linkleri kaydet ve iç linkleri frontier için işaretle
    seen_targets = set()
    for ld in raw_links:
        link_url = normalize_url(ld["url"], url)
        if not is_valid_url(link_url) or link_url in seen_targets:
            continue
        seen_targets.add(link_url)
        internal = is_same_domain(link_url, job.base_url)
        db.add(Link(
            source_page_id=page.id,
            target_page_id=None,
            source_url=url,
            target_url=link_url,
            link_text=ld.get("text"),
            link_type=LinkType.INTERNAL if internal else LinkType.EXTERNAL,
            anchor_text=ld.get("text"),
        ))


async def run_step(db, job: CrawlJob) -> dict:
    """Bir crawl adımını çalıştırır: birkaç sayfayı işler, durumu döndürür."""
    if job.status in (JobStatus.PENDING,):
        job.status = JobStatus.RUNNING
        if not job.started_at:
            job.started_at = datetime.utcnow()
        db.commit()
        db.refresh(job)

    if job.status != JobStatus.RUNNING:
        return _status_dict(job)

    if (job.pages_crawled or 0) >= job.max_pages:
        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        db.commit()
        return _status_dict(job)

    visited = {u for (u,) in db.query(Page.url).filter(Page.crawl_job_id == job.id).all()}
    frontier = _build_frontier(db, job, visited)

    if not frontier:
        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        db.commit()
        return _status_dict(job)

    site_type_holder: Dict = {}
    request_delay = float(_setting(job, "request_delay", 0.2))
    timeout = int(_setting(job, "timeout", 20))
    user_agent = _setting(job, "user_agent", "CrawlScope/1.0 (+https://vercel.app)")
    follow_redirects = bool(_setting(job, "follow_redirects", True))

    processed = 0
    start = time.time()
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=follow_redirects,
        headers={"User-Agent": user_agent},
    ) as client:
        for item in frontier:
            if processed >= STEP_MAX_PAGES or (time.time() - start) > STEP_TIME_BUDGET:
                break
            if (job.pages_crawled or 0) >= job.max_pages:
                break
            if item["url"] in visited:
                continue
            visited.add(item["url"])
            await _crawl_one(client, db, job, item, site_type_holder)
            processed += 1
            if request_delay > 0:
                import asyncio
                await asyncio.sleep(min(request_delay, 1.0))

    db.commit()
    db.refresh(job)

    # Kalan var mı? Yoksa tamamla.
    remaining = _build_frontier(db, job, {u for (u,) in db.query(Page.url).filter(Page.crawl_job_id == job.id).all()})
    if not remaining or (job.pages_crawled or 0) >= job.max_pages:
        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        db.commit()

    return _status_dict(job)


# --------------------------------------------------------------------------- #
# FastAPI app
# --------------------------------------------------------------------------- #
app = FastAPI(title="CrawlScope Serverless API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CrawlerSettings(BaseModel):
    request_delay: Optional[float] = None
    timeout: Optional[int] = None
    concurrent_requests: Optional[int] = None
    user_agent: Optional[str] = None
    respect_robots_txt: Optional[bool] = None
    follow_redirects: Optional[bool] = None
    save_html_content: Optional[bool] = None
    extract_metadata: Optional[bool] = None


class CrawlJobCreate(BaseModel):
    base_url: str
    max_depth: Optional[int] = 10
    max_pages: Optional[int] = 10000
    settings: Optional[CrawlerSettings] = None


@app.get("/api/health")
@app.get(API_PREFIX + "/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post(API_PREFIX + "/crawl/start")
def start_crawl(job_data: CrawlJobCreate, db=Depends(get_db)):
    if not is_valid_url(job_data.base_url):
        raise HTTPException(status_code=400, detail="Geçersiz URL")
    job = CrawlJob(
        base_url=job_data.base_url,
        max_depth=job_data.max_depth or 10,
        max_pages=job_data.max_pages or 10000,
        status=JobStatus.PENDING,
        settings=job_data.settings.model_dump(exclude_none=True) if job_data.settings else None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_dict(job)


@app.post(API_PREFIX + "/crawl/{job_id}/step")
async def step_crawl(job_id: int, db=Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    try:
        return await run_step(db, job)
    except Exception as e:
        db.rollback()
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(e)[:500]
            db.commit()
            return _status_dict(job)
        raise HTTPException(status_code=500, detail=str(e))


@app.get(API_PREFIX + "/crawl/{job_id}")
def get_crawl_job(job_id: int, db=Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    return _job_dict(job)


@app.get(API_PREFIX + "/crawl/{job_id}/status")
def get_crawl_status(job_id: int, db=Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    return _status_dict(job)


@app.get(API_PREFIX + "/crawl/{job_id}/pages")
def get_crawl_pages(job_id: int, skip: int = 0, limit: int = 100, db=Depends(get_db)):
    pages = (
        db.query(Page).filter(Page.crawl_job_id == job_id)
        .order_by(Page.depth.asc(), Page.id.asc())
        .offset(skip).limit(limit).all()
    )
    return [
        {
            "id": p.id, "url": p.url, "title": p.title, "depth": p.depth,
            "status_code": p.status_code, "crawled_at": _iso(p.crawled_at) or datetime.utcnow().isoformat(),
            "parent_url": p.parent_url,
        }
        for p in pages
    ]


@app.get(API_PREFIX + "/crawl/{job_id}/tree")
def get_crawl_tree(job_id: int, db=Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")

    pages = db.query(Page).filter(Page.crawl_job_id == job_id).all()
    if not pages:
        return {
            "root": {"id": "0", "url": job.base_url, "title": None, "depth": 0,
                     "children": [], "has_article": False, "status_code": None},
            "total_nodes": 0, "max_depth": 0,
        }

    page_map = {str(p.id): p for p in pages}
    url_to_page = {p.url: p for p in pages}

    root_page = None
    base_norm = job.base_url.rstrip("/")
    for p in pages:
        if p.url.rstrip("/") == base_norm or p.depth == 0:
            root_page = p
            break
    if not root_page:
        root_page = pages[0]

    page_ids = [p.id for p in pages]
    links = db.query(Link).filter(Link.source_page_id.in_(page_ids)).all()
    children_map: Dict[str, List[str]] = {}
    for link in links:
        source_id = str(link.source_page_id)
        if link.target_page_id:
            target_id = str(link.target_page_id)
        elif link.target_url in url_to_page:
            target_id = str(url_to_page[link.target_url].id)
        else:
            continue
        children_map.setdefault(source_id, [])
        if target_id not in children_map[source_id]:
            children_map[source_id].append(target_id)

    def build(page_id: str, visited: set):
        if page_id in visited:
            return None
        visited.add(page_id)
        p = page_map.get(page_id)
        if not p:
            return None
        children = []
        for child_id in children_map.get(page_id, []):
            node = build(child_id, visited)
            if node:
                children.append(node)
        return {
            "id": str(p.id), "url": p.url, "title": p.title, "depth": p.depth,
            "children": children, "has_article": bool(p.title), "status_code": p.status_code,
        }

    root_node = build(str(root_page.id), set())
    return {
        "root": root_node,
        "total_nodes": len(pages),
        "max_depth": max((p.depth for p in pages), default=0),
    }


@app.post(API_PREFIX + "/crawl/{job_id}/pause")
def pause_crawl(job_id: int, db=Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    if job.status == JobStatus.RUNNING:
        job.status = JobStatus.PAUSED
        db.commit()
    return {"message": "Crawl duraklatıldı"}


@app.post(API_PREFIX + "/crawl/{job_id}/resume")
def resume_crawl(job_id: int, db=Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    if job.status == JobStatus.PAUSED:
        job.status = JobStatus.RUNNING
        db.commit()
    return {"message": "Crawl devam ediyor"}


@app.post(API_PREFIX + "/crawl/{job_id}/cancel")
def cancel_crawl(job_id: int, db=Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    job.status = JobStatus.CANCELLED
    db.commit()
    return {"message": "Crawl iptal edildi"}


def _delete_job(db, job: CrawlJob):
    pages = db.query(Page).filter(Page.crawl_job_id == job.id).all()
    page_ids = [p.id for p in pages]
    if page_ids:
        db.query(Link).filter(
            (Link.source_page_id.in_(page_ids)) | (Link.target_page_id.in_(page_ids))
        ).delete(synchronize_session=False)
        db.query(Page).filter(Page.crawl_job_id == job.id).delete(synchronize_session=False)
    db.delete(job)


@app.delete(API_PREFIX + "/crawl/{job_id}")
def delete_crawl(job_id: int, db=Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    _delete_job(db, job)
    db.commit()
    return {"message": "Crawl başarıyla silindi"}


@app.delete(API_PREFIX + "/jobs/all")
def delete_all_jobs(db=Depends(get_db)):
    jobs = db.query(CrawlJob).all()
    count = len(jobs)
    for job in jobs:
        _delete_job(db, job)
    db.commit()
    return {"message": f"{count} crawl başarıyla silindi", "deleted_count": count}


@app.get(API_PREFIX + "/jobs")
def list_jobs(skip: int = 0, limit: int = 20, db=Depends(get_db)):
    jobs = db.query(CrawlJob).order_by(CrawlJob.created_at.desc()).offset(skip).limit(limit).all()
    return [_job_dict(j) for j in jobs]


@app.get(API_PREFIX + "/analytics/summary")
def analytics_summary(db=Depends(get_db)):
    jobs = db.query(CrawlJob).all()
    total_jobs = len(jobs)
    total_pages = sum(j.pages_crawled or 0 for j in jobs)
    failed_pages = sum(j.pages_failed or 0 for j in jobs)
    processed = total_pages + failed_pages
    success_rate = round((total_pages / processed) * 100, 1) if processed else 0.0

    status_counts = {s.value: 0 for s in JobStatus}
    for j in jobs:
        status_counts[j.status.value] = status_counts.get(j.status.value, 0) + 1

    today = datetime.utcnow().date()
    daily = []
    for off in range(6, -1, -1):
        day = today - timedelta(days=off)
        day_jobs = [j for j in jobs if j.created_at and j.created_at.date() == day]
        daily.append({
            "date": day.isoformat(),
            "jobs": len(day_jobs),
            "pages": sum(j.pages_crawled or 0 for j in day_jobs),
            "failed_pages": sum(j.pages_failed or 0 for j in day_jobs),
        })

    return {
        "total_jobs": total_jobs,
        "running_jobs": status_counts.get("running", 0),
        "completed_jobs": status_counts.get("completed", 0),
        "failed_jobs": status_counts.get("failed", 0),
        "paused_jobs": status_counts.get("paused", 0),
        "cancelled_jobs": status_counts.get("cancelled", 0),
        "total_pages": total_pages,
        "failed_pages": failed_pages,
        "success_rate": success_rate,
        "average_pages_per_job": round(total_pages / total_jobs) if total_jobs else 0,
        "status_breakdown": [
            {"status": s, "count": c} for s, c in status_counts.items() if c > 0
        ],
        "daily_activity": daily,
    }


@app.get("/api/cron/keepalive")
@app.get(API_PREFIX + "/keepalive")
def keepalive(db=Depends(get_db)):
    """Supabase free-tier'ın hareketsizlikten askıya alınmasını önlemek için
    veritabanına küçük bir istek atar. Vercel Cron tarafından günlük tetiklenir."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "reachable", "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)[:200]}")


@app.get(API_PREFIX + "/settings")
def get_settings():
    engine_name = "postgres" if not DATABASE_URL.startswith("sqlite") else "sqlite"
    return {
        "api_base_path": API_PREFIX,
        "frontend_url": os.environ.get("PUBLIC_FRONTEND_URL", ""),
        "database_engine": engine_name,
        "deployment_target": os.environ.get("DEPLOYMENT_TARGET", "vercel"),
        "crawl_mode": "step",
        "crawler_defaults": {
            "request_delay": 0.2,
            "timeout": 20,
            "concurrent_requests": 1,
            "user_agent": "CrawlScope/1.0 (+https://vercel.app)",
            "respect_robots_txt": False,
            "follow_redirects": True,
            "save_html_content": True,
            "extract_metadata": True,
        },
    }
