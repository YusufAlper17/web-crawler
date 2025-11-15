import { useQuery } from '@tanstack/react-query'
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  IconButton,
  Fade,
  Divider,
} from '@mui/material'
import {
  ArrowBack,
  TrendingUp,
  Speed,
  CheckCircle,
  Error,
  Timeline,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { crawlApi } from '../services/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'

const Analytics = () => {
  const navigate = useNavigate()

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => crawlApi.listJobs(0, 100),
  })

  if (isLoading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <LinearProgress sx={{ width: '100%' }} />
        </Box>
      </Container>
    )
  }

  // İstatistikleri hesapla
  const stats = {
    total: jobs.length,
    running: jobs.filter((j) => j.status === 'running').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    paused: jobs.filter((j) => j.status === 'paused').length,
    totalPages: jobs.reduce((sum, j) => sum + j.pages_crawled, 0),
    totalFailed: jobs.reduce((sum, j) => sum + j.pages_failed, 0),
    avgPages: jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + j.pages_crawled, 0) / jobs.length) : 0,
  }

  // Status dağılımı için pie chart data
  const statusData = [
    { name: 'Tamamlandı', value: stats.completed, color: '#10b981' },
    { name: 'Çalışıyor', value: stats.running, color: '#6366f1' },
    { name: 'Başarısız', value: stats.failed, color: '#ef4444' },
    { name: 'Duraklatıldı', value: stats.paused, color: '#f59e0b' },
  ].filter((item) => item.value > 0)

  // Son 10 job için bar chart data
  const recentJobsData = jobs.slice(0, 10).reverse().map((job) => ({
    name: `Job ${job.id}`,
    'Çekilen': job.pages_crawled,
    'Başarısız': job.pages_failed,
  }))

  // Başarı oranı hesapla
  const successRate = stats.totalPages > 0 
    ? ((stats.totalPages / (stats.totalPages + stats.totalFailed)) * 100).toFixed(1)
    : 0

  // Zaman bazlı analiz (son 7 gün)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
  })

  const timelineData = last7Days.map((date) => ({
    date,
    jobs: Math.floor(Math.random() * 10), // Gerçek verilerle değiştirilecek
    pages: Math.floor(Math.random() * 1000),
  }))

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
        pb: 4,
      }}
    >
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Fade in timeout={600}>
          <Card
            sx={{
              mb: 3,
              background: 'rgba(26, 31, 58, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
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
                    sx={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    📊 Analytics & İstatistikler
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Crawler performansını detaylı şekilde inceleyin
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>

        {/* Genel İstatistikler */}
        <Fade in timeout={800}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        Toplam Job
                      </Typography>
                      <Typography variant="h3" fontWeight={700}>
                        {stats.total}
                      </Typography>
                    </Box>
                    <BarChartIcon sx={{ fontSize: 48, opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        Toplam Sayfa
                      </Typography>
                      <Typography variant="h3" fontWeight={700}>
                        {stats.totalPages.toLocaleString()}
                      </Typography>
                    </Box>
                    <Timeline sx={{ fontSize: 48, opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        Ortalama Sayfa
                      </Typography>
                      <Typography variant="h3" fontWeight={700}>
                        {stats.avgPages}
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: 48, opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        Başarı Oranı
                      </Typography>
                      <Typography variant="h3" fontWeight={700}>
                        {successRate}%
                      </Typography>
                    </Box>
                    <CheckCircle sx={{ fontSize: 48, opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Fade>

        <Grid container spacing={3}>
          {/* Status Dağılımı */}
          <Grid item xs={12} md={6}>
            <Fade in timeout={1000}>
              <Card
                sx={{
                  background: 'rgba(26, 31, 58, 0.6)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  height: '100%',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <PieChartIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Job Status Dağılımı
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          {/* Son Job'lar */}
          <Grid item xs={12} md={6}>
            <Fade in timeout={1200}>
              <Card
                sx={{
                  background: 'rgba(26, 31, 58, 0.6)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  height: '100%',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <BarChartIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Son 10 Job Performansı
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={recentJobsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.2)" />
                      <XAxis dataKey="name" stroke="#a0a0a0" />
                      <YAxis stroke="#a0a0a0" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(26, 31, 58, 0.95)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Çekilen" fill="#10b981" />
                      <Bar dataKey="Başarısız" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          {/* Zaman Bazlı Analiz */}
          <Grid item xs={12}>
            <Fade in timeout={1400}>
              <Card
                sx={{
                  background: 'rgba(26, 31, 58, 0.6)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Timeline sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      7 Günlük Aktivite Grafiği
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={timelineData}>
                      <defs>
                        <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.2)" />
                      <XAxis dataKey="date" stroke="#a0a0a0" />
                      <YAxis stroke="#a0a0a0" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(26, 31, 58, 0.95)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="jobs"
                        stroke="#6366f1"
                        fillOpacity={1}
                        fill="url(#colorJobs)"
                        name="Job Sayısı"
                      />
                      <Area
                        type="monotone"
                        dataKey="pages"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorPages)"
                        name="Sayfa Sayısı"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          {/* Detaylı İstatistikler */}
          <Grid item xs={12}>
            <Fade in timeout={1600}>
              <Card
                sx={{
                  background: 'rgba(26, 31, 58, 0.6)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    📈 Detaylı İstatistikler
                  </Typography>
                  <Divider sx={{ mb: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          background: 'rgba(99, 102, 241, 0.1)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Çalışan Job'lar
                        </Typography>
                        <Typography variant="h4" color="primary.main" fontWeight={700}>
                          {stats.running}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Tamamlanan
                        </Typography>
                        <Typography variant="h4" color="success.main" fontWeight={700}>
                          {stats.completed}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Başarısız
                        </Typography>
                        <Typography variant="h4" color="error.main" fontWeight={700}>
                          {stats.failed}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Duraklatıldı
                        </Typography>
                        <Typography variant="h4" color="warning.main" fontWeight={700}>
                          {stats.paused}
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

export default Analytics

