import React, { useState, useMemo, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { Terminal, Shield, Info, AlertTriangle, CheckCircle, Search, Download, Trash2, ChevronDown, Filter } from 'lucide-react'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'motion/react'

interface AuditLog {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'success'
  source: string
  message: string
  detail?: string
}

interface SystemAuditLogsProps {
  agents?: any[]
  tasks?: any[]
  messages?: any[]
}

function safeMs(ts: any): number {
  if (!ts) return Date.now()
  const n = Number(ts)
  return n > 1e12 ? n : n * 1000
}

// Derive a full structured audit log from real sidecar data
function deriveAuditLogs(agents: any[], tasks: any[], messages: any[]): AuditLog[] {
  const logs: AuditLog[] = []

  // Agent events
  agents.forEach(a => {
    logs.push({
      id: `agent_created_${a.id}`,
      timestamp: safeMs(a.created_at),
      level: 'success',
      source: 'agent.registry',
      message: `Agent deployed: ${a.name}`,
      detail: `model=${a.model} id=${a.id}`,
    })
    if (a.status === 'error') {
      logs.push({
        id: `agent_err_${a.id}`,
        timestamp: safeMs(a.updated_at || a.created_at),
        level: 'error',
        source: 'agent.runner',
        message: `Agent entered error state: ${a.name}`,
        detail: `id=${a.id}`,
      })
    }
    if (a.status === 'running') {
      logs.push({
        id: `agent_run_${a.id}`,
        timestamp: safeMs(a.updated_at || a.created_at),
        level: 'info',
        source: 'agent.runner',
        message: `Agent is running: ${a.name}`,
        detail: `id=${a.id}`,
      })
    }
  })

  // Task events
  tasks.forEach(t => {
    const agent = agents.find(a => a.id === t.agent_id)
    const agentName = agent?.name || t.agent_id?.slice(0, 8) || 'unknown'

    if (t.created_at) {
      logs.push({
        id: `task_queued_${t.id}`,
        timestamp: safeMs(t.created_at),
        level: 'info',
        source: 'task.queue',
        message: `Task queued for ${agentName}`,
        detail: `"${(t.instruction || '').slice(0, 80)}"`,
      })
    }
    if (t.started_at) {
      logs.push({
        id: `task_started_${t.id}`,
        timestamp: safeMs(t.started_at),
        level: 'info',
        source: 'task.runner',
        message: `Task started → ${agentName}`,
        detail: `id=${t.id}`,
      })
    }
    if (t.status === 'completed' && t.completed_at) {
      const dur = t.started_at ? Math.round((safeMs(t.completed_at) - safeMs(t.started_at)) / 1000) : null
      logs.push({
        id: `task_done_${t.id}`,
        timestamp: safeMs(t.completed_at),
        level: 'success',
        source: 'task.runner',
        message: `Task completed: ${agentName}`,
        detail: `${dur != null ? `${dur}s · ` : ''}${t.tokens_used ? `${t.tokens_used} tokens` : ''}`,
      })
    }
    if (t.status === 'failed' && t.completed_at) {
      logs.push({
        id: `task_failed_${t.id}`,
        timestamp: safeMs(t.completed_at),
        level: 'error',
        source: 'task.runner',
        message: `Task failed: ${agentName}`,
        detail: t.error || 'Unknown error',
      })
    }
    if (t.status === 'paused') {
      logs.push({
        id: `task_paused_${t.id}`,
        timestamp: safeMs(t.updated_at || t.created_at),
        level: 'warn',
        source: 'task.queue',
        message: `Task paused: ${agentName}`,
        detail: `id=${t.id}`,
      })
    }
  })

  // Message events (base AI messages)
  messages.filter(m => m.senderId === 'base' || m.senderName === 'base').slice(0, 20).forEach(m => {
    const ts = typeof m.timestamp === 'number' ? m.timestamp : safeMs(m.created_at)
    logs.push({
      id: `msg_base_${m.id}`,
      timestamp: ts,
      level: 'info',
      source: 'base.orchestrator',
      message: 'base AI sent response',
      detail: (m.content || '').slice(0, 100),
    })
  })

  // System boot entry
  logs.push({
    id: 'sys_boot',
    timestamp: Date.now() - 60000,
    level: 'success',
    source: 'system',
    message: 'base engine connected · WebSocket established',
    detail: 'ws://localhost:41801',
  })

  return logs.sort((a, b) => b.timestamp - a.timestamp)
}

const levelIcon = (level: AuditLog['level']) => {
  switch (level) {
    case 'info':    return <Info size={12} className="text-blue-400 shrink-0" />
    case 'warn':    return <AlertTriangle size={12} className="text-amber-400 shrink-0" />
    case 'error':   return <Shield size={12} className="text-red-400 shrink-0" />
    case 'success': return <CheckCircle size={12} className="text-emerald-400 shrink-0" />
  }
}

const levelText = (level: AuditLog['level']) => ({
  info:    'text-blue-400',
  warn:    'text-amber-400',
  error:   'text-red-400',
  success: 'text-emerald-400',
}[level])

const levelBg = (level: AuditLog['level']) => ({
  info:    'bg-blue-400/8 border-blue-400/10',
  warn:    'bg-amber-400/8 border-amber-400/10',
  error:   'bg-red-400/10 border-red-400/15',
  success: 'bg-emerald-400/5 border-emerald-400/8',
}[level])

type LevelFilter = 'all' | 'info' | 'warn' | 'error' | 'success'

export const SystemAuditLogs: React.FC<SystemAuditLogsProps> = ({ agents = [], tasks = [], messages = [] }) => {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)

  const rawLogs = useMemo(() => deriveAuditLogs(agents, tasks, messages), [agents, tasks, messages])

  const sources = useMemo(() => ['all', ...Array.from(new Set(rawLogs.map(l => l.source)))], [rawLogs])

  const filtered = useMemo(() => rawLogs.filter(l => {
    if (levelFilter !== 'all' && l.level !== levelFilter) return false
    if (sourceFilter !== 'all' && l.source !== sourceFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return l.message.toLowerCase().includes(q) || l.source.toLowerCase().includes(q) || (l.detail || '').toLowerCase().includes(q)
    }
    return true
  }), [rawLogs, levelFilter, sourceFilter, search])

  const counts = useMemo(() => ({
    info:    rawLogs.filter(l => l.level === 'info').length,
    warn:    rawLogs.filter(l => l.level === 'warn').length,
    error:   rawLogs.filter(l => l.level === 'error').length,
    success: rawLogs.filter(l => l.level === 'success').length,
  }), [rawLogs])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filtered.length, autoScroll])

  const toggleExpand = (id: string) => setExpanded(p => {
    const n = new Set(p)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const exportCSV = () => {
    const csv = ['timestamp,level,source,message,detail',
      ...filtered.map(l => `"${format(new Date(l.timestamp), 'yyyy-MM-dd HH:mm:ss')}","${l.level}","${l.source}","${l.message.replace(/"/g, '""')}","${(l.detail || '').replace(/"/g, '""')}"`)
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `base-audit-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-hidden">

      {/* Header */}
      <div className="px-8 py-5 border-b border-white/5 bg-black/20 backdrop-blur-md shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-mono text-[11px] uppercase tracking-[0.3em] font-bold">Audit Log</h2>
            <p className="text-white/20 text-[9px] font-mono uppercase mt-1 tracking-wider">
              {rawLogs.length} events · {filtered.length} shown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white/30 hover:text-white hover:bg-white/10 font-mono text-[10px] uppercase tracking-wider transition-all">
              <Download size={11} /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl pl-8 pr-4 py-2 text-[11px] font-mono text-white focus:outline-none focus:border-white/20 placeholder-white/15 transition-all" />
          </div>

          {/* Level filter */}
          <div className="flex items-center gap-1">
            {(['all', 'success', 'info', 'warn', 'error'] as const).map(l => (
              <button key={l} onClick={() => setLevelFilter(l)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all',
                  levelFilter === l ? 'bg-white/12 text-white' : 'text-white/20 hover:text-white/45')}>
                {l !== 'all' && <span className={cn('w-1.5 h-1.5 rounded-full', {
                  'bg-emerald-400': l === 'success',
                  'bg-blue-400': l === 'info',
                  'bg-amber-400': l === 'warn',
                  'bg-red-400': l === 'error',
                })} />}
                {l === 'all' ? 'All' : `${l} ${(counts as any)[l] > 0 ? `(${(counts as any)[l]})` : ''}`}
              </button>
            ))}
          </div>

          {/* Source filter */}
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-[10px] font-mono text-white/40 focus:outline-none focus:border-white/20 transition-all appearance-none cursor-pointer">
            {sources.map(s => <option key={s} value={s} className="bg-[#0a0a0a]">{s === 'all' ? 'All sources' : s}</option>)}
          </select>

          <button onClick={() => setAutoScroll(p => !p)}
            className={cn('px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all border',
              autoScroll ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/8 text-white/20')}>
            {autoScroll ? 'Live' : 'Paused'}
          </button>
        </div>
      </div>

      {/* Log table */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px] bg-black/30">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
            <Terminal size={24} className="text-white/20" />
            <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest">
              {rawLogs.length === 0 ? 'No events yet — run some tasks' : 'No events match filters'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((log, i) => (
              <motion.div key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'group border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer',
                  log.level === 'error' && 'hover:bg-red-500/[0.02]'
                )}
                onClick={() => log.detail && toggleExpand(log.id)}
              >
                <div className="flex items-center gap-0 px-6 py-2.5">
                  {/* Timestamp */}
                  <span className="text-white/20 w-44 shrink-0 text-[10px] tabular-nums">
                    {format(new Date(log.timestamp), 'MM-dd HH:mm:ss.SSS')}
                  </span>

                  {/* Level */}
                  <div className={cn('flex items-center gap-1.5 w-24 shrink-0 px-2 py-0.5 rounded-md border mr-3', levelBg(log.level))}>
                    {levelIcon(log.level)}
                    <span className={cn('text-[9px] uppercase tracking-wider font-bold', levelText(log.level))}>{log.level}</span>
                  </div>

                  {/* Source */}
                  <span className="text-white/30 w-40 shrink-0 truncate">{log.source}</span>

                  {/* Message */}
                  <span className="text-white/70 flex-1 truncate">{log.message}</span>

                  {/* Detail toggle */}
                  {log.detail && (
                    <ChevronDown size={11} className={cn('text-white/15 group-hover:text-white/30 shrink-0 transition-all', expanded.has(log.id) && 'rotate-180')} />
                  )}
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expanded.has(log.id) && log.detail && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="px-6 pb-3 pl-44">
                        <div className="bg-black/40 rounded-xl px-4 py-2.5 border border-white/5">
                          <span className="text-white/35 text-[10px] leading-relaxed break-all">{log.detail}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-8 py-3 border-t border-white/5 bg-black/20 flex items-center gap-6 shrink-0">
        {[
          { l: 'Total', v: rawLogs.length, c: 'text-white/40' },
          { l: 'Errors', v: counts.error, c: counts.error > 0 ? 'text-red-400' : 'text-white/20' },
          { l: 'Warnings', v: counts.warn, c: counts.warn > 0 ? 'text-amber-400' : 'text-white/20' },
          { l: 'Success', v: counts.success, c: 'text-emerald-400' },
        ].map(s => (
          <div key={s.l} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-white/20 uppercase">{s.l}</span>
            <span className={cn('text-[10px] font-mono font-bold', s.c)}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}