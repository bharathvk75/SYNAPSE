// SYNAPSE — Dashboard Page
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, ArrowRight, Zap, ShieldAlert, Bug, TrendingUp,
  Clock, CheckCircle2, AlertCircle, Loader2, FileCode2, Bot,
} from 'lucide-react'
import { reviewApi } from '@/lib/api'
import { cn, timeAgo, getScoreColor, getStatusColor, getStatusLabel, formatDuration } from '@/lib/utils'
import type { ReviewResponse } from '@/types'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

export default function DashboardPage() {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => reviewApi.list(10),
    refetchInterval: 15_000,
  })

  const completed = reviews.filter((r) => r.status === 'completed' || r.status === 'approved')
  const totalIssues = completed.reduce((a, r) => a + (r.summary?.total_issues ?? 0), 0)
  const totalVulns  = completed.reduce((a, r) => a + (r.summary?.security_vulnerabilities ?? 0), 0)
  const avgScore    = completed.length
    ? (completed.reduce((a, r) => a + (r.summary?.overall_score ?? 0), 0) / completed.length).toFixed(1)
    : '—'
  const running = reviews.filter((r) => r.status === 'running' || r.status === 'pending')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ── Hero ── */}
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item} className="relative overflow-hidden rounded-lg border border-dark-border p-8"
          style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f16 100%)' }}>
          <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                     style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)' }}>
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-synapse-400 text-sm font-semibold tracking-wide uppercase">SYNAPSE</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                AI Code Intelligence
                <span className="text-gradient"> Platform</span>
              </h1>
              <p className="text-gray-400 text-sm max-w-xl">
                Multi-agent automated code review powered by LangGraph + LiteLLM.
                Hermes orchestrates 5 specialist agents — from deep static analysis to security auditing to auto-fix generation.
              </p>
            </div>
            <Link to="/review/new"
              className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
              <Plus className="w-4 h-4" />
              New Review
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* ── Stats row ── */}
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {[
            { label: 'Total Reviews',    value: reviews.length,   icon: FileCode2,   color: 'text-synapse-400' },
            { label: 'Issues Found',     value: totalIssues,      icon: Bug,         color: 'text-orange-400' },
            { label: 'Vulnerabilities',  value: totalVulns,       icon: ShieldAlert, color: 'text-red-400' },
            { label: 'Avg Score',        value: avgScore,         icon: TrendingUp,  color: 'text-green-400', suffix: '/10' },
          ].map(({ label, value, icon: Icon, color, suffix }) => (
            <div key={label} className="glass-card p-5 flex items-center gap-4">
              <div className={cn('p-2 rounded-lg bg-dark-bg', color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {value}<span className="text-sm text-gray-500">{suffix}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Active runs ── */}
        {running.length > 0 && (
          <motion.div variants={item} className="glass-card border-synapse-700/30 p-5 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Loader2 className="w-4 h-4 text-synapse-400 animate-spin" />
              <h2 className="text-sm font-semibold text-synapse-400">Active Reviews</h2>
            </div>
            <div className="space-y-3">
              {running.map((r) => (
                <Link key={r.session_id} to={`/review/${r.session_id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-hover transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-synapse-400 animate-pulse" />
                  <span className="text-sm text-white flex-1 truncate">{r.title}</span>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Recent reviews ── */}
        <motion.div variants={item} className="glass-card p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent Reviews</h2>
            <Link to="/history" className="text-xs text-synapse-400 hover:text-synapse-300 transition-colors">
              View all →
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading reviews…
            </div>
          ) : reviews.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {reviews.slice(0, 6).map((r) => (
                <ReviewRow key={r.session_id} review={r} />
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Agents overview ── */}
        <motion.div variants={item} className="glass-card p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-synapse-400" />
              Agent Fleet
            </h2>
            <Link to="/agents" className="text-xs text-synapse-400 hover:text-synapse-300 transition-colors">
              View details →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AGENT_PREVIEW.map((a) => (
              <div key={a.name} className="p-3 rounded-lg bg-dark-bg border border-dark-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{a.emoji}</span>
                  <span className="text-sm font-medium text-white">{a.display_name}</span>
                </div>
                <p className="text-xs text-gray-600">{a.role}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

function ReviewRow({ review }: { review: ReviewResponse }) {
  const score = review.summary?.overall_score
  return (
    <Link to={`/review/${review.session_id}`}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-hover transition-colors group">
      <StatusIcon status={review.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{review.title}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className={cn('text-xs font-medium', getStatusColor(review.status))}>
            {getStatusLabel(review.status)}
          </span>
          {review.summary?.total_issues !== undefined && (
            <span className="text-xs text-gray-600">{review.summary.total_issues} issues</span>
          )}
          <span className="text-xs text-gray-600">{timeAgo(review.created_at)}</span>
        </div>
      </div>
      {score !== undefined && (
        <div className={cn('text-sm font-bold', getScoreColor(score))}>
          {score}<span className="text-xs text-gray-600">/10</span>
        </div>
      )}
      <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" />
    </Link>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': case 'approved':
      return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
    case 'running': case 'pending':
      return <Loader2 className="w-4 h-4 text-synapse-400 animate-spin flex-shrink-0" />
    case 'failed': case 'rejected':
      return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
    case 'awaiting_approval':
      return <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
    default:
      return <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
  }
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, rgba(79,110,247,0.1), rgba(79,110,247,0.05))' }}>
        <Zap className="w-7 h-7 text-synapse-400 opacity-60" />
      </div>
      <p className="text-white font-medium mb-1">No reviews yet</p>
      <p className="text-gray-600 text-sm mb-4">Start your first AI-powered code review</p>
      <Link to="/review/new" className="btn-primary text-sm flex items-center gap-2">
        <Plus className="w-4 h-4" />
        New Review
      </Link>
    </div>
  )
}

const AGENT_PREVIEW = [
  { name: 'hermes',          emoji: '🧠', display_name: 'Hermes',         role: 'Master Orchestrator' },
  { name: 'code_analyzer',   emoji: '🔍', display_name: 'CodeAnalyzer',   role: 'Static Analysis Engine' },
  { name: 'security_scanner',emoji: '🛡️', display_name: 'SecurityScanner',role: 'OWASP Security Auditor' },
  { name: 'test_generator',  emoji: '🧪', display_name: 'TestGenerator',  role: 'Coverage Gap Analyst' },
  { name: 'fix_suggester',   emoji: '🔧', display_name: 'FixSuggester',   role: 'Automated Refactoring' },
  { name: 'pr_manager',      emoji: '🐙', display_name: 'PRManager',      role: 'GitHub PR Publisher' },
]
