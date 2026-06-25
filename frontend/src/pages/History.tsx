// SYNAPSE — Review History Page
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  History, Search, Trash2, ArrowRight, Loader2,
  CheckCircle2, AlertCircle, Clock, ChevronDown, Filter, RefreshCw,
} from 'lucide-react'
import { reviewApi } from '@/lib/api'
import { cn, timeAgo, getScoreColor, getStatusColor, getStatusLabel, formatDuration } from '@/lib/utils'
import type { ReviewResponse } from '@/types'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'running', label: 'Running' },
  { value: 'awaiting_approval', label: 'Awaiting Approval' },
  { value: 'failed', label: 'Failed' },
]

export default function HistoryPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: reviews = [], isLoading, refetch } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => reviewApi.list(50),
    refetchInterval: 10_000,
  })

  const deleteMut = useMutation({
    mutationFn: (sessionId: string) => reviewApi.delete(sessionId),
    onSuccess: () => {
      toast.success('Review deleted')
      qc.invalidateQueries({ queryKey: ['reviews'] })
    },
    onError: () => toast.error('Failed to delete review'),
  })

  const filtered = reviews.filter((r) => {
    const matchSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.session_id.includes(search) ||
      r.llm_provider?.includes(search)
    const matchStatus = !statusFilter || r.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-synapse-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Review History</h1>
              <p className="text-sm text-gray-500">{reviews.length} total review{reviews.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="btn-ghost flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              className="synapse-input text-sm pl-9"
              placeholder="Search by title, session ID, or provider…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    statusFilter === f.value
                      ? 'bg-synapse-600/30 text-synapse-300 border border-synapse-600/40'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-dark-hover'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading history…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-500 font-medium">No reviews found</p>
            <p className="text-gray-700 text-sm mt-1">
              {search || statusFilter ? 'Try clearing your filters' : 'Start your first review from the dashboard'}
            </p>
            {(search || statusFilter) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('') }}
                className="btn-ghost mt-3 text-xs"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider">Review</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider">Issues</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {filtered.map((r) => (
                  <HistoryRow
                    key={r.session_id}
                    review={r}
                    onDelete={() => deleteMut.mutate(r.session_id)}
                    deleting={deleteMut.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function HistoryRow({
  review,
  onDelete,
  deleting,
}: {
  review: ReviewResponse
  onDelete: () => void
  deleting: boolean
}) {
  const score = review.summary?.overall_score

  return (
    <tr className="hover:bg-dark-hover transition-colors group">
      <td className="px-5 py-3">
        <p className="font-medium text-white truncate max-w-xs">{review.title}</p>
        <p className="text-xs text-gray-600 font-mono mt-0.5 truncate">{review.session_id.slice(0, 16)}…</p>
      </td>
      <td className="px-4 py-3">
        <StatusChip status={review.status} />
      </td>
      <td className="px-4 py-3">
        {score !== undefined ? (
          <span className={cn('font-bold', getScoreColor(score))}>
            {score}<span className="text-xs text-gray-600">/10</span>
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {review.summary?.critical_issues ? (
            <span className="text-red-400 text-xs font-bold">🔴 {review.summary.critical_issues}</span>
          ) : null}
          <span className="text-gray-500 text-xs">{review.summary?.total_issues ?? '—'} total</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500 capitalize">{review.llm_provider ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500">{timeAgo(review.created_at)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to={`/review/${review.session_id}`}
            className="p-1.5 rounded-lg hover:bg-synapse-600/20 text-gray-500 hover:text-synapse-400 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function StatusChip({ status }: { status: string }) {
  const DOTS: Record<string, string> = {
    completed: 'bg-green-400', running: 'bg-synapse-400 animate-pulse',
    pending: 'bg-gray-500', failed: 'bg-red-400', approved: 'bg-green-400',
    awaiting_approval: 'bg-yellow-400 animate-pulse', rejected: 'bg-red-400',
  }
  return (
    <span className={cn('flex items-center gap-1.5 text-xs font-medium', getStatusColor(status))}>
      <span className={cn('w-1.5 h-1.5 rounded-full', DOTS[status] ?? 'bg-gray-500')} />
      {getStatusLabel(status)}
    </span>
  )
}
