// SYNAPSE — Main Layout Shell (Sidebar + Topbar + Outlet)
import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Plus, History, Github, Bot, Settings,
  Menu, X, Zap, ChevronRight, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/review/new', icon: Plus,            label: 'New Review' },
  { to: '/history',    icon: History,         label: 'History' },
  { to: '/github',     icon: Github,          label: 'GitHub' },
  { to: '/agents',     icon: Bot,             label: 'Agents' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
]

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg">
      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'hidden lg:flex flex-col flex-shrink-0 h-screen z-30',
          'bg-dark-surface border-r border-dark-border overflow-hidden'
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </motion.aside>

      {/* ── Mobile sidebar ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 w-60 z-50 flex flex-col lg:hidden bg-dark-surface border-r border-dark-border"
          >
            <SidebarContent collapsed={false} onToggle={() => setMobileOpen(false)} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center h-14 px-4 border-b border-dark-border bg-dark-surface/80 backdrop-blur-sm z-20 flex-shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-dark-hover transition-colors mr-3"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-400" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-1">
            <Zap className="w-4 h-4 text-synapse-500" />
            <span className="text-gray-600">SYNAPSE</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white font-medium capitalize">
              {location.pathname.replace('/', '') || 'Dashboard'}
            </span>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-card border border-dark-border">
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-gray-400 font-medium">SYNAPSE Online</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}

function SidebarContent({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-dark-border flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-synapse-gradient flex items-center justify-center flex-shrink-0 shadow-glow-sm"
               style={{ background: 'linear-gradient(135deg, #4f6ef7, #818cf8)' }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <p className="text-white font-bold text-sm tracking-wide">SYNAPSE</p>
                <p className="text-gray-600 text-xs">AI Code Intelligence</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-lg hover:bg-dark-hover transition-colors text-gray-600 hover:text-gray-300"
        >
          {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <div
                className={cn(
                  'sidebar-item group',
                  isActive && 'active',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-synapse-400' : 'text-gray-600 group-hover:text-gray-300')} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="truncate"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 border-t border-dark-border"
          >
            <div className="px-3 py-2 rounded-lg bg-dark-card border border-dark-border">
              <p className="text-xs text-gray-600">Powered by</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-medium text-synapse-400">LangGraph</span>
                <span className="text-gray-700">·</span>
                <span className="text-xs font-medium text-hermes-500">LiteLLM</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
