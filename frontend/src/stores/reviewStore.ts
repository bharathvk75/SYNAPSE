// SYNAPSE — Zustand global store
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  ReviewResponse,
  ReviewStatus,
  AgentState,
  WSMessage,
} from '@/types'

interface HermesMessage {
  role: 'user' | 'hermes'
  content: string
  timestamp: string
}

interface StreamToken {
  agent: string
  token: string
}

interface ReviewStore {
  // ── Active reviews ──────────────────────────────────────────────────────────
  reviews: ReviewResponse[]
  activeSessionId: string | null
  activeReview: ReviewResponse | null

  // ── WS state ───────────────────────────────────────────────────────────────
  wsConnected: boolean
  streamingAgent: string | null
  streamBuffer: string

  // ── Agent progress ─────────────────────────────────────────────────────────
  agentStates: Record<string, AgentState>

  // ── Hermes conversation ────────────────────────────────────────────────────
  hermesMessages: HermesMessage[]
  hermesTyping: boolean
  approvalRequired: boolean
  approvalMessage: string | null

  // ── Actions ────────────────────────────────────────────────────────────────
  setReviews: (reviews: ReviewResponse[]) => void
  addReview: (review: ReviewResponse) => void
  updateReview: (sessionId: string, partial: Partial<ReviewResponse>) => void
  setActiveSession: (sessionId: string | null) => void
  setActiveReview: (review: ReviewResponse | null) => void

  setWsConnected: (v: boolean) => void
  handleWsMessage: (msg: WSMessage) => void

  addHermesMessage: (msg: HermesMessage) => void
  clearHermesMessages: () => void
  setHermesTyping: (v: boolean) => void

  setApprovalRequired: (v: boolean, message?: string) => void
  clearApproval: () => void

  reset: () => void
}

const defaultState = {
  reviews: [] as ReviewResponse[],
  activeSessionId: null as string | null,
  activeReview: null as ReviewResponse | null,
  wsConnected: false,
  streamingAgent: null as string | null,
  streamBuffer: '',
  agentStates: {} as Record<string, AgentState>,
  hermesMessages: [] as HermesMessage[],
  hermesTyping: false,
  approvalRequired: false,
  approvalMessage: null as string | null,
}

export const useReviewStore = create<ReviewStore>()(
  devtools(
    (set, get) => ({
      ...defaultState,

      setReviews: (reviews) => set({ reviews }),

      addReview: (review) =>
        set((s) => ({
          reviews: [review, ...s.reviews.filter((r) => r.session_id !== review.session_id)],
        })),

      updateReview: (sessionId, partial) =>
        set((s) => ({
          reviews: s.reviews.map((r) =>
            r.session_id === sessionId ? { ...r, ...partial } : r
          ),
          activeReview:
            s.activeReview?.session_id === sessionId
              ? { ...s.activeReview, ...partial }
              : s.activeReview,
        })),

      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

      setActiveReview: (review) =>
        set({
          activeReview: review,
          agentStates: review?.agent_states ?? {},
        }),

      setWsConnected: (v) => set({ wsConnected: v }),

      handleWsMessage: (msg: WSMessage) => {
        const s = get()

        switch (msg.type) {
          case 'agent_start': {
            const agent = msg.agent || (msg.data as { name?: string })?.name || 'unknown'
            set((st) => ({
              streamingAgent: agent,
              streamBuffer: '',
              agentStates: {
                ...st.agentStates,
                [agent]: {
                  name: agent,
                  status: 'running',
                  progress: 0,
                  tokens_used: 0,
                  started_at: msg.timestamp,
                },
              },
            }))
            break
          }

          case 'agent_progress': {
            const agent = msg.agent || ''
            const data = msg.data as { progress?: number; task?: string } | undefined
            if (agent) {
              set((st) => ({
                agentStates: {
                  ...st.agentStates,
                  [agent]: {
                    ...(st.agentStates[agent] ?? { name: agent, status: 'running', tokens_used: 0 }),
                    progress: data?.progress ?? 0,
                    current_task: data?.task,
                    status: 'running',
                  },
                },
              }))
            }
            break
          }

          case 'agent_complete': {
            const agent = msg.agent || ''
            if (agent) {
              set((st) => ({
                streamingAgent: st.streamingAgent === agent ? null : st.streamingAgent,
                agentStates: {
                  ...st.agentStates,
                  [agent]: {
                    ...(st.agentStates[agent] ?? { name: agent, tokens_used: 0 }),
                    status: 'completed',
                    progress: 1,
                    completed_at: msg.timestamp,
                  },
                },
              }))
            }
            break
          }

          case 'agent_error': {
            const agent = msg.agent || ''
            const data = msg.data as { error?: string } | undefined
            if (agent) {
              set((st) => ({
                agentStates: {
                  ...st.agentStates,
                  [agent]: {
                    ...(st.agentStates[agent] ?? { name: agent, tokens_used: 0 }),
                    status: 'failed',
                    error: data?.error,
                  },
                },
              }))
            }
            break
          }

          case 'stream_token': {
            const data = msg.data as { token?: string } | undefined
            set((st) => ({ streamBuffer: st.streamBuffer + (data?.token ?? '') }))
            break
          }

          case 'hermes_message': {
            const data = msg.data as { content?: string } | undefined
            const content = data?.content || ''
            if (content) {
              set((st) => ({
                hermesMessages: [
                  ...st.hermesMessages,
                  { role: 'hermes', content, timestamp: msg.timestamp },
                ],
                hermesTyping: false,
              }))
            }
            break
          }

          case 'approval_required': {
            const data = msg.data as { message?: string } | undefined
            set({
              approvalRequired: true,
              approvalMessage: data?.message ?? null,
            })
            break
          }

          case 'approval_received': {
            set({ approvalRequired: false, approvalMessage: null })
            break
          }

          case 'review_complete': {
            const review = msg.data as ReviewResponse | undefined
            if (review) {
              set((st) => ({
                activeReview: review,
                agentStates: review.agent_states ?? st.agentStates,
              }))
              get().addReview(review)
            }
            break
          }

          case 'current_state': {
            const review = msg.data as ReviewResponse | undefined
            if (review) {
              set({ activeReview: review, agentStates: review.agent_states ?? {} })
            }
            break
          }

          default:
            break
        }
      },

      addHermesMessage: (msg) =>
        set((s) => ({ hermesMessages: [...s.hermesMessages, msg] })),

      clearHermesMessages: () => set({ hermesMessages: [] }),

      setHermesTyping: (v) => set({ hermesTyping: v }),

      setApprovalRequired: (v, message) =>
        set({ approvalRequired: v, approvalMessage: message ?? null }),

      clearApproval: () => set({ approvalRequired: false, approvalMessage: null }),

      reset: () => set(defaultState),
    }),
    { name: 'SYNAPSE' }
  )
)
