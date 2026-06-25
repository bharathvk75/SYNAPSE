// SYNAPSE — HermesChat Component
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Send, Loader2, Bot, User, Copy, CheckCheck } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TextareaAutosize from 'react-textarea-autosize'
import { reviewApi } from '@/lib/api'
import { useReviewStore } from '@/stores/reviewStore'
import { cn, copyToClipboard } from '@/lib/utils'

interface HermesMessageItem {
  role: 'user' | 'hermes'
  content: string
  timestamp: string
}

interface Props {
  sessionId: string
  messages: HermesMessageItem[]
  narrative?: string | null
}

export default function HermesChat({ sessionId, messages, narrative }: Props) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { addHermesMessage, setHermesTyping } = useReviewStore()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const msg = input.trim()
    if (!msg || sending) return

    setInput('')
    setSending(true)

    addHermesMessage({
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    })

    setHermesTyping(true)

    try {
      const { response } = await reviewApi.chatWithHermes(sessionId, msg)
      addHermesMessage({
        role: 'hermes',
        content: response,
        timestamp: new Date().toISOString(),
      })
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Hermes failed to respond'
      toast.error(errMsg)
    } finally {
      setSending(false)
      setHermesTyping(false)
    }
  }

  async function handleCopy(content: string, id: string) {
    await copyToClipboard(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const allMessages: HermesMessageItem[] = [
    // Include the narrative as the first Hermes message if no history yet
    ...(messages.length === 0 && narrative
      ? [{ role: 'hermes' as const, content: narrative, timestamp: new Date().toISOString() }]
      : []),
    ...messages,
  ]

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-280px)]">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
                 style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))',
                          border: '1px solid rgba(249,115,22,0.2)' }}>
              🧠
            </div>
            <p className="text-white font-semibold mb-1">Hermes is ready</p>
            <p className="text-sm text-gray-500 max-w-sm">
              Ask Hermes any question about this review. He can explain issues,
              discuss fixes, and guide your decision on whether to approve or reject.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {allMessages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
              >
                {/* Avatar */}
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm',
                  msg.role === 'hermes'
                    ? 'bg-hermes-500/15 border border-hermes-500/25'
                    : 'bg-synapse-600/15 border border-synapse-500/25'
                )}>
                  {msg.role === 'hermes' ? '🧠' : <User className="w-4 h-4 text-synapse-400" />}
                </div>

                {/* Bubble */}
                <div className={cn(
                  'group relative max-w-2xl flex-1',
                  msg.role === 'user' && 'flex justify-end'
                )}>
                  <div className={msg.role === 'hermes' ? 'hermes-bubble' : 'user-bubble'}>
                    <div className={cn(
                      'prose prose-invert prose-sm max-w-none',
                      msg.role === 'user' && 'text-blue-100',
                      '[&_pre]:bg-dark-bg [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-dark-border',
                      '[&_code]:text-hermes-300 [&_code]:bg-dark-bg [&_code]:px-1 [&_code]:rounded',
                    )}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(msg.content, `${idx}`)}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-gray-300 bg-dark-bg border border-dark-border"
                  >
                    {copiedId === `${idx}`
                      ? <CheckCheck className="w-3 h-3 text-green-400" />
                      : <Copy className="w-3 h-3" />
                    }
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Typing indicator */}
        <AnimatePresence>
          {sending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-hermes-500/15 border border-hermes-500/25">
                🧠
              </div>
              <div className="hermes-bubble flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-hermes-400"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-dark-border pt-4 flex-shrink-0">
        <div className="flex items-end gap-3 p-3 rounded-xl bg-dark-surface border border-dark-border focus-within:border-synapse-500/50 transition-colors">
          <TextareaAutosize
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none leading-relaxed"
            placeholder="Ask Hermes about this review… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            minRows={1}
            maxRows={6}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              'p-2 rounded-lg transition-all flex-shrink-0',
              input.trim() && !sending
                ? 'bg-hermes-500 hover:bg-hermes-400 text-white shadow-hermes'
                : 'bg-dark-muted text-gray-600 cursor-not-allowed'
            )}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-2 text-center">
          Hermes can answer questions, explain issues, and guide your approval decision
        </p>
      </div>
    </div>
  )
}
