// SYNAPSE — GitHub Integration Page
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Github, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff,
  GitPullRequest, Star, Lock, Globe, RefreshCw, ExternalLink, Zap,
} from 'lucide-react'
import { githubApi } from '@/lib/api'
import { cn, timeAgo } from '@/lib/utils'

export default function GitHubPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState('')

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['github-status'],
    queryFn: githubApi.status,
    refetchInterval: 30_000,
  })

  const { data: repos, isLoading: reposLoading } = useQuery({
    queryKey: ['github-repos'],
    queryFn: () => githubApi.listRepos(30),
    enabled: status?.connected ?? false,
  })

  const { data: prs, isLoading: prsLoading } = useQuery({
    queryKey: ['github-prs', selectedRepo],
    queryFn: () => {
      const [owner, repo] = selectedRepo.split('/')
      return githubApi.listPRs(owner, repo, 'open')
    },
    enabled: !!selectedRepo,
  })

  const connectMut = useMutation({
    mutationFn: (t: string) => githubApi.connect(t),
    onSuccess: (data) => {
      toast.success(`✅ Connected as @${data.user}`)
      setToken('')
      qc.invalidateQueries({ queryKey: ['github-status'] })
      qc.invalidateQueries({ queryKey: ['github-repos'] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      toast.error(msg)
    },
  })

  const reviewPRMut = useMutation({
    mutationFn: (params: { repo: string; pr_number: number }) =>
      githubApi.reviewPR({ ...params, require_approval: true }),
    onSuccess: (data) => {
      toast.success('Review started! 🧠')
      navigate(`/review/${data.session_id}`)
    },
    onError: () => toast.error('Failed to start PR review'),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Github className="w-6 h-6 text-white" />
          <div>
            <h1 className="text-xl font-bold text-white">GitHub Integration</h1>
            <p className="text-sm text-gray-500">Connect your repos and trigger PR reviews automatically</p>
          </div>
        </div>

        {/* Connection card */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Connection Status</h2>
            {status?.connected ? (
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected as @{status.user}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Not connected
              </span>
            )}
          </div>

          {!status?.connected && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Enter a GitHub Personal Access Token (PAT) with <code className="text-synapse-400">repo</code> and <code className="text-synapse-400">pull_requests</code> scopes.
              </p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type={showToken ? 'text' : 'password'}
                    className="synapse-input text-sm font-mono pr-10"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  disabled={!token || connectMut.isPending}
                  onClick={() => connectMut.mutate(token)}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {connectMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                  Connect
                </button>
              </div>
              <p className="text-xs text-gray-700">
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener"
                   className="text-synapse-400 hover:text-synapse-300 inline-flex items-center gap-1">
                  Create a token on GitHub <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Repositories */}
        {status?.connected && (
          <div className="glass-card p-6 mt-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Your Repositories</h2>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ['github-repos'] })}
                className="btn-ghost flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {reposLoading ? (
              <div className="flex items-center gap-2 py-4 text-gray-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading repositories…
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(repos?.repos ?? []).map((repo) => (
                  <div
                    key={repo.full_name}
                    onClick={() => setSelectedRepo(selectedRepo === repo.full_name ? '' : repo.full_name)}
                    className={cn(
                      'p-4 rounded-xl border cursor-pointer transition-all duration-150',
                      selectedRepo === repo.full_name
                        ? 'border-synapse-500/50 bg-synapse-600/10'
                        : 'border-dark-border bg-dark-bg hover:bg-dark-hover hover:border-dark-muted'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {repo.private
                        ? <Lock className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                        : <Globe className="w-4 h-4 text-synapse-400 flex-shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{repo.full_name}</p>
                        {repo.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          {repo.language && (
                            <span className="text-xs text-gray-600">{repo.language}</span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            <Star className="w-3 h-3" /> {repo.stars}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            <GitPullRequest className="w-3 h-3" /> {repo.open_prs} PRs
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Open PRs for selected repo */}
        <AnimatePresence>
          {selectedRepo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="glass-card p-6 mt-5 overflow-hidden"
            >
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-synapse-400" />
                Open PRs — {selectedRepo}
              </h2>

              {prsLoading ? (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading PRs…
                </div>
              ) : !prs?.prs?.length ? (
                <p className="text-gray-600 text-sm">No open pull requests</p>
              ) : (
                <div className="space-y-3">
                  {prs.prs.map((pr) => (
                    <div key={pr.pr_number}
                      className="flex items-center gap-4 p-4 rounded-xl bg-dark-bg border border-dark-border hover:bg-dark-hover transition-colors group">
                      <GitPullRequest className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">#{pr.pr_number}</span>
                          <p className="text-sm font-medium text-white truncate">{pr.title}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-600">by @{pr.author}</span>
                          <span className="text-xs text-gray-600">{pr.files_changed} files</span>
                          <span className="text-xs text-green-600">+{pr.additions}</span>
                          <span className="text-xs text-red-600">-{pr.deletions}</span>
                          <span className="text-xs text-gray-600">{timeAgo(pr.updated_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={pr.url} target="_blank" rel="noopener"
                          className="p-1.5 rounded-lg hover:bg-dark-muted text-gray-600 hover:text-gray-300 transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => reviewPRMut.mutate({ repo: selectedRepo, pr_number: pr.pr_number })}
                          disabled={reviewPRMut.isPending}
                          className="btn-primary flex items-center gap-1.5 text-xs py-1.5"
                        >
                          {reviewPRMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          Review PR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
