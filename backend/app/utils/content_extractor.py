from bs4 import BeautifulSoup
from typing import Optional, Dict, List
import re
from app.utils.site_analyzer import SiteAnalyzer, SiteType


class ContentExtractor:
    @staticmethod
    def extract_metadata(html: str) -> Dict:
        """HTML'den metadata çıkarır"""
        soup = BeautifulSoup(html, 'html.parser')
        
        metadata = {
            'title': None,
            'description': None,
            'keywords': None,
            'og_title': None,
            'og_description': None,
            'og_image': None,
            'h1': [],
            'h2': [],
            'images': [],
            'links': []
        }
        
        # Title
        title_tag = soup.find('title')
        if title_tag:
            metadata['title'] = title_tag.get_text(strip=True)
        
        # Meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            metadata['description'] = meta_desc.get('content', '').strip()
        
        # Meta keywords
        meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
        if meta_keywords:
            metadata['keywords'] = meta_keywords.get('content', '').strip()
        
        # Open Graph
        og_title = soup.find('meta', property='og:title')
        if og_title:
            metadata['og_title'] = og_title.get('content', '').strip()
        
        og_desc = soup.find('meta', property='og:description')
        if og_desc:
            metadata['og_description'] = og_desc.get('content', '').strip()
        
        og_image = soup.find('meta', property='og:image')
        if og_image:
            metadata['og_image'] = og_image.get('content', '').strip()
        
        # Headings
        h1_tags = soup.find_all('h1')
        metadata['h1'] = [h.get_text(strip=True) for h in h1_tags]
        
        h2_tags = soup.find_all('h2')
        metadata['h2'] = [h.get_text(strip=True) for h in h2_tags]
        
        # Images
        img_tags = soup.find_all('img')
        metadata['images'] = [img.get('src', '') for img in img_tags if img.get('src')]
        
        return metadata
    
    def __init__(self):
        """ContentExtractor başlatıcı"""
        self.site_analyzer = SiteAnalyzer()
        self.site_analysis_cache: Dict[str, Dict] = {}
    
    def extract_text_content(self, html: str, url: str = "") -> str:
        """HTML'den temiz metin içeriği çıkarır - site yapısına göre adapte olur"""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Site analizi yap (cache'den veya yeni)
        if url:
            if url not in self.site_analysis_cache:
                self.site_analysis_cache[url] = self.site_analyzer.analyze_site(html, url)
            site_analysis = self.site_analysis_cache[url]
        else:
            site_analysis = self.site_analyzer.analyze_site(html, url)
        
        # Site tipine göre strateji al
        strategy = self.site_analyzer.get_content_extraction_strategy(
            site_analysis['site_type'],
            site_analysis['content_structure']
        )
        
        # Önce stratejiye göre içerik al
        content_text = ""
        for selector in strategy.get('content_selectors', []):
            elements = soup.select(selector)
            if elements:
                # Script ve style tag'lerini kaldır
                for element in elements:
                    for script in element(["script", "style", "nav", "footer", "header", "aside"]):
                        script.decompose()
                    content_text += element.get_text(separator=' ', strip=True) + " "
                if content_text.strip():
                    break
        
        # Eğer strateji ile içerik bulunamadıysa, varsayılan yöntemi kullan
        if not content_text.strip():
            # Script ve style tag'lerini kaldır
            for script in soup(["script", "style", "meta", "link", "nav", "footer", "header", "aside"]):
                script.decompose()
            
            # Metni al
            content_text = soup.get_text(separator=' ', strip=True)
        
        # Çoklu boşlukları temizle
        content_text = re.sub(r'\s+', ' ', content_text)
        
        return content_text.strip()
    
    @staticmethod
    def extract_text_content_static(html: str) -> str:
        """HTML'den temiz metin içeriği çıkarır (statik metod - geriye dönük uyumluluk)"""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Script ve style tag'lerini kaldır
        for script in soup(["script", "style", "meta", "link"]):
            script.decompose()
        
        # Metni al
        text = soup.get_text(separator=' ', strip=True)
        
        # Çoklu boşlukları temizle
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    @staticmethod
    def extract_links(html: str, base_url: str) -> List[Dict]:
        """HTML'den linkleri çıkarır"""
        from urllib.parse import urljoin
        
        soup = BeautifulSoup(html, 'html.parser')
        links = []
        
        for a_tag in soup.find_all('a', href=True):
            href = a_tag.get('href', '').strip()
            if not href:
                continue
            
            # JavaScript ve diğer geçersiz linkleri atla
            if href.startswith('javascript:') or href.startswith('mailto:') or href.startswith('tel:'):
                continue
            
            full_url = urljoin(base_url, href)
            link_text = a_tag.get_text(strip=True)
            
            links.append({
                'url': full_url,
                'text': link_text,
                'anchor': a_tag.get('title', '')
            })
        
        return links

