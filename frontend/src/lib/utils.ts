// SYNAPSE — Utility helpers
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import type { Severity } from '@/types'

// ── Tailwind class merger ──────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ── Severity helpers ───────────────────────────────────────────────────────────
export const SEVERITY_COLORS: Record<Severity, { text: string; bg: string; border: string; dot: string }> = {
  critical: { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    dot: 'bg-red-500' },
  high:     { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  medium:   { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  low:      { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   dot: 'bg-blue-400' },
  info:     { text: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/30',   dot: 'bg-gray-500' },
}

export const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  critical: 'badge-critical',
  high:     'badge-high',
  medium:   'badge-medium',
  low:      'badge-low',
  info:     'badge-info',
}

export const SEVERITY_ICON: Record<Severity, string> = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🔵',
  info:     '⚪',
}

export function getSeverityBadge(severity: Severity): string {
  return SEVERITY_BADGE_CLASS[severity] ?? 'badge-info'
}

// ── Score helpers ──────────────────────────────────────────────────────────────
export function getScoreColor(score: number): string {
  if (score >= 8)  return 'text-green-400'
  if (score >= 6)  return 'text-yellow-400'
  if (score >= 4)  return 'text-orange-400'
  return 'text-red-400'
}

export function getScoreLabel(score: number): string {
  if (score >= 9)  return 'Excellent'
  if (score >= 7)  return 'Good'
  if (score >= 5)  return 'Fair'
  if (score >= 3)  return 'Poor'
  return 'Critical'
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'critical': return 'text-red-400'
    case 'high':     return 'text-orange-400'
    case 'medium':   return 'text-yellow-400'
    case 'low':      return 'text-green-400'
    default:         return 'text-gray-400'
  }
}

// ── Date helpers ───────────────────────────────────────────────────────────────
export function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

export function formatDate(dateStr: string, fmt = 'MMM d, yyyy HH:mm'): string {
  try {
    return format(parseISO(dateStr), fmt)
  } catch {
    return dateStr
  }
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

// ── Language helpers ───────────────────────────────────────────────────────────
export const LANG_ICONS: Record<string, string> = {
  python:     '🐍',
  javascript: '🟨',
  typescript: '🔷',
  go:         '🐹',
  rust:       '🦀',
  java:       '☕',
  csharp:     '💎',
  cpp:        '⚙️',
  c:          '⚙️',
  ruby:       '💎',
  php:        '🐘',
  swift:      '🦅',
  kotlin:     '🎯',
  bash:       '🐚',
  yaml:       '📄',
  json:       '📋',
  html:       '🌐',
  css:        '🎨',
  sql:        '🗄️',
  markdown:   '📝',
  unknown:    '📄',
}

export function getLangIcon(lang: string): string {
  return LANG_ICONS[lang.toLowerCase()] ?? '📄'
}

// ── Number helpers ─────────────────────────────────────────────────────────────
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── Category helpers ───────────────────────────────────────────────────────────
export const CATEGORY_ICONS: Record<string, string> = {
  security:        '🛡️',
  performance:     '⚡',
  maintainability: '🔧',
  bug:             '🐛',
  style:           '🎨',
  testing:         '🧪',
  documentation:   '📚',
  best_practice:   '✅',
}

export function getCategoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] ?? '📌'
}

// ── Copy to clipboard ──────────────────────────────────────────────────────────
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ── Confidence badge ───────────────────────────────────────────────────────────
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'Very High'
  if (confidence >= 0.7) return 'High'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}

// ── Status helpers ─────────────────────────────────────────────────────────────
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400'
    case 'running':   return 'text-synapse-400'
    case 'awaiting_approval': return 'text-yellow-400'
    case 'approved':  return 'text-green-400'
    case 'rejected':  return 'text-red-400'
    case 'failed':    return 'text-red-400'
    default:          return 'text-gray-400'
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending:          'Pending',
    running:          'Running',
    awaiting_approval: 'Awaiting Approval',
    approved:         'Approved',
    rejected:         'Rejected',
    completed:        'Completed',
    failed:           'Failed',
  }
  return labels[status] ?? status
}
