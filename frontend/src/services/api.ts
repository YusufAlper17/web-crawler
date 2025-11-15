import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface CrawlJobCreate {
  base_url: string
  max_depth?: number
  max_pages?: number
}

export interface CrawlJob {
  id: number
  base_url: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  max_depth: number
  max_pages: number
  pages_crawled: number
  pages_failed: number
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface CrawlStatus {
  job_id: number
  status: string
  pages_crawled: number
  pages_failed: number
  total_pages: number
  progress: number
}

export interface Page {
  id: number
  url: string
  title?: string
  depth: number
  status_code?: number
  crawled_at: string
  parent_url?: string
}

export interface TreeNode {
  id: string
  url: string
  title?: string
  depth: number
  children: TreeNode[]
  has_article: boolean
  status_code?: number
}

export interface TreeResponse {
  root: TreeNode
  total_nodes: number
  max_depth: number
}

export const crawlApi = {
  startCrawl: async (data: CrawlJobCreate): Promise<CrawlJob> => {
    const response = await api.post<CrawlJob>('/crawl/start', data)
    return response.data
  },

  getCrawlJob: async (jobId: number): Promise<CrawlJob> => {
    const response = await api.get<CrawlJob>(`/crawl/${jobId}`)
    return response.data
  },

  getCrawlStatus: async (jobId: number): Promise<CrawlStatus> => {
    const response = await api.get<CrawlStatus>(`/crawl/${jobId}/status`)
    return response.data
  },

  getCrawlTree: async (jobId: number): Promise<TreeResponse> => {
    const response = await api.get<TreeResponse>(`/crawl/${jobId}/tree`)
    return response.data
  },

  getCrawlPages: async (jobId: number, skip = 0, limit = 100): Promise<Page[]> => {
    const response = await api.get<Page[]>(`/crawl/${jobId}/pages`, {
      params: { skip, limit },
    })
    return response.data
  },

  pauseCrawl: async (jobId: number): Promise<void> => {
    await api.post(`/crawl/${jobId}/pause`)
  },

  resumeCrawl: async (jobId: number): Promise<void> => {
    await api.post(`/crawl/${jobId}/resume`)
  },

  cancelCrawl: async (jobId: number): Promise<void> => {
    await api.post(`/crawl/${jobId}/cancel`)
  },

  deleteCrawl: async (jobId: number): Promise<void> => {
    await api.delete(`/crawl/${jobId}`)
  },

  listJobs: async (skip = 0, limit = 20): Promise<CrawlJob[]> => {
    const response = await api.get<CrawlJob[]>('/jobs', {
      params: { skip, limit },
    })
    return response.data
  },

  deleteAllJobs: async (): Promise<{ message: string; deleted_count: number }> => {
    const response = await api.delete<{ message: string; deleted_count: number }>('/jobs/all')
    return response.data
  },

  // Export fonksiyonları
  exportJSON: (jobId: number, includeHtml = false): string => {
    return `${API_BASE_URL}/crawl/${jobId}/export/json?include_html=${includeHtml}`
  },

  exportCSV: (jobId: number): string => {
    return `${API_BASE_URL}/crawl/${jobId}/export/csv`
  },

  exportExcel: (jobId: number): string => {
    return `${API_BASE_URL}/crawl/${jobId}/export/excel`
  },

  exportLinksJSON: (jobId: number): string => {
    return `${API_BASE_URL}/crawl/${jobId}/export/links-json`
  },

  exportAllJobsSummary: (): string => {
    return `${API_BASE_URL}/jobs/export/summary`
  },

  // Gelişmiş export fonksiyonları
  exportAdvanced: async (
    jobId: number,
    config: {
      include_fields?: string[]
      exclude_fields?: string[]
      max_content_length?: number
      max_html_length?: number
      include_html: boolean
      include_content: boolean
      include_links: boolean
      include_metadata: boolean
      format: 'json' | 'csv' | 'excel'
    }
  ): Promise<Blob> => {
    const response = await api.post(
      `/crawl/${jobId}/export/advanced`,
      config,
      { responseType: 'blob' }
    )
    return response.data
  },

  bulkExport: async (
    jobIds: number[],
    config: {
      include_fields?: string[]
      exclude_fields?: string[]
      max_content_length?: number
      max_html_length?: number
      include_html: boolean
      include_content: boolean
      include_links: boolean
      include_metadata: boolean
      format: 'json' | 'csv' | 'excel'
    }
  ): Promise<Blob> => {
    const response = await api.post(
      '/crawl/bulk-export',
      { job_ids: jobIds, ...config },
      { responseType: 'blob' }
    )
    return response.data
  },
}

export default api

