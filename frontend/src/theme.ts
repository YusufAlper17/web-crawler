import { createTheme } from '@mui/material'

// Material 3 (Material You) inspired light design tokens
export const brand = {
  bg: '#F6F8FD',
  surface: '#FFFFFF',
  surfaceVariant: '#EEF1F8',
  surfaceHover: '#F1F4FB',
  border: '#DCE1EC',
  borderStrong: '#C6CCDA',
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#8B87F1',
  primaryContainer: '#E7E8FE',
  onPrimaryContainer: '#28268A',
  secondary: '#0B7285',
  success: '#1E8E3E',
  warning: '#E37400',
  error: '#D93025',
  info: '#1A73E8',
  text: '#1B1F27',
  muted: '#5F6672',
}

// Tonal containers for metric / stat surfaces (soft Material You tints)
export const tones = {
  indigo: { bg: '#ECEDFE', fg: '#312BA8', icon: '#4F46E5' },
  blue: { bg: '#E7F0FE', fg: '#1558B0', icon: '#1A73E8' },
  green: { bg: '#E4F5E9', fg: '#137333', icon: '#1E8E3E' },
  amber: { bg: '#FDF0DC', fg: '#9A5B00', icon: '#E37400' },
  red: { bg: '#FCE9E7', fg: '#B3261E', icon: '#D93025' },
  teal: { bg: '#DDF1F3', fg: '#00636E', icon: '#0B7285' },
  neutral: { bg: '#EEF1F8', fg: '#404654', icon: '#5F6672' },
}

const softShadow = '0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.08)'
const raisedShadow = '0 6px 18px rgba(16, 24, 40, 0.08)'

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: brand.primary,
      dark: brand.primaryDark,
      light: brand.primaryLight,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: brand.secondary,
      contrastText: '#FFFFFF',
    },
    success: { main: brand.success, contrastText: '#FFFFFF' },
    warning: { main: brand.warning, contrastText: '#FFFFFF' },
    error: { main: brand.error, contrastText: '#FFFFFF' },
    info: { main: brand.info, contrastText: '#FFFFFF' },
    background: {
      default: brand.bg,
      paper: brand.surface,
    },
    divider: brand.border,
    text: {
      primary: brand.text,
      secondary: brand.muted,
    },
  },
  typography: {
    fontFamily: '"Inter", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.035em' },
    h2: { fontWeight: 800, letterSpacing: '-0.03em' },
    h3: { fontWeight: 700, letterSpacing: '-0.025em' },
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.018em' },
    h6: { fontWeight: 700, letterSpacing: '-0.015em' },
    button: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: brand.bg,
          color: brand.text,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 999,
          boxShadow: 'none',
          paddingInline: 20,
          paddingBlock: 8,
        },
        contained: {
          backgroundImage: 'none',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: raisedShadow,
          },
        },
        outlined: {
          borderColor: brand.borderStrong,
          '&:hover': {
            borderColor: brand.primary,
            backgroundColor: 'rgba(79, 70, 229, 0.06)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: brand.surface,
          border: `1px solid ${brand.border}`,
          boxShadow: softShadow,
          borderRadius: 20,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: brand.surface,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: brand.border,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: brand.surfaceVariant,
          color: brand.text,
          fontWeight: 700,
        },
        root: {
          borderColor: brand.border,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: brand.border,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: brand.text,
          fontSize: 12,
          fontWeight: 500,
          borderRadius: 8,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardInfo: {
          backgroundColor: brand.primaryContainer,
          color: brand.onPrimaryContainer,
        },
      },
    },
  },
})
