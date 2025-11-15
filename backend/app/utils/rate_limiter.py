"""Rate limiting ve retry mekanizması için yardımcı modül"""
import asyncio
import time
from typing import Dict, Optional, Callable, Any
from functools import wraps
import httpx
from app.utils.logger import crawler_logger


class RateLimiter:
    """Domain bazlı rate limiting"""
    
    def __init__(self, requests_per_second: float = 1.0):
        self.requests_per_second = requests_per_second
        self.min_interval = 1.0 / requests_per_second
        self.last_request_time: Dict[str, float] = {}
    
    async def wait_if_needed(self, domain: str):
        """Gerekirse rate limit için bekle"""
        current_time = time.time()
        
        if domain in self.last_request_time:
            time_since_last = current_time - self.last_request_time[domain]
            if time_since_last < self.min_interval:
                wait_time = self.min_interval - time_since_last
                crawler_logger.debug(f"Rate limit: {domain} için {wait_time:.2f}s bekleniyor")
                await asyncio.sleep(wait_time)
        
        self.last_request_time[domain] = time.time()


class RetryHandler:
    """HTTP istekleri için retry mekanizması"""
    
    def __init__(
        self,
        max_retries: int = 3,
        backoff_factor: float = 2.0,
        retry_on_status: list = None
    ):
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.retry_on_status = retry_on_status or [429, 500, 502, 503, 504]
    
    async def retry_request(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Verilen fonksiyonu retry mekanizması ile çalıştırır
        
        Args:
            func: Çalıştırılacak async fonksiyon
            *args: Fonksiyon argümanları
            **kwargs: Fonksiyon keyword argümanları
        
        Returns:
            Fonksiyon sonucu
        
        Raises:
            Son denemenin exception'ı
        """
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                result = await func(*args, **kwargs)
                
                # HTTP response kontrolü (httpx.Response objesi ise)
                if hasattr(result, 'status_code'):
                    if result.status_code in self.retry_on_status:
                        if attempt < self.max_retries:
                            wait_time = self.backoff_factor ** attempt
                            crawler_logger.warning(
                                f"HTTP {result.status_code} alındı. "
                                f"{wait_time}s sonra tekrar denenecek (deneme {attempt + 1}/{self.max_retries})"
                            )
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            crawler_logger.error(
                                f"Maksimum deneme sayısına ulaşıldı. Son status: {result.status_code}"
                            )
                            raise httpx.HTTPStatusError(
                                f"HTTP {result.status_code}",
                                request=result.request,
                                response=result
                            )
                
                # Başarılı
                if attempt > 0:
                    crawler_logger.info(f"İstek {attempt + 1}. denemede başarılı oldu")
                
                return result
                
            except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as e:
                last_exception = e
                
                if attempt < self.max_retries:
                    wait_time = self.backoff_factor ** attempt
                    crawler_logger.warning(
                        f"Network hatası: {str(e)}. "
                        f"{wait_time}s sonra tekrar denenecek (deneme {attempt + 1}/{self.max_retries})"
                    )
                    await asyncio.sleep(wait_time)
                else:
                    crawler_logger.error(
                        f"Maksimum deneme sayısına ulaşıldı. Son hata: {str(e)}"
                    )
                    raise
            
            except Exception as e:
                # Diğer hatalar için retry yapma
                crawler_logger.error(f"Beklenmeyen hata: {str(e)}")
                raise
        
        # Bu noktaya ulaşılmamalı ama yine de
        if last_exception:
            raise last_exception


def with_retry(max_retries: int = 3, backoff_factor: float = 2.0):
    """
    Decorator: Async fonksiyonlara retry mekanizması ekler
    
    Usage:
        @with_retry(max_retries=3, backoff_factor=2.0)
        async def my_function():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            retry_handler = RetryHandler(max_retries, backoff_factor)
            return await retry_handler.retry_request(func, *args, **kwargs)
        return wrapper
    return decorator


class AdaptiveRateLimiter:
    """
    Adaptive rate limiter - sunucu yanıtlarına göre hızı otomatik ayarlar
    """
    
    def __init__(
        self,
        initial_rate: float = 1.0,
        min_rate: float = 0.1,
        max_rate: float = 10.0,
        increase_factor: float = 1.2,
        decrease_factor: float = 0.5
    ):
        self.current_rate = initial_rate
        self.min_rate = min_rate
        self.max_rate = max_rate
        self.increase_factor = increase_factor
        self.decrease_factor = decrease_factor
        self.last_request_time: Dict[str, float] = {}
        self.success_count = 0
        self.error_count = 0
    
    async def wait_if_needed(self, domain: str):
        """Rate limit için bekle"""
        interval = 1.0 / self.current_rate
        current_time = time.time()
        
        if domain in self.last_request_time:
            time_since_last = current_time - self.last_request_time[domain]
            if time_since_last < interval:
                wait_time = interval - time_since_last
                await asyncio.sleep(wait_time)
        
        self.last_request_time[domain] = time.time()
    
    def report_success(self):
        """Başarılı istek rapor et - hızı artır"""
        self.success_count += 1
        self.error_count = 0
        
        # Her 10 başarılı istekte bir hızı artır
        if self.success_count >= 10:
            self.current_rate = min(
                self.current_rate * self.increase_factor,
                self.max_rate
            )
            self.success_count = 0
            crawler_logger.info(f"Rate artırıldı: {self.current_rate:.2f} req/s")
    
    def report_error(self, status_code: Optional[int] = None):
        """Hata rapor et - hızı azalt"""
        self.error_count += 1
        self.success_count = 0
        
        # 429 (Too Many Requests) veya 503 (Service Unavailable) durumunda hızı azalt
        if status_code in [429, 503] or self.error_count >= 3:
            self.current_rate = max(
                self.current_rate * self.decrease_factor,
                self.min_rate
            )
            self.error_count = 0
            crawler_logger.warning(f"Rate azaltıldı: {self.current_rate:.2f} req/s")

