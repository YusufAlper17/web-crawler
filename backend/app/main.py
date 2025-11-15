from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.routes import router
from app.api.export_routes import router as export_router
from app.database.connection import engine, Base
import logging
from datetime import datetime
import time

# Logging ayarları - Gelişmiş
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('crawler.log')
    ]
)

logger = logging.getLogger(__name__)
logger.info("=" * 50)
logger.info("🚀 BACKEND BAŞLATILIYOR")
logger.info("=" * 50)

# Database tablolarını oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Web Crawler API",
    description="Gelişmiş ve ölçeklenebilir web crawler API",
    version="1.0.0"
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"📥 {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"📤 {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.2f}s")
        return response
    except Exception as e:
        logger.error(f"❌ {request.method} {request.url.path} - Error: {str(e)}")
        raise

# CORS middleware
# Development için tüm origin'lere izin ver
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Development için tüm origin'lere izin
    allow_credentials=False,  # "*" ile credentials kullanılamaz
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logger.info(f"🌐 CORS yapılandırıldı: {settings.CORS_ORIGINS}")

# API routes
app.include_router(router, prefix=settings.API_V1_PREFIX, tags=["crawler"])
app.include_router(export_router, prefix=settings.API_V1_PREFIX, tags=["export"])


@app.get("/")
def root():
    logger.info("📍 Root endpoint çağrıldı")
    return {
        "message": "Web Crawler API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
def health_check():
    logger.info("💚 Health check çağrıldı")
    return {"status": "healthy", "timestamp": str(datetime.now())}


# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("=" * 50)
    logger.info("✅ Backend başarıyla başlatıldı!")
    logger.info(f"📊 API Dokümantasyon: http://localhost:8000/docs")
    logger.info(f"🔗 API Base URL: {settings.API_V1_PREFIX}")
    logger.info(f"🌐 CORS Origins: {settings.CORS_ORIGINS}")
    logger.info("=" * 50)


# Shutdown event  
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Backend kapatılıyor...")

