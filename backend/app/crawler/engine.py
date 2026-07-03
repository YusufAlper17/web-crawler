import asyncio
import httpx
from typing import Set, Dict, Optional, List
from urllib.parse import urlparse
from datetime import datetime
import time
import logging
from sqlalchemy.exc import IntegrityError

from app.database.connection import SessionLocal
from app.models.crawl_job import CrawlJob, JobStatus
from app.models.page import Page
from app.models.link import Link, LinkType
from app.utils.url_normalizer import normalize_url, get_base_domain, is_same_domain, is_valid_url
from app.utils.robots_checker import RobotsChecker
from app.utils.content_extractor import ContentExtractor
from app.utils.site_analyzer import SiteAnalyzer
from app.config import settings

logger = logging.getLogger(__name__)


class CrawlerEngine:
    def __init__(self, job_id: int):
        self.job_id = job_id
        self.visited_urls: Set[str] = set()
        self.url_queue: List[Dict] = []  # {url, depth, parent_url}
        self.robots_checker = RobotsChecker()
        self.content_extractor = ContentExtractor()
        self.site_analyzer = SiteAnalyzer()
        self.base_domain: Optional[str] = None
        self.site_type: Optional[str] = None
        self.job_settings: Dict = {}
        self.semaphore = asyncio.Semaphore(settings.CONCURRENT_REQUESTS)
        self.last_request_time: Dict[str, float] = {}

    def _setting(self, key: str, default):
        value = self.job_settings.get(key)
        return default if value is None else value
        
    async def start(self):
        """Crawling işlemini başlatır"""
        db = SessionLocal()
        base_url_normalized = None
        try:
            job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
            if not job:
                raise ValueError(f"Job {self.job_id} bulunamadı")
            
            job.status = JobStatus.RUNNING
            job.started_at = datetime.utcnow()
            self.job_settings = job.settings or {}
            concurrent_requests = int(self._setting("concurrent_requests", settings.CONCURRENT_REQUESTS))
            self.semaphore = asyncio.Semaphore(max(1, min(concurrent_requests, 50)))
            db.commit()
            
            self.base_domain = get_base_domain(job.base_url)
            base_url_normalized = normalize_url(job.base_url)
            
            logger.info(f"🕷️ Job {self.job_id} başlatılıyor: {base_url_normalized}")
            
            # İlk URL'yi queue'ya ekle
            self.url_queue.append({
                'url': base_url_normalized,
                'depth': 0,
                'parent_url': None
            })
            
        except Exception as e:
            logger.error(f"❌ Crawler start hatası (Job {self.job_id}): {e}")
            import traceback
            logger.error(traceback.format_exc())
            # Hata durumunda job'u failed olarak işaretle
            try:
                job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                if job:
                    job.status = JobStatus.FAILED
                    job.error_message = str(e)
                    db.commit()
            except Exception:
                pass
        finally:
            db.close()
        
        # Crawling başlat (database session kapandıktan sonra)
        if base_url_normalized:
            try:
                await self._crawl_loop()
            except Exception as e:
                logger.error(f"❌ Crawl loop hatası (Job {self.job_id}): {e}")
                import traceback
                logger.error(traceback.format_exc())
                # Hata durumunda job'u failed olarak işaretle
                db = SessionLocal()
                try:
                    job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                    if job:
                        job.status = JobStatus.FAILED
                        job.error_message = str(e)
                        db.commit()
                finally:
                    db.close()
    
    async def _crawl_loop(self):
        """Ana crawling döngüsü"""
        logger.info(f"🔄 Crawl loop başlatıldı: Job {self.job_id}, Queue size: {len(self.url_queue)}")
        
        while True:
            # Job durumunu kontrol et
            db = SessionLocal()
            try:
                job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                if not job:
                    logger.warning(f"⚠️ Job {self.job_id} bulunamadı, loop sonlandırılıyor")
                    break
                
                # Paused veya cancelled durumunda bekle
                if job.status == JobStatus.PAUSED:
                    db.close()
                    await asyncio.sleep(1)  # 1 saniye bekle ve tekrar kontrol et
                    continue
                
                if job.status == JobStatus.CANCELLED:
                    logger.info(f"🛑 Job {self.job_id} iptal edildi")
                    break
                
                if job.status != JobStatus.RUNNING:
                    logger.info(f"ℹ️ Job {self.job_id} durumu: {job.status}, loop sonlandırılıyor")
                    break
                
                # Queue boşsa ve sayfa limitine ulaşıldıysa bitir
                if not self.url_queue:
                    logger.info(f"✅ Queue boş, crawl tamamlandı. Çekilen: {job.pages_crawled}, Başarısız: {job.pages_failed}")
                    break
                
                if job.pages_crawled >= job.max_pages:
                    logger.info(f"📊 Maksimum sayfa limitine ulaşıldı: {job.pages_crawled}/{job.max_pages}")
                    break
                
            finally:
                db.close()
            
            # Queue'dan URL al
            if not self.url_queue:
                logger.debug("Queue boş, bekleniyor...")
                await asyncio.sleep(0.5)
                continue
            
            url_data = self.url_queue.pop(0)
            url = url_data['url']
            depth = url_data['depth']
            parent_url = url_data.get('parent_url')
            
            # Zaten ziyaret edilmiş mi?
            if url in self.visited_urls:
                logger.debug(f"URL zaten ziyaret edilmiş: {url}")
                continue
            
            # Depth kontrolü
            db = SessionLocal()
            try:
                job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                if not job:
                    continue
                if depth > job.max_depth:
                    logger.debug(f"Derinlik limiti aşıldı: {depth} > {job.max_depth}")
                    continue
            finally:
                db.close()
            
            # Rate limiting
            await self._rate_limit(url)
            
            # Crawl et
            await self._crawl_page(url, depth, parent_url)
        
        # Job'u tamamla
        db = SessionLocal()
        try:
            job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
            if job and job.status == JobStatus.RUNNING:
                job.status = JobStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                db.commit()
        finally:
            db.close()
    
    async def _rate_limit(self, url: str):
        """Rate limiting uygular"""
        domain = get_base_domain(url)
        current_time = time.time()
        
        if domain in self.last_request_time:
            time_since_last = current_time - self.last_request_time[domain]
            request_delay = float(self._setting("request_delay", settings.REQUEST_DELAY))
            if time_since_last < request_delay:
                await asyncio.sleep(request_delay - time_since_last)
        
        self.last_request_time[domain] = time.time()
    
    async def _crawl_page(self, url: str, depth: int, parent_url: Optional[str]):
        """Tek bir sayfayı crawl eder"""
        async with self.semaphore:
            page_saved = False
            url_marked_visited = False
            
            try:
                user_agent = self._setting("user_agent", settings.USER_AGENT)
                respect_robots = bool(self._setting("respect_robots_txt", True))

                if respect_robots:
                    can_fetch = await self.robots_checker.can_fetch(url, user_agent)
                    if not can_fetch:
                        logger.debug(f"🚫 Robots.txt izin vermiyor: {url}")
                        self.visited_urls.add(url)
                        return
                
                # URL'yi ziyaret edildi olarak işaretle (HTTP isteğinden önce, tekrar denenmesini önlemek için)
                self.visited_urls.add(url)
                url_marked_visited = True
                
                logger.info(f"🕷️ Crawling: {url} (depth: {depth})")
                
                async with httpx.AsyncClient(
                    timeout=int(self._setting("timeout", settings.TIMEOUT)),
                    follow_redirects=bool(self._setting("follow_redirects", True)),
                    headers={'User-Agent': user_agent}
                ) as client:
                    response = await client.get(url)
                    
                    # HTTP hata kodlarını kontrol et
                    if response.status_code >= 400:
                        logger.warning(f"⚠️ HTTP hatası {response.status_code}: {url}")
                        # Hata durumunda sayfayı kaydet ama başarısız olarak işaretle
                        db = SessionLocal()
                        try:
                            job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                            if job and job.status == JobStatus.RUNNING:
                                # Hatalı sayfayı da kaydet (log için)
                                try:
                                    page = Page(
                                        crawl_job_id=self.job_id,
                                        url=url,
                                        title=None,
                                        content=None,
                                        html_content=None,
                                        depth=depth,
                                        status_code=response.status_code,
                                        content_type=response.headers.get('content-type'),
                                        content_length=0,
                                        parent_url=parent_url,
                                        extra_metadata={'error': f'HTTP {response.status_code}'}
                                    )
                                    db.add(page)
                                    db.flush()
                                    job.pages_failed += 1
                                    db.commit()
                                    page_saved = True
                                except Exception as e:
                                    db.rollback()
                                    logger.error(f"❌ Sayfa kaydetme hatası: {e}")
                                    job.pages_failed += 1
                                    db.commit()
                        finally:
                            db.close()
                        return
                    
                    # Sadece HTML içeriği işle
                    content_type = response.headers.get('content-type', '').lower()
                    if 'text/html' not in content_type:
                        logger.debug(f"📄 HTML değil, atlanıyor: {url} (content-type: {content_type})")
                        # HTML olmayan içerikler için sayfa sayma (bu normal bir durum)
                        return
                    
                    html = response.text
                    
                    # Boş içerik kontrolü
                    if not html or len(html.strip()) == 0:
                        logger.warning(f"⚠️ Boş içerik: {url}")
                        db = SessionLocal()
                        try:
                            job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                            if job and job.status == JobStatus.RUNNING:
                                job.pages_failed += 1
                                db.commit()
                        finally:
                            db.close()
                        return
                    
                    # Önce job'u al ve linkleri çıkar (sayfa kaydetmeden önce)
                    # Bu sayede sayfa kaydetme hatası olsa bile linkler keşfedilebilir
                    db = SessionLocal()
                    try:
                        job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                        if not job:
                            db.close()
                            return
                        
                        # Job durumunu kontrol et
                        if job.status != JobStatus.RUNNING:
                            db.close()
                            return
                    except Exception as e:
                        logger.error(f"❌ Job durumu kontrol hatası: {e}")
                        db.close()
                        return
                        
                    extract_metadata = bool(self._setting("extract_metadata", True))

                    # Site analizi yap (sadece ilk sayfa için veya site tipi bilinmiyorsa)
                    if extract_metadata and (not self.site_type or depth == 0):
                        try:
                            site_analysis = self.site_analyzer.analyze_site(html, url)
                            self.site_type = site_analysis.get('site_type', 'unknown')
                            logger.info(f"🔍 Site tipi algılandı: {self.site_type} (URL: {url})")
                        except Exception as e:
                            logger.warning(f"⚠️ Site analizi hatası {url}: {str(e)}")
                    
                    # Metadata çıkar
                    try:
                        metadata = self.content_extractor.extract_metadata(html) if extract_metadata else {}
                        # Site yapısına göre adapte olan içerik çıkarma
                        text_content = self.content_extractor.extract_text_content(html, url)
                    except Exception as e:
                        logger.warning(f"⚠️ İçerik çıkarma hatası {url}: {str(e)}")
                        # İçerik çıkarma hatası olsa bile sayfayı kaydet
                        metadata = {}
                        text_content = ""
                        # Fallback: statik metod kullan
                        try:
                            text_content = ContentExtractor.extract_text_content_static(html)
                        except:
                            text_content = ""
                    
                    # Sayfanın zaten kayıtlı olup olmadığını kontrol et (duplicate kontrolü)
                    existing_page = None
                    try:
                        existing_page = db.query(Page).filter(
                            Page.url == url,
                            Page.crawl_job_id == self.job_id
                        ).first()
                    except Exception as e:
                        logger.error(f"❌ Sayfa kontrolü hatası {url}: {str(e)}")
                    
                    # Sayfayı kaydet (eğer yoksa)
                    page = None
                    if existing_page:
                        logger.debug(f"ℹ️ Sayfa zaten mevcut: {url} (ID: {existing_page.id})")
                        page = existing_page
                    else:
                        # Database'e sayfayı kaydet
                        try:
                            page = Page(
                                crawl_job_id=self.job_id,
                                url=url,
                                title=metadata.get('title'),
                                content=text_content[:50000] if text_content else None,  # İlk 50k karakter
                                html_content=html[:100000] if html and bool(self._setting("save_html_content", True)) else None,
                                meta_description=metadata.get('description'),
                                meta_keywords=metadata.get('keywords'),
                                depth=depth,
                                status_code=response.status_code,
                                content_type=content_type,
                                content_length=len(html) if html else 0,
                                parent_url=parent_url,
                                extra_metadata=metadata,
                                site_type=self.site_type
                            )
                            db.add(page)
                            db.flush()
                            logger.info(f"✅ Sayfa kaydedildi: {url} (ID: {page.id}, Depth: {depth})")
                        except IntegrityError as e:
                            db.rollback()
                            logger.debug(f"ℹ️ Duplicate URL hatası {url}: {str(e)}")
                            # Duplicate durumunda mevcut sayfayı al
                            try:
                                page = db.query(Page).filter(
                                    Page.url == url,
                                    Page.crawl_job_id == self.job_id
                                ).first()
                                if not page:
                                    # Eğer sayfa bulunamazsa, bu bir sorun ama devam edelim
                                    logger.warning(f"⚠️ Duplicate hatası sonrası sayfa bulunamadı: {url}")
                                    # Sayfa saymayı artırmayalım, çünkü bu bir duplicate durumu
                                    db.close()
                                    return
                                logger.debug(f"ℹ️ Mevcut sayfa kullanılıyor: {url} (ID: {page.id})")
                                # Sayfa zaten var, bu yüzden sayfa saymayı artırmayalım
                                page_saved = True
                            except Exception as e2:
                                logger.error(f"❌ Sayfa sorgulama hatası: {str(e2)}")
                                db.close()
                                return
                        except Exception as e:
                            db.rollback()
                            logger.error(f"❌ Sayfa kaydetme hatası {url}: {str(e)}")
                            import traceback
                            logger.error(traceback.format_exc())
                            # Diğer hatalarda sayfa saymayı artır ve çık
                            job.pages_failed += 1
                            db.commit()
                            db.close()
                            return
                    
                    # Linkleri çıkar (sayfa kaydedildikten sonra)
                    links_to_process = []
                    try:
                        links = self.content_extractor.extract_links(html, url)
                        logger.info(f"🔗 Sayfadan {len(links)} link bulundu: {url}")
                        
                        # Job bilgisi gerekli, bu yüzden db içinde tutalım
                        # Job'u tekrar al (db session hala açık)
                        current_job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                        if not current_job:
                            db.close()
                            return
                        
                        for link_data in links:
                            link_url = normalize_url(link_data['url'], url)
                            
                            # Geçerli URL mi?
                            if not is_valid_url(link_url):
                                continue
                            
                            # Aynı domain mi?
                            is_internal = is_same_domain(link_url, current_job.base_url)
                            
                            # Internal link ise ve henüz ziyaret edilmediyse queue'ya ekle
                            if is_internal and link_url not in self.visited_urls:
                                # Depth kontrolü
                                if depth + 1 <= current_job.max_depth:
                                    links_to_process.append({
                                        'url': link_url,
                                        'link_data': link_data,
                                        'is_internal': is_internal
                                    })
                                    self.url_queue.append({
                                        'url': link_url,
                                        'depth': depth + 1,
                                        'parent_url': url
                                    })
                                    logger.debug(f"➕ Queue'ya eklendi: {link_url} (depth: {depth + 1})")
                    except Exception as e:
                        logger.error(f"❌ Link çıkarma hatası {url}: {str(e)}")
                        import traceback
                        logger.error(traceback.format_exc())
                    
                    # Linkleri kaydet (sadece sayfa kaydedildiyse)
                    if page and page.id:
                        try:
                            for link_info in links_to_process:
                                link_url = link_info['url']
                                link_data = link_info['link_data']
                                is_internal = link_info['is_internal']
                                
                                link_type = LinkType.INTERNAL if is_internal else LinkType.EXTERNAL
                                
                                # Target page'i bul
                                target_page = db.query(Page).filter(
                                    Page.url == link_url,
                                    Page.crawl_job_id == self.job_id
                                ).first()
                                target_page_id = target_page.id if target_page else None
                                
                                # Link zaten var mı kontrol et
                                existing_link = db.query(Link).filter(
                                    Link.source_page_id == page.id,
                                    Link.target_url == link_url
                                ).first()
                                
                                if not existing_link:
                                    new_link = Link(
                                        source_page_id=page.id,
                                        target_page_id=target_page_id,
                                        source_url=url,
                                        target_url=link_url,
                                        link_text=link_data.get('text'),
                                        link_type=link_type,
                                        anchor_text=link_data.get('anchor')
                                    )
                                    db.add(new_link)
                        except Exception as e:
                            logger.warning(f"⚠️ Link kaydetme hatası {url}: {e}")
                            # Link kaydetme hatası olsa bile devam et
                    
                    # Job istatistiklerini güncelle (sadece yeni sayfa için)
                    try:
                        # Sayfa yeni kaydedildiyse pages_crawled artır
                        if page and page.id and not existing_page:
                            job.pages_crawled += 1
                            page_saved = True
                            logger.info(f"📊 İstatistik güncellendi: pages_crawled={job.pages_crawled}, pages_failed={job.pages_failed}")
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        logger.error(f"❌ İstatistik güncelleme hatası {url}: {str(e)}")
                        if not page_saved:
                            job.pages_failed += 1
                        db.commit()
                    finally:
                        db.close()
                        
            except httpx.HTTPStatusError as e:
                # HTTP status hatası (4xx, 5xx)
                logger.warning(f"⚠️ HTTP status hatası {url}: {e.response.status_code if e.response else 'Unknown'}")
                db = SessionLocal()
                try:
                    job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                    if job and not page_saved:
                        try:
                            page = Page(
                                crawl_job_id=self.job_id,
                                url=url,
                                title=None,
                                content=None,
                                html_content=None,
                                depth=depth,
                                status_code=e.response.status_code if e.response else None,
                                content_type=None,
                                content_length=0,
                                parent_url=parent_url,
                                extra_metadata={'error': f'HTTP Status Error: {str(e)}'}
                            )
                            db.add(page)
                            db.flush()
                        except Exception:
                            pass  # Sayfa kaydetme hatası olsa bile devam et
                        job.pages_failed += 1
                        db.commit()
                        page_saved = True
                finally:
                    db.close()
            except httpx.RequestError as e:
                # Network hatası (connection error, timeout, vb.)
                logger.warning(f"⚠️ HTTP request hatası {url}: {e}")
                db = SessionLocal()
                try:
                    job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                    if job and not page_saved:
                        job.pages_failed += 1
                        db.commit()
                finally:
                    db.close()
            except httpx.HTTPError as e:
                # Diğer HTTP hataları
                logger.warning(f"⚠️ HTTP hatası {url}: {e}")
                db = SessionLocal()
                try:
                    job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                    if job and not page_saved:
                        job.pages_failed += 1
                        db.commit()
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"❌ Beklenmeyen hata {url}: {e}")
                import traceback
                logger.error(traceback.format_exc())
                db = SessionLocal()
                try:
                    job = db.query(CrawlJob).filter(CrawlJob.id == self.job_id).first()
                    if job and not page_saved:
                        job.pages_failed += 1
                        db.commit()
                finally:
                    db.close()

