import { Box, Card, CardContent, Typography } from '@mui/material'
import { tones } from '../theme'

type Tone = keyof typeof tones

interface StatCardProps {
  value: string | number
  label: string
  icon: React.ReactNode
  tone?: Tone
}

const StatCard = ({ value, label, icon, tone = 'indigo' }: StatCardProps) => {
  const palette = tones[tone]
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 28px rgba(16, 24, 40, 0.10)' },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" fontWeight={800} sx={{ color: palette.fg }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {label}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 52,
              height: 52,
              flexShrink: 0,
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.bg,
              color: palette.icon,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default StatCard
