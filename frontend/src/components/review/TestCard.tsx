// SYNAPSE — TestCard Component
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Copy, CheckCheck, TestTube } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn, copyToClipboard } from '@/lib/utils'
import type { TestSuggestion } from '@/types'

const PRIORITY_COLORS = {
  high:   'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
  low:    'text-blue-400 bg-blue-500/10 border-blue-500/25',
}

const TEST_TYPE_LABELS: Record<string, string> = {
  unit:        '🔬 Unit',
  integration: '🔗 Integration',
  e2e:         '🌐 E2E',
  property:    '🎲 Property',
  snapshot:    '📸 Snapshot',
  mutation:    '🧬 Mutation',
}

export default function TestCard({ suggestion }: { suggestion: TestSuggestion }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await copyToClipboard(suggestion.test_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const priorityClass = PRIORITY_COLORS[suggestion.priority as keyof typeof PRIORITY_COLORS] ?? PRIORITY_COLORS.medium

  return (
    <motion.div layout className="glass-card overflow-hidden border-green-500/10">
      <button
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-dark-hover/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0 mt-0.5">
          <TestTube className="w-4 h-4 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border',
              priorityClass
            )}>
              {suggestion.priority.toUpperCase()} PRIORITY
            </span>
            <span className="text-xs text-gray-500 bg-dark-bg border border-dark-border px-2 py-0.5 rounded-full">
              {TEST_TYPE_LABELS[suggestion.test_type] ?? suggestion.test_type}
            </span>
          </div>
          <p className="text-sm font-semibold text-white">
            Test: <span className="font-mono text-green-300">{suggestion.function_name}()</span>
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 font-mono">{suggestion.file_path}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{suggestion.coverage_gap}</p>
        </div>
        <div className="flex-shrink-0 text-gray-600 mt-0.5">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-dark-border overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">What this test covers</p>
                <p className="text-sm text-gray-300 leading-relaxed">{suggestion.description}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1.5">Coverage Gap</p>
                <p className="text-sm text-gray-300 leading-relaxed bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                  {suggestion.coverage_gap}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Generated Test Code</p>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {copied
                      ? <><CheckCheck className="w-3.5 h-3.5 text-green-400" /> Copied!</>
                      : <><Copy className="w-3.5 h-3.5" /> Copy code</>
                    }
                  </button>
                </div>
                <div className="code-block">
                  <SyntaxHighlighter
                    language="python"
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '12px 16px', background: '#0c0e1a', fontSize: '12px', maxHeight: '400px' }}
                    showLineNumbers
                  >
                    {suggestion.test_code}
                  </SyntaxHighlighter>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
