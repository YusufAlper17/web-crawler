"""Custom exception classes for better error handling"""


class CrawlerException(Exception):
    """Base exception for crawler errors"""
    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class URLValidationError(CrawlerException):
    """URL doğrulama hatası"""
    pass


class RobotsTxtError(CrawlerException):
    """Robots.txt hatası"""
    pass


class HTTPError(CrawlerException):
    """HTTP request hatası"""
    def __init__(self, message: str, status_code: int = None, url: str = None):
        self.status_code = status_code
        self.url = url
        super().__init__(message, {"status_code": status_code, "url": url})


class DatabaseError(CrawlerException):
    """Database hatası"""
    pass


class ContentExtractionError(CrawlerException):
    """İçerik çıkarma hatası"""
    pass


class JobNotFoundError(CrawlerException):
    """Job bulunamadı hatası"""
    pass


class CrawlLimitExceededError(CrawlerException):
    """Crawl limiti aşıldı hatası"""
    pass


def handle_exception(exc: Exception, context: dict = None) -> dict:
    """
    Exception'ı yakalayıp uygun şekilde formatlar
    
    Args:
        exc: Yakalanan exception
        context: Ek context bilgisi
    
    Returns:
        Formatlanmış hata dict'i
    """
    error_response = {
        "error": True,
        "message": str(exc),
        "type": type(exc).__name__,
        "context": context or {}
    }
    
    if isinstance(exc, CrawlerException):
        error_response["details"] = exc.details
    
    return error_response

