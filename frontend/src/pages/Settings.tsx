import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
  Fade,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  Paper,
  Slider,
} from '@mui/material'
import {
  ArrowBack,
  Settings as SettingsIcon,
  Save,
  RestartAlt,
  Security,
  Speed,
  Storage,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { crawlApi } from '../services/api'

const Settings = () => {
  const navigate = useNavigate()
  const { data: runtimeSettings } = useQuery({
    queryKey: ['runtimeSettings'],
    queryFn: () => crawlApi.getRuntimeSettings(),
  })
  
  const [settings, setSettings] = useState(() => {
    const defaults = {
      maxDepth: 10,
      maxPages: 10000,
      requestDelay: 1.0,
      timeout: 30,
      concurrentRequests: 10,
      userAgent: 'CrawlScope/1.0 (+https://example.com/bot)',
      respectRobotsTxt: true,
      followRedirects: true,
      autoRetry: true,
      maxRetries: 3,
      saveHtmlContent: true,
      extractMetadata: true,
    }

    const saved = localStorage.getItem('crawlerSettings')
    if (!saved) return defaults

    try {
      return { ...defaults, ...JSON.parse(saved) }
    } catch {
      return defaults
    }
  })

  const handleChange = (field: string, value: any) => {
    setSettings({ ...settings, [field]: value })
  }

  const handleSave = () => {
    // LocalStorage'a kaydet
    localStorage.setItem('crawlerSettings', JSON.stringify(settings))
    toast.success('Ayarlar kaydedildi!')
  }

  const handleReset = () => {
    const defaultSettings = {
      maxDepth: 10,
      maxPages: 10000,
      requestDelay: 1.0,
      timeout: 30,
      concurrentRequests: 10,
      userAgent: 'WebCrawler/1.0',
      respectRobotsTxt: true,
      followRedirects: true,
      autoRetry: true,
      maxRetries: 3,
      saveHtmlContent: true,
      extractMetadata: true,
    }
    setSettings(defaultSettings)
    localStorage.setItem('crawlerSettings', JSON.stringify(defaultSettings))
    toast.success('Ayarlar sıfırlandı')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        pb: 4,
      }}
    >
      <Container maxWidth="lg" sx={{ py: 4 }}>
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
                    Crawler Ayarları
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Crawler davranışını özelleştirin
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RestartAlt />}
                    onClick={handleReset}
                  >
                    Sıfırla
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSave}
                  >
                    Kaydet
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>

        <Grid container spacing={3}>
          {/* Genel Ayarlar */}
          <Grid item xs={12}>
            {runtimeSettings && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Deploy hedefi: {runtimeSettings.deployment_target} · Database: {runtimeSettings.database_engine} · API: {runtimeSettings.api_base_path}
              </Alert>
            )}
            <Fade in timeout={800}>
              <Card
                sx={{
                  backgroundColor: 'background.paper',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Genel Crawler Ayarları
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Maksimum Derinlik"
                        value={settings.maxDepth}
                        onChange={(e) => handleChange('maxDepth', Number(e.target.value))}
                        helperText="Crawler'ın ne kadar derine ineceği"
                        inputProps={{ min: 1, max: 50 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Maksimum Sayfa"
                        value={settings.maxPages}
                        onChange={(e) => handleChange('maxPages', Number(e.target.value))}
                        helperText="Taranacak maksimum sayfa sayısı"
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="İstek Gecikmesi (saniye)"
                        value={settings.requestDelay}
                        onChange={(e) => handleChange('requestDelay', Number(e.target.value))}
                        helperText="İstekler arası bekleme süresi"
                        inputProps={{ min: 0.1, max: 10, step: 0.1 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Timeout (saniye)"
                        value={settings.timeout}
                        onChange={(e) => handleChange('timeout', Number(e.target.value))}
                        helperText="İstek zaman aşımı süresi"
                        inputProps={{ min: 5, max: 120 }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Eşzamanlı İstek Sayısı: {settings.concurrentRequests}
                      </Typography>
                      <Slider
                        value={settings.concurrentRequests}
                        onChange={(_, value) => handleChange('concurrentRequests', value)}
                        min={1}
                        max={50}
                        marks={[
                          { value: 1, label: '1' },
                          { value: 10, label: '10' },
                          { value: 25, label: '25' },
                          { value: 50, label: '50' },
                        ]}
                        valueLabelDisplay="auto"
                        sx={{
                          color: 'primary.main',
                          '& .MuiSlider-thumb': {
                            backgroundColor: 'primary.main',
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="User Agent"
                        value={settings.userAgent}
                        onChange={(e) => handleChange('userAgent', e.target.value)}
                        helperText="HTTP isteklerinde kullanılacak User-Agent"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          {/* Güvenlik ve Davranış */}
          <Grid item xs={12} md={6}>
            <Fade in timeout={1000}>
              <Card
                sx={{
                  backgroundColor: 'background.paper',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Security sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Güvenlik ve Davranış
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.respectRobotsTxt}
                          onChange={(e) => handleChange('respectRobotsTxt', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Robots.txt'e Uy"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.followRedirects}
                          onChange={(e) => handleChange('followRedirects', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Yönlendirmeleri Takip Et"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.autoRetry}
                          onChange={(e) => handleChange('autoRetry', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Hata Durumunda Tekrar Dene"
                    />
                    {settings.autoRetry && (
                      <TextField
                        type="number"
                        label="Maksimum Deneme Sayısı"
                        value={settings.maxRetries}
                        onChange={(e) => handleChange('maxRetries', Number(e.target.value))}
                        size="small"
                        inputProps={{ min: 1, max: 10 }}
                        sx={{ ml: 4 }}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          {/* Veri Toplama */}
          <Grid item xs={12} md={6}>
            <Fade in timeout={1200}>
              <Card
                sx={{
                  backgroundColor: 'background.paper',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Storage sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Veri Toplama
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.saveHtmlContent}
                          onChange={(e) => handleChange('saveHtmlContent', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="HTML İçeriğini Kaydet"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.extractMetadata}
                          onChange={(e) => handleChange('extractMetadata', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Metadata Çıkar"
                    />
                    <Alert
                      severity="info"
                      sx={{
                        mt: 2,
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      Bu ayarlar daha fazla depolama alanı kullanır ancak daha detaylı analiz sağlar.
                    </Alert>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          {/* Performans Önerileri */}
          <Grid item xs={12}>
            <Fade in timeout={1400}>
              <Card
                sx={{
                  backgroundColor: 'background.paper',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Speed sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Performans Önerileri
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Paper
                        sx={{
                          p: 2,
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Hızlı Tarama
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          • Düşük gecikme (0.5s)<br />
                          • Yüksek eşzamanlılık (20-50)<br />
                          • Metadata kapalı
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Paper
                        sx={{
                          p: 2,
                          background: 'rgba(99, 102, 241, 0.1)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Dengeli (Önerilen)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          • Orta gecikme (1s)<br />
                          • Orta eşzamanlılık (10-20)<br />
                          • Metadata açık
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Paper
                        sx={{
                          p: 2,
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Güvenli
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          • Yüksek gecikme (2-3s)<br />
                          • Düşük eşzamanlılık (5-10)<br />
                          • Tüm güvenlik açık
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default Settings

