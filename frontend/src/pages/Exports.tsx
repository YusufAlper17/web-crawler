import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Fade,
  Divider,
  Checkbox,
  FormControlLabel,
  TextField,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Chip,
  Alert,
  Paper,
  CircularProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  ArrowBack,
  GetApp,
  ExpandMore,
  Settings,
  FileDownload,
  SelectAll,
  Deselect,
} from '@mui/icons-material'
import { crawlApi, CrawlJob } from '../services/api'
import toast from 'react-hot-toast'

interface ExportConfig {
  includeFields: string[]
  excludeFields: string[]
  maxContentLength: number | null
  maxHtmlLength: number | null
  includeHtml: boolean
  includeContent: boolean
  includeLinks: boolean
  includeMetadata: boolean
  format: 'json' | 'csv' | 'excel'
}

const AVAILABLE_FIELDS = [
  { id: 'id', label: 'ID', default: true },
  { id: 'url', label: 'URL', default: true },
  { id: 'title', label: 'Başlık', default: true },
  { id: 'depth', label: 'Derinlik', default: true },
  { id: 'status_code', label: 'Status Kodu', default: true },
  { id: 'content_type', label: 'İçerik Tipi', default: true },
  { id: 'content_length', label: 'İçerik Uzunluğu', default: true },
  { id: 'crawled_at', label: 'Crawl Tarihi', default: true },
  { id: 'parent_url', label: 'Parent URL', default: true },
  { id: 'meta_description', label: 'Meta Açıklama', default: true },
  { id: 'meta_keywords', label: 'Meta Anahtar Kelimeler', default: true },
  { id: 'html_content', label: 'HTML İçeriği', default: false },
  { id: 'content', label: 'Metin İçeriği', default: false },
]

const Exports = () => {
  const navigate = useNavigate()
  const [selectedJobs, setSelectedJobs] = useState<number[]>([])
  const [config, setConfig] = useState<ExportConfig>({
    includeFields: AVAILABLE_FIELDS.filter(f => f.default).map(f => f.id),
    excludeFields: [],
    maxContentLength: null,
    maxHtmlLength: null,
    includeHtml: false,
    includeContent: true,
    includeLinks: true,
    includeMetadata: true,
    format: 'json',
  })

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => crawlApi.listJobs(0, 100),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // CrawlDetail'den gelen seçili sayfaları kontrol et
  useEffect(() => {
    const selectedPages = localStorage.getItem('selectedPages')
    const selectedJobId = localStorage.getItem('selectedJobId')
    
    if (selectedPages && selectedJobId) {
      const jobId = Number(selectedJobId)
      setSelectedJobs([jobId])
      
      // Bilgi mesajı göster
      toast.success(`${JSON.parse(selectedPages).length} sayfa seçili. İndirme konfigürasyonunu yapıp indirebilirsiniz.`, {
        duration: 5000,
      })
      
      // localStorage'ı temizle
      localStorage.removeItem('selectedPages')
      localStorage.removeItem('selectedJobId')
    }
  }, [])

  const exportMutation = useMutation({
    mutationFn: async ({ jobId, config }: { jobId: number; config: any }) => {
      const blob = await crawlApi.exportAdvanced(jobId, config)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export_${jobId}_${new Date().toISOString().split('T')[0]}.${config.format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onSuccess: () => {
      toast.success('İndirme başlatıldı!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'İndirme başarısız')
    },
  })

  const bulkExportMutation = useMutation({
    mutationFn: async ({ jobIds, config }: { jobIds: number[]; config: any }) => {
      const blob = await crawlApi.bulkExport(jobIds, config)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bulk_export_${new Date().toISOString().split('T')[0]}.${config.format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onSuccess: () => {
      toast.success('Toplu indirme başlatıldı!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Toplu indirme başarısız')
    },
  })

  const handleFieldToggle = (fieldId: string) => {
    if (config.includeFields.includes(fieldId)) {
      setConfig({
        ...config,
        includeFields: config.includeFields.filter(f => f !== fieldId),
      })
    } else {
      setConfig({
        ...config,
        includeFields: [...config.includeFields, fieldId],
      })
    }
  }

  const handleSelectAll = () => {
    setConfig({
      ...config,
      includeFields: AVAILABLE_FIELDS.map(f => f.id),
    })
  }

  const handleDeselectAll = () => {
    setConfig({
      ...config,
      includeFields: [],
    })
  }

  const handleSelectDefault = () => {
    setConfig({
      ...config,
      includeFields: AVAILABLE_FIELDS.filter(f => f.default).map(f => f.id),
    })
  }

  const handleExport = (jobId?: number) => {
    // undefined değerleri temizle
    const exportConfig: any = {
      include_html: config.includeHtml,
      include_content: config.includeContent,
      include_links: config.includeLinks,
      include_metadata: config.includeMetadata,
      format: config.format,
    }
    
    // Sadece dolu olanları ekle
    if (config.includeFields.length > 0) {
      exportConfig.include_fields = config.includeFields
    }
    if (config.excludeFields.length > 0) {
      exportConfig.exclude_fields = config.excludeFields
    }
    if (config.maxContentLength) {
      exportConfig.max_content_length = config.maxContentLength
    }
    if (config.maxHtmlLength) {
      exportConfig.max_html_length = config.maxHtmlLength
    }

    if (jobId) {
      exportMutation.mutate({ jobId, config: exportConfig })
    } else if (selectedJobs.length > 0) {
      bulkExportMutation.mutate({ jobIds: selectedJobs, config: exportConfig })
    } else {
      toast.error('Lütfen en az bir crawl seçin')
    }
  }

  const toggleJobSelection = (jobId: number) => {
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId))
    } else {
      setSelectedJobs([...selectedJobs, jobId])
    }
  }

  const selectAllJobs = () => {
    setSelectedJobs(jobs.map(j => j.id))
  }

  const deselectAllJobs = () => {
    setSelectedJobs([])
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
                      background: 'rgba(99, 102, 241, 0.2)',
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
                    color="text.primary"
                  >
                    İndirme Merkezi
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Crawl verilerinizi özelleştirerek indirin
                  </Typography>
                </Box>
                <Chip
                  label={`${selectedJobs.length} seçili`}
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Fade>

        <Grid container spacing={3}>
          {/* Sol Panel - Konfigürasyon */}
          <Grid item xs={12} lg={4}>
            <Fade in timeout={800}>
              <Card
                sx={{
                  backgroundColor: 'background.paper',
                  position: 'sticky',
                  top: 20,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Settings sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      İndirme Konfigürasyonu
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />

                  {/* Format Seçimi */}
                  <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
                    <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
                      İndirme Formatı
                    </FormLabel>
                    <RadioGroup
                      value={config.format}
                      onChange={(e) => setConfig({ ...config, format: e.target.value as any })}
                    >
                      <FormControlLabel value="json" control={<Radio />} label="JSON" />
                      <FormControlLabel value="csv" control={<Radio />} label="CSV" />
                      <FormControlLabel value="excel" control={<Radio />} label="Excel" />
                    </RadioGroup>
                  </FormControl>

                  <Divider sx={{ my: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />

                  {/* İçerik Seçenekleri */}
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                    İçerik Seçenekleri
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.includeContent}
                          onChange={(e) => setConfig({ ...config, includeContent: e.target.checked })}
                          color="primary"
                        />
                      }
                      label="Metin İçeriği Dahil Et"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.includeHtml}
                          onChange={(e) => setConfig({ ...config, includeHtml: e.target.checked })}
                          color="primary"
                        />
                      }
                      label="HTML İçeriği Dahil Et"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.includeLinks}
                          onChange={(e) => setConfig({ ...config, includeLinks: e.target.checked })}
                          color="primary"
                        />
                      }
                      label="Linkler Dahil Et"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.includeMetadata}
                          onChange={(e) => setConfig({ ...config, includeMetadata: e.target.checked })}
                          color="primary"
                        />
                      }
                      label="Metadata Dahil Et"
                    />
                  </Box>

                  <Divider sx={{ my: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />

                  {/* Karakter Sınırlandırması */}
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                    Karakter Sınırlandırması
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Maksimum İçerik Uzunluğu"
                      value={config.maxContentLength || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          maxContentLength: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      helperText="Boş bırakılırsa sınır yok"
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="Maksimum HTML Uzunluğu"
                      value={config.maxHtmlLength || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          maxHtmlLength: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      helperText="Boş bırakılırsa sınır yok"
                    />
                  </Box>

                  <Divider sx={{ my: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />

                  {/* Alan Seçimi */}
                  <Accordion
                    sx={{
                      background: 'rgba(99, 102, 241, 0.05)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Dahil Edilecek Alanlar
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button
                          size="small"
                          startIcon={<SelectAll />}
                          onClick={handleSelectAll}
                          variant="outlined"
                        >
                          Tümünü Seç
                        </Button>
                        <Button
                          size="small"
                          startIcon={<Deselect />}
                          onClick={handleDeselectAll}
                          variant="outlined"
                        >
                          Tümünü Kaldır
                        </Button>
                        <Button
                          size="small"
                          onClick={handleSelectDefault}
                          variant="outlined"
                        >
                          Varsayılan
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {AVAILABLE_FIELDS.map((field) => (
                          <FormControlLabel
                            key={field.id}
                            control={
                              <Checkbox
                                checked={config.includeFields.includes(field.id)}
                                onChange={() => handleFieldToggle(field.id)}
                                color="primary"
                              />
                            }
                            label={field.label}
                          />
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>

                  <Divider sx={{ my: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />

                  {/* İndirme Butonu */}
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={
                      exportMutation.isPending || bulkExportMutation.isPending ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <FileDownload />
                      )
                    }
                    onClick={() => handleExport()}
                    disabled={
                      (exportMutation.isPending || bulkExportMutation.isPending) &&
                      selectedJobs.length === 0
                    }
                    sx={{ py: 1.5 }}
                  >
                    {selectedJobs.length > 0
                      ? `${selectedJobs.length} Crawl'ı İndir`
                      : 'Seçili Crawl\'ları İndir'}
                  </Button>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          {/* Sağ Panel - Crawl Listesi */}
          <Grid item xs={12} lg={8}>
            <Fade in timeout={1000}>
              <Card
                sx={{
                  backgroundColor: 'background.paper',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Crawl'ları Seçin
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        onClick={selectAllJobs}
                        variant="outlined"
                        startIcon={<SelectAll />}
                      >
                        Tümünü Seç
                      </Button>
                      <Button
                        size="small"
                        onClick={deselectAllJobs}
                        variant="outlined"
                        startIcon={<Deselect />}
                      >
                        Seçimi Temizle
                      </Button>
                    </Box>
                  </Box>

                  {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : jobs.length === 0 ? (
                    <Alert
                      severity="info"
                      sx={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      Henüz crawl bulunmuyor. Önce bir crawl başlatın!
                    </Alert>
                  ) : (
                    <Box sx={{ maxHeight: 600, overflowY: 'auto' }}>
                      {jobs.map((job) => (
                        <JobSelectionCard
                          key={job.id}
                          job={job}
                          selected={selectedJobs.includes(job.id)}
                          onToggle={() => toggleJobSelection(job.id)}
                          onExport={() => handleExport(job.id)}
                          isExporting={exportMutation.isPending}
                        />
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

// Job Selection Card Component
const JobSelectionCard = ({
  job,
  selected,
  onToggle,
  onExport,
  isExporting,
}: {
  job: CrawlJob
  selected: boolean
  onToggle: () => void
  onExport: () => void
  isExporting: boolean
}) => {
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
    <Paper
      sx={{
        p: 2.5,
        mb: 2,
        backgroundColor: selected ? 'rgba(79, 70, 229, 0.08)' : 'background.paper',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        transition: 'all 0.3s',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateX(4px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Checkbox
          checked={selected}
          onChange={onToggle}
          color="primary"
          sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            noWrap
            sx={{
              mb: 1,
              color: selected ? 'primary.light' : 'text.primary',
            }}
          >
            {job.base_url}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
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
            <Chip
              label={`ID: ${job.id}`}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>
        <Tooltip title="Tekil İndir">
          <IconButton
            color="primary"
            onClick={onExport}
            disabled={isExporting}
            sx={{
              '&:hover': {
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'scale(1.1)',
              },
              transition: 'all 0.2s',
            }}
          >
            <GetApp />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  )
}

export default Exports

