from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # App / Deployment
    APP_NAME: str = "CrawlScope"
    DEPLOYMENT_TARGET: str = "local"
    PUBLIC_FRONTEND_URL: str = "http://localhost:3000"
    
    # Database
    DATABASE_URL: str = "sqlite:///./webcrawler.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Crawler Settings
    MAX_DEPTH: int = 10
    MAX_PAGES: int = 10000
    REQUEST_DELAY: float = 1.0  # seconds between requests
    TIMEOUT: int = 30
    CONCURRENT_REQUESTS: int = 10
    USER_AGENT: str = "WebCrawler/1.0 (+https://example.com/bot)"
    
    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **values):
        super().__init__(**values)
        if self.DATABASE_URL.startswith("postgres://"):
            object.__setattr__(
                self,
                "DATABASE_URL",
                self.DATABASE_URL.replace("postgres://", "postgresql://", 1),
            )
        # SQLite için göreli yol verilmişse backend köküne sabitle
        if self.DATABASE_URL.startswith("sqlite" ) and "sqlite:///./" in self.DATABASE_URL:
            rel = self.DATABASE_URL.split("sqlite:///./", 1)[1]
            backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            abs_path = os.path.join(backend_root, rel)
            # pydantic model field set
            object.__setattr__(self, "DATABASE_URL", f"sqlite:///{abs_path}")


settings = Settings()

