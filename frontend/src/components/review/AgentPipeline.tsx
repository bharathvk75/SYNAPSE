// SYNAPSE — AgentPipeline Component (live agent status + Chain-of-Thought reasoning traces)
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, BrainCircuit, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentState } from '@/types'

const AGENTS = [
  { key: 'hermes_init',       emoji: '🧠', label: 'Hermes Init' },
  { key: 'code_analyzer',     emoji: '🔍', label: 'CodeAnalyzer' },
  { key: 'security_scanner',  emoji: '🛡️', label: 'Security' },
  { key: 'impact_analyzer',   emoji: '💥', label: 'Blast Radius' },
  { key: 'test_generator',    emoji: '🧪', label: 'TestGen' },
  { key: 'fix_suggester',     emoji: '🔧', label: 'FixSuggester' },
  { key: 'hermes_synthesize', emoji: '🧠', label: 'Hermes Synth' },
  { key: 'pr_manager',        emoji: '🐙', label: 'PRManager' },
]

interface Props {
  agentStates: Record<string, AgentState>
}

export default function AgentPipeline({ agentStates }: Props) {
  const [showTraces, setShowTraces] = useState(false)

  // Collect any agent with reasoning traces or thoughts
  const agentsWithTraces = Object.entries(agentStates).filter(
    ([_, s]) => (s.reasoning_trace && s.reasoning_trace.length > 0) || s.thought_process
  )

  return (
    <div className="space-y-3">
      {/* Top pipeline dots */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
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
                    'w-5 h-px transition-colors duration-500',
                    status === 'completed' ? 'bg-synapse-500' : 'bg-dark-border'
                  )} />
                )}
              </div>
            )
          })}
        </div>

        {/* Reasoning Trace toggle button */}
        <button
          onClick={() => setShowTraces(!showTraces)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border border-synapse-500/30 bg-synapse-950/40 text-synapse-300 hover:border-synapse-500/60 transition-all flex-shrink-0 ml-3"
        >
          <BrainCircuit className="w-3.5 h-3.5 text-synapse-400" />
          <span>CoT Reasoning</span>
          {showTraces ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expandable Reasoning Trace Drawer */}
      <AnimatePresence>
        {showTraces && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border border-dark-border rounded bg-dark-bg/80 p-3 space-y-2.5 font-mono text-xs"
          >
            <div className="flex items-center gap-2 text-gray-400 border-b border-dark-border pb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-synapse-400" />
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Multi-Agent Chain-of-Thought & Reasoning Execution
              </span>
            </div>

            {agentsWithTraces.length > 0 ? (
              <div className="space-y-2">
                {agentsWithTraces.map(([key, s]) => {
                  const agentMeta = AGENTS.find((a) => a.key === key)
                  return (
                    <div key={key} className="bg-dark-surface p-2.5 rounded border border-dark-border/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-gray-200 flex items-center gap-1.5">
                          <span>{agentMeta?.emoji ?? '🤖'}</span>
                          <span>{agentMeta?.label ?? key}</span>
                        </span>
                        {s.confidence_score && (
                          <span className="text-[10px] text-synapse-400 border border-synapse-500/30 px-1.5 py-0.5 rounded">
                            {Math.round(s.confidence_score * 100)}% Confidence
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 pl-2 border-l border-synapse-500/30 text-gray-400 text-[11px]">
                        {s.reasoning_trace && s.reasoning_trace.map((step, sIdx) => (
                          <div key={sIdx} className="leading-relaxed">
                            <span className="text-synapse-400 font-bold mr-1.5">›</span>
                            <span>{step}</span>
                          </div>
                        ))}
                        {(!s.reasoning_trace || s.reasoning_trace.length === 0) && s.thought_process && (
                          <div>{s.thought_process}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-gray-500 italic py-2 text-center text-xs">
                Reasoning deliberation traces stream live as agents evaluate files.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
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
          'w-7 h-7 rounded flex items-center justify-center text-xs transition-all duration-300 border',
          isRunning   && 'border-synapse-500/80 bg-synapse-600/20 shadow-glow-sm',
          isCompleted && 'border-green-500/40 bg-green-500/10',
          isError     && 'border-red-500/40 bg-red-500/10',
          isWaiting   && 'border-yellow-500/40 bg-yellow-500/10',
          status === 'idle' && 'border-dark-border bg-dark-bg opacity-40',
        )}
      >
        {isRunning ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded border-2 border-synapse-400 border-t-transparent"
          />
        ) : null}
        <span className={cn(isRunning && 'animate-pulse')}>{emoji}</span>
      </div>

      {/* Status overlay icon */}
      {isCompleted && (
        <CheckCircle2 className="w-2.5 h-2.5 text-green-400 absolute -top-1 -right-1 bg-dark-bg rounded-full" />
      )}
      {isError && (
        <XCircle className="w-2.5 h-2.5 text-red-400 absolute -top-1 -right-1 bg-dark-bg rounded-full" />
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
        <div className="px-2 py-1 rounded bg-dark-card border border-dark-border text-[11px] whitespace-nowrap shadow-card font-mono">
          <p className="font-bold text-white">{label}</p>
          <p className={cn(
            'text-[10px] mt-0.5',
            isRunning   ? 'text-synapse-400' :
            isCompleted ? 'text-green-400' :
            isError     ? 'text-red-400' :
            'text-gray-500'
          )}>
            {isRunning ? (task || 'Running…') : status}
          </p>
          {isRunning && progress > 0 && (
            <p className="text-gray-500 text-[10px]">{Math.round(progress * 100)}%</p>
          )}
        </div>
      </div>
    </div>
  )
}
