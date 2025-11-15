from urllib.parse import urlparse, urljoin, urlunparse, parse_qs, urlencode
from typing import Optional
import tldextract


def normalize_url(url: str, base_url: Optional[str] = None) -> str:
    """
    URL'yi normalize eder - aynı sayfaya farklı URL'lerle gitmeyi önler
    """
    if base_url:
        url = urljoin(base_url, url)
    
    parsed = urlparse(url)
    
    # Query string'i normalize et (boş değerleri kaldır, sırala)
    query_parts = []
    if parsed.query:
        query_dict = parse_qs(parsed.query, keep_blank_values=False)
        # Sıralı query string oluştur
        sorted_items = sorted(query_dict.items())
        query_parts = [f"{k}={v[0]}" if len(v) == 1 else f"{k}={','.join(v)}" for k, v in sorted_items]
    
    normalized_query = '&'.join(query_parts) if query_parts else ''
    
    # Fragment'leri kaldır, query string'i koru
    normalized = urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower(),
        parsed.path.rstrip('/') or '/',
        parsed.params,
        normalized_query,  # Query string'i koru
        ''   # Fragment'i kaldır
    ))
    
    return normalized


def get_domain(url: str) -> str:
    """URL'den domain'i çıkarır"""
    parsed = urlparse(url)
    return parsed.netloc.lower()


def get_base_domain(url: str) -> str:
    """URL'den base domain'i çıkarır (subdomain olmadan)"""
    extracted = tldextract.extract(url)
    return f"{extracted.domain}.{extracted.suffix}"


def is_same_domain(url1: str, url2: str) -> bool:
    """İki URL'nin aynı domain'de olup olmadığını kontrol eder"""
    return get_base_domain(url1) == get_base_domain(url2)


def is_valid_url(url: str) -> bool:
    """URL'nin geçerli olup olmadığını kontrol eder"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

