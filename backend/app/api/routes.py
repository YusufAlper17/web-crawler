from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import asyncio
import logging

from app.database.connection import SessionLocal
from app.models.crawl_job import CrawlJob, JobStatus
from app.models.page import Page
from app.models.link import Link
from app.api.schemas import (
    CrawlJobCreate, CrawlJobResponse, PageResponse, 
    LinkResponse, TreeResponse, TreeNode, CrawlStatusResponse
)
from app.crawler.engine import CrawlerEngine
from app.utils.url_normalizer import is_valid_url

router = APIRouter()
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/crawl/start", response_model=CrawlJobResponse)
async def start_crawl(
    job_data: CrawlJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Yeni bir crawl job'ı başlatır"""
    if not is_valid_url(job_data.base_url):
        raise HTTPException(status_code=400, detail="Geçersiz URL")
    
    # Job oluştur
    job = CrawlJob(
        base_url=job_data.base_url,
        max_depth=job_data.max_depth or 10,
        max_pages=job_data.max_pages or 10000,
        status=JobStatus.PENDING
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Background task olarak crawl başlat
    background_tasks.add_task(run_crawler, job.id)
    
    logger.info(f"✅ Crawl job başlatıldı: {job.id} - {job.base_url}")
    
    return job


async def run_crawler(job_id: int):
    """Crawler'ı çalıştırır"""
    try:
        logger.info(f"🕷️ Crawler başlatılıyor: Job {job_id}")
        engine = CrawlerEngine(job_id)
        await engine.start()
        logger.info(f"✅ Crawler tamamlandı: Job {job_id}")
    except Exception as e:
        logger.error(f"❌ Crawler hatası (Job {job_id}): {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Hata durumunda job'u failed olarak işaretle
        db = SessionLocal()
        try:
            job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(e)
                db.commit()
        finally:
            db.close()


@router.get("/crawl/{job_id}", response_model=CrawlJobResponse)
def get_crawl_job(job_id: int, db: Session = Depends(get_db)):
    """Crawl job detaylarını getirir"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    return job


@router.get("/crawl/{job_id}/status", response_model=CrawlStatusResponse)
def get_crawl_status(job_id: int, db: Session = Depends(get_db)):
    """Crawl job durumunu getirir"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    total_pages = job.pages_crawled + job.pages_failed
    progress = (job.pages_crawled / job.max_pages * 100) if job.max_pages > 0 else 0
    
    return CrawlStatusResponse(
        job_id=job.id,
        status=job.status.value,
        pages_crawled=job.pages_crawled,
        pages_failed=job.pages_failed,
        total_pages=total_pages,
        progress=min(progress, 100.0)
    )


@router.get("/crawl/{job_id}/pages", response_model=List[PageResponse])
def get_crawl_pages(
    job_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Crawl job'ın sayfalarını getirir"""
    pages = db.query(Page).filter(
        Page.crawl_job_id == job_id
    ).offset(skip).limit(limit).all()
    return pages


@router.get("/crawl/{job_id}/tree", response_model=TreeResponse)
def get_crawl_tree(job_id: int, db: Session = Depends(get_db)):
    """Crawl job'ın link ağacını getirir"""
    # Job'u kontrol et
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    # Tüm sayfaları al
    pages = db.query(Page).filter(Page.crawl_job_id == job_id).all()
    if not pages:
        # Eğer henüz sayfa yoksa boş bir root node döndür
        return TreeResponse(
            root=TreeNode(
                id="0",
                url=job.base_url,
                title=None,
                depth=0,
                children=[],
                has_article=False,
                status_code=None
            ),
            total_nodes=0,
            max_depth=0
        )
    
    # ID'den sayfaya mapping
    page_map = {str(page.id): page for page in pages}
    url_to_page = {page.url: page for page in pages}
    
    # Root sayfayı bul
    root_page = None
    base_url_normalized = job.base_url.rstrip('/')
    for page in pages:
        page_url_normalized = page.url.rstrip('/')
        if page_url_normalized == base_url_normalized or page.depth == 0:
            root_page = page
            break
    
    if not root_page:
        root_page = pages[0]
    
    # Linkleri al - source_page_id ve target_page_id kullanarak
    page_ids = [p.id for p in pages]
    links = db.query(Link).filter(Link.source_page_id.in_(page_ids)).all()
    
    # Parent-child ilişkilerini oluştur
    children_map = {}
    for link in links:
        source_id = str(link.source_page_id)
        
        # Target page varsa onu kullan, yoksa target_url'den bul
        if link.target_page_id:
            target_id = str(link.target_page_id)
        elif link.target_url in url_to_page:
            target_id = str(url_to_page[link.target_url].id)
        else:
            continue  # Target page henüz crawl edilmemiş
        
        if source_id not in children_map:
            children_map[source_id] = []
        if target_id not in children_map[source_id]:
            children_map[source_id].append(target_id)
    
    # Tree oluştur
    def build_tree(page_id: str, visited: set) -> TreeNode:
        if page_id in visited:
            return None
        visited.add(page_id)
        
        page = page_map.get(page_id)
        if not page:
            return None
        
        children = []
        if page_id in children_map:
            for child_id in children_map[page_id]:
                child_node = build_tree(child_id, visited)
                if child_node:
                    children.append(child_node)
        
        return TreeNode(
            id=str(page.id),
            url=page.url,
            title=page.title,
            depth=page.depth,
            children=children,
            has_article=bool(page.title),
            status_code=page.status_code
        )
    
    root_node = build_tree(str(root_page.id), set())
    if not root_node:
        raise HTTPException(status_code=500, detail="Ağaç oluşturulamadı")
    
    max_depth = max((p.depth for p in pages), default=0)
    
    return TreeResponse(
        root=root_node,
        total_nodes=len(pages),
        max_depth=max_depth
    )


@router.get("/crawl/{job_id}/links", response_model=List[LinkResponse])
def get_crawl_links(
    job_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Crawl job'ın linklerini getirir"""
    # Job'un sayfalarını al
    pages = db.query(Page.id).filter(Page.crawl_job_id == job_id).all()
    page_ids = [p.id for p in pages]
    
    if not page_ids:
        return []
    
    links = db.query(Link).filter(
        Link.source_page_id.in_(page_ids)
    ).offset(skip).limit(limit).all()
    
    return links


@router.post("/crawl/{job_id}/pause")
def pause_crawl(job_id: int, db: Session = Depends(get_db)):
    """Crawl job'ı duraklatır"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    if job.status == JobStatus.RUNNING:
        logger.info(f"⏸️ Pause isteği alındı: Job {job_id} (önceki: {job.status.value})")
        job.status = JobStatus.PAUSED
        db.commit()
        logger.info(f"⏹️ Job {job_id} duraklatıldı (yeni: {job.status.value})")
    else:
        logger.info(f"ℹ️ Pause atlandı: Job {job_id} hali hazırda {job.status.value}")
    
    return {"message": "Crawl duraklatıldı"}


@router.post("/crawl/{job_id}/resume")
async def resume_crawl(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Crawl job'ı devam ettirir"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    if job.status == JobStatus.PAUSED:
        logger.info(f"▶️ Resume isteği alındı: Job {job_id} (önceki: {job.status.value})")
        job.status = JobStatus.RUNNING
        db.commit()
        # Background task olarak crawl başlat
        background_tasks.add_task(run_crawler, job.id)
        logger.info(f"▶️ Crawl devam ediyor: Job {job_id}")
    else:
        logger.info(f"ℹ️ Resume atlandı: Job {job_id} hali hazırda {job.status.value}")
    
    return {"message": "Crawl devam ediyor"}


@router.post("/crawl/{job_id}/cancel")
def cancel_crawl(job_id: int, db: Session = Depends(get_db)):
    """Crawl job'ı iptal eder"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    logger.info(f"🛑 Cancel isteği alındı: Job {job_id} (önceki: {job.status.value})")
    job.status = JobStatus.CANCELLED
    db.commit()
    logger.info(f"🛑 Job {job_id} iptal edildi (yeni: {job.status.value})")
    
    return {"message": "Crawl iptal edildi"}


@router.delete("/crawl/{job_id}")
def delete_crawl(job_id: int, db: Session = Depends(get_db)):
    """Crawl job'ı ve ilişkili verileri siler"""
    try:
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job bulunamadı")
        
        # SQLite'da foreign key desteğini aç
        db.execute(text("PRAGMA foreign_keys = ON"))
        
        # Önce linkleri sil (sayfa silinmeden önce)
        pages = db.query(Page).filter(Page.crawl_job_id == job_id).all()
        page_ids = [page.id for page in pages]
        
        if page_ids:
            # Bu sayfalara ait tüm linkleri sil
            db.query(Link).filter(
                (Link.source_page_id.in_(page_ids)) | (Link.target_page_id.in_(page_ids))
            ).delete(synchronize_session=False)
        
        # Sonra sayfaları sil
        if pages:
            db.query(Page).filter(Page.crawl_job_id == job_id).delete(synchronize_session=False)
        
        # En son job'u sil
        db.delete(job)
        db.commit()
        
        logger.info(f"🗑️ Job {job_id} ve ilişkili veriler silindi")
        return {"message": "Crawl başarıyla silindi"}
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Crawl silme hatası (Job {job_id}): {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Silme işlemi başarısız: {str(e)}")


@router.get("/jobs", response_model=List[CrawlJobResponse])
def list_jobs(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    """Tüm crawl job'ları listeler"""
    jobs = db.query(CrawlJob).order_by(CrawlJob.created_at.desc()).offset(skip).limit(limit).all()
    return jobs


@router.delete("/jobs/all")
def delete_all_jobs(db: Session = Depends(get_db)):
    """Tüm crawl job'ları ve ilişkili verileri siler"""
    try:
        # SQLite'da foreign key desteğini aç
        db.execute(text("PRAGMA foreign_keys = ON"))
        
        # Tüm job'ları al
        jobs = db.query(CrawlJob).all()
        deleted_count = len(jobs)
        
        if deleted_count == 0:
            return {"message": "Silinecek crawl job bulunamadı", "deleted_count": 0}
        
        # Tüm job ID'lerini al
        job_ids = [job.id for job in jobs]
        
        # Önce tüm linkleri sil
        all_pages = db.query(Page).filter(Page.crawl_job_id.in_(job_ids)).all()
        if all_pages:
            page_ids = [page.id for page in all_pages]
            db.query(Link).filter(
                (Link.source_page_id.in_(page_ids)) | (Link.target_page_id.in_(page_ids))
            ).delete(synchronize_session=False)
        
        # Sonra tüm sayfaları sil
        if all_pages:
            db.query(Page).filter(Page.crawl_job_id.in_(job_ids)).delete(synchronize_session=False)
        
        # En son tüm job'ları sil
        db.query(CrawlJob).delete(synchronize_session=False)
        
        db.commit()
        logger.info(f"🗑️ {deleted_count} job silindi")
        return {"message": f"{deleted_count} crawl job başarıyla silindi", "deleted_count": deleted_count}
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Tüm job'ları silme hatası: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Silme işlemi başarısız: {str(e)}")

