// SYNAPSE — SecurityCard Component
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Shield, AlertTriangle, ExternalLink } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn, getSeverityBadge } from '@/lib/utils'
import type { SecurityVulnerability } from '@/types'

export default function SecurityCard({ vuln }: { vuln: SecurityVulnerability }) {
  const [expanded, setExpanded] = useState(false)

  const cvssColor =
    (vuln.cvss_score ?? 0) >= 9 ? 'text-red-400' :
    (vuln.cvss_score ?? 0) >= 7 ? 'text-orange-400' :
    (vuln.cvss_score ?? 0) >= 4 ? 'text-yellow-400' :
    'text-green-400'

  return (
    <motion.div layout className="glass-card overflow-hidden border-red-500/10">
      <button
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-dark-hover/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0 mt-0.5">
          <Shield className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={getSeverityBadge(vuln.severity)}>
              {vuln.severity.toUpperCase()}
            </span>
            {vuln.owasp_category && (
              <span className="text-xs text-red-400/70 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                {vuln.owasp_category}
              </span>
            )}
            {vuln.cvss_score !== undefined && vuln.cvss_score !== null && (
              <span className={cn('text-xs font-bold', cvssColor)}>
                CVSS {vuln.cvss_score.toFixed(1)}
              </span>
            )}
            {vuln.cve_id && (
              <span className="text-xs text-gray-600 font-mono">{vuln.cve_id}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white">{vuln.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500 font-mono">
              {vuln.file_path}:{vuln.line_start}
            </span>
            {vuln.exploit_likelihood !== undefined && (
              <span className={cn(
                'text-xs font-medium',
                vuln.exploit_likelihood >= 0.8 ? 'text-red-400' :
                vuln.exploit_likelihood >= 0.5 ? 'text-orange-400' :
                'text-yellow-400'
              )}>
                {Math.round(vuln.exploit_likelihood * 100)}% exploit likelihood
              </span>
            )}
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
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Vulnerability Details</p>
                <p className="text-sm text-gray-300 leading-relaxed">{vuln.description}</p>
              </div>

              {vuln.code_snippet && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">Vulnerable Code</p>
                  <div className="code-block">
                    <SyntaxHighlighter
                      language="text"
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, padding: '12px 16px', background: '#0c0e1a', fontSize: '12px' }}
                    >
                      {vuln.code_snippet}
                    </SyntaxHighlighter>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5">🛡️ Remediation</p>
                <p className="text-sm text-gray-300 leading-relaxed bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                  {vuln.remediation}
                </p>
              </div>

              {vuln.cve_id && (
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-synapse-400 hover:text-synapse-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View {vuln.cve_id} on NVD
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
