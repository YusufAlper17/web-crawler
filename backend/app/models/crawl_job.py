from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, JSON
from sqlalchemy.sql import func
from app.database.connection import Base
import enum


class JobStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CrawlJob(Base):
    __tablename__ = "crawl_jobs"

    id = Column(Integer, primary_key=True, index=True)
    base_url = Column(String, nullable=False, index=True)
    status = Column(Enum(JobStatus), default=JobStatus.PENDING, nullable=False)
    max_depth = Column(Integer, default=10)
    max_pages = Column(Integer, default=10000)
    pages_crawled = Column(Integer, default=0)
    pages_failed = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    settings = Column(JSON, nullable=True)  # Store crawler settings

