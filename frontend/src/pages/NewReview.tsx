// SYNAPSE — New Review Page
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  FileCode2, Github, ArrowRight, Loader2, Zap, ChevronDown,
  Settings2, Eye, EyeOff, RefreshCw, Sparkles,
} from 'lucide-react'
import TextareaAutosize from 'react-textarea-autosize'
import { reviewApi, settingsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ReviewRequest, LLMProvider } from '@/types'

type SourceTab = 'paste' | 'github_pr'

const PROVIDER_LABELS: Record<string, string> = {
  ollama: '🦙 Ollama (Local)',
  lmstudio: '🖥️ LM Studio (Local)',
  openai: '🟢 OpenAI GPT-4o',
  anthropic: '🔵 Anthropic Claude',
  gemini: '✨ Google Gemini',
  groq: '⚡ Groq (Fast)',
  cohere: '🌊 Cohere',
  azure: '☁️ Azure OpenAI',
  deepseek: '🐳 DeepSeek Coder',
  nvidia: '🟢 Nvidia NIM',
  openai_compatible: '☁️ OpenAI Compatible',
  mock: '🧪 Mock Mode (No API Key Required)',
}

export default function NewReviewPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<SourceTab>('paste')
  const [code, setCode] = useState('')
  const [fileName, setFileName] = useState('code.py')
  const [title, setTitle] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [prNumber, setPrNumber] = useState('')
  const [llmProvider, setLlmProvider] = useState<LLMProvider | ''>('')
  const [llmModel, setLlmModel] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [enableSecurity, setEnableSecurity] = useState(true)
  const [enableTests, setEnableTests] = useState(true)
  const [enableFixes, setEnableFixes] = useState(true)
  const [requireApproval, setRequireApproval] = useState(true)
  const [autoPost, setAutoPost] = useState(false)
  const [loading, setLoading] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })

  const activeProv = llmProvider || settings?.active_provider || 'ollama'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (activeTab === 'paste' && !code.trim()) {
      toast.error('Please paste some code to review')
      return
    }
    if (activeTab === 'github_pr' && (!githubRepo || !prNumber)) {
      toast.error('Please provide a GitHub repo and PR number')
      return
    }

    const request: ReviewRequest = {
      title: title || (activeTab === 'paste' ? `Review — ${fileName}` : `PR #${prNumber} — ${githubRepo}`),
      source_type: activeTab,
      code_content: activeTab === 'paste' ? code : undefined,
      file_name: activeTab === 'paste' ? fileName : undefined,
      github_repo: activeTab === 'github_pr' ? githubRepo : undefined,
      pr_number: activeTab === 'github_pr' ? parseInt(prNumber) : undefined,
      llm_provider: llmProvider as LLMProvider || undefined,
      llm_model: llmModel || undefined,
      enable_security: enableSecurity,
      enable_tests: enableTests,
      enable_fixes: enableFixes,
      require_approval: requireApproval,
      auto_post_to_pr: autoPost,
    }

    setLoading(true)
    try {
      const { session_id } = await reviewApi.start(request)
      toast.success('Review started! Hermes is on the case 🧠')
      navigate(`/review/${session_id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start review'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)' }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">New Code Review</h1>
            <p className="text-sm text-gray-500">Paste code or connect a GitHub PR · Hermes orchestrates 5 AI agents</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Source tabs */}
          <div className="glass-card p-5">
            <div className="flex gap-2 mb-5">
              {([
                { id: 'paste', icon: FileCode2, label: 'Paste Code' },
                { id: 'github_pr', icon: Github, label: 'GitHub PR' },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn('synapse-tab flex items-center gap-2', activeTab === id && 'active')}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'paste' ? (
                <motion.div key="paste" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">File name</label>
                      <input
                        className="synapse-input text-sm"
                        placeholder="code.py"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Review title (optional)</label>
                      <input
                        className="synapse-input text-sm"
                        placeholder="Auto-generated from file name"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                      Code <span className="text-gray-700">{code.split('\n').length} lines</span>
                    </label>
                    <div className="relative rounded-lg overflow-hidden border border-dark-border focus-within:border-synapse-500 transition-colors">
                      <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-border bg-dark-bg">
                        <div className="w-3 h-3 rounded-full bg-red-500/40" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
                        <div className="w-3 h-3 rounded-full bg-green-500/40" />
                        <span className="ml-2 text-xs text-gray-600 font-mono">{fileName}</span>
                      </div>
                      <TextareaAutosize
                        className="w-full px-4 py-4 bg-dark-bg text-sm font-mono text-gray-300 resize-none focus:outline-none placeholder-gray-700 leading-relaxed"
                        placeholder={`# Paste your ${fileName.split('.').pop() || 'code'} here...\n# SYNAPSE will analyse it with 5 specialized AI agents\n`}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        minRows={14}
                        maxRows={40}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="github_pr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Repository</label>
                    <input
                      className="synapse-input text-sm"
                      placeholder="owner/repository-name"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">PR Number</label>
                      <input
                        className="synapse-input text-sm"
                        type="number"
                        placeholder="42"
                        value={prNumber}
                        onChange={(e) => setPrNumber(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Review title (optional)</label>
                      <input
                        className="synapse-input text-sm"
                        placeholder={githubRepo && prNumber ? `PR #${prNumber} — ${githubRepo}` : 'Auto-generated'}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-bg border border-dark-border">
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={autoPost} onChange={(e) => setAutoPost(e.target.checked)}
                        className="w-4 h-4 rounded accent-synapse-500" />
                      Auto-post review to GitHub PR after approval
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* LLM Selection */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-synapse-400" />
              AI Provider
              <span className="ml-auto text-xs text-gray-600 font-normal">
                Active: {PROVIDER_LABELS[activeProv] ?? activeProv}
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLlmProvider(key as LLMProvider)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium text-left transition-all duration-150 border',
                    llmProvider === key || (!llmProvider && settings?.active_provider === key)
                      ? 'bg-synapse-600/20 border-synapse-500/40 text-white'
                      : 'bg-dark-bg border-dark-border text-gray-500 hover:text-gray-300 hover:bg-dark-hover'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {(llmProvider || settings?.active_provider) && (
              <div className="mt-3">
                <input
                  className="synapse-input text-sm font-mono"
                  placeholder={`Custom model name (e.g. hermes3, gpt-4o, claude-3-5-sonnet-20241022)`}
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Advanced settings toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Advanced settings
            <ChevronDown className={cn('w-4 h-4 transition-transform', showAdvanced && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="glass-card p-5 overflow-hidden"
              >
                <h3 className="text-sm font-semibold text-white mb-4">Agent Configuration</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'security', label: '🛡️ Security Scan', value: enableSecurity, set: setEnableSecurity },
                    { key: 'tests', label: '🧪 Test Generation', value: enableTests, set: setEnableTests },
                    { key: 'fixes', label: '🔧 Fix Suggestions', value: enableFixes, set: setEnableFixes },
                    { key: 'approval', label: '✅ Require Hermes Approval', value: requireApproval, set: setRequireApproval },
                  ].map(({ key, label, value, set }) => (
                    <label key={key} className="flex items-center gap-3 p-3 rounded-lg bg-dark-bg border border-dark-border cursor-pointer hover:bg-dark-hover transition-colors">
                      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)}
                        className="w-4 h-4 rounded accent-synapse-500" />
                      <span className="text-sm text-gray-400">{label}</span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting review…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Start SYNAPSE Review
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
