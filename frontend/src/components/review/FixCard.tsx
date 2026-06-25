// SYNAPSE — FixCard Component (diff viewer + apply)
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Copy, CheckCheck, Wrench, Zap, AlertTriangle } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn, copyToClipboard, confidenceLabel } from '@/lib/utils'
import type { FixSuggestion } from '@/types'

export default function FixCard({ fix }: { fix: FixSuggestion }) {
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<'diff' | 'fixed'>('diff')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await copyToClipboard(view === 'diff' ? fix.diff : fix.fixed_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const confidence = fix.confidence
  const confColor =
    confidence >= 0.9 ? 'text-green-400' :
    confidence >= 0.7 ? 'text-yellow-400' :
    'text-orange-400'

  return (
    <motion.div layout className="glass-card overflow-hidden border-yellow-500/10">
      <button
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-dark-hover/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0 mt-0.5">
          <Wrench className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {fix.auto_applicable ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/25">
                <Zap className="w-3 h-3" /> Auto-applicable
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                <AlertTriangle className="w-3 h-3" /> Manual Review Required
              </span>
            )}
            <span className={cn('text-xs font-medium', confColor)}>
              {confidenceLabel(confidence)} confidence
            </span>
          </div>
          <p className="text-sm font-semibold text-white font-mono">{fix.file_path}</p>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{fix.explanation}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-600">Fixes {fix.issue_ids.length} issue{fix.issue_ids.length !== 1 ? 's' : ''}</span>
          </div>
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
              {/* Explanation */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">What this fix does</p>
                <p className="text-sm text-gray-300 leading-relaxed bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                  {fix.explanation}
                </p>
              </div>

              {/* View toggle + copy */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {(['diff', 'fixed'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        view === v
                          ? 'bg-synapse-600/20 text-synapse-300 border border-synapse-500/30'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-dark-hover'
                      )}
                    >
                      {v === 'diff' ? '📋 Diff View' : '✅ Fixed Code'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {copied
                    ? <><CheckCheck className="w-3.5 h-3.5 text-green-400" /> Copied!</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy</>
                  }
                </button>
              </div>

              {/* Code view */}
              <div className="code-block">
                {view === 'diff' ? (
                  <SyntaxHighlighter
                    language="diff"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '12px 16px',
                      background: '#0c0e1a',
                      fontSize: '12px',
                      maxHeight: '400px',
                    }}
                  >
                    {fix.diff || `--- a/${fix.file_path}\n+++ b/${fix.file_path}\n-${fix.original_code}\n+${fix.fixed_code}`}
                  </SyntaxHighlighter>
                ) : (
                  <SyntaxHighlighter
                    language="python"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '12px 16px',
                      background: '#0c0e1a',
                      fontSize: '12px',
                      maxHeight: '400px',
                    }}
                    showLineNumbers
                  >
                    {fix.fixed_code}
                  </SyntaxHighlighter>
                )}
              </div>

              {/* Auto-apply notice */}
              {fix.auto_applicable && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <Zap className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-400 mb-0.5">Safe to Auto-Apply</p>
                    <p className="text-xs text-gray-500">
                      This fix is deterministic and well-understood. Once you approve the review,
                      SYNAPSE can automatically apply it to your codebase or suggest it as a PR commit.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
