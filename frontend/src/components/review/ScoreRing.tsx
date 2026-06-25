// SYNAPSE — ScoreRing Component (animated SVG ring)
import { motion } from 'framer-motion'
import { getScoreColor, getScoreLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  score: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
}

export default function ScoreRing({
  score,
  size = 88,
  strokeWidth = 7,
  showLabel = true,
}: Props) {
  const radius   = (size - strokeWidth * 2) / 2
  const circumf  = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(1, score / 10))
  const offset   = circumf * (1 - progress)

  // Color based on score
  const trackColor = '#1e2240'
  const ringColor =
    score >= 8 ? '#4ade80' :
    score >= 6 ? '#facc15' :
    score >= 4 ? '#fb923c' :
    '#f87171'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumf}
          initial={{ strokeDashoffset: circumf }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 6px ${ringColor}80)` }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={cn('text-xl font-bold leading-none', getScoreColor(score))}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          {score.toFixed(1)}
        </motion.span>
        {showLabel && (
          <motion.span
            className="text-xs text-gray-500 mt-0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {getScoreLabel(score)}
          </motion.span>
        )}
      </div>
    </div>
  )
}
