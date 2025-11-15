from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from typing import Optional
import httpx
from app.database.connection import SessionLocal
from app.models.robots_cache import RobotsCache
from app.utils.url_normalizer import get_base_domain


class RobotsChecker:
    def __init__(self):
        self.cache = {}
    
    async def can_fetch(self, url: str, user_agent: str = "*") -> bool:
        """
        robots.txt'e göre URL'nin çekilip çekilemeyeceğini kontrol eder
        """
        domain = get_base_domain(url)
        
        # Cache'den kontrol et
        if domain in self.cache:
            rp = self.cache[domain]
            return rp.can_fetch(user_agent, url)
        
        # Database'den kontrol et
        db = SessionLocal()
        try:
            robots_cache = db.query(RobotsCache).filter(RobotsCache.domain == domain).first()
            
            if robots_cache and robots_cache.robots_txt:
                # Database'deki robots.txt'i kullan
                robots_url = f"http://{domain}/robots.txt"
                rp = RobotFileParser()
                rp.set_url(robots_url)
                # İçeriği parse etmek için geçici olarak StringIO kullan
                # Ancak RobotFileParser URL'den okur, bu yüzden basit bir kontrol yapalım
                # Gerçek uygulamada robots-parser kütüphanesi kullanılabilir
                try:
                    # Basit parse: Disallow kurallarını kontrol et
                    lines = robots_cache.robots_txt.split('\n')
                    user_agent_section = False
                    for line in lines:
                        line = line.strip().lower()
                        if line.startswith('user-agent:'):
                            ua = line.split(':', 1)[1].strip()
                            user_agent_section = (ua == '*' or user_agent.lower() in ua)
                        elif user_agent_section and line.startswith('disallow:'):
                            disallow_path = line.split(':', 1)[1].strip()
                            if disallow_path and url.endswith(disallow_path):
                                return False
                except Exception:
                    pass
                # Varsayılan olarak izin ver
                return True
        finally:
            db.close()
        
        # robots.txt'i çek ve cache'le
        try:
            # HTTP ve HTTPS'i dene
            for scheme in ['https', 'http']:
                try:
                    robots_url = f"{scheme}://{domain}/robots.txt"
                    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                        response = await client.get(robots_url)
                        if response.status_code == 200:
                            robots_content = response.text
                            
                            # Database'e kaydet
                            db = SessionLocal()
                            try:
                                robots_cache = RobotsCache(
                                    domain=domain,
                                    robots_txt=robots_content
                                )
                                db.merge(robots_cache)
                                db.commit()
                            finally:
                                db.close()
                            
                            # Basit robots.txt kontrolü
                            # Şimdilik her zaman izin ver (fail-open)
                            # İleride daha gelişmiş parser eklenebilir
                            return True
                except Exception:
                    continue
        except Exception as e:
            print(f"Robots.txt çekilemedi: {e}")
        
        # Hata durumunda izin ver (fail-open)
        return True
