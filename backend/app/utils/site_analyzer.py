"""
Site yapısını analiz eden ve farklı site tiplerini algılayan modül
"""
from bs4 import BeautifulSoup
from typing import Dict, Optional, List
from urllib.parse import urlparse
import re


class SiteType:
    """Site tipi enum"""
    BLOG = "blog"
    ECOMMERCE = "ecommerce"
    NEWS = "news"
    WIKI = "wiki"
    FORUM = "forum"
    PORTFOLIO = "portfolio"
    CORPORATE = "corporate"
    SOCIAL = "social"
    UNKNOWN = "unknown"


class SiteAnalyzer:
    """Site yapısını analiz eder ve tipini belirler"""
    
    # Blog göstergeleri
    BLOG_INDICATORS = [
        r'/blog',
        r'/post',
        r'/article',
        r'/entry',
        r'/archive',
        r'blog',
        r'wordpress',
        r'wp-content',
        r'post-date',
        r'author',
        r'published',
    ]
    
    # E-ticaret göstergeleri
    ECOMMERCE_INDICATORS = [
        r'/product',
        r'/shop',
        r'/cart',
        r'/checkout',
        r'/category',
        r'add-to-cart',
        r'product-price',
        r'buy-now',
        r'shopping',
        r'woocommerce',
    ]
    
    # Haber sitesi göstergeleri
    NEWS_INDICATORS = [
        r'/news',
        r'/article',
        r'/story',
        r'/breaking',
        r'news',
        r'headline',
        r'byline',
        r'published-date',
        r'article-body',
    ]
    
    # Wiki göstergeleri
    WIKI_INDICATORS = [
        r'/wiki',
        r'/w/',
        r'wiki',
        r'edit-section',
        r'wiki-content',
        r'infobox',
    ]
    
    # Forum göstergeleri
    FORUM_INDICATORS = [
        r'/forum',
        r'/topic',
        r'/thread',
        r'forum',
        r'thread',
        r'post-reply',
        r'user-post',
    ]
    
    @staticmethod
    def analyze_site(html: str, url: str) -> Dict:
        """Site yapısını analiz eder"""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Site tipini belirle
        site_type = SiteAnalyzer._detect_site_type(html, url, soup)
        
        # İçerik yapısını analiz et
        content_structure = SiteAnalyzer._analyze_content_structure(soup)
        
        # Navigasyon yapısını analiz et
        navigation_structure = SiteAnalyzer._analyze_navigation(soup)
        
        # Link yapısını analiz et
        link_structure = SiteAnalyzer._analyze_link_structure(soup, url)
        
        return {
            'site_type': site_type,
            'content_structure': content_structure,
            'navigation_structure': navigation_structure,
            'link_structure': link_structure,
            'is_spa': SiteAnalyzer._detect_spa(html, soup),
            'has_dynamic_content': SiteAnalyzer._detect_dynamic_content(html, soup),
        }
    
    @staticmethod
    def _detect_site_type(html: str, url: str, soup: BeautifulSoup) -> str:
        """Site tipini algılar"""
        html_lower = html.lower()
        url_lower = url.lower()
        
        # Blog kontrolü
        blog_score = sum(1 for indicator in SiteAnalyzer.BLOG_INDICATORS 
                        if re.search(indicator, html_lower, re.IGNORECASE) or 
                        re.search(indicator, url_lower, re.IGNORECASE))
        
        # E-ticaret kontrolü
        ecommerce_score = sum(1 for indicator in SiteAnalyzer.ECOMMERCE_INDICATORS 
                             if re.search(indicator, html_lower, re.IGNORECASE) or 
                             re.search(indicator, url_lower, re.IGNORECASE))
        
        # Haber sitesi kontrolü
        news_score = sum(1 for indicator in SiteAnalyzer.NEWS_INDICATORS 
                        if re.search(indicator, html_lower, re.IGNORECASE) or 
                        re.search(indicator, url_lower, re.IGNORECASE))
        
        # Wiki kontrolü
        wiki_score = sum(1 for indicator in SiteAnalyzer.WIKI_INDICATORS 
                        if re.search(indicator, html_lower, re.IGNORECASE) or 
                        re.search(indicator, url_lower, re.IGNORECASE))
        
        # Forum kontrolü
        forum_score = sum(1 for indicator in SiteAnalyzer.FORUM_INDICATORS 
                         if re.search(indicator, html_lower, re.IGNORECASE) or 
                         re.search(indicator, url_lower, re.IGNORECASE))
        
        # En yüksek skora sahip tipi döndür
        scores = {
            SiteType.BLOG: blog_score,
            SiteType.ECOMMERCE: ecommerce_score,
            SiteType.NEWS: news_score,
            SiteType.WIKI: wiki_score,
            SiteType.FORUM: forum_score,
        }
        
        max_score = max(scores.values())
        if max_score >= 2:  # En az 2 eşleşme gerekli
            return max(scores, key=scores.get)
        
        return SiteType.UNKNOWN
    
    @staticmethod
    def _analyze_content_structure(soup: BeautifulSoup) -> Dict:
        """İçerik yapısını analiz eder"""
        structure = {
            'has_article_tag': bool(soup.find('article')),
            'has_main_tag': bool(soup.find('main')),
            'has_content_div': bool(soup.find(class_=re.compile(r'content|post|article|entry', re.I))),
            'has_aside': bool(soup.find('aside')),
            'has_nav': bool(soup.find('nav')),
            'has_header': bool(soup.find('header')),
            'has_footer': bool(soup.find('footer')),
            'main_content_selectors': [],
        }
        
        # Yaygın içerik selector'ları
        common_selectors = [
            'article',
            'main',
            '.content',
            '.post',
            '.article',
            '.entry',
            '#content',
            '#main',
            '.main-content',
            '.post-content',
            '.article-content',
        ]
        
        for selector in common_selectors:
            if soup.select(selector):
                structure['main_content_selectors'].append(selector)
        
        return structure
    
    @staticmethod
    def _analyze_navigation(soup: BeautifulSoup) -> Dict:
        """Navigasyon yapısını analiz eder"""
        nav_tags = soup.find_all('nav')
        nav_links = []
        
        for nav in nav_tags:
            links = nav.find_all('a', href=True)
            nav_links.extend([a.get('href') for a in links])
        
        return {
            'has_nav_tag': len(nav_tags) > 0,
            'nav_link_count': len(nav_links),
            'has_breadcrumb': bool(soup.find(class_=re.compile(r'breadcrumb', re.I))),
            'has_pagination': bool(soup.find(class_=re.compile(r'pagination|pager|page-nav', re.I))),
        }
    
    @staticmethod
    def _analyze_link_structure(soup: BeautifulSoup, url: str) -> Dict:
        """Link yapısını analiz eder"""
        all_links = soup.find_all('a', href=True)
        
        internal_links = []
        external_links = []
        navigation_links = []
        content_links = []
        
        base_domain = urlparse(url).netloc
        
        for link in all_links:
            href = link.get('href', '')
            if not href or href.startswith('#'):
                continue
            
            # Domain kontrolü
            try:
                parsed = urlparse(href)
                if parsed.netloc:
                    if parsed.netloc == base_domain:
                        internal_links.append(href)
                    else:
                        external_links.append(href)
                else:
                    internal_links.append(href)
            except:
                continue
            
            # Navigasyon linki mi?
            parent = link.find_parent(['nav', 'header', 'footer', 'aside'])
            if parent:
                navigation_links.append(href)
            else:
                content_links.append(href)
        
        return {
            'total_links': len(all_links),
            'internal_links': len(internal_links),
            'external_links': len(external_links),
            'navigation_links': len(navigation_links),
            'content_links': len(content_links),
        }
    
    @staticmethod
    def _detect_spa(html: str, soup: BeautifulSoup) -> bool:
        """Single Page Application (SPA) olup olmadığını tespit eder"""
        # React, Vue, Angular gibi framework'lerin göstergeleri
        spa_indicators = [
            r'__REACT',
            r'__NEXT_DATA__',
            r'ng-app',
            r'vue',
            r'data-react',
            r'react-root',
            r'vue-app',
            r'angular',
        ]
        
        html_lower = html.lower()
        return any(re.search(indicator, html_lower, re.IGNORECASE) for indicator in spa_indicators)
    
    @staticmethod
    def _detect_dynamic_content(html: str, soup: BeautifulSoup) -> bool:
        """Dinamik içerik olup olmadığını tespit eder"""
        # Lazy loading, infinite scroll, vb. göstergeleri
        dynamic_indicators = [
            r'lazy-load',
            r'infinite-scroll',
            r'data-src',
            r'data-lazy',
            r'loading="lazy"',
            r'ajax',
            r'xhr',
        ]
        
        html_lower = html.lower()
        return any(re.search(indicator, html_lower, re.IGNORECASE) for indicator in dynamic_indicators)
    
    @staticmethod
    def get_content_extraction_strategy(site_type: str, content_structure: Dict) -> Dict:
        """Site tipine göre içerik çıkarma stratejisi döndürür"""
        strategies = {
            SiteType.BLOG: {
                'primary_selectors': ['article', '.post', '.entry', '.blog-post'],
                'title_selectors': ['h1', '.post-title', '.entry-title'],
                'content_selectors': ['.post-content', '.entry-content', 'article > *'],
                'date_selectors': ['.post-date', '.published', 'time'],
                'author_selectors': ['.author', '.by-author'],
            },
            SiteType.ECOMMERCE: {
                'primary_selectors': ['.product', '.product-detail', 'main'],
                'title_selectors': ['h1.product-title', '.product-name'],
                'content_selectors': ['.product-description', '.product-details'],
                'price_selectors': ['.price', '.product-price'],
                'image_selectors': ['.product-image', '.product-gallery img'],
            },
            SiteType.NEWS: {
                'primary_selectors': ['article', '.article-body', '.story'],
                'title_selectors': ['h1.headline', '.article-title'],
                'content_selectors': ['.article-content', '.story-body'],
                'date_selectors': ['.published-date', 'time'],
                'author_selectors': ['.byline', '.author'],
            },
            SiteType.WIKI: {
                'primary_selectors': ['#content', '#bodyContent', '.mw-parser-output'],
                'title_selectors': ['h1.firstHeading', '#firstHeading'],
                'content_selectors': ['#mw-content-text', '.mw-content'],
            },
        }
        
        # Varsayılan strateji
        default_strategy = {
            'primary_selectors': ['main', 'article', '.content'],
            'title_selectors': ['h1'],
            'content_selectors': ['main > *', 'article > *'],
        }
        
        if site_type in strategies:
            strategy = strategies[site_type].copy()
            # İçerik yapısına göre özelleştir
            if content_structure.get('has_article_tag'):
                strategy['primary_selectors'].insert(0, 'article')
            if content_structure.get('has_main_tag'):
                strategy['primary_selectors'].insert(0, 'main')
            return strategy
        
        return default_strategy

