import logging
import sys
from typing import Optional
from datetime import datetime
import traceback
from pathlib import Path


class CrawlerLogger:
    """Crawler için özelleştirilmiş logger"""
    
    def __init__(self, name: str, log_file: Optional[str] = None):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
        
        # Format
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        # File handler (opsiyonel)
        if log_file:
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            
            file_handler = logging.FileHandler(log_file, encoding='utf-8')
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
    
    def info(self, message: str, **kwargs):
        """Info level log"""
        self.logger.info(message, extra=kwargs)
    
    def warning(self, message: str, **kwargs):
        """Warning level log"""
        self.logger.warning(message, extra=kwargs)
    
    def error(self, message: str, exc_info: Optional[Exception] = None, **kwargs):
        """Error level log with optional exception info"""
        if exc_info:
            self.logger.error(f"{message}\n{traceback.format_exc()}", extra=kwargs)
        else:
            self.logger.error(message, extra=kwargs)
    
    def debug(self, message: str, **kwargs):
        """Debug level log"""
        self.logger.debug(message, extra=kwargs)
    
    def critical(self, message: str, exc_info: Optional[Exception] = None, **kwargs):
        """Critical level log"""
        if exc_info:
            self.logger.critical(f"{message}\n{traceback.format_exc()}", extra=kwargs)
        else:
            self.logger.critical(message, extra=kwargs)


# Global logger instance'ları
crawler_logger = CrawlerLogger("crawler", "logs/crawler.log")
api_logger = CrawlerLogger("api", "logs/api.log")
db_logger = CrawlerLogger("database", "logs/database.log")

