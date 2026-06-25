// SYNAPSE — Review Detail Page (live streaming + results)
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, AlertTriangle,
  ShieldAlert, Bug, TestTube, Wrench, MessageSquare,
  Clock, ChevronDown, ChevronUp, Copy, ExternalLink, Zap,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { reviewApi } from '@/lib/api'
import { SynapseWebSocket } from '@/lib/websocket'
import { useReviewStore } from '@/stores/reviewStore'
import {
  cn, getSeverityBadge, getCategoryIcon, getScoreColor,
  getRiskColor, timeAgo, formatDuration, copyToClipboard,
} from '@/lib/utils'
import AgentPipeline from '@/components/review/AgentPipeline'
import HermesChat from '@/components/review/HermesChat'
import ScoreRing from '@/components/review/ScoreRing'
import IssueCard from '@/components/review/IssueCard'
import SecurityCard from '@/components/review/SecurityCard'
import TestCard from '@/components/review/TestCard'
import FixCard from '@/components/review/FixCard'
import type { ReviewResponse, WSMessage } from '@/types'

type TabId = 'overview' | 'issues' | 'security' | 'tests' | 'fixes' | 'hermes'

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
    refetchInterval: (data) =>
      data?.status === 'running' || data?.status === 'pending' ? 3000 : false,
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

  if (isLoading && !activeReview) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-600">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        Loading review…
      </div>
    )
  }

  if (!displayReview) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
        <p className="text-white font-medium">Review not found</p>
        <button onClick={() => navigate('/')} className="btn-ghost mt-4">← Back to Dashboard</button>
      </div>
    )
  }

  const { summary } = displayReview
  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: 'overview',  label: 'Overview',  icon: '📊' },
    { id: 'issues',    label: 'Issues',    icon: '🐛', count: displayReview.issues?.length },
    { id: 'security',  label: 'Security',  icon: '🛡️', count: displayReview.vulnerabilities?.length },
    { id: 'tests',     label: 'Tests',     icon: '🧪', count: displayReview.test_suggestions?.length },
    { id: 'fixes',     label: 'Fixes',     icon: '🔧', count: displayReview.fix_suggestions?.length },
    { id: 'hermes',    label: 'Hermes',    icon: '🧠', count: hermesMessages.length || undefined },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-dark-border bg-dark-surface/80 backdrop-blur-sm flex-shrink-0">
        <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-1.5 text-xs">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{displayReview.title}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <StatusBadge status={displayReview.status} />
            {displayReview.llm_provider && (
              <span className="text-xs text-gray-600">{displayReview.llm_provider} · {displayReview.llm_model}</span>
            )}
            <span className="text-xs text-gray-600">{timeAgo(displayReview.created_at)}</span>
            {displayReview.duration_seconds && (
              <span className="text-xs text-gray-600">{formatDuration(displayReview.duration_seconds)}</span>
            )}
          </div>
        </div>
        {summary?.overall_score !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Score</span>
            <span className={cn('text-lg font-bold', getScoreColor(summary.overall_score))}>
              {summary.overall_score}<span className="text-xs text-gray-600">/10</span>
            </span>
          </div>
        )}
      </div>

      {/* Agent pipeline (always visible when running) */}
      {(isRunning || Object.keys(agentStates).length > 0) && (
        <div className="px-6 py-3 border-b border-dark-border bg-dark-bg/50 flex-shrink-0">
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
                <p className="text-sm font-semibold text-yellow-300 mb-1">Hermes is requesting your approval</p>
                <div className="text-xs text-gray-400 leading-relaxed prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {approvalMessage ?? displayReview.hermes_approval_message ?? ''}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleApprove('reject')}
                  className="btn-danger flex items-center gap-1.5 text-xs"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => handleApprove('approve')}
                  className="btn-primary flex items-center gap-1.5 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-dark-border flex-shrink-0 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn('synapse-tab flex items-center gap-1.5 whitespace-nowrap', activeTab === t.id && 'active')}
          >
            <span>{t.icon}</span>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-dark-muted text-xs text-gray-400">{t.count}</span>
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
            {activeTab === 'overview' && <OverviewTab review={displayReview} />}
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

function OverviewTab({ review }: { review: ReviewResponse }) {
  const s = review.summary
  if (!s) return null
  return (
    <div className="space-y-5">
      {/* Score + risk */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="glass-card p-6 flex items-center gap-6 flex-1">
          <ScoreRing score={s.overall_score} size={88} />
          <div>
            <p className="text-2xl font-bold text-white">{s.overall_score}<span className="text-sm text-gray-500">/10</span></p>
            <p className="text-sm text-gray-400 mt-1">Overall Code Quality</p>
            <p className={cn('text-sm font-semibold mt-1', getRiskColor(s.risk_level))}>
              {s.risk_level.toUpperCase()} RISK
            </p>
          </div>
        </div>
        <div className="glass-card p-5 flex-1 grid grid-cols-2 gap-4">
          {[
            { label: '🔴 Critical',     value: s.critical_issues,           color: 'text-red-400' },
            { label: '🟠 High',         value: s.high_issues,               color: 'text-orange-400' },
            { label: '🛡️ Vulnerabilities', value: s.security_vulnerabilities, color: 'text-red-400' },
            { label: '🔧 Fixes Ready',  value: s.fixes_available,           color: 'text-green-400' },
            { label: '📁 Files',        value: s.files_analyzed,            color: 'text-gray-400' },
            { label: '📝 Lines',        value: s.lines_analyzed,            color: 'text-gray-400' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className={cn('text-lg font-bold', color)}>{value}</p>
              <p className="text-xs text-gray-600">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hermes narrative */}
      {review.hermes_narrative && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🧠</span>
            <h3 className="text-sm font-semibold text-white">Hermes Analysis</h3>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-gray-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{review.hermes_narrative}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Zap className="w-8 h-8 text-synapse-400 opacity-40 mb-3" />
      <p className="text-gray-500 text-sm">{label}</p>
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
    <span className={cn('flex items-center gap-1.5 text-xs font-medium', cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
