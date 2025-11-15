import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Container,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Fade,
  Skeleton,
  Tooltip,
} from '@mui/material'
import {
  PlayArrow,
  History,
  Link as LinkIcon,
  Delete,
  Speed,
  CheckCircle,
  Error,
  Pause,
  AutoAwesome,
  Analytics as AnalyticsIcon,
  Timeline,
  Settings,
  GetApp,
} from '@mui/icons-material'
import { FormControlLabel, Checkbox } from '@mui/material'
import { crawlApi, CrawlJobCreate } from '../services/api'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [maxDepth, setMaxDepth] = useState(10)
  const [maxPages, setMaxPages] = useState(10000)
  const [unlimitedPages, setUnlimitedPages] = useState(false)

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => crawlApi.listJobs(0, 20),
    // Durum değişikliklerini yakalamak için daima taze tut
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: (data) => {
      const hasActive = (data as any)?.some?.((j: any) => ['running', 'pending', 'paused'].includes(j.status))
      return hasActive ? 2000 : false
    },
  })

  // İstatistikler hesapla
  const stats = {
    total: jobs.length,
    running: jobs.filter((j) => j.status === 'running').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    totalPages: jobs.reduce((sum, j) => sum + j.pages_crawled, 0),
  }

  const deleteMutation = useMutation({
    mutationFn: (jobId: number) => crawlApi.deleteCrawl(jobId),
    onSuccess: () => {
      toast.success('Crawl silindi')
      refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Silme işlemi başarısız')
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: () => crawlApi.deleteAllJobs(),
    onSuccess: (data) => {
      toast.success(`${data.deleted_count} crawl başarıyla silindi`)
      refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Silme işlemi başarısız')
    },
  })

  const handleDeleteAll = () => {
    if (jobs.length === 0) {
      toast.error('Silinecek crawl yok')
      return
    }
    if (window.confirm(`Tüm ${jobs.length} crawl'ı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
      deleteAllMutation.mutate()
    }
  }

  const handleDelete = (jobId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Bu crawl\'ı silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(jobId)
    }
  }

  const startCrawlMutation = useMutation({
    mutationFn: (data: CrawlJobCreate) => crawlApi.startCrawl(data),
    onSuccess: (job) => {
      toast.success('Crawl başlatıldı!', {
        icon: '🚀',
        style: {
          borderRadius: '10px',
          background: '#1a1f3a',
          color: '#e0e0e0',
        },
      })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      navigate(`/crawl/${job.id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Bir hata oluştu')
    },
  })

  const handleStartCrawl = () => {
    const trimmedUrl = url.trim()
    
    if (!trimmedUrl) {
      toast.error('Lütfen bir URL girin')
      return
    }

    // URL formatını kontrol et
    let validUrl: string
    try {
      const urlObj = new URL(trimmedUrl)
      validUrl = urlObj.href
    } catch {
      // Eğer protocol yoksa ekle
      try {
        const urlWithProtocol = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') 
          ? trimmedUrl 
          : `https://${trimmedUrl}`
        const urlObj = new URL(urlWithProtocol)
        validUrl = urlObj.href
      } catch {
        toast.error('Geçersiz URL formatı')
        return
      }
    }

    startCrawlMutation.mutate({
      base_url: validUrl,
      max_depth: maxDepth,
      max_pages: unlimitedPages ? 999999 : maxPages,
    })
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
        pb: 4,
      }}
    >
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Hero Section */}
        <Fade in timeout={600}>
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AutoAwesome sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography
                    variant="h2"
                    fontWeight={800}
                    sx={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Web Crawler
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    Gelişmiş ve ölçeklenebilir web tarayıcı ile sitenizi analiz edin
                  </Typography>
                </Box>
              </Box>
              
              {/* Navigation Buttons */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<AnalyticsIcon />}
                  onClick={() => navigate('/analytics')}
                  sx={{ minWidth: 130 }}
                >
                  Analytics
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<GetApp />}
                  onClick={() => navigate('/exports')}
                  sx={{ minWidth: 130 }}
                >
                  İndirme Merkezi
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Settings />}
                  onClick={() => navigate('/settings')}
                  sx={{ minWidth: 130 }}
                >
                  Ayarlar
                </Button>
              </Box>
            </Box>
          </Box>
        </Fade>

        {/* Stats Cards */}
        <Fade in timeout={800}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(99, 102, 241, 0.4)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>
                        {stats.total}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Toplam Job
                      </Typography>
                    </Box>
                    <AnalyticsIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(16, 185, 129, 0.4)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>
                        {stats.running}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Çalışan
                      </Typography>
                    </Box>
                    <Speed sx={{ fontSize: 40, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(59, 130, 246, 0.4)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>
                        {stats.completed}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Tamamlanan
                      </Typography>
                    </Box>
                    <CheckCircle sx={{ fontSize: 40, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(245, 158, 11, 0.4)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>
                        {stats.totalPages.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Toplam Sayfa
                      </Typography>
                    </Box>
                    <Timeline sx={{ fontSize: 40, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Fade>

        <Grid container spacing={3}>
          {/* Yeni Crawl Form */}
          <Grid item xs={12} lg={5}>
            <Fade in timeout={1000}>
              <Card
                sx={{
                  height: '100%',
                  background: 'rgba(26, 31, 58, 0.6)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <PlayArrow sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h5" fontWeight={600}>
                      Yeni Crawl Başlat
                    </Typography>
                  </Box>

                  <TextField
                    fullWidth
                    label="Website URL"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    sx={{ mb: 2 }}
                    InputProps={{
                      startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleStartCrawl()
                    }}
                  />

                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Maksimum Derinlik"
                        value={maxDepth}
                        onChange={(e) => setMaxDepth(Number(e.target.value))}
                        inputProps={{ min: 1, max: 50 }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Maksimum Sayfa"
                        value={maxPages}
                        onChange={(e) => setMaxPages(Number(e.target.value))}
                        inputProps={{ min: 1 }}
                        disabled={unlimitedPages}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={unlimitedPages}
                            onChange={(e) => {
                              setUnlimitedPages(e.target.checked)
                              if (e.target.checked) {
                                setMaxPages(999999)
                              }
                            }}
                            sx={{
                              color: 'primary.main',
                              '&.Mui-checked': {
                                color: 'primary.main',
                              },
                            }}
                          />
                        }
                        label="Tüm Sayfaları Çek (Sınırsız)"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            color: 'text.primary',
                            fontWeight: 500,
                          },
                        }}
                      />
                    </Grid>
                  </Grid>

                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={<PlayArrow />}
                    onClick={handleStartCrawl}
                    disabled={startCrawlMutation.isPending}
                    sx={{
                      py: 1.5,
                      fontSize: '1rem',
                      fontWeight: 600,
                    }}
                  >
                    {startCrawlMutation.isPending ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      'Crawl Başlat'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          {/* Job Listesi */}
          <Grid item xs={12} lg={7}>
            <Fade in timeout={1200}>
              <Card
                sx={{
                  background: 'rgba(26, 31, 58, 0.6)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <History sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h5" fontWeight={600}>
                        Geçmiş Crawl'lar
                      </Typography>
                    </Box>
                    {jobs.length > 0 && (
                      <Tooltip title="Tümünü Sil">
                        <IconButton
                          color="error"
                          onClick={handleDeleteAll}
                          disabled={deleteAllMutation.isPending}
                          sx={{
                            '&:hover': {
                              bgcolor: 'rgba(239, 68, 68, 0.1)',
                            },
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {isLoading ? (
                    <Box>
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
                      ))}
                    </Box>
                  ) : jobs.length === 0 ? (
                    <Alert
                      severity="info"
                      sx={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      Henüz crawl başlatılmamış. İlk crawl'ınızı başlatın!
                    </Alert>
                  ) : (
                    <Box sx={{ maxHeight: 600, overflowY: 'auto' }}>
                      {jobs.map((job, index) => (
                        <JobCard key={job.id} job={job} index={index} onDelete={handleDelete} />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

// Job Card Component
const JobCard = ({ 
  job, 
  index, 
  onDelete 
}: { 
  job: any
  index: number
  onDelete: (jobId: number, e: React.MouseEvent) => void
}) => {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Speed sx={{ fontSize: 20 }} />
      case 'completed':
        return <CheckCircle sx={{ fontSize: 20 }} />
      case 'failed':
        return <Error sx={{ fontSize: 20 }} />
      case 'paused':
        return <Pause sx={{ fontSize: 20 }} />
      default:
        return <CheckCircle sx={{ fontSize: 20 }} />
    }
  }

  const getStatusColor = (status: string) => {
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

  return (
    <Fade in timeout={300 + index * 100}>
      <Paper
        sx={{
          p: 2.5,
          mb: 2,
          cursor: 'pointer',
          background: hovered
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)'
            : 'rgba(26, 31, 58, 0.4)',
          border: '1px solid',
          borderColor: hovered ? 'primary.main' : 'rgba(99, 102, 241, 0.1)',
          transition: 'all 0.3s',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            transform: 'translateX(8px)',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
            borderRight: '3px solid',
            borderRightColor: 'primary.main',
          },
        }}
        onClick={() => navigate(`/crawl/${job.id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Tooltip title="Sil">
          <IconButton
            size="small"
            color="error"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm('Bu crawl\'ı silmek istediğinize emin misiniz?')) {
                onDelete(job.id, e)
              }
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0, pr: 4 }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            noWrap
            sx={{
              mb: 1,
              background: 'linear-gradient(135deg, #e0e0e0 0%, #a0a0a0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {job.base_url}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Chip
              icon={getStatusIcon(job.status)}
              label={job.status}
              size="small"
              color={getStatusColor(job.status) as any}
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label={`${job.pages_crawled} sayfa`}
              size="small"
              variant="outlined"
              sx={{ borderColor: 'primary.main', color: 'primary.main' }}
            />
            {job.status === 'running' && (
              <Chip
                label={`Derinlik: ${job.max_depth}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      </Paper>
    </Fade>
  )
}

export default Dashboard

