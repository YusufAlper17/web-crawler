from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base
import enum


class LinkType(enum.Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    ANCHOR = "anchor"


class Link(Base):
    __tablename__ = "links"

    id = Column(Integer, primary_key=True, index=True)
    source_page_id = Column(Integer, ForeignKey("pages.id", ondelete="CASCADE"), nullable=False, index=True)
    target_page_id = Column(Integer, ForeignKey("pages.id", ondelete="CASCADE"), nullable=True, index=True)
    source_url = Column(String, nullable=False)
    target_url = Column(String, nullable=False, index=True)
    link_text = Column(String, nullable=True)
    link_type = Column(Enum(LinkType), nullable=False)
    anchor_text = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    source_page = relationship("Page", foreign_keys=[source_page_id], back_populates="outgoing_links")
    target_page = relationship("Page", foreign_keys=[target_page_id], back_populates="incoming_links")

