import { useState, useEffect, useRef, useCallback } from 'react'

const SIDECAR_URL = 'ws://localhost:41801'

type MessageHandler = (data: any) => void

interface UseSidecarReturn {
  connected: boolean
  agents: any[]
  tasks: any[]
  messages: any[]
  send: (type: string, payload?: any) => Promise<any>
  runAgent: (agentId: string, instruction: string, context?: any) => Promise<any>
  refreshTasks: () => Promise<void>
  refreshMessages: () => Promise<void>
  sendToBase: (command: string, onChunk?: (chunk: string) => void) => Promise<any>
  pauseTask: (taskId: string) => Promise<any>
  resumeTask: (taskId: string) => Promise<any>
  cancelTask: (taskId: string) => Promise<any>
  createAgent: (payload: any) => Promise<any>
  updateAgent: (id: string, payload: any) => Promise<any>
  deleteAgent: (id: string) => Promise<any>
  connectAgent: (payload: any) => Promise<any>
}

export function useSidecar(): UseSidecarReturn {
  const [connected, setConnected] = useState(false)
  const [agents, setAgents] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])

  const ws = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, { resolve: Function; reject: Function }>>(new Map())
  const streamHandlers = useRef<Map<string, (chunk: string) => void>>(new Map())
  const reconnectTimer = useRef<any>(null)

  const connectingRef = useRef(false)

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    if (connectingRef.current) return
    connectingRef.current = true

    const socket = new WebSocket(SIDECAR_URL)
    ws.current = socket

    socket.onopen = () => {
      console.log('[sidecar] Connected')
      connectingRef.current = false
      setConnected(true)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        // Handle replies to specific requests
        if (msg.id && pendingRef.current.has(msg.id)) {
          const { resolve, reject } = pendingRef.current.get(msg.id)!
          pendingRef.current.delete(msg.id)
          if (msg.error) reject(new Error(msg.error))
          else resolve(msg.data)
          return
        }

        // Handle broadcast events
        switch (msg.event) {
          case 'init':
            setAgents(msg.data.agents || [])
            setTasks(msg.data.tasks || [])
            if (msg.data.messages?.length) {
              const incoming = msg.data.messages.map((m: any) => ({
                ...m,
                senderId: m.sender_id || m.senderId || 'base',
                senderName: m.sender_name || m.senderName || 'base',
                timestamp: m.created_at ? m.created_at * 1000 : Date.now(),
              }))
              // Merge with any live messages received during this session (dedup by id)
              setMessages(prev => {
                const ids = new Set(incoming.map((m: any) => m.id))
                const liveOnly = prev.filter((m: any) => !ids.has(m.id))
                return [...incoming, ...liveOnly].slice(-500)
              })
            }
            break

          case 'agent:update':
            setAgents(prev => {
              const idx = prev.findIndex(a => a.id === msg.data.id)
              return idx >= 0
                ? prev.map(a => a.id === msg.data.id ? msg.data : a)
                : [...prev, msg.data]
            })
            break

          case 'agent:deleted':
            setAgents(prev => prev.filter(a => a.id !== msg.data.id))
            break

          case 'task:update':
          case 'task:queued':
            setTasks(prev => {
              if (!msg.data.status && !msg.data.tokens_used) return prev
              const idx = prev.findIndex(t => t.id === msg.data.id)
              return idx >= 0
                ? prev.map(t => t.id === msg.data.id ? { ...t, ...msg.data } : t)
                : [msg.data, ...prev]
            })
            // Refresh full task list when a task finishes to get accurate token counts
            if (['completed', 'failed', 'cancelled'].includes(msg.data.status)) {
              setTimeout(() => {
                send('task:list', {}).then((tasks: any) => {
                  if (Array.isArray(tasks)) setTasks(tasks)
                }).catch(() => {})
              }, 300)
            }
            break

          case 'message': {
            // Normalise both snake_case (from DB) and camelCase (from runner)
            const incoming = {
              ...msg.data,
              senderId: msg.data.senderId || msg.data.sender_id || 'base',
              senderName: msg.data.senderName || msg.data.sender_name || 'base',
              timestamp: msg.data.timestamp || (msg.data.created_at ? msg.data.created_at * 1000 : Date.now()),
            }
            setMessages(prev => {
              if (prev.find(m => m.id === incoming.id)) return prev
              return [...prev, incoming].slice(-500)
            })
            break
          }

          case 'base:stream':
            const handler = streamHandlers.current.get(msg.data.commandId)
            if (handler) handler(msg.data.chunk)
            break
        }
      } catch (err) {
        console.error('[sidecar] Parse error:', err)
      }
    }

    socket.onclose = () => {
      console.log('[sidecar] Disconnected, reconnecting in 2s...')
      connectingRef.current = false
      setConnected(false)
      reconnectTimer.current = setTimeout(connect, 2000)
    }

    socket.onerror = (err) => {
      console.error('[sidecar] Error:', err)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  // Send a message and await reply
  const send = useCallback((type: string, payload: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to base engine'))
        return
      }
      const id = Math.random().toString(36).slice(2)
      pendingRef.current.set(id, { resolve, reject })
      ws.current.send(JSON.stringify({ id, type, payload }))

      // Timeout after 30s
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id)
          reject(new Error('Request timed out'))
        }
      }, 30000)
    })
  }, [])

  const refreshTasks = useCallback(async () => {
    try {
      const tasks = await send('task:list', {})
      if (Array.isArray(tasks)) setTasks(tasks)
    } catch {}
  }, [send])

  const refreshMessages = useCallback(async () => {
    try {
      const msgs = await send('message:list', { limit: 200 })
      if (Array.isArray(msgs)) {
        setMessages(msgs.map((m: any) => ({
          ...m,
          senderId: m.sender_id || m.senderId || 'base',
          senderName: m.sender_name || m.senderName || 'base',
          timestamp: m.created_at ? m.created_at * 1000 : Date.now(),
        })))
      }
    } catch {}
  }, [send])

  const runAgent = useCallback(async (agentId: string, instruction: string, context: any = {}) => {
    const result = await send('task:run', { agentId, instruction, context })
    // Refresh tasks after a short delay to pick up token counts
    setTimeout(refreshTasks, 500)
    return result
  }, [send, refreshTasks])

  const sendToBase = useCallback((command: string, onChunk?: (chunk: string) => void) => {
    const commandId = Math.random().toString(36).slice(2)
    if (onChunk) streamHandlers.current.set(commandId, onChunk)
    return send('base:command', { command, commandId }).finally(() => {
      streamHandlers.current.delete(commandId)
    })
  }, [send])

  const pauseTask = useCallback((taskId: string) => send('task:pause', { taskId }), [send])
  const resumeTask = useCallback((taskId: string) => send('task:resume', { taskId }), [send])
  const cancelTask = useCallback((taskId: string) => send('task:cancel', { taskId }), [send])
  const createAgent = useCallback((payload: any) => send('agent:create', payload), [send])
  const updateAgent = useCallback((id: string, payload: any) => send('agent:update', { id, ...payload }), [send])
  const deleteAgent = useCallback((id: string) => send('agent:delete', { id }), [send])
  const connectAgent = useCallback((payload: any) => send('agent:connect', payload), [send])

  return {
    connected,
    agents,
    tasks,
    messages,
    send,
    runAgent,
    refreshTasks,
    refreshMessages,
    sendToBase,
    pauseTask,
    resumeTask,
    cancelTask,
    createAgent,
    updateAgent,
    deleteAgent,
    connectAgent,
  }
}