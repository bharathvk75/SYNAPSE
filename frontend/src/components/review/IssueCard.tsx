// SYNAPSE — IssueCard Component
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Copy, CheckCheck, ExternalLink } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn, getSeverityBadge, getCategoryIcon, confidenceLabel, copyToClipboard } from '@/lib/utils'
import type { CodeIssue } from '@/types'

export default function IssueCard({ issue }: { issue: CodeIssue }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await copyToClipboard(issue.suggestion)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      layout
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <button
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-dark-hover/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={getSeverityBadge(issue.severity)}>
              {issue.severity.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500 bg-dark-bg border border-dark-border px-2 py-0.5 rounded-full">
              {getCategoryIcon(issue.category)} {issue.category.replace('_', ' ')}
            </span>
            {issue.rule_id && (
              <span className="text-xs text-gray-600 font-mono">{issue.rule_id}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white">{issue.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500 font-mono">
              {issue.file_path}:{issue.line_start}{issue.line_end && issue.line_end !== issue.line_start ? `–${issue.line_end}` : ''}
            </span>
            <span className="text-xs text-gray-600">Confidence: {confidenceLabel(issue.confidence)}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-gray-600 mt-0.5">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
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
              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</p>
                <p className="text-sm text-gray-300 leading-relaxed">{issue.description}</p>
              </div>

              {/* Code snippet */}
              {issue.code_snippet && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Problematic Code</p>
                  <div className="code-block">
                    <SyntaxHighlighter
                      language="text"
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, padding: '12px 16px', background: '#0c0e1a', fontSize: '12px' }}
                    >
                      {issue.code_snippet}
                    </SyntaxHighlighter>
                  </div>
                </div>
              )}

              {/* Suggestion */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">💡 Suggestion</p>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                  {issue.suggestion}
                </p>
              </div>

              {/* References */}
              {issue.references && issue.references.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">References</p>
                  <div className="flex flex-wrap gap-2">
                    {issue.references.map((ref, i) => (
                      <a key={i} href={ref} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-synapse-400 hover:text-synapse-300 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                        {ref.length > 60 ? ref.slice(0, 60) + '…' : ref}
                      </a>
                    ))}
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
