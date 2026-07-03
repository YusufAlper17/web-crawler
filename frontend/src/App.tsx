import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import Dashboard from './pages/Dashboard'
import CrawlDetail from './pages/CrawlDetail'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Exports from './pages/Exports'
import { appTheme } from './theme'

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/crawl/:jobId" element={<CrawlDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/exports" element={<Exports />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App

