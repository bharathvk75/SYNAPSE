// SYNAPSE — WebSocket client with auto-reconnect
import type { WSMessage, WSMessageType } from '@/types'

type MessageHandler = (message: WSMessage) => void

export class SynapseWebSocket {
  private ws: WebSocket | null = null
  protected sessionId: string
  private handlers: Map<WSMessageType | '*', Set<MessageHandler>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private readonly MAX_RECONNECT = 5
  private readonly BASE_RECONNECT_MS = 1000
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private isManualClose = false

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const url = `${protocol}://${host}/ws/${this.sessionId}`

    this.ws = new WebSocket(url)
    this.isManualClose = false

    this.ws.onopen = () => {
      console.log(`[SYNAPSE WS] Connected — session ${this.sessionId}`)
      this.reconnectAttempts = 0
      this._startPing()
      this._dispatch({ type: 'ping', session_id: this.sessionId, timestamp: new Date().toISOString() } as WSMessage)
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        this._dispatch(message)
      } catch (e) {
        console.warn('[SYNAPSE WS] Failed to parse message', event.data)
      }
    }

    this.ws.onclose = (event) => {
      console.log(`[SYNAPSE WS] Disconnected — code ${event.code}`)
      this._stopPing()
      if (!this.isManualClose && this.reconnectAttempts < this.MAX_RECONNECT) {
        const delay = Math.min(
          this.BASE_RECONNECT_MS * Math.pow(2, this.reconnectAttempts),
          16_000
        )
        this.reconnectAttempts++
        this.reconnectTimer = setTimeout(() => this.connect(), delay)
      }
    }

    this.ws.onerror = (error) => {
      console.error('[SYNAPSE WS] Error', error)
    }
  }

  disconnect(): void {
    this.isManualClose = true
    this._stopPing()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  on(type: WSMessageType | '*', handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.off(type, handler)
  }

  off(type: WSMessageType | '*', handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private _dispatch(message: WSMessage): void {
    // Type-specific handlers
    this.handlers.get(message.type)?.forEach((h) => h(message))
    // Wildcard handlers
    this.handlers.get('*')?.forEach((h) => h(message))
  }

  private _startPing(): void {
    this._stopPing()
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping', session_id: this.sessionId })
    }, 25_000)
  }

  private _stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}

// ── Hermes-specific WebSocket (bidirectional conversation) ─────────────────────
export class HermesWebSocket extends SynapseWebSocket {
  constructor(sessionId: string) {
    super(sessionId)
  }

  override connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const url = `${protocol}://${host}/ws/hermes/${this.sessionId}`

    // @ts-ignore — accessing private field via override pattern
    const ws = new WebSocket(url)
    // @ts-ignore
    this['ws'] = ws

    ws.onopen = () => {
      console.log(`[Hermes WS] Connected — session ${this.sessionId}`)
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data)
        // @ts-ignore
        this['_dispatch'](message)
      } catch {
        // ignore
      }
    }

    ws.onerror = (e: Event) => console.error('[Hermes WS] Error', e)
    ws.onclose = () => console.log('[Hermes WS] Closed')
  }

  sendMessage(content: string): void {
    this.send({ type: 'message', message: content })
  }
}
