// SYNAPSE — Axios API client
import axios from 'axios'
import type {
  ReviewRequest,
  ReviewResponse,
  SettingsResponse,
  SettingsUpdateRequest,
  GitHubPRInfo,
  GitHubRepoInfo,
  AgentInfo,
} from '@/types'

const api = axios.create({
  baseURL: '/api',
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor ────────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// ── Response interceptor ───────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Unknown API error'
    return Promise.reject(new Error(message))
  }
)

// ── Review API ─────────────────────────────────────────────────────────────────
export const reviewApi = {
  start: (request: ReviewRequest): Promise<{ session_id: string; status: string }> =>
    api.post('/review/', request).then((r) => r.data),

  list: (limit = 20, offset = 0): Promise<ReviewResponse[]> =>
    api.get('/review/', { params: { limit, offset } }).then((r) => r.data),

  get: (sessionId: string): Promise<ReviewResponse> =>
    api.get(`/review/${sessionId}`).then((r) => r.data),

  delete: (sessionId: string): Promise<void> =>
    api.delete(`/review/${sessionId}`).then(() => undefined),

  approve: (
    sessionId: string,
    decision: 'approve' | 'reject',
    comment?: string
  ): Promise<{ decision: string; status: string }> =>
    api
      .post(`/review/${sessionId}/approve`, { session_id: sessionId, decision, comment })
      .then((r) => r.data),

  chatWithHermes: (
    sessionId: string,
    message: string
  ): Promise<{ response: string; role: string }> =>
    api
      .post(`/review/${sessionId}/hermes`, { session_id: sessionId, message, role: 'user' })
      .then((r) => r.data),
}

// ── GitHub API ─────────────────────────────────────────────────────────────────
export const githubApi = {
  status: (): Promise<{ connected: boolean; user?: string; token_configured: boolean }> =>
    api.get('/github/status').then((r) => r.data),

  connect: (token: string): Promise<{ connected: boolean; user: string; message: string }> =>
    api.post('/github/connect', { token }).then((r) => r.data),

  listRepos: (limit = 30): Promise<{ repos: GitHubRepoInfo[] }> =>
    api.get('/github/repos', { params: { limit } }).then((r) => r.data),

  listPRs: (
    owner: string,
    repo: string,
    state = 'open'
  ): Promise<{ prs: GitHubPRInfo[] }> =>
    api.get(`/github/repos/${owner}/${repo}/prs`, { params: { state } }).then((r) => r.data),

  getPR: (owner: string, repo: string, prNumber: number): Promise<GitHubPRInfo> =>
    api.get(`/github/repos/${owner}/${repo}/prs/${prNumber}`).then((r) => r.data),

  reviewPR: (params: {
    repo: string
    pr_number: number
    llm_provider?: string
    llm_model?: string
    auto_post?: boolean
    require_approval?: boolean
  }): Promise<{ session_id: string; status: string }> =>
    api.post('/github/review-pr', params).then((r) => r.data),
}

// ── Settings API ───────────────────────────────────────────────────────────────
export const settingsApi = {
  get: (): Promise<SettingsResponse> =>
    api.get('/settings/').then((r) => r.data),

  update: (body: Partial<SettingsUpdateRequest>): Promise<{ status: string }> =>
    api.put('/settings/', body).then((r) => r.data),

  testLLM: (provider?: string, model?: string) =>
    api
      .post('/settings/test-llm', null, { params: { provider, model } })
      .then((r) => r.data),

  ollamaModels: (): Promise<{ models: string[] }> =>
    api.get('/settings/ollama/models').then((r) => r.data),

  lmstudioModels: (): Promise<{ models: string[] }> =>
    api.get('/settings/lmstudio/models').then((r) => r.data),
}

// ── Agents API ─────────────────────────────────────────────────────────────────
export const agentsApi = {
  list: (): Promise<{ agents: AgentInfo[] }> =>
    api.get('/agents/').then((r) => r.data),

  get: (name: string): Promise<AgentInfo> =>
    api.get(`/agents/${name}`).then((r) => r.data),

  status: (sessionId: string) =>
    api.get(`/agents/status/${sessionId}`).then((r) => r.data),
}

// ── Health ─────────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health').then((r) => r.data),
}

export default api
