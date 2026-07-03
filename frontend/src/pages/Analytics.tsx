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
  CheckCircle,
  Timeline,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { crawlApi } from '../services/api'
import StatCard from '../components/StatCard'
import { brand } from '../theme'
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
} from 'recharts'

const Analytics = () => {
  const navigate = useNavigate()

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => crawlApi.listJobs(0, 100),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analyticsSummary'],
    queryFn: () => crawlApi.getAnalyticsSummary(),
  })

  if (isLoading || summaryLoading || !summary) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <LinearProgress sx={{ width: '100%' }} />
        </Box>
      </Container>
    )
  }

  const stats = {
    total: summary.total_jobs,
    running: summary.running_jobs,
    completed: summary.completed_jobs,
    failed: summary.failed_jobs,
    paused: summary.paused_jobs,
    totalPages: summary.total_pages,
    totalFailed: summary.failed_pages,
    avgPages: summary.average_pages_per_job,
  }

  const statusLabels: Record<string, string> = {
    completed: 'Tamamlandı',
    running: 'Çalışıyor',
    failed: 'Başarısız',
    paused: 'Duraklatıldı',
    pending: 'Bekliyor',
    cancelled: 'İptal',
  }

  const statusColors: Record<string, string> = {
    completed: '#1E8E3E',
    running: '#4F46E5',
    failed: '#D93025',
    paused: '#E37400',
    pending: '#7C8398',
    cancelled: '#9AA1B2',
  }

  const statusData = summary.status_breakdown.map((item) => ({
    name: statusLabels[item.status] || item.status,
    value: item.count,
    color: statusColors[item.status] || '#64748b',
  }))

  // Son 10 job için bar chart data
  const recentJobsData = jobs.slice(0, 10).reverse().map((job) => ({
    name: `Job ${job.id}`,
    'Çekilen': job.pages_crawled,
    'Başarısız': job.pages_failed,
  }))

  const successRate = summary.success_rate.toFixed(1)
  const timelineData = summary.daily_activity.map((item) => ({
    date: new Date(item.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
    jobs: item.jobs,
    pages: item.pages,
    failed_pages: item.failed_pages,
  }))

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
                    Analytics & İstatistikler
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
              <StatCard value={stats.total} label="Toplam Job" tone="indigo" icon={<BarChartIcon />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard value={stats.totalPages.toLocaleString()} label="Toplam Sayfa" tone="green" icon={<Timeline />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard value={stats.avgPages} label="Ortalama Sayfa" tone="amber" icon={<TrendingUp />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard value={`${successRate}%`} label="Başarı Oranı" tone="teal" icon={<CheckCircle />} />
            </Grid>
          </Grid>
        </Fade>

        <Grid container spacing={3}>
          {/* Status Dağılımı */}
          <Grid item xs={12} md={6}>
            <Fade in timeout={1000}>
              <Card
                sx={{
                  backgroundColor: 'background.paper',
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
                  backgroundColor: 'background.paper',
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
                      <CartesianGrid strokeDasharray="3 3" stroke={brand.border} />
                      <XAxis dataKey="name" stroke={brand.muted} />
                      <YAxis stroke={brand.muted} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: brand.surface,
                          border: `1px solid ${brand.border}`,
                          borderRadius: '10px',
                          color: brand.text,
                          boxShadow: '0 6px 18px rgba(16, 24, 40, 0.10)',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Çekilen" fill="#1E8E3E" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Başarısız" fill="#D93025" radius={[6, 6, 0, 0]} />
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
                  backgroundColor: 'background.paper',
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
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={brand.border} />
                      <XAxis dataKey="date" stroke={brand.muted} />
                      <YAxis stroke={brand.muted} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: brand.surface,
                          border: `1px solid ${brand.border}`,
                          borderRadius: '10px',
                          color: brand.text,
                          boxShadow: '0 6px 18px rgba(16, 24, 40, 0.10)',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="jobs"
                        stroke="#4F46E5"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        name="Job Sayısı"
                      />
                      <Line
                        type="monotone"
                        dataKey="pages"
                        stroke="#1E8E3E"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        name="Sayfa Sayısı"
                      />
                    </LineChart>
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
                  backgroundColor: 'background.paper',
                }}
              >
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Detaylı İstatistikler
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

