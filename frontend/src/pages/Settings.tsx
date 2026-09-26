import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Settings, Zap, CheckCircle2, AlertCircle, Eye, EyeOff,
  Loader2, Save, Activity, Github, Bot, Shield, TestTube, Bell, MessageSquare,
} from 'lucide-react'
import { settingsApi, githubApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const qc = useQueryClient()
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [githubToken, setGithubToken] = useState('')
  const [reviewSettings, setReviewSettings] = useState<Record<string, boolean | number>>({})
  const [notificationSettings, setNotificationSettings] = useState<Record<string, string | boolean>>({})
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [activeModel, setActiveModel] = useState('')
  const [hermesProvider, setHermesProvider] = useState<string | null>(null)
  const [hermesModel, setHermesModel] = useState('')
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { status: string; latency_ms?: number; error?: string }>>({})
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({})

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })

  useEffect(() => {
    if (settings) {
      if (!activeProvider) setActiveProvider(settings.active_provider)
      if (!activeModel) setActiveModel(settings.active_model)
      if (!hermesProvider) setHermesProvider(settings.hermes_provider)
      if (!hermesModel) setHermesModel(settings.hermes_model)
      if (Object.keys(reviewSettings).length === 0) {
        setReviewSettings(settings.review_settings as Record<string, boolean | number>)
      }
      if (Object.keys(notificationSettings).length === 0 && settings.notification_settings) {
        setNotificationSettings(settings.notification_settings as Record<string, string | boolean>)
      }
      const urls: Record<string, string> = {}
      settings.providers.forEach((p) => {
        if (p.base_url) {
          urls[p.provider] = p.base_url
        }
      })
      setBaseUrls(urls)
    }
  }, [settings])

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => settingsApi.update(body),
    onSuccess: () => {
      toast.success('Settings saved')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const { data: ollamaModels } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: settingsApi.ollamaModels,
  })

  const { data: lmstudioModels } = useQuery({
    queryKey: ['lmstudio-models'],
    queryFn: settingsApi.lmstudioModels,
  })

  async function testConnection(provider: string) {
    setTestingProvider(provider)
    try {
      const result = await settingsApi.testLLM(provider)
      setTestResult((r) => ({ ...r, [provider]: result }))
      if (result.status === 'ok') {
        toast.success(`${provider} connected! ${result.latency_ms}ms`)
      } else {
        toast.error(`${provider} failed: ${result.error}`)
      }
    } catch (e) {
      setTestResult((r) => ({ ...r, [provider]: { status: 'error', error: 'Request failed' } }))
      toast.error(`${provider} connection test failed`)
    } finally {
      setTestingProvider(null)
    }
  }

  function saveAll() {
    const body: Record<string, unknown> = {
      review_settings: reviewSettings,
      notification_settings: notificationSettings,
    }
    if (activeProvider) body.llm_provider = activeProvider
    if (activeModel) body.llm_model = activeModel
    if (hermesProvider) body.hermes_provider = hermesProvider
    if (hermesModel) body.hermes_model = hermesModel
    if (githubToken) body.github_token = githubToken
    if (Object.keys(apiKeys).length > 0) body.api_keys = apiKeys
    if (Object.keys(baseUrls).length > 0) body.base_urls = baseUrls
    updateMut.mutate(body)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings…
      </div>
    )
  }

  const providers = settings?.providers ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-synapse-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Settings</h1>
              <p className="text-sm text-gray-500">Configure LLM providers, GitHub integration, and review behaviour</p>
            </div>
          </div>
          <button
            onClick={saveAll}
            disabled={updateMut.isPending}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>

        {/* LLM Providers */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-synapse-400" />
            LLM Providers
          </h2>
          <div className="space-y-4">
            {providers.map((p) => {
              const result = testResult[p.provider]
              return (
                <div key={p.provider}
                  className={cn(
                    'rounded-xl border p-4 transition-all cursor-pointer',
                    activeProvider === p.provider
                      ? 'border-synapse-500/50 bg-synapse-600/5'
                      : 'border-dark-border bg-dark-bg hover:bg-dark-hover'
                  )}
                  onClick={() => setActiveProvider(p.provider)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-2 h-2 rounded-full', activeProvider === p.provider ? 'bg-synapse-400' : 'bg-gray-700')} />
                      <span className="font-medium text-white text-sm">{p.display_name}</span>
                      {p.is_local && (
                        <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                          Local · Free
                        </span>
                      )}
                      {activeProvider === p.provider && (
                        <span className="text-xs text-synapse-400">Active</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {result && (
                        <span className={cn('text-xs', result.status === 'ok' ? 'text-green-400' : 'text-red-400')}>
                          {result.status === 'ok' ? `✓ ${result.latency_ms}ms` : `✗ ${result.error}`}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); testConnection(p.provider) }}
                        disabled={testingProvider === p.provider}
                        className="btn-ghost text-xs flex items-center gap-1.5 py-1"
                      >
                        {testingProvider === p.provider
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Activity className="w-3.5 h-3.5" />}
                        Test
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 ml-5">{p.description}</p>

                  {/* API key input for cloud providers */}
                  {!p.is_local && activeProvider === p.provider && (
                    <div className="mt-3 ml-5 space-y-2">
                      <div className="relative">
                        <input
                          type={showKeys[p.provider] ? 'text' : 'password'}
                          className="synapse-input text-sm font-mono pr-10"
                          placeholder={`${p.display_name} API key`}
                          value={apiKeys[p.provider] ?? ''}
                          onChange={(e) => setApiKeys((k) => ({ ...k, [p.provider]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowKeys((s) => ({ ...s, [p.provider]: !s[p.provider] })) }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                        >
                          {showKeys[p.provider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <input
                        className="synapse-input text-sm font-mono"
                        placeholder={`Model name (e.g. ${p.model})`}
                        value={activeProvider === p.provider ? activeModel : ''}
                        onChange={(e) => setActiveModel(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {(p.provider === 'openai_compatible' || p.provider === 'nvidia' || p.provider === 'deepseek') && (
                        <input
                          className="synapse-input text-sm font-mono"
                          placeholder="Base URL (e.g. https://api.openai.com/v1)"
                          value={baseUrls[p.provider] ?? ''}
                          onChange={(e) => setBaseUrls((u) => ({ ...u, [p.provider]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  )}

                  {/* Local model selection */}
                  {p.is_local && activeProvider === p.provider && (
                    <div className="mt-3 ml-5">
                      {p.provider === 'ollama' && ollamaModels?.models?.length ? (
                        <select
                          className="synapse-input text-sm"
                          value={activeModel}
                          onChange={(e) => setActiveModel(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ollamaModels.models.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="synapse-input text-sm font-mono"
                          placeholder={`Model name (e.g. ${p.model})`}
                          value={activeModel}
                          onChange={(e) => setActiveModel(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Hermes model */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-hermes-500" />
            Hermes Orchestrator Model
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Hermes can use a different (often larger) model for orchestration and synthesis. 
            It handles conversational approval and cross-agent reasoning.
          </p>
          <div className="flex gap-3">
            <select
              className="synapse-input text-sm flex-1"
              value={hermesProvider ?? settings?.hermes_provider ?? 'ollama'}
              onChange={(e) => setHermesProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.provider} value={p.provider}>{p.display_name}</option>
              ))}
            </select>
            <input
              className="synapse-input text-sm font-mono flex-1"
              placeholder="hermes3, gpt-4o, claude-3-5-sonnet…"
              value={hermesModel}
              onChange={(e) => setHermesModel(e.target.value)}
            />
          </div>
        </div>

        {/* Review settings */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-synapse-400" />
            Review Behaviour
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'enable_security_scan',      label: '🛡️ Security Scanner',          desc: 'OWASP + CVE analysis on every review' },
              { key: 'enable_test_generation',    label: '🧪 Test Generator',            desc: 'Auto-generate test suggestions' },
              { key: 'enable_fix_suggestions',    label: '🔧 Fix Suggester',             desc: 'Generate diff-backed fix suggestions' },
              { key: 'require_approval_for_pr',   label: '✅ Require PR Approval',       desc: 'Hermes asks before posting to GitHub' },
              { key: 'auto_approve_low_severity', label: '⚡ Auto-approve Low Severity', desc: 'Skip approval for low-risk reviews' },
              { key: 'enable_ast_analysis',       label: '🌳 AST Analysis',             desc: 'Python AST-level deep analysis' },
            ].map(({ key, label, desc }) => (
              <label key={key}
                className="flex items-start gap-3 p-4 rounded-xl bg-dark-bg border border-dark-border cursor-pointer hover:bg-dark-hover transition-colors">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded accent-synapse-500"
                  checked={reviewSettings[key] as boolean ?? false}
                  onChange={(e) => setReviewSettings((s) => ({ ...s, [key]: e.target.checked }))}
                />
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* GitHub */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Github className="w-4 h-4 text-white" />
            GitHub Token
            {settings?.github_connected && (
              <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected as @{settings.github_user}
              </span>
            )}
          </h2>
          <div className="relative">
            <input
              type={showKeys['github'] ? 'text' : 'password'}
              className="synapse-input text-sm font-mono pr-10"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (leave blank to keep current)"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowKeys((s) => ({ ...s, github: !s.github }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            >
              {showKeys['github'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Notification Channels */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-hermes-500" />
            Notification Channels (Telegram & WhatsApp)
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Receive review results and approval notifications instantly on Telegram or WhatsApp.
          </p>

          <div className="space-y-6">
            {/* Telegram Channel */}
            <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-white cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-synapse-500"
                    checked={!!notificationSettings.enable_telegram_notifications}
                    onChange={(e) => setNotificationSettings((s) => ({ ...s, enable_telegram_notifications: e.target.checked }))}
                  />
                  📬 Enable Telegram Notifications
                </label>
              </div>
              
              {notificationSettings.enable_telegram_notifications && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Telegram Bot Token</label>
                    <input
                      type="password"
                      className="synapse-input text-xs font-mono"
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      value={(notificationSettings.telegram_bot_token as string) || ''}
                      onChange={(e) => setNotificationSettings((s) => ({ ...s, telegram_bot_token: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Telegram Chat ID</label>
                    <input
                      className="synapse-input text-xs font-mono"
                      placeholder="-100xxxxxxxxx or @channelname"
                      value={(notificationSettings.telegram_chat_id as string) || ''}
                      onChange={(e) => setNotificationSettings((s) => ({ ...s, telegram_chat_id: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp Channel */}
            <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-white cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-synapse-500"
                    checked={!!notificationSettings.enable_whatsapp_notifications}
                    onChange={(e) => setNotificationSettings((s) => ({ ...s, enable_whatsapp_notifications: e.target.checked }))}
                  />
                  💬 Enable WhatsApp Notifications
                </label>
              </div>

              {notificationSettings.enable_whatsapp_notifications && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">WhatsApp Phone Number ID</label>
                      <input
                        className="synapse-input text-xs font-mono"
                        placeholder="e.g., 10928374656574"
                        value={(notificationSettings.whatsapp_phone_number_id as string) || ''}
                        onChange={(e) => setNotificationSettings((s) => ({ ...s, whatsapp_phone_number_id: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Recipient Phone Number</label>
                      <input
                        className="synapse-input text-xs font-mono"
                        placeholder="e.g., +447123456789 (with country code)"
                        value={(notificationSettings.whatsapp_recipient_number as string) || ''}
                        onChange={(e) => setNotificationSettings((s) => ({ ...s, whatsapp_recipient_number: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Meta Access Token (System User Permanent Token)</label>
                    <input
                      type="password"
                      className="synapse-input text-xs font-mono"
                      placeholder="EAACw..."
                      value={(notificationSettings.whatsapp_access_token as string) || ''}
                      onChange={(e) => setNotificationSettings((s) => ({ ...s, whatsapp_access_token: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save button at bottom */}
        <div className="flex justify-end">
          <button
            onClick={saveAll}
            disabled={updateMut.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Settings
          </button>
        </div>
      </motion.div>
    </div>
  )
}
