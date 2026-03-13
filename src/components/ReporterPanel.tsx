import React, { useState, useEffect, useRef } from 'react'
import { Bell, Sparkles, Check, X, AlertTriangle, XCircle, CheckCircle, Info, Zap, Brain, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../lib/utils'
import { format } from 'date-fns'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: number
  read: boolean
  agentName?: string
  agentColor?: string
  actionable?: boolean
  onApprove?: () => void
  onDismiss?: () => void
}

interface ReporterPanelProps {
  agents: any[]
  tasks: any[]
  messages: any[]
  onSendCommand?: (cmd: string) => void
}

function generateNotifications(agents: any[], tasks: any[], messages: any[]): Notification[] {
  const notifs: Notification[] = []

  // Failed tasks → error notifications
  tasks.filter(t => t.status === 'failed').slice(0, 10).forEach(t => {
    const agent = agents.find(a => a.id === t.agent_id)
    notifs.push({
      id: `fail_${t.id}`,
      type: 'error',
      title: 'Task Failed',
      message: t.error || `Task could not be completed: "${(t.instruction || '').slice(0, 60)}"`,
      timestamp: t.completed_at ? (t.completed_at > 1e10 ? t.completed_at : t.completed_at * 1000) : Date.now(),
      read: false,
      agentName: agent?.name,
      agentColor: agent?.color,
    })
  })

  // Recently completed tasks → success
  tasks.filter(t => t.status === 'completed').slice(0, 5).forEach(t => {
    const agent = agents.find(a => a.id === t.agent_id)
    notifs.push({
      id: `done_${t.id}`,
      type: 'success',
      title: 'Task Complete',
      message: `"${(t.instruction || '').slice(0, 70)}"`,
      timestamp: t.completed_at ? (t.completed_at > 1e10 ? t.completed_at : t.completed_at * 1000) : Date.now(),
      read: true,
      agentName: agent?.name,
      agentColor: agent?.color,
    })
  })

  // Running tasks > 2 min → warning
  const now = Date.now()
  tasks.filter(t => t.status === 'running' && t.started_at).forEach(t => {
    const startMs = t.started_at > 1e10 ? t.started_at : t.started_at * 1000
    const elapsed = (now - startMs) / 1000
    if (elapsed > 120) {
      const agent = agents.find(a => a.id === t.agent_id)
      notifs.push({
        id: `slow_${t.id}`,
        type: 'warning',
        title: 'Long-running Task',
        message: `${agent?.name || 'Agent'} has been running for ${Math.round(elapsed / 60)}m`,
        timestamp: now,
        read: false,
        agentName: agent?.name,
        agentColor: agent?.color,
        actionable: true,
      })
    }
  })

  // Agents in error state
  agents.filter(a => a.status === 'error').forEach(a => {
    notifs.push({
      id: `agent_err_${a.id}`,
      type: 'error',
      title: 'Agent Error',
      message: `${a.name} is in an error state`,
      timestamp: now,
      read: false,
      agentName: a.name,
      agentColor: a.color,
    })
  })

  // High token usage warning (>100k tokens)
  const totalTokens = tasks.reduce((s: number, t: any) => s + (t.tokens_used || 0), 0)
  if (totalTokens > 100000) {
    notifs.push({
      id: 'high_tokens',
      type: 'warning',
      title: 'High Token Usage',
      message: `${(totalTokens / 1000).toFixed(1)}k tokens used. Monitor your API costs.`,
      timestamp: now,
      read: true,
    })
  }

  // System online notification
  if (agents.length > 0 || tasks.length > 0) {
    notifs.push({
      id: 'sys_online',
      type: 'info',
      title: 'Engine Connected',
      message: `${agents.length} agents loaded · ${tasks.length} tasks in history`,
      timestamp: now - 5000,
      read: true,
    })
  }

  // Sort newest first
  return notifs.sort((a, b) => b.timestamp - a.timestamp)
}

function safeFormat(ts: number): string {
  try {
    return format(new Date(ts), 'HH:mm')
  } catch { return '--:--' }
}

const typeIcon = (type: Notification['type']) => {
  switch (type) {
    case 'success': return <CheckCircle size={12} className="text-emerald-400" />
    case 'error':   return <XCircle size={12} className="text-red-400" />
    case 'warning': return <AlertTriangle size={12} className="text-amber-400" />
    case 'info':    return <Info size={12} className="text-blue-400" />
  }
}

const typeBorder = (type: Notification['type']) => {
  switch (type) {
    case 'success': return 'border-emerald-500/15 bg-emerald-500/[0.03]'
    case 'error':   return 'border-red-500/20 bg-red-500/[0.04]'
    case 'warning': return 'border-amber-500/15 bg-amber-500/[0.03]'
    case 'info':    return 'border-blue-500/10 bg-blue-500/[0.02]'
  }
}

export const ReporterPanel: React.FC<ReporterPanelProps> = ({
  agents, tasks, messages, onSendCommand
}) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [read, setRead] = useState<Set<string>>(new Set())
  const [askInput, setAskInput] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'errors'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  const allNotifs = generateNotifications(agents, tasks, messages)
  const visible = allNotifs
    .filter(n => !dismissed.has(n.id))
    .filter(n => {
      if (filter === 'unread') return !n.read && !read.has(n.id)
      if (filter === 'errors') return n.type === 'error' || n.type === 'warning'
      return true
    })

  const unreadCount = allNotifs.filter(n => !n.read && !read.has(n.id) && !dismissed.has(n.id)).length

  const markRead = (id: string) => setRead(p => new Set([...p, id]))
  const dismiss = (id: string) => setDismissed(p => new Set([...p, id]))
  const dismissAll = () => setDismissed(new Set(allNotifs.map(n => n.id)))

  const handleAsk = () => {
    if (!askInput.trim() || !onSendCommand) return
    onSendCommand(askInput.trim())
    setAskInput('')
  }

  return (
    <div className="w-72 bg-black/20 backdrop-blur-2xl border-l border-white/5 flex flex-col h-full z-10 shrink-0">

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Bell size={14} className="text-white/60" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border border-black text-[7px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <h2 className="text-white font-mono text-[11px] uppercase tracking-widest font-bold">Reporter</h2>
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button onClick={() => setRead(new Set(allNotifs.map(n => n.id)))}
              className="text-[9px] font-mono text-white/20 hover:text-white/50 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
              Mark all read
            </button>
          )}
          {dismissed.size < allNotifs.length && allNotifs.length > 0 && (
            <button onClick={dismissAll} title="Clear all"
              className="w-6 h-6 flex items-center justify-center rounded-lg text-white/15 hover:text-white/40 hover:bg-white/5 transition-all">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-white/5 shrink-0">
        {(['all', 'unread', 'errors'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('flex-1 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all',
              filter === f ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/45')}>
            {f}
          </button>
        ))}
      </div>

      {/* Notifications */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {visible.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center py-12 gap-3">
              <Sparkles size={22} className="text-white/8" />
              <p className="text-white/20 font-mono text-[10px] uppercase tracking-widest leading-relaxed">
                {filter === 'all' ? 'All clear.\nSystem nominal.' : `No ${filter} notifications`}
              </p>
            </motion.div>
          ) : visible.map(notif => (
            <motion.div key={notif.id || notif.title}
              initial={{ opacity: 0, x: 12, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.95 }}
              onClick={() => markRead(notif.id)}
              className={cn(
                'p-3.5 rounded-xl border cursor-pointer transition-all group',
                typeBorder(notif.type),
                (notif.read || read.has(notif.id)) && 'opacity-50'
              )}>

              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {typeIcon(notif.type)}
                  <span className="text-[10px] font-mono text-white font-bold truncate">{notif.title}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-mono text-white/20">{safeFormat(notif.timestamp)}</span>
                  <button onClick={e => { e.stopPropagation(); dismiss(notif.id) }}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-white/20 hover:text-white/60 transition-all">
                    <X size={9} />
                  </button>
                </div>
              </div>

              {notif.agentName && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-3 h-3 rounded flex items-center justify-center text-[7px] font-bold"
                    style={{ backgroundColor: notif.agentColor || '#6b7280', color: '#000' }}>
                    {notif.agentName.charAt(0)}
                  </div>
                  <span className="text-[9px] font-mono text-white/30">{notif.agentName}</span>
                </div>
              )}

              <p className="text-[10px] font-mono text-white/50 leading-relaxed">{notif.message}</p>

              {!notif.read && !read.has(notif.id) && (
                <div className="w-1.5 h-1.5 rounded-full bg-white/40 absolute top-3 right-3" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Ask base */}
      <div className="px-3 py-3 border-t border-white/5 shrink-0">
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/8">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0">
              <Sparkles size={10} className="text-white" />
            </div>
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Ask base</span>
          </div>
          <div className="relative">
            <input ref={inputRef} value={askInput} onChange={e => setAskInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAsk() }}
              placeholder="What's happening with my agents?"
              className="w-full bg-black/30 border border-white/8 rounded-xl px-3 py-2 pr-8 text-white font-mono text-[10px] focus:outline-none focus:border-white/18 placeholder-white/15 transition-all" />
            <button onClick={handleAsk} disabled={!askInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white disabled:opacity-20 transition-colors">
              <Zap size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}