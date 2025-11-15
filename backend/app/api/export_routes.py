from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Set
from pydantic import BaseModel
import io
import json
import csv
import pandas as pd
from datetime import datetime

from app.database.connection import SessionLocal
from app.models.crawl_job import CrawlJob
from app.models.page import Page
from app.models.link import Link

router = APIRouter()


class ExportConfig(BaseModel):
    """Export konfigürasyon modeli"""
    include_fields: Optional[List[str]] = None  # Hangi alanlar dahil edilecek
    exclude_fields: Optional[List[str]] = None  # Hangi alanlar hariç tutulacak
    max_content_length: Optional[int] = None  # İçerik için maksimum karakter
    max_html_length: Optional[int] = None  # HTML için maksimum karakter
    include_html: bool = False
    include_content: bool = True
    include_links: bool = True
    include_metadata: bool = True
    format: str = "json"  # json, csv, excel


class BulkExportRequest(BaseModel):
    """Toplu export request modeli"""
    job_ids: List[int]
    include_fields: Optional[List[str]] = None
    exclude_fields: Optional[List[str]] = None
    max_content_length: Optional[int] = None
    max_html_length: Optional[int] = None
    include_html: bool = False
    include_content: bool = True
    include_links: bool = True
    include_metadata: bool = True
    format: str = "json"


def truncate_text(text: Optional[str], max_length: Optional[int]) -> Optional[str]:
    """Metni belirtilen uzunluğa kısaltır"""
    if not text or not max_length:
        return text
    if len(text) <= max_length:
        return text
    return text[:max_length] + "... [KESILDI]"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/crawl/{job_id}/export/advanced")
async def export_advanced(
    job_id: int,
    config: ExportConfig = Body(...),
    db: Session = Depends(get_db)
):
    """Gelişmiş export - konfigürasyon ile"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    pages = db.query(Page).filter(Page.crawl_job_id == job_id).all()
    
    # Varsayılan alanlar
    default_fields = {
        "id", "url", "title", "depth", "status_code", "content_type",
        "content_length", "crawled_at", "parent_url", "meta_description",
        "meta_keywords"
    }
    
    # Hangi alanlar dahil edilecek?
    if config.include_fields:
        allowed_fields = set(config.include_fields)
    else:
        allowed_fields = default_fields.copy()
        if config.include_html:
            allowed_fields.add("html_content")
        if config.include_content:
            allowed_fields.add("content")
        if config.include_metadata and hasattr(Page, 'extra_metadata'):
            allowed_fields.add("extra_metadata")
    
    # Hariç tutulacak alanlar
    if config.exclude_fields:
        allowed_fields -= set(config.exclude_fields)
    
    # Sayfa verilerini hazırla
    pages_data = []
    for page in pages:
        page_data = {}
        
        if "id" in allowed_fields:
            page_data["id"] = page.id
        if "url" in allowed_fields:
            page_data["url"] = page.url
        if "title" in allowed_fields:
            page_data["title"] = page.title
        if "depth" in allowed_fields:
            page_data["depth"] = page.depth
        if "status_code" in allowed_fields:
            page_data["status_code"] = page.status_code
        if "content_type" in allowed_fields:
            page_data["content_type"] = page.content_type
        if "content_length" in allowed_fields:
            page_data["content_length"] = page.content_length
        if "crawled_at" in allowed_fields:
            page_data["crawled_at"] = page.crawled_at.isoformat() if page.crawled_at else None
        if "parent_url" in allowed_fields:
            page_data["parent_url"] = page.parent_url
        if "meta_description" in allowed_fields:
            page_data["meta_description"] = truncate_text(page.meta_description, config.max_content_length)
        if "meta_keywords" in allowed_fields:
            page_data["meta_keywords"] = truncate_text(page.meta_keywords, config.max_content_length)
        if "html_content" in allowed_fields and config.include_html:
            page_data["html_content"] = truncate_text(page.html_content, config.max_html_length)
        if "content" in allowed_fields and config.include_content:
            page_data["content"] = truncate_text(page.content, config.max_content_length)
        if "extra_metadata" in allowed_fields and hasattr(page, 'extra_metadata'):
            page_data["extra_metadata"] = page.extra_metadata
        
        pages_data.append(page_data)
    
    # Link verileri
    links_data = []
    if config.include_links:
        page_ids = [p.id for p in pages]
        links = db.query(Link).filter(Link.source_page_id.in_(page_ids)).all()
        for link in links:
            links_data.append({
                "id": link.id,
                "source_url": link.source_url,
                "target_url": link.target_url,
                "link_text": link.link_text,
                "link_type": link.link_type.value,
                "anchor_text": link.anchor_text
            })
    
    # Ana veri yapısı
    data = {
        "job": {
            "id": job.id,
            "base_url": job.base_url,
            "status": job.status.value,
            "pages_crawled": job.pages_crawled,
            "pages_failed": job.pages_failed,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        },
        "pages": pages_data
    }
    
    if config.include_links:
        data["links"] = links_data
    
    # Format'a göre döndür
    if config.format == "json":
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        return StreamingResponse(
            io.BytesIO(json_str.encode('utf-8')),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=crawl_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            }
        )
    elif config.format == "csv":
        # CSV için sayfaları düzleştir
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        headers = list(allowed_fields)
        if config.include_links:
            headers.extend(["links_count"])
        writer.writerow(headers)
        
        # Data
        for page_data in pages_data:
            row = [page_data.get(field, "") for field in headers if field != "links_count"]
            if config.include_links:
                link_count = sum(1 for link in links_data if link["source_url"] == page_data.get("url", ""))
                row.append(link_count)
            writer.writerow(row)
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=crawl_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    elif config.format == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Job bilgileri
            job_df = pd.DataFrame([data["job"]])
            job_df.to_excel(writer, sheet_name='Job Bilgisi', index=False)
            
            # Sayfalar
            if pages_data:
                pages_df = pd.DataFrame(pages_data)
                pages_df.to_excel(writer, sheet_name='Sayfalar', index=False)
            
            # Linkler
            if links_data:
                links_df = pd.DataFrame(links_data)
                links_df.to_excel(writer, sheet_name='Linkler', index=False)
        
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=crawl_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            }
        )
    else:
        raise HTTPException(status_code=400, detail="Geçersiz format. json, csv veya excel kullanın.")


@router.post("/crawl/bulk-export")
async def bulk_export(
    request: BulkExportRequest,
    db: Session = Depends(get_db)
):
    """Toplu export - birden fazla crawl'ı birlikte indirir"""
    jobs = db.query(CrawlJob).filter(CrawlJob.id.in_(request.job_ids)).all()
    if len(jobs) != len(request.job_ids):
        raise HTTPException(status_code=404, detail="Bazı job'lar bulunamadı")
    
    all_data = {
        "exported_at": datetime.now().isoformat(),
        "total_jobs": len(jobs),
        "jobs": []
    }
    
    # Config'i ExportConfig formatına çevir
    config = ExportConfig(
        include_fields=request.include_fields,
        exclude_fields=request.exclude_fields,
        max_content_length=request.max_content_length,
        max_html_length=request.max_html_length,
        include_html=request.include_html,
        include_content=request.include_content,
        include_links=request.include_links,
        include_metadata=request.include_metadata,
        format=request.format
    )
    
    for job in jobs:
        pages = db.query(Page).filter(Page.crawl_job_id == job.id).all()
        
        # Aynı export mantığı
        default_fields = {
            "id", "url", "title", "depth", "status_code", "content_type",
            "content_length", "crawled_at", "parent_url", "meta_description",
            "meta_keywords"
        }
        
        if config.include_fields:
            allowed_fields = set(config.include_fields)
        else:
            allowed_fields = default_fields.copy()
            if config.include_html:
                allowed_fields.add("html_content")
            if config.include_content:
                allowed_fields.add("content")
        
        if config.exclude_fields:
            allowed_fields -= set(config.exclude_fields)
        
        pages_data = []
        for page in pages:
            page_data = {}
            if "id" in allowed_fields:
                page_data["id"] = page.id
            if "url" in allowed_fields:
                page_data["url"] = page.url
            if "title" in allowed_fields:
                page_data["title"] = page.title
            if "depth" in allowed_fields:
                page_data["depth"] = page.depth
            if "status_code" in allowed_fields:
                page_data["status_code"] = page.status_code
            if "content_type" in allowed_fields:
                page_data["content_type"] = page.content_type
            if "content_length" in allowed_fields:
                page_data["content_length"] = page.content_length
            if "crawled_at" in allowed_fields:
                page_data["crawled_at"] = page.crawled_at.isoformat() if page.crawled_at else None
            if "parent_url" in allowed_fields:
                page_data["parent_url"] = page.parent_url
            if "meta_description" in allowed_fields:
                page_data["meta_description"] = truncate_text(page.meta_description, config.max_content_length)
            if "meta_keywords" in allowed_fields:
                page_data["meta_keywords"] = truncate_text(page.meta_keywords, config.max_content_length)
            if "html_content" in allowed_fields and config.include_html:
                page_data["html_content"] = truncate_text(page.html_content, config.max_html_length)
            if "content" in allowed_fields and config.include_content:
                page_data["content"] = truncate_text(page.content, config.max_content_length)
            
            pages_data.append(page_data)
        
        all_data["jobs"].append({
            "job": {
                "id": job.id,
                "base_url": job.base_url,
                "status": job.status.value,
                "pages_crawled": job.pages_crawled,
                "pages_failed": job.pages_failed,
            },
            "pages": pages_data
        })
    
    # Format'a göre döndür
    if config.format == "json":
        json_str = json.dumps(all_data, ensure_ascii=False, indent=2)
        return StreamingResponse(
            io.BytesIO(json_str.encode('utf-8')),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=bulk_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            }
        )
    else:
        raise HTTPException(status_code=400, detail="Toplu export şu anda sadece JSON formatını destekliyor")


@router.get("/crawl/{job_id}/export/json")
async def export_json(
    job_id: int,
    include_html: bool = False,
    db: Session = Depends(get_db)
):
    """Crawl verilerini JSON formatında indirir (eski endpoint - uyumluluk için)"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    pages = db.query(Page).filter(Page.crawl_job_id == job_id).all()
    
    # Veriyi hazırla
    data = {
        "job": {
            "id": job.id,
            "base_url": job.base_url,
            "status": job.status.value,
            "pages_crawled": job.pages_crawled,
            "pages_failed": job.pages_failed,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        },
        "pages": []
    }
    
    for page in pages:
        page_data = {
            "id": page.id,
            "url": page.url,
            "title": page.title,
            "depth": page.depth,
            "status_code": page.status_code,
            "content_type": page.content_type,
            "content_length": page.content_length,
            "crawled_at": page.crawled_at.isoformat(),
            "parent_url": page.parent_url,
            "meta_description": page.meta_description,
            "meta_keywords": page.meta_keywords,
        }
        
        if include_html:
            page_data["html_content"] = page.html_content
            page_data["content"] = page.content
        
        data["pages"].append(page_data)
    
    # JSON olarak döndür
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    
    return StreamingResponse(
        io.BytesIO(json_str.encode('utf-8')),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=crawl_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )


@router.get("/crawl/{job_id}/export/csv")
async def export_csv(job_id: int, db: Session = Depends(get_db)):
    """Crawl verilerini CSV formatında indirir"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    pages = db.query(Page).filter(Page.crawl_job_id == job_id).all()
    
    # CSV oluştur
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "URL", "Başlık", "Derinlik", "Status Kodu", 
        "İçerik Tipi", "İçerik Uzunluğu", "Tarih", "Parent URL",
        "Meta Description", "Meta Keywords"
    ])
    
    # Data
    for page in pages:
        writer.writerow([
            page.id,
            page.url,
            page.title or "",
            page.depth,
            page.status_code or "",
            page.content_type or "",
            page.content_length or 0,
            page.crawled_at.isoformat(),
            page.parent_url or "",
            page.meta_description or "",
            page.meta_keywords or ""
        ])
    
    # Byte'a çevir
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),  # BOM ekle Türkçe karakterler için
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=crawl_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/crawl/{job_id}/export/excel")
async def export_excel(job_id: int, db: Session = Depends(get_db)):
    """Crawl verilerini Excel formatında indirir"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    pages = db.query(Page).filter(Page.crawl_job_id == job_id).all()
    links = db.query(Link).filter(
        Link.source_page_id.in_([p.id for p in pages])
    ).all()
    
    # Excel dosyası oluştur
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Job bilgileri
        job_df = pd.DataFrame([{
            "ID": job.id,
            "Base URL": job.base_url,
            "Status": job.status.value,
            "Çekilen Sayfa": job.pages_crawled,
            "Başarısız": job.pages_failed,
            "Max Derinlik": job.max_depth,
            "Max Sayfa": job.max_pages,
            "Oluşturma": job.created_at.isoformat() if job.created_at else None,
            "Başlatma": job.started_at.isoformat() if job.started_at else None,
            "Tamamlanma": job.completed_at.isoformat() if job.completed_at else None,
        }])
        job_df.to_excel(writer, sheet_name='Job Bilgisi', index=False)
        
        # Sayfa bilgileri
        pages_data = []
        for page in pages:
            pages_data.append({
                "ID": page.id,
                "URL": page.url,
                "Başlık": page.title or "",
                "Derinlik": page.depth,
                "Status Kodu": page.status_code or "",
                "İçerik Tipi": page.content_type or "",
                "İçerik Uzunluğu": page.content_length or 0,
                "Tarih": page.crawled_at.isoformat() if page.crawled_at else None,
                "Parent URL": page.parent_url or "",
                "Meta Description": page.meta_description or "",
                "Meta Keywords": page.meta_keywords or ""
            })
        
        pages_df = pd.DataFrame(pages_data)
        pages_df.to_excel(writer, sheet_name='Sayfalar', index=False)
        
        # Link bilgileri
        links_data = []
        for link in links:
            links_data.append({
                "ID": link.id,
                "Source URL": link.source_url,
                "Target URL": link.target_url,
                "Link Metni": link.link_text or "",
                "Tip": link.link_type.value,
                "Anchor": link.anchor_text or ""
            })
        
        links_df = pd.DataFrame(links_data)
        links_df.to_excel(writer, sheet_name='Linkler', index=False)
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=crawl_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        }
    )


@router.get("/crawl/{job_id}/export/links-json")
async def export_links_json(job_id: int, db: Session = Depends(get_db)):
    """Sadece linkleri JSON formatında indirir"""
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    
    pages = db.query(Page).filter(Page.crawl_job_id == job_id).all()
    page_ids = [p.id for p in pages]
    links = db.query(Link).filter(Link.source_page_id.in_(page_ids)).all()
    
    data = {
        "job_id": job_id,
        "base_url": job.base_url,
        "links": [
            {
                "id": link.id,
                "source_url": link.source_url,
                "target_url": link.target_url,
                "link_text": link.link_text,
                "link_type": link.link_type.value,
                "anchor_text": link.anchor_text
            }
            for link in links
        ]
    }
    
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    
    return StreamingResponse(
        io.BytesIO(json_str.encode('utf-8')),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=links_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )


@router.get("/jobs/export/summary")
async def export_all_jobs_summary(db: Session = Depends(get_db)):
    """Tüm job'ların özetini CSV olarak indirir"""
    jobs = db.query(CrawlJob).order_by(CrawlJob.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "Base URL", "Status", "Çekilen Sayfa", "Başarısız", 
        "Max Derinlik", "Max Sayfa", "Oluşturma", "Başlatma", "Tamamlanma"
    ])
    
    # Data
    for job in jobs:
        writer.writerow([
            job.id,
            job.base_url,
            job.status.value,
            job.pages_crawled,
            job.pages_failed,
            job.max_depth,
            job.max_pages,
            job.created_at.isoformat() if job.created_at else "",
            job.started_at.isoformat() if job.started_at else "",
            job.completed_at.isoformat() if job.completed_at else ""
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=all_jobs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )

