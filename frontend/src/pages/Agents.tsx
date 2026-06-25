// SYNAPSE — Agents Page
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Bot, Zap, CheckCircle2, ChevronRight } from 'lucide-react'
import { agentsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AgentInfo } from '@/types'

const AGENT_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  hermes:          { bg: 'bg-hermes-500/10',   border: 'border-hermes-500/30',   glow: 'shadow-hermes' },
  code_analyzer:   { bg: 'bg-synapse-500/10',  border: 'border-synapse-500/30',  glow: 'shadow-synapse' },
  security_scanner:{ bg: 'bg-red-500/10',      border: 'border-red-500/30',      glow: '' },
  test_generator:  { bg: 'bg-green-500/10',    border: 'border-green-500/30',    glow: '' },
  fix_suggester:   { bg: 'bg-yellow-500/10',   border: 'border-yellow-500/30',   glow: '' },
  pr_manager:      { bg: 'bg-purple-500/10',   border: 'border-purple-500/30',   glow: '' },
}

export default function AgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-synapse-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Agent Fleet</h1>
            <p className="text-sm text-gray-500">
              6 specialized AI agents orchestrated by Hermes via LangGraph
            </p>
          </div>
        </div>

        {/* Pipeline diagram */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Review Pipeline</h2>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {['🧠 Hermes Init', '🔍 CodeAnalyzer', '🛡️ SecurityScanner', '🧪 TestGenerator', '🔧 FixSuggester', '🧠 Hermes Synth', '🐙 PRManager'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2 flex-shrink-0">
                <div className="px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-xs font-medium text-white whitespace-nowrap">
                  {step}
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-700 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3">
            All agents share a unified <span className="text-synapse-400 font-mono">SynapseState</span> via LangGraph's StateGraph.
            Hermes orchestrates entry and synthesis; specialist agents run in sequence. PRManager runs only after explicit approval.
          </p>
        </div>

        {/* Agent cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading agents…
          </div>
        ) : (
          <div className="space-y-4">
            {(data?.agents ?? []).map((agent, i) => (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <AgentCard agent={agent} />
              </motion.div>
            ))}
          </div>
        )}

        {/* LangGraph explanation */}
        <div className="glass-card p-6 border-synapse-700/30">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-synapse-400" />
            <h2 className="text-sm font-semibold text-white">Why LangGraph? (The "Ponytail" Architecture)</h2>
          </div>
          <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
            <p>
              SYNAPSE uses <span className="text-synapse-400 font-semibold">LangGraph's StateGraph</span> as the multi-agent backbone.
              This is what we call the "Ponytail" pattern — complex agent orchestration with minimal code.
            </p>
            <p>
              Instead of manually chaining LLM calls, LangGraph lets us define a <span className="text-synapse-400">DAG of agent nodes</span> with
              conditional edges, shared state, and built-in persistence. Adding a new agent is as simple as adding a node and an edge.
            </p>
            <p>
              The entire 6-agent pipeline is defined in ~80 lines of Python in <span className="font-mono text-hermes-400">workflow.py</span>.
              Without LangGraph, this would require hundreds of lines of async orchestration code.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function AgentCard({ agent }: { agent: AgentInfo }) {
  const colors = AGENT_COLORS[agent.name] ?? { bg: 'bg-dark-card', border: 'border-dark-border', glow: '' }
  return (
    <div className={cn('rounded-xl border p-6 transition-all', colors.bg, colors.border)}>
      <div className="flex items-start gap-4">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0', colors.bg, 'border', colors.border)}>
          {agent.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-bold text-white">{agent.display_name}</h3>
            <span className="text-xs text-gray-500 bg-dark-bg px-2 py-0.5 rounded-full border border-dark-border">
              {agent.role}
            </span>
          </div>
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">{agent.description}</p>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Capabilities</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {agent.capabilities.map((cap) => (
                <div key={cap} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-400">{cap}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs text-gray-600">Runs at:</span>
            {agent.runs_at.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded bg-dark-bg border border-dark-border text-xs text-gray-500 font-mono">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
