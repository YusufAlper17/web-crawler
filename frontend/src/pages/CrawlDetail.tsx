import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, useEffect } from 'react'
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  LinearProgress,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Fade,
  Tabs,
  Tab,
  Tooltip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  InputAdornment,
  Link,
  Checkbox,
} from '@mui/material'
import {
  ArrowBack,
  PlayArrow,
  Pause,
  Stop,
  Link as LinkIcon,
  CheckCircle,
  Cancel,
  Speed,
  Error as ErrorIcon,
  Timeline,
  AccountTree,
  TableChart,
  BarChart,
  Search,
  OpenInNew,
  FilterList,
  SelectAll,
  Deselect,
  FileDownload,
} from '@mui/icons-material'
import { crawlApi, TreeNode, Page } from '../services/api'
import TreeVisualization from '../components/TreeVisualization'
import toast from 'react-hot-toast'

const CrawlDetail = () => {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [nodeDetailsDialog, setNodeDetailsDialog] = useState<{
    open: boolean
    node: TreeNode | null
  }>({ open: false, node: null })
  const [activeTab, setActiveTab] = useState(0) // Tablo görünümü varsayılan
  const [pages, setPages] = useState<Page[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [scrollToNodeId, setScrollToNodeId] = useState<string | null>(null)
  const previousTreeNodes = useRef<number>(0)

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['crawlJob', jobId],
    queryFn: () => crawlApi.getCrawlJob(Number(jobId)),
    enabled: !!jobId,
    refetchInterval: (queryState) => {
      const data = queryState.state.data
      if (data?.status === 'running' || data?.status === 'pending') {
        return 2000 // 2 saniyede bir güncelle
      }
      return false
    },
  })

  const { data: status } = useQuery({
    queryKey: ['crawlStatus', jobId],
    queryFn: () => crawlApi.getCrawlStatus(Number(jobId)),
    enabled: !!jobId,
    refetchInterval: (queryState) => {
      const data = queryState.state.data
      if (data?.status === 'running' || data?.status === 'pending') {
        return 1000 // 1 saniyede bir güncelle
      }
      return false
    },
  })

  const { data: tree, isLoading: treeLoading } = useQuery({
    queryKey: ['crawlTree', jobId],
    queryFn: () => crawlApi.getCrawlTree(Number(jobId)),
    enabled: !!jobId,
    refetchInterval: () => {
      const statusData = queryClient.getQueryData(['crawlStatus', jobId]) as any
      const jobData = queryClient.getQueryData(['crawlJob', jobId]) as any
      if (statusData?.status === 'running' || statusData?.status === 'pending' || 
          jobData?.status === 'running' || jobData?.status === 'pending') {
        return 1500 // 1.5 saniyede bir güncelle - status ile senkronize
      }
      return false
    },
  })

  // Pages query
  const { data: pagesData, isLoading: pagesDataLoading, refetch: refetchPages } = useQuery({
    queryKey: ['crawlPages', jobId, page, rowsPerPage],
    queryFn: () => crawlApi.getCrawlPages(Number(jobId), rowsPerPage === -1 ? 0 : page * rowsPerPage, rowsPerPage === -1 ? undefined : rowsPerPage),
    enabled: !!jobId && activeTab === 0,
    refetchInterval: () => {
      const statusData = queryClient.getQueryData(['crawlStatus', jobId]) as any
      const jobData = queryClient.getQueryData(['crawlJob', jobId]) as any
      if (statusData?.status === 'running' || statusData?.status === 'pending' || 
          jobData?.status === 'running' || jobData?.status === 'pending') {
        return 2000 // 2 saniyede bir güncelle
      }
      return false
    },
  })

  // Çalışma zamanı ayarları (serverless "step" modunu algılamak için)
  const { data: runtimeSettings } = useQuery({
    queryKey: ['runtimeSettings'],
    queryFn: () => crawlApi.getRuntimeSettings(),
    staleTime: Infinity,
    retry: false,
  })

  const steppingRef = useRef(false)

  useEffect(() => {
    if (pagesData) {
      setPages(pagesData)
    }
  }, [pagesData])

  // Serverless (Vercel) modunda crawl'ı adım adım ilerlet
  useEffect(() => {
    if (runtimeSettings?.crawl_mode !== 'step' || !jobId) return
    const currentStatus = status?.status || job?.status
    if (currentStatus !== 'running' && currentStatus !== 'pending') return
    if (steppingRef.current) return

    let cancelled = false
    const drive = async () => {
      steppingRef.current = true
      try {
        while (!cancelled) {
          const res = await crawlApi.stepCrawl(Number(jobId))
          queryClient.invalidateQueries({ queryKey: ['crawlStatus', jobId] })
          queryClient.invalidateQueries({ queryKey: ['crawlJob', jobId] })
          queryClient.invalidateQueries({ queryKey: ['crawlPages', jobId] })
          queryClient.invalidateQueries({ queryKey: ['crawlTree', jobId] })
          if (res.status !== 'running' && res.status !== 'pending') break
          await new Promise((r) => setTimeout(r, 350))
        }
      } catch {
        // Adım hatası: polling durumu zaten yansıtacak
      } finally {
        steppingRef.current = false
      }
    }
    drive()
    return () => {
      cancelled = true
    }
  }, [runtimeSettings?.crawl_mode, status?.status, job?.status, jobId, queryClient])

  // Tab değiştiğinde pages'ı yükle
  useEffect(() => {
    if (activeTab === 0 && jobId) {
      refetchPages()
    }
  }, [activeTab, jobId, refetchPages])

  // Yeni node eklendiğinde son node'a scroll yap
  useEffect(() => {
    if (tree && tree.total_nodes > previousTreeNodes.current && previousTreeNodes.current > 0) {
      // En derin veya en son eklenen node'u bul
      const findDeepestNode = (node: TreeNode, maxDepth: { value: number; node: TreeNode }): TreeNode => {
        if (node.children.length === 0) {
          if (node.depth > maxDepth.value) {
            maxDepth.value = node.depth
            maxDepth.node = node
          }
          return node
        }
        let deepest = node
        node.children.forEach((child) => {
          const childDeepest = findDeepestNode(child, maxDepth)
          if (childDeepest.depth > deepest.depth) {
            deepest = childDeepest
          }
        })
        return deepest
      }

      const maxDepth = { value: 0, node: tree.root }
      const deepestNode = findDeepestNode(tree.root, maxDepth)
      
      // En derin node'a scroll yap
      setScrollToNodeId(deepestNode.id)
      setTimeout(() => setScrollToNodeId(null), 1500)
    }
    previousTreeNodes.current = tree?.total_nodes || 0
  }, [tree])

  const pauseMutation = useMutation({
    mutationFn: () => crawlApi.pauseCrawl(Number(jobId)),
    onSuccess: () => {
      toast.success('Crawl duraklatıldı')
      queryClient.invalidateQueries({ queryKey: ['crawlJob', jobId] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const resumeMutation = useMutation({
    mutationFn: () => crawlApi.resumeCrawl(Number(jobId)),
    onSuccess: () => {
      toast.success('Crawl devam ediyor')
      queryClient.invalidateQueries({ queryKey: ['crawlJob', jobId] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => crawlApi.cancelCrawl(Number(jobId)),
    onSuccess: () => {
      toast.success('Crawl iptal edildi')
      queryClient.invalidateQueries({ queryKey: ['crawlJob', jobId] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const handleNodeSelect = (node: TreeNode) => {
    const newSelected = new Set(selectedNodes)
    if (newSelected.has(node.id)) {
      newSelected.delete(node.id)
    } else {
      newSelected.add(node.id)
    }
    setSelectedNodes(newSelected)
    setNodeDetailsDialog({ open: true, node })
    // Seçilen node'a scroll yap
    setScrollToNodeId(node.id)
    setTimeout(() => setScrollToNodeId(null), 1000)
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'running':
        return 'primary'
      case 'failed':
        return 'error'
      case 'paused':
        return 'warning'
      default:
        return 'default'
    }
  }

  if (jobLoading || !job) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        pb: 4,
      }}
    >
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Fade in timeout={600}>
          <Card
            sx={{
              mb: 3,
              backgroundColor: 'background.paper',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  onClick={() => navigate('/')}
                  sx={{
                    '&:hover': {
                      background: '#ECEDFE',
                      transform: 'scale(1.1)',
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  <ArrowBack />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="h4"
                    fontWeight={700}
                    sx={{
                      mb: 1,
                      color: 'text.primary',
                    }}
                  >
                    {job.base_url}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip
                      icon={
                        job.status === 'running' ? (
                          <Speed sx={{ fontSize: 16 }} />
                        ) : job.status === 'completed' ? (
                          <CheckCircle sx={{ fontSize: 16 }} />
                        ) : job.status === 'failed' ? (
                          <ErrorIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <Pause sx={{ fontSize: 16 }} />
                        )
                      }
                      label={job.status}
                      color={getStatusColor(job.status) as any}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                    <Chip
                      label={`${job.pages_crawled} sayfa çekildi`}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: 'primary.main', color: 'primary.main' }}
                    />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {job.status === 'running' && (
                    <Button
                      variant="outlined"
                      startIcon={<Pause />}
                      onClick={() => pauseMutation.mutate()}
                      sx={{ minWidth: 120 }}
                    >
                      Duraklat
                    </Button>
                  )}
                  {job.status === 'paused' && (
                    <Button
                      variant="contained"
                      startIcon={<PlayArrow />}
                      onClick={() => resumeMutation.mutate()}
                      sx={{ minWidth: 120 }}
                    >
                      Devam Et
                    </Button>
                  )}
                  {(job.status === 'running' || job.status === 'paused') && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Stop />}
                      onClick={() => cancelMutation.mutate()}
                      sx={{ minWidth: 120 }}
                    >
                      İptal Et
                    </Button>
                  )}
                  
                  {/* Export Butonları */}
                  {(job.status === 'completed' || job.pages_crawled > 0 || job.status === 'running' || job.status === 'paused') && (
                    <>
                      <Tooltip title="İndirme Seçenekleri (işlemi duraklatarak)">
                        <Button
                          variant="outlined"
                          size="medium"
                          startIcon={<FileDownload />}
                          onClick={async () => {
                            try {
                              if (job.status === 'running') {
                                await crawlApi.pauseCrawl(Number(jobId))
                                toast.success('Crawl duraklatıldı')
                              }
                              navigate('/exports')
                            } catch (e) {
                              navigate('/exports')
                            }
                          }}
                          sx={{ minWidth: 180 }}
                        >
                          İndirme Seçenekleri
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>

        {/* Progress */}
        {status && (status.status === 'running' || status.status === 'pending' || status.status === 'completed') && (
          <Fade in timeout={800}>
            <Card
              sx={{
                mb: 3,
                backgroundColor: 'background.paper',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      İlerleme Durumu
                    </Typography>
                  </Box>
                  <Typography
                    variant="h5"
                    sx={{
                      color: 'primary.main',
                      fontWeight: 700,
                    }}
                  >
                    {status.progress.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={status.progress}
                  sx={{
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: 'rgba(27, 31, 39, 0.08)',
                    mb: 3,
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 7,
                      backgroundColor: 'primary.main',
                    },
                  }}
                />
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        background: '#E4F5E9',
                        border: '1px solid #C8E6C9',
                      }}
                    >
                      <Typography variant="h4" color="success.main" fontWeight={700}>
                        {status.pages_crawled}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Çekilen Sayfa
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        background: '#FCE9E7',
                        border: '1px solid #F5C6C2',
                      }}
                    >
                      <Typography variant="h4" color="error.main" fontWeight={700}>
                        {status.pages_failed}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Başarısız
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        background: '#ECEDFE',
                        border: '1px solid #DDDEFF',
                      }}
                    >
                      <Typography variant="h4" color="primary.main" fontWeight={700}>
                        {status.total_pages}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Toplam İşlem
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        background: '#F3F4FE',
                        border: '1px solid #E3E4FE',
                      }}
                    >
                      <Typography variant="h4" color="text.primary" fontWeight={700}>
                        {job.max_pages}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Maksimum Sayfa
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* Tabs */}
        <Fade in timeout={1000}>
          <Card
            sx={{
              mb: 3,
              backgroundColor: 'background.paper',
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  minHeight: 64,
                },
              }}
            >
              <Tab icon={<TableChart />} iconPosition="start" label="Tablo Görünümü" />
              <Tab icon={<AccountTree />} iconPosition="start" label="Ağaç Görünümü" />
              <Tab icon={<BarChart />} iconPosition="start" label="İstatistikler" />
            </Tabs>
          </Card>
        </Fade>

        <Grid container spacing={3}>
          {/* Tablo Görünümü */}
          {activeTab === 0 && (
            <Grid item xs={12}>
              <Fade in timeout={1200}>
                <Card
                  sx={{
                    backgroundColor: 'background.paper',
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="h6" fontWeight={600}>
                          Çekilen Sayfalar ({job.pages_crawled})
                        </Typography>
                        {selectedPages.size > 0 && (
                          <Chip
                            label={`${selectedPages.size} seçili`}
                            color="primary"
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        {pages.length > 0 && (
                          <>
                            <Tooltip title="Tümünü Seç">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const filteredPages = pages.filter((p) => {
                                    if (searchQuery) {
                                      const query = searchQuery.toLowerCase()
                                      if (!p.url.toLowerCase().includes(query) && !(p.title && p.title.toLowerCase().includes(query))) {
                                        return false
                                      }
                                    }
                                    if (statusFilter === '200' && (!p.status_code || p.status_code >= 400)) return false
                                    if (statusFilter === '400' && (!p.status_code || p.status_code < 400)) return false
                                    return true
                                  })
                                  setSelectedPages(new Set(filteredPages.map(p => p.id)))
                                }}
                                sx={{
                                  bgcolor: '#f8f9fa',
                                  '&:hover': { bgcolor: '#E3E4FE' },
                                }}
                              >
                                <SelectAll />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Seçimi Temizle">
                              <IconButton
                                size="small"
                                onClick={() => setSelectedPages(new Set())}
                                sx={{
                                  bgcolor: '#FCE9E7',
                                  '&:hover': { bgcolor: '#FCE9E7' },
                                }}
                              >
                                <Deselect />
                              </IconButton>
                            </Tooltip>
                            {selectedPages.size > 0 && (
                              <Tooltip title="Seçilenleri İndirme Merkezi'nde Aç">
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<FileDownload />}
                                  onClick={() => {
                                    // Seçilen sayfaları localStorage'a kaydet ve İndirme Merkezi'ne git
                                    localStorage.setItem('selectedPages', JSON.stringify(Array.from(selectedPages)))
                                    localStorage.setItem('selectedJobId', String(job.id))
                                    navigate('/exports')
                                  }}
                                  sx={{
                                    backgroundColor: 'primary.main',
                                    '&:hover': {
                                      backgroundColor: 'primary.dark',
                                    },
                                  }}
                                >
                                  Seçilenleri İndir ({selectedPages.size})
                                </Button>
                              </Tooltip>
                            )}
                          </>
                        )}
                        <TextField
                          size="small"
                          placeholder="URL veya başlık ara..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search sx={{ color: 'text.secondary' }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{ minWidth: 250 }}
                        />
                        <Tooltip title="Status Filtrele">
                          <IconButton
                            onClick={() => {
                              if (statusFilter === null) setStatusFilter('200')
                              else if (statusFilter === '200') setStatusFilter('400')
                              else setStatusFilter(null)
                            }}
                            sx={{
                              bgcolor: statusFilter ? 'primary.main' : 'transparent',
                              color: statusFilter ? 'white' : 'text.secondary',
                              '&:hover': {
                                bgcolor: statusFilter ? 'primary.dark' : '#ECEDFE',
                              },
                            }}
                          >
                            <FilterList />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {pagesDataLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                      </Box>
                    ) : !pages || pages.length === 0 ? (
                      <Alert
                        severity="info"
                        sx={{
                          background: '#ECEDFE',
                          border: '1px solid #DDDEFF',
                        }}
                      >
                        {job?.status === 'running' || job?.status === 'pending'
                          ? 'Sayfalar çekiliyor...'
                          : 'Henüz sayfa çekilmemiş'}
                      </Alert>
                    ) : (
                      <>
                        <TableContainer
                          component={Paper}
                          sx={{
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            maxHeight: 600,
                          }}
                        >
                          <Table stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell padding="checkbox" sx={{ fontWeight: 600, bgcolor: '#f8f9fa' }}>
                                  <Checkbox
                                    indeterminate={selectedPages.size > 0 && selectedPages.size < pages.filter((p) => {
                                      if (searchQuery) {
                                        const query = searchQuery.toLowerCase()
                                        if (!p.url.toLowerCase().includes(query) && !(p.title && p.title.toLowerCase().includes(query))) {
                                          return false
                                        }
                                      }
                                      if (statusFilter === '200' && (!p.status_code || p.status_code >= 400)) return false
                                      if (statusFilter === '400' && (!p.status_code || p.status_code < 400)) return false
                                      return true
                                    }).length}
                                    checked={pages.length > 0 && pages.filter((p) => {
                                      if (searchQuery) {
                                        const query = searchQuery.toLowerCase()
                                        if (!p.url.toLowerCase().includes(query) && !(p.title && p.title.toLowerCase().includes(query))) {
                                          return false
                                        }
                                      }
                                      if (statusFilter === '200' && (!p.status_code || p.status_code >= 400)) return false
                                      if (statusFilter === '400' && (!p.status_code || p.status_code < 400)) return false
                                      return true
                                    }).every(p => selectedPages.has(p.id))}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                      if (e.target.checked) {
                                        const filteredPages = pages.filter((p) => {
                                          if (searchQuery) {
                                            const query = searchQuery.toLowerCase()
                                            if (!p.url.toLowerCase().includes(query) && !(p.title && p.title.toLowerCase().includes(query))) {
                                              return false
                                            }
                                          }
                                          if (statusFilter === '200' && (!p.status_code || p.status_code >= 400)) return false
                                          if (statusFilter === '400' && (!p.status_code || p.status_code < 400)) return false
                                          return true
                                        })
                                        setSelectedPages(new Set([...selectedPages, ...filteredPages.map(p => p.id)]))
                                      } else {
                                        const filteredPages = pages.filter((p) => {
                                          if (searchQuery) {
                                            const query = searchQuery.toLowerCase()
                                            if (!p.url.toLowerCase().includes(query) && !(p.title && p.title.toLowerCase().includes(query))) {
                                              return false
                                            }
                                          }
                                          if (statusFilter === '200' && (!p.status_code || p.status_code >= 400)) return false
                                          if (statusFilter === '400' && (!p.status_code || p.status_code < 400)) return false
                                          return true
                                        })
                                        const newSelected = new Set(selectedPages)
                                        filteredPages.forEach(p => newSelected.delete(p.id))
                                        setSelectedPages(newSelected)
                                      }
                                    }}
                                    color="primary"
                                  />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8f9fa' }}>
                                  URL
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8f9fa' }}>
                                  Başlık
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ fontWeight: 600, bgcolor: '#f8f9fa' }}
                                >
                                  Derinlik
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ fontWeight: 600, bgcolor: '#f8f9fa' }}
                                >
                                  Status
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ fontWeight: 600, bgcolor: '#f8f9fa' }}
                                >
                                  Tarih
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ fontWeight: 600, bgcolor: '#f8f9fa' }}
                                >
                                  İşlemler
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {pages
                                .filter((p) => {
                                  if (searchQuery) {
                                    const query = searchQuery.toLowerCase()
                                    return (
                                      p.url.toLowerCase().includes(query) ||
                                      (p.title && p.title.toLowerCase().includes(query))
                                    )
                                  }
                                  return true
                                })
                                .filter((p) => {
                                  if (statusFilter === '200') return p.status_code && p.status_code < 400
                                  if (statusFilter === '400') return p.status_code && p.status_code >= 400
                                  return true
                                })
                                .map((page) => (
                                  <TableRow
                                    key={page.id}
                                    sx={{
                                      '&:hover': {
                                        bgcolor: '#f8f9fa',
                                      },
                                      bgcolor: selectedPages.has(page.id) ? '#E7F0FE' : 'transparent',
                                    }}
                                  >
                                    <TableCell padding="checkbox">
                                      <Checkbox
                                        checked={selectedPages.has(page.id)}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                          const newSelected = new Set(selectedPages)
                                          if (e.target.checked) {
                                            newSelected.add(page.id)
                                          } else {
                                            newSelected.delete(page.id)
                                          }
                                          setSelectedPages(newSelected)
                                        }}
                                        color="primary"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Link
                                          href={page.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          sx={{
                                            color: 'primary.main',
                                            textDecoration: 'none',
                                            '&:hover': { textDecoration: 'underline' },
                                            maxWidth: 400,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {page.url}
                                        </Link>
                                        <IconButton
                                          size="small"
                                          onClick={() => window.open(page.url, '_blank')}
                                          sx={{ color: 'text.secondary' }}
                                        >
                                          <OpenInNew fontSize="small" />
                                        </IconButton>
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          maxWidth: 300,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {page.title || '-'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                      <Chip
                                        label={page.depth}
                                        size="small"
                                        variant="outlined"
                                        sx={{ borderColor: 'primary.main', color: 'primary.main' }}
                                      />
                                    </TableCell>
                                    <TableCell align="center">
                                      {page.status_code ? (
                                        <Chip
                                          label={page.status_code}
                                          size="small"
                                          color={page.status_code < 400 ? 'success' : 'error'}
                                          sx={{ fontWeight: 600 }}
                                        />
                                      ) : (
                                        <Typography variant="body2" color="text.secondary">
                                          -
                                        </Typography>
                                      )}
                                    </TableCell>
                                    <TableCell align="center">
                                      <Typography variant="caption" color="text.secondary">
                                        {new Date(page.crawled_at).toLocaleDateString('tr-TR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                      <Tooltip title="Detayları Görüntüle">
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            const node: TreeNode = {
                                              id: String(page.id),
                                              url: page.url,
                                              title: page.title,
                                              depth: page.depth,
                                              children: [],
                                              has_article: !!page.title,
                                              status_code: page.status_code,
                                            }
                                            handleNodeSelect(node)
                                          }}
                                        >
                                          <LinkIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <TablePagination
                          component="div"
                          count={job.pages_crawled}
                          page={page}
                          onPageChange={(_, newPage) => setPage(newPage)}
                          rowsPerPage={rowsPerPage}
                          onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10))
                            setPage(0)
                          }}
                          rowsPerPageOptions={[10, 25, 50, 100, { value: -1, label: 'Sınırsız' }]}
                          labelRowsPerPage="Sayfa başına:"
                          labelDisplayedRows={({ from, to, count }) => {
                            if (rowsPerPage === -1) {
                              return `Tümü (${count !== -1 ? count : job.pages_crawled})`
                            }
                            return `${from}-${to} / ${count !== -1 ? count : `~${job.pages_crawled}`}`
                          }}
                          sx={{
                            color: 'text.secondary',
                            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                              color: 'text.secondary',
                            },
                          }}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </Fade>
              
              {/* Tablo Görünümü İstatistikleri */}
              {pages && pages.length > 0 && (
                <Fade in timeout={1400}>
                  <Card
                    sx={{
                      mt: 3,
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        Tablo İstatistikleri
                      </Typography>
                      <Divider sx={{ mb: 2, borderColor: 'divider' }} />
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#ECEDFE',
                              border: '1px solid #DDDEFF',
                            }}
                          >
                            <Typography variant="h4" color="primary.main" fontWeight={700}>
                              {pages.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Görüntülenen Sayfa
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#E4F5E9',
                              border: '1px solid #C8E6C9',
                            }}
                          >
                            <Typography variant="h4" color="success.main" fontWeight={700}>
                              {pages.filter((p) => p.status_code && p.status_code < 400).length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Başarılı Sayfa
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#FCE9E7',
                              border: '1px solid #F5C6C2',
                            }}
                          >
                            <Typography variant="h4" color="error.main" fontWeight={700}>
                              {pages.filter((p) => p.status_code && p.status_code >= 400).length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Hatalı Sayfa
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#FDF0DC',
                              border: '1px solid #FADCAB',
                            }}
                          >
                            <Typography variant="h4" color="warning.main" fontWeight={700}>
                              {Math.max(...pages.map((p) => p.depth), 0)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Maksimum Derinlik
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Fade>
              )}
            </Grid>
          )}

          {/* Ağaç Görünümü */}
          {activeTab === 1 && (
            <Grid item xs={12}>
              <Fade in timeout={1200}>
                <Card
                  sx={{
                    backgroundColor: 'background.paper',
                  }}
                >
                  <CardContent>
                    {treeLoading && !tree ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                      </Box>
                    ) : tree && tree.total_nodes > 0 ? (
                      <TreeVisualization
                        data={tree.root}
                        onNodeSelect={handleNodeSelect}
                        selectedNodes={selectedNodes}
                        scrollToNodeId={scrollToNodeId}
                      />
                    ) : (
                      <Alert
                        severity="info"
                        sx={{
                          background: '#ECEDFE',
                          border: '1px solid #DDDEFF',
                        }}
                      >
                        {job?.status === 'running' || job?.status === 'pending'
                          ? 'Sayfalar çekiliyor, ağaç görselleştirmesi yakında güncellenecek...'
                          : "Ağaç görselleştirmesi için crawl'ın başlaması gerekiyor"}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Fade>
              
              {/* Ağaç Görünümü İstatistikleri */}
              {tree && tree.total_nodes > 0 && (
                <Fade in timeout={1400}>
                  <Card
                    sx={{
                      mt: 3,
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        Node İstatistikleri
                      </Typography>
                      <Divider sx={{ mb: 2, borderColor: 'divider' }} />
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#ECEDFE',
                              border: '1px solid #DDDEFF',
                            }}
                          >
                            <Typography variant="h4" color="primary.main" fontWeight={700}>
                              {tree.total_nodes}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Toplam Node
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#E4F5E9',
                              border: '1px solid #C8E6C9',
                            }}
                          >
                            <Typography variant="h4" color="success.main" fontWeight={700}>
                              {tree.max_depth}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Maksimum Derinlik
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#ECEDFE',
                              border: '1px solid #DDDEFF',
                            }}
                          >
                            <Typography variant="h4" color="secondary.main" fontWeight={700}>
                              {selectedNodes.size}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Seçili Node
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#FDF0DC',
                              border: '1px solid #FADCAB',
                            }}
                          >
                            <Typography variant="h4" color="warning.main" fontWeight={700}>
                              {tree.root.children.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Root Alt Node
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Fade>
              )}
            </Grid>
          )}

          {/* İstatistikler Tab */}
          {activeTab === 2 && (
            <>
              {/* Genel İstatistikler */}
              <Grid item xs={12}>
                <Fade in timeout={1200}>
                  <Card
                    sx={{
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        Genel Crawl İstatistikleri
                      </Typography>
                      <Divider sx={{ mb: 3, borderColor: 'divider' }} />
                      <Grid container spacing={3}>
                        <Grid item xs={6} sm={4} md={2}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#ECEDFE',
                              border: '1px solid #DDDEFF',
                            }}
                          >
                            <Typography variant="h4" color="primary.main" fontWeight={700}>
                              {job.pages_crawled}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Çekilen Sayfa
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#FCE9E7',
                              border: '1px solid #F5C6C2',
                            }}
                          >
                            <Typography variant="h4" color="error.main" fontWeight={700}>
                              {job.pages_failed}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Başarısız
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#E4F5E9',
                              border: '1px solid #C8E6C9',
                            }}
                          >
                            <Typography variant="h4" color="success.main" fontWeight={700}>
                              {tree?.total_nodes || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Toplam Node
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#ECEDFE',
                              border: '1px solid #DDDEFF',
                            }}
                          >
                            <Typography variant="h4" color="secondary.main" fontWeight={700}>
                              {tree?.max_depth || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Maksimum Derinlik
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#FDF0DC',
                              border: '1px solid #FADCAB',
                            }}
                          >
                            <Typography variant="h4" color="warning.main" fontWeight={700}>
                              {job.max_pages}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Maksimum Sayfa
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              background: '#E7F0FE',
                              border: '1px solid #C4DAF8',
                            }}
                          >
                            <Typography variant="h4" color="info.main" fontWeight={700}>
                              {job.max_depth}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Maksimum Derinlik
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Fade>
              </Grid>

              {/* Detaylı İstatistikler */}
              <Grid item xs={12} md={6}>
                <Fade in timeout={1400}>
                  <Card
                    sx={{
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        Detaylı Bilgiler
                      </Typography>
                      <Divider sx={{ mb: 2, borderColor: 'divider' }} />
                      <List>
                        <ListItem>
                          <ListItemText
                            primary="Başlangıç URL"
                            secondary={job.base_url}
                            primaryTypographyProps={{ fontWeight: 600 }}
                            secondaryTypographyProps={{ sx: { wordBreak: 'break-all' } }}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText
                            primary="Durum"
                            secondary={job.status}
                            primaryTypographyProps={{ fontWeight: 600 }}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText
                            primary="Oluşturulma Tarihi"
                            secondary={new Date(job.created_at).toLocaleString('tr-TR')}
                            primaryTypographyProps={{ fontWeight: 600 }}
                          />
                        </ListItem>
                        {job.started_at && (
                          <ListItem>
                            <ListItemText
                              primary="Başlangıç Tarihi"
                              secondary={new Date(job.started_at).toLocaleString('tr-TR')}
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                        )}
                        {job.completed_at && (
                          <ListItem>
                            <ListItemText
                              primary="Tamamlanma Tarihi"
                              secondary={new Date(job.completed_at).toLocaleString('tr-TR')}
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                        )}
                        {job.started_at && job.completed_at && (
                          <ListItem>
                            <ListItemText
                              primary="Süre"
                              secondary={`${Math.round(
                                (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000
                              )} saniye`}
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                        )}
                        <ListItem>
                          <ListItemText
                            primary="Başarı Oranı"
                            secondary={
                              job.pages_crawled + job.pages_failed > 0
                                ? `${Math.round((job.pages_crawled / (job.pages_crawled + job.pages_failed)) * 100)}%`
                                : '0%'
                            }
                            primaryTypographyProps={{ fontWeight: 600 }}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText
                            primary="İlerleme"
                            secondary={
                              job.max_pages > 0
                                ? `${Math.round((job.pages_crawled / job.max_pages) * 100)}%`
                                : 'Hesaplanamıyor'
                            }
                            primaryTypographyProps={{ fontWeight: 600 }}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Fade>
              </Grid>

              {/* Seçili Node'lar */}
              <Grid item xs={12} md={6}>
                <Fade in timeout={1400}>
                  <Card
                    sx={{
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        Seçili Linkler ({selectedNodes.size})
                      </Typography>
                      <Divider sx={{ mb: 2, borderColor: 'divider' }} />
                      {selectedNodes.size === 0 ? (
                        <Alert
                          severity="info"
                          sx={{
                            background: '#ECEDFE',
                            border: '1px solid #DDDEFF',
                          }}
                        >
                          Henüz link seçilmedi
                        </Alert>
                      ) : (
                        <List>
                          {Array.from(selectedNodes).map((nodeId) => {
                            const findNode = (node: TreeNode): TreeNode | null => {
                              if (node.id === nodeId) return node
                              for (const child of node.children) {
                                const found = findNode(child)
                                if (found) return found
                              }
                              return null
                            }
                            const node = tree ? findNode(tree.root) : null
                            if (!node) return null

                            return (
                              <Paper
                                key={nodeId}
                                sx={{
                                  p: 1.5,
                                  mb: 1,
                                  background: '#ECEDFE',
                                  border: '1px solid #E3E4FE',
                                  '&:hover': {
                                    background: '#E3E4FE',
                                  },
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle2" fontWeight={600} noWrap>
                                      {node.title || node.url}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      {node.url}
                                    </Typography>
                                  </Box>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      const newSelected = new Set(selectedNodes)
                                      newSelected.delete(nodeId)
                                      setSelectedNodes(newSelected)
                                    }}
                                  >
                                    <Cancel fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Paper>
                            )
                          })}
                        </List>
                      )}
                    </CardContent>
                  </Card>
                </Fade>
              </Grid>
            </>
          )}
        </Grid>

        {/* Node Details Dialog */}
        <Dialog
          open={nodeDetailsDialog.open}
          onClose={() => setNodeDetailsDialog({ open: false, node: null })}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <DialogTitle
            sx={{
              backgroundColor: 'background.default',
              borderBottom: '1px solid #E3E4FE',
            }}
          >
            Link Detayları
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {nodeDetailsDialog.node && (
              <Box>
                <TextField
                  fullWidth
                  label="URL"
                  value={nodeDetailsDialog.node.url}
                  margin="normal"
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  fullWidth
                  label="Başlık"
                  value={nodeDetailsDialog.node.title || 'Başlık yok'}
                  margin="normal"
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  fullWidth
                  label="Derinlik"
                  value={nodeDetailsDialog.node.depth}
                  margin="normal"
                  InputProps={{ readOnly: true }}
                />
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={nodeDetailsDialog.node.has_article ? 'Makale Var' : 'Makale Yok'}
                    color={nodeDetailsDialog.node.has_article ? 'success' : 'default'}
                    sx={{ fontWeight: 600 }}
                  />
                  {nodeDetailsDialog.node.status_code && (
                    <Chip
                      label={`Status: ${nodeDetailsDialog.node.status_code}`}
                      color={nodeDetailsDialog.node.status_code < 400 ? 'success' : 'error'}
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              onClick={() => setNodeDetailsDialog({ open: false, node: null })}
              variant="outlined"
            >
              Kapat
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  )
}

export default CrawlDetail

