from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.crawl_job import JobStatus


class CrawlerSettings(BaseModel):
    request_delay: Optional[float] = Field(default=None, ge=0.1, le=10)
    timeout: Optional[int] = Field(default=None, ge=5, le=120)
    concurrent_requests: Optional[int] = Field(default=None, ge=1, le=50)
    user_agent: Optional[str] = None
    respect_robots_txt: Optional[bool] = True
    follow_redirects: Optional[bool] = True
    save_html_content: Optional[bool] = True
    extract_metadata: Optional[bool] = True


class CrawlJobCreate(BaseModel):
    base_url: str
    max_depth: Optional[int] = 10
    max_pages: Optional[int] = 10000
    settings: Optional[CrawlerSettings] = None


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
    settings: Optional[Dict[str, Any]] = None
    
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


class StatusBreakdownItem(BaseModel):
    status: str
    count: int


class DailyActivityItem(BaseModel):
    date: str
    jobs: int
    pages: int
    failed_pages: int


class AnalyticsSummaryResponse(BaseModel):
    total_jobs: int
    running_jobs: int
    completed_jobs: int
    failed_jobs: int
    paused_jobs: int
    cancelled_jobs: int
    total_pages: int
    failed_pages: int
    success_rate: float
    average_pages_per_job: int
    status_breakdown: List[StatusBreakdownItem]
    daily_activity: List[DailyActivityItem]


class RuntimeSettingsResponse(BaseModel):
    api_base_path: str
    frontend_url: str
    database_engine: str
    deployment_target: str
    crawl_mode: str = "background"
    crawler_defaults: CrawlerSettings

