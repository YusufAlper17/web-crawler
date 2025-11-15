from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.crawl_job import JobStatus


class CrawlJobCreate(BaseModel):
    base_url: str
    max_depth: Optional[int] = 10
    max_pages: Optional[int] = 10000


class CrawlJobResponse(BaseModel):
    id: int
    base_url: str
    status: JobStatus
    max_depth: int
    max_pages: int
    pages_crawled: int
    pages_failed: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PageResponse(BaseModel):
    id: int
    url: str
    title: Optional[str]
    depth: int
    status_code: Optional[int]
    crawled_at: datetime
    parent_url: Optional[str]
    
    class Config:
        from_attributes = True


class LinkResponse(BaseModel):
    id: int
    source_url: str
    target_url: str
    link_text: Optional[str]
    link_type: str
    
    class Config:
        from_attributes = True


class TreeNode(BaseModel):
    id: str
    url: str
    title: Optional[str]
    depth: int
    children: List['TreeNode']
    has_article: bool = False
    status_code: Optional[int] = None


TreeNode.model_rebuild()


class TreeResponse(BaseModel):
    root: TreeNode
    total_nodes: int
    max_depth: int


class CrawlStatusResponse(BaseModel):
    job_id: int
    status: str
    pages_crawled: int
    pages_failed: int
    total_pages: int
    progress: float

