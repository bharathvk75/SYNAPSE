// SYNAPSE — Review Detail Page (live streaming + results + DevSecOps exports)
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Zap, Download, FileText, Copy, Layers, Share2, Sparkles,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { reviewApi } from '@/lib/api'
import { SynapseWebSocket } from '@/lib/websocket'
import { useReviewStore } from '@/stores/reviewStore'
import {
  cn, getScoreColor, getRiskColor, timeAgo, formatDuration, copyToClipboard,
} from '@/lib/utils'
import AgentPipeline from '@/components/review/AgentPipeline'
import HermesChat from '@/components/review/HermesChat'
import ScoreRing from '@/components/review/ScoreRing'
import IssueCard from '@/components/review/IssueCard'
import SecurityCard from '@/components/review/SecurityCard'
import ImpactCard from '@/components/review/ImpactCard'
import TestCard from '@/components/review/TestCard'
import FixCard from '@/components/review/FixCard'
import type { ReviewResponse, WSMessage } from '@/types'

type TabId = 'overview' | 'issues' | 'security' | 'impact' | 'tests' | 'fixes' | 'hermes'

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const ws = useRef<SynapseWebSocket | null>(null)

  const {
    activeReview, agentStates, hermesMessages, approvalRequired,
    approvalMessage, handleWsMessage, setActiveReview, setWsConnected,
  } = useReviewStore()

  // ── Fetch initial state ──
  const { data: review, isLoading } = useQuery({
    queryKey: ['review', id],
    queryFn: () => reviewApi.get(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' || query.state.data?.status === 'pending' ? 3000 : false,
  })

  useEffect(() => {
    if (review) setActiveReview(review)
  }, [review, setActiveReview])

  // ── WebSocket connection ──
  useEffect(() => {
    if (!id) return
    ws.current = new SynapseWebSocket(id)

    ws.current.on('*', (msg: WSMessage) => {
      handleWsMessage(msg)
      if (msg.type === 'review_complete') {
        qc.invalidateQueries({ queryKey: ['review', id] })
        qc.invalidateQueries({ queryKey: ['reviews'] })
        toast.success('Review complete! 🎉')
      }
    })

    ws.current.connect()
    setWsConnected(true)

    return () => {
      ws.current?.disconnect()
      setWsConnected(false)
    }
  }, [id])

  const displayReview = activeReview ?? review
  const isRunning = displayReview?.status === 'running' || displayReview?.status === 'pending'
  const isAwaitingApproval = displayReview?.status === 'awaiting_approval' || approvalRequired

  async function handleApprove(decision: 'approve' | 'reject', comment?: string) {
    if (!id) return
    try {
      await reviewApi.approve(id, decision, comment)
      toast.success(decision === 'approve' ? '✅ Review approved!' : '🔴 Review rejected')
      qc.invalidateQueries({ queryKey: ['review', id] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed'
      toast.error(msg)
    }
  }

  async function handleExportSarif() {
    if (!id) return
    try {
      const res = await fetch(`/api/review/${id}/sarif`)
      if (!res.ok) throw new Error('Failed to generate SARIF report')
      const sarifData = await res.json()
      const blob = new Blob([JSON.stringify(sarifData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `synapse-review-${id.slice(0, 8)}.sarif`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded OASIS SARIF v2.1.0!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SARIF export failed'
      toast.error(msg)
    }
  }

  async function handleCopyMarkdown() {
    if (!id) return
    try {
      const res = await fetch(`/api/review/${id}/markdown`)
      if (!res.ok) throw new Error('Failed to format PR summary')
      const data = await res.json()
      await copyToClipboard(data.markdown)
      toast.success('Copied GitHub PR Comment Markdown!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Markdown copy failed'
      toast.error(msg)
    }
  }

  if (isLoading && !activeReview) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 font-mono text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-3 text-synapse-400" />
        Loading review session…
      </div>
    )
  }

  if (!displayReview) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
        <p className="text-white font-medium">Review not found</p>
        <button onClick={() => navigate('/')} className="btn-ghost mt-4 font-mono text-xs">← Back to Dashboard</button>
      </div>
    )
  }

  const { summary } = displayReview
  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: 'overview',  label: 'Overview',  icon: '📊' },
    { id: 'issues',    label: 'Issues',    icon: '🐛', count: displayReview.issues?.length },
    { id: 'security',  label: 'Security',  icon: '🛡️', count: displayReview.vulnerabilities?.length },
    { id: 'impact',    label: 'Blast Radius', icon: '💥', count: displayReview.impact_assessment?.blast_radius_score },
    { id: 'tests',     label: 'Tests',     icon: '🧪', count: displayReview.test_suggestions?.length },
    { id: 'fixes',     label: 'Fixes',     icon: '🔧', count: displayReview.fix_suggestions?.length },
    { id: 'hermes',    label: 'Hermes',    icon: '🧠', count: hermesMessages.length || undefined },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-dark-border bg-dark-surface/90 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-1.5 text-xs font-mono">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white truncate font-mono">{displayReview.title}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-synapse-500/15 text-synapse-400 border border-synapse-500/30">
                SYNAPSE v2.12
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 font-mono text-xs">
              <StatusBadge status={displayReview.status} />
              {displayReview.llm_provider && (
                <span className="text-[11px] text-gray-500">{displayReview.llm_provider} · {displayReview.llm_model}</span>
              )}
              <span className="text-[11px] text-gray-500">{timeAgo(displayReview.created_at)}</span>
              {displayReview.duration_seconds && (
                <span className="text-[11px] text-gray-500">{formatDuration(displayReview.duration_seconds)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions (SARIF & Markdown Export) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleCopyMarkdown}
            title="Copy formatted PR Summary for GitHub comment"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono border border-dark-border bg-dark-bg text-gray-300 hover:text-white hover:border-dark-hover transition-all"
          >
            <Copy className="w-3.5 h-3.5 text-synapse-400" />
            <span className="hidden sm:inline">Copy PR Markdown</span>
          </button>
          <button
            onClick={handleExportSarif}
            title="Download SARIF v2.1.0 report for GitHub Advanced Security / GitLab SAST"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono border border-dark-border bg-dark-bg text-gray-300 hover:text-white hover:border-dark-hover transition-all"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export SARIF</span>
          </button>

          {summary?.overall_score !== undefined && (
            <div className="flex items-center gap-1.5 pl-3 border-l border-dark-border">
              <span className="text-xs text-gray-500 font-mono">Score</span>
              <span className={cn('text-base font-bold font-mono', getScoreColor(summary.overall_score))}>
                {summary.overall_score}<span className="text-xs text-gray-600">/10</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Agent pipeline (always visible when running or completed) */}
      {(isRunning || Object.keys(agentStates).length > 0 || displayReview.agent_states) && (
        <div className="px-6 py-2.5 border-b border-dark-border bg-dark-bg/60 flex-shrink-0">
          <AgentPipeline agentStates={Object.keys(agentStates).length > 0 ? agentStates : displayReview.agent_states ?? {}} />
        </div>
      )}

      {/* Approval banner */}
      <AnimatePresence>
        {isAwaitingApproval && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 py-4 border-b border-yellow-500/20 bg-yellow-500/5 flex-shrink-0"
          >
            <div className="flex items-start gap-4">
              <div className="text-2xl">🧠</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-yellow-300 mb-1 font-mono">Hermes is requesting your approval</p>
                <div className="text-xs text-gray-400 leading-relaxed prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {approvalMessage ?? displayReview.hermes_approval_message ?? ''}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleApprove('reject')}
                  className="btn-danger flex items-center gap-1.5 text-xs font-mono"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => handleApprove('approve')}
                  className="btn-primary flex items-center gap-1.5 text-xs font-mono"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-dark-border flex-shrink-0 overflow-x-auto no-scrollbar font-mono text-xs">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn('synapse-tab flex items-center gap-1.5 whitespace-nowrap', activeTab === t.id && 'active')}
          >
            <span>{t.icon}</span>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-dark-muted text-[11px] text-gray-400 font-mono">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-6"
          >
            {activeTab === 'overview' && (
              <OverviewTab review={displayReview} onSelectTab={(tab) => setActiveTab(tab)} />
            )}
            {activeTab === 'issues' && (
              <div className="space-y-3">
                {displayReview.issues?.length === 0 && <EmptyTab label="No code issues found 🎉" />}
                {displayReview.issues?.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
              </div>
            )}
            {activeTab === 'security' && (
              <div className="space-y-3">
                {displayReview.vulnerabilities?.length === 0 && <EmptyTab label="No security vulnerabilities found 🛡️" />}
                {displayReview.vulnerabilities?.map((v) => <SecurityCard key={v.id} vuln={v} />)}
              </div>
            )}
            {activeTab === 'impact' && (
              <ImpactCard impact={displayReview.impact_assessment} />
            )}
            {activeTab === 'tests' && (
              <div className="space-y-3">
                {displayReview.test_suggestions?.length === 0 && <EmptyTab label="No test suggestions generated" />}
                {displayReview.test_suggestions?.map((t) => <TestCard key={t.id} suggestion={t} />)}
              </div>
            )}
            {activeTab === 'fixes' && (
              <div className="space-y-3">
                {displayReview.fix_suggestions?.length === 0 && <EmptyTab label="No fix suggestions generated" />}
                {displayReview.fix_suggestions?.map((f) => <FixCard key={f.id} fix={f} />)}
              </div>
            )}
            {activeTab === 'hermes' && (
              <HermesChat
                sessionId={id!}
                messages={hermesMessages}
                narrative={displayReview.hermes_narrative}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function OverviewTab({ review, onSelectTab }: { review: ReviewResponse; onSelectTab: (tab: TabId) => void }) {
  const s = review.summary
  const impact = review.impact_assessment
  if (!s) return null

  return (
    <div className="space-y-5">
      {/* Score + risk + Blast Radius overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score */}
        <div className="card-synapse p-5 flex items-center gap-5 border border-dark-border">
          <ScoreRing score={s.overall_score} size={80} />
          <div>
            <p className="text-2xl font-bold text-white font-mono">{s.overall_score}<span className="text-xs text-gray-500">/10</span></p>
            <p className="text-xs text-gray-400 mt-1">Code Quality Score</p>
            <p className={cn('text-xs font-semibold mt-1 font-mono uppercase', getRiskColor(s.risk_level))}>
              {s.risk_level} Risk Level
            </p>
          </div>
        </div>

        {/* Issue Breakdown */}
        <div className="card-synapse p-4 border border-dark-border grid grid-cols-3 gap-2 text-center font-mono">
          <div className="bg-dark-bg p-2 rounded border border-dark-border">
            <p className="text-base font-bold text-red-400">{s.critical_issues}</p>
            <p className="text-[10px] text-gray-500 uppercase">Critical</p>
          </div>
          <div className="bg-dark-bg p-2 rounded border border-dark-border">
            <p className="text-base font-bold text-orange-400">{s.high_issues}</p>
            <p className="text-[10px] text-gray-500 uppercase">High</p>
          </div>
          <div className="bg-dark-bg p-2 rounded border border-dark-border">
            <p className="text-base font-bold text-red-400">{s.security_vulnerabilities}</p>
            <p className="text-[10px] text-gray-500 uppercase">Security</p>
          </div>
          <div className="bg-dark-bg p-2 rounded border border-dark-border">
            <p className="text-base font-bold text-green-400">{s.fixes_available}</p>
            <p className="text-[10px] text-gray-500 uppercase">Fixes</p>
          </div>
          <div className="bg-dark-bg p-2 rounded border border-dark-border">
            <p className="text-base font-bold text-gray-300">{s.files_analyzed}</p>
            <p className="text-[10px] text-gray-500 uppercase">Files</p>
          </div>
          <div className="bg-dark-bg p-2 rounded border border-dark-border">
            <p className="text-base font-bold text-gray-300">{s.lines_analyzed}</p>
            <p className="text-[10px] text-gray-500 uppercase">Lines</p>
          </div>
        </div>

        {/* Blast Radius Mini Card */}
        <div
          onClick={() => onSelectTab('impact')}
          className="card-synapse p-5 border border-dark-border hover:border-synapse-500/40 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-400">Blast Radius</span>
            <span className="text-[10px] font-mono text-synapse-400 underline">View Details →</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-white">
              {impact?.blast_radius_score ?? s.blast_radius_score ?? 25}
              <span className="text-xs text-gray-500 font-normal">/100</span>
            </div>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              Status: {impact?.breaking_change_risk ? '⚠️ Breaking API Contracts' : '✅ Backward Compatible'}
            </p>
          </div>
          <div className="w-full bg-dark-bg h-1.5 rounded-full overflow-hidden border border-dark-border">
            <div
              className="bg-synapse-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${impact?.blast_radius_score ?? s.blast_radius_score ?? 25}%` }}
            />
          </div>
        </div>
      </div>

      {/* Hermes narrative */}
      {review.hermes_narrative && (
        <div className="card-synapse p-5 border border-dark-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🧠</span>
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Hermes Executive Analysis</h3>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-gray-300 leading-relaxed font-sans text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{review.hermes_narrative}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center font-mono">
      <Zap className="w-8 h-8 text-synapse-400 opacity-40 mb-3" />
      <p className="text-gray-500 text-xs">{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; dot: string; label: string }> = {
    running:          { color: 'text-synapse-400', dot: 'bg-synapse-400 animate-pulse', label: 'Running' },
    pending:          { color: 'text-gray-500',    dot: 'bg-gray-500',                  label: 'Pending' },
    completed:        { color: 'text-green-400',   dot: 'bg-green-400',                 label: 'Completed' },
    approved:         { color: 'text-green-400',   dot: 'bg-green-400',                 label: 'Approved' },
    awaiting_approval:{ color: 'text-yellow-400',  dot: 'bg-yellow-400 animate-pulse',  label: 'Awaiting Approval' },
    failed:           { color: 'text-red-400',     dot: 'bg-red-400',                   label: 'Failed' },
    rejected:         { color: 'text-red-400',     dot: 'bg-red-400',                   label: 'Rejected' },
  }
  const cfg = configs[status] ?? { color: 'text-gray-500', dot: 'bg-gray-500', label: status }
  return (
    <span className={cn('flex items-center gap-1.5 text-xs font-mono font-medium', cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
