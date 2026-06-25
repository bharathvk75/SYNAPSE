// SYNAPSE — Core TypeScript Types

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type IssueCategory = 'security' | 'performance' | 'maintainability' | 'bug' | 'style' | 'testing' | 'documentation' | 'best_practice'
export type ReviewStatus = 'pending' | 'running' | 'awaiting_approval' | 'approved' | 'rejected' | 'completed' | 'failed'
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'waiting'
export type LLMProvider = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'cohere' | 'azure' | 'deepseek'

export interface CodeIssue {
  id: string
  file_path: string
  line_start: number
  line_end?: number
  category: IssueCategory
  severity: Severity
  title: string
  description: string
  suggestion: string
  code_snippet?: string
  confidence: number
  rule_id?: string
  references?: string[]
}

export interface SecurityVulnerability {
  id: string
  file_path: string
  line_start: number
  line_end?: number
  cve_id?: string
  owasp_category?: string
  severity: Severity
  title: string
  description: string
  remediation: string
  code_snippet?: string
  exploit_likelihood: number
  cvss_score?: number
}

export interface TestSuggestion {
  id: string
  file_path: string
  function_name: string
  test_type: string
  description: string
  test_code: string
  priority: string
  coverage_gap: string
}

export interface FixSuggestion {
  id: string
  issue_ids: string[]
  file_path: string
  original_code: string
  fixed_code: string
  diff: string
  explanation: string
  confidence: number
  auto_applicable: boolean
}

export interface AgentState {
  name: string
  status: AgentStatus
  started_at?: string
  completed_at?: string
  tokens_used: number
  error?: string
  progress: number
  current_task?: string
}

export interface ReviewSummary {
  total_issues: number
  critical_issues: number
  high_issues: number
  medium_issues: number
  low_issues: number
  security_vulnerabilities: number
  tests_suggested: number
  fixes_available: number
  overall_score: number
  risk_level: string
  files_analyzed: number
  lines_analyzed: number
  ai_confidence: number
}

export interface ReviewResponse {
  session_id: string
  status: ReviewStatus
  title: string
  created_at: string
  completed_at?: string
  duration_seconds?: number
  summary: ReviewSummary
  issues: CodeIssue[]
  vulnerabilities: SecurityVulnerability[]
  test_suggestions: TestSuggestion[]
  fix_suggestions: FixSuggestion[]
  hermes_narrative?: string
  hermes_approval_message?: string
  requires_approval: boolean
  approved_by?: string
  agent_states: Record<string, AgentState>
  llm_provider?: string
  llm_model?: string
  error?: string
}

export interface ReviewRequest {
  title?: string
  description?: string
  source_type: 'paste' | 'github_pr' | 'github_repo'
  code_content?: string
  file_name?: string
  language?: string
  github_repo?: string
  pr_number?: number
  branch?: string
  llm_provider?: LLMProvider
  llm_model?: string
  enable_security?: boolean
  enable_tests?: boolean
  enable_fixes?: boolean
  auto_post_to_pr?: boolean
  require_approval?: boolean
}

export interface LLMProviderConfig {
  provider: LLMProvider
  model: string
  api_key?: string
  base_url?: string
  is_active: boolean
  is_local: boolean
  display_name: string
  description: string
}

export interface SettingsResponse {
  active_provider: string
  active_model: string
  hermes_provider: string
  hermes_model: string
  providers: LLMProviderConfig[]
  github_connected: boolean
  github_user?: string
  review_settings: Record<string, boolean | number | string>
}

export interface GitHubPRInfo {
  repo: string
  pr_number: number
  title: string
  body?: string
  author: string
  base_branch: string
  head_branch: string
  files_changed: number
  additions: number
  deletions: number
  state: string
  url: string
  created_at: string
  updated_at: string
}

export interface GitHubRepoInfo {
  full_name: string
  description?: string
  default_branch: string
  language?: string
  stars: number
  open_prs: number
  private: boolean
}

export interface AgentInfo {
  name: string
  display_name: string
  emoji: string
  role: string
  description: string
  capabilities: string[]
  runs_at: string[]
}

// WebSocket message types
export type WSMessageType =
  | 'agent_start'
  | 'agent_progress'
  | 'agent_complete'
  | 'agent_error'
  | 'stream_token'
  | 'review_complete'
  | 'approval_required'
  | 'approval_received'
  | 'hermes_message'
  | 'pr_posted'
  | 'error'
  | 'ping'
  | 'pong'
  | 'current_state'

export interface WSMessage {
  type: WSMessageType
  session_id: string
  agent?: string
  data?: Record<string, unknown>
  timestamp: string
}
