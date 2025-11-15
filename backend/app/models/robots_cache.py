from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database.connection import Base


class RobotsCache(Base):
    __tablename__ = "robots_cache"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, nullable=False, unique=True, index=True)
    robots_txt = Column(Text, nullable=True)
    sitemap_url = Column(String, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now())
    is_allowed = Column(String, nullable=True)  # JSON string of allowed paths

