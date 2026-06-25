// SYNAPSE — AgentPipeline Component (live agent status visualization)
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentState } from '@/types'

const AGENTS = [
  { key: 'hermes_init',     emoji: '🧠', label: 'Hermes Init' },
  { key: 'code_analyzer',   emoji: '🔍', label: 'CodeAnalyzer' },
  { key: 'security_scanner',emoji: '🛡️', label: 'Security' },
  { key: 'test_generator',  emoji: '🧪', label: 'TestGen' },
  { key: 'fix_suggester',   emoji: '🔧', label: 'FixSuggester' },
  { key: 'hermes_synthesize',emoji: '🧠', label: 'Hermes Synth' },
  { key: 'pr_manager',      emoji: '🐙', label: 'PRManager' },
]

interface Props {
  agentStates: Record<string, AgentState>
}

export default function AgentPipeline({ agentStates }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
      {AGENTS.map((agent, idx) => {
        const state = agentStates[agent.key]
        const status = state?.status ?? 'idle'
        return (
          <div key={agent.key} className="flex items-center gap-1 flex-shrink-0">
            <AgentDot
              emoji={agent.emoji}
              label={agent.label}
              status={status}
              progress={state?.progress ?? 0}
              task={state?.current_task}
            />
            {idx < AGENTS.length - 1 && (
              <div className={cn(
                'w-6 h-px transition-colors duration-500',
                status === 'completed' ? 'bg-synapse-500' : 'bg-dark-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function AgentDot({
  emoji,
  label,
  status,
  progress,
  task,
}: {
  emoji: string
  label: string
  status: string
  progress: number
  task?: string | null
}) {
  const isRunning   = status === 'running'
  const isCompleted = status === 'completed'
  const isError     = status === 'failed'
  const isWaiting   = status === 'waiting'

  return (
    <div className="relative group">
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all duration-300 border',
          isRunning   && 'border-synapse-500/60 bg-synapse-600/15 shadow-glow-sm',
          isCompleted && 'border-green-500/40 bg-green-500/10',
          isError     && 'border-red-500/40 bg-red-500/10',
          isWaiting   && 'border-yellow-500/40 bg-yellow-500/10',
          status === 'idle' && 'border-dark-border bg-dark-bg opacity-50',
        )}
      >
        {isRunning ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-lg border-2 border-synapse-400 border-t-transparent"
          />
        ) : null}
        <span className={cn(isRunning && 'animate-pulse')}>{emoji}</span>
      </div>

      {/* Status overlay icon */}
      {isCompleted && (
        <CheckCircle2 className="w-3 h-3 text-green-400 absolute -top-1 -right-1 bg-dark-bg rounded-full" />
      )}
      {isError && (
        <XCircle className="w-3 h-3 text-red-400 absolute -top-1 -right-1 bg-dark-bg rounded-full" />
      )}

      {/* Progress bar for running */}
      {isRunning && progress > 0 && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full overflow-hidden bg-dark-border">
          <motion.div
            className="h-full bg-synapse-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
        <div className="px-2.5 py-1.5 rounded-lg bg-dark-card border border-dark-border text-xs whitespace-nowrap shadow-card">
          <p className="font-medium text-white">{label}</p>
          <p className={cn(
            'text-xs mt-0.5',
            isRunning   ? 'text-synapse-400' :
            isCompleted ? 'text-green-400' :
            isError     ? 'text-red-400' :
            'text-gray-600'
          )}>
            {isRunning ? (task || 'Running…') : status}
          </p>
          {isRunning && progress > 0 && (
            <p className="text-gray-600 text-xs">{Math.round(progress * 100)}%</p>
          )}
        </div>
      </div>
    </div>
  )
}
