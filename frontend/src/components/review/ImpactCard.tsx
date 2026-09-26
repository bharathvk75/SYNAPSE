// SYNAPSE — ImpactCard (Architectural Blast Radius & Systemic Risk Analysis)
import React from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, ShieldAlert, Cpu, Database,
  Layers, GitFork, ArrowUpRight, Zap, Lightbulb
} from 'lucide-react'
import type { ImpactAssessment } from '@/types'

interface ImpactCardProps {
  impact?: ImpactAssessment
}

export default function ImpactCard({ impact }: ImpactCardProps) {
  if (!impact) {
    return (
      <div className="card-synapse p-6 text-center text-gray-500">
        <Layers className="w-8 h-8 mx-auto mb-2 opacity-40 text-synapse-400" />
        <p className="text-sm">Architectural blast radius data will appear once the ImpactAnalyzer finishes analysis.</p>
      </div>
    )
  }

  const {
    blast_radius_score,
    risk_level,
    breaking_change_risk,
    api_contracts_affected,
    database_impact,
    performance_impact,
    dependency_risk,
    architectural_recommendations,
  } = impact

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-red-400 border-red-500/40 bg-red-950/20'
    if (score >= 50) return 'text-orange-400 border-orange-500/40 bg-orange-950/20'
    if (score >= 25) return 'text-yellow-400 border-yellow-500/40 bg-yellow-950/20'
    return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
  }

  const getRiskBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical':
        return 'badge-critical'
      case 'high':
        return 'badge-high'
      case 'medium':
        return 'badge-medium'
      default:
        return 'badge-low'
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Banner: Score & Breaking Changes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Blast Radius Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card-synapse p-5 border flex items-center justify-between ${getScoreColor(blast_radius_score)}`}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-synapse-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">Blast Radius Index</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight font-mono">
              {blast_radius_score}<span className="text-sm text-gray-500 font-normal">/100</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`badge ${getRiskBadge(risk_level)} text-xs uppercase font-mono`}>
                {risk_level} Risk
              </span>
              <span className="text-[11px] text-gray-400 font-mono">
                {blast_radius_score < 30 ? 'High stability' : blast_radius_score < 70 ? 'Moderate footprint' : 'Critical footprint'}
              </span>
            </div>
          </div>

          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-dark-border"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="stroke-current transition-all duration-1000"
                strokeWidth="3.5"
                strokeDasharray={`${blast_radius_score}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-bold font-mono">{blast_radius_score}%</span>
          </div>
        </motion.div>

        {/* Breaking Changes Alert */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`card-synapse p-5 border flex flex-col justify-between ${
            breaking_change_risk ? 'border-red-500/40 bg-red-950/20' : 'border-emerald-500/30 bg-emerald-950/10'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-400">API Contract Status</span>
            {breaking_change_risk ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className={`text-base font-bold ${breaking_change_risk ? 'text-red-300' : 'text-emerald-300'}`}>
              {breaking_change_risk ? 'Breaking Changes Detected' : 'Backward Compatible'}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {breaking_change_risk
                ? 'Exported types, endpoint schemas, or parameter signatures were modified.'
                : 'No disruptions to external callers or public API contracts.'}
            </p>
          </div>
        </motion.div>

        {/* Impact Scope */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-synapse p-5 border border-dark-border flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-400">Affected Contracts</span>
            <GitFork className="w-5 h-5 text-synapse-400" />
          </div>
          <div>
            <div className="text-base font-bold text-white font-mono">
              {api_contracts_affected.length} Surface{api_contracts_affected.length === 1 ? '' : 's'}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {api_contracts_affected.length > 0 ? (
                api_contracts_affected.slice(0, 3).map((contract, i) => (
                  <span key={i} className="text-[10px] font-mono bg-dark-bg px-2 py-0.5 rounded border border-dark-border text-gray-300">
                    {contract}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500 italic">None modified</span>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Deep Impact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Database Footprint */}
        <div className="card-synapse p-5 border border-dark-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider font-mono">Database & Query Impact</h4>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            {database_impact}
          </p>
        </div>

        {/* Performance & Concurrency */}
        <div className="card-synapse p-5 border border-dark-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Cpu className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider font-mono">Performance & Latency</h4>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            {performance_impact}
          </p>
        </div>

        {/* Third-Party Dependencies */}
        <div className="card-synapse p-5 border border-dark-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider font-mono">Dependency & Supply Chain</h4>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            {dependency_risk}
          </p>
        </div>
      </div>

      {/* Architectural Recommendations */}
      {architectural_recommendations && architectural_recommendations.length > 0 && (
        <div className="card-synapse p-5 border border-synapse-500/20 bg-synapse-950/10">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-synapse-400" />
            <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider font-mono">
              Architectural Recommendations for Reviewer
            </h4>
          </div>
          <ul className="space-y-2">
            {architectural_recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                <span className="text-synapse-400 font-mono font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
