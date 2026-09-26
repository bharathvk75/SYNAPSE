// SYNAPSE — Main App Router & Layout
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'

import MainLayout from '@/components/layout/MainLayout'
import DashboardPage from '@/pages/Dashboard'
import NewReviewPage from '@/pages/NewReview'
import ReviewDetailPage from '@/pages/ReviewDetail'
import HistoryPage from '@/pages/History'
import GitHubPage from '@/pages/GitHub'
import AgentsPage from '@/pages/Agents'
import SettingsPage from '@/pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0f0f16',
            color: '#fff',
            border: '1px solid #1c1c28',
            borderRadius: '2px',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#f97316', secondary: '#0f0f16' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#0f0f16' } },
        }}
      />
      <AnimatePresence mode="wait">
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/"          element={<DashboardPage />} />
            <Route path="/review/new" element={<NewReviewPage />} />
            <Route path="/review/:id" element={<ReviewDetailPage />} />
            <Route path="/history"   element={<HistoryPage />} />
            <Route path="/github"    element={<GitHubPage />} />
            <Route path="/agents"    element={<AgentsPage />} />
            <Route path="/settings"  element={<SettingsPage />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  )
}
