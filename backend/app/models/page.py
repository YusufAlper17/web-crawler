from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base


class Page(Base):
    __tablename__ = "pages"

    id = Column(Integer, primary_key=True, index=True)
    crawl_job_id = Column(Integer, ForeignKey("crawl_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String, nullable=False, index=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=True)
    html_content = Column(Text, nullable=True)
    meta_description = Column(String, nullable=True)
    meta_keywords = Column(String, nullable=True)
    depth = Column(Integer, default=0)
    status_code = Column(Integer, nullable=True)
    content_type = Column(String, nullable=True)
    content_length = Column(Integer, nullable=True)
    crawled_at = Column(DateTime(timezone=True), server_default=func.now())
    parent_url = Column(String, nullable=True)
    is_indexed = Column(Boolean, default=False)
    extra_metadata = Column(JSON, nullable=True)  # Store additional metadata
    site_type = Column(String, nullable=True)  # Site tipi (blog, ecommerce, news, vb.)
    
    # Relationships
    crawl_job = relationship("CrawlJob", backref="pages")
    outgoing_links = relationship("Link", foreign_keys="Link.source_page_id", back_populates="source_page")
    incoming_links = relationship("Link", foreign_keys="Link.target_page_id", back_populates="target_page")

