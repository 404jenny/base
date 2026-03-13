import React, { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell
} from 'recharts'
import { Agent } from '../types'
import { Brain, Zap, CheckCircle, XCircle, Clock, TrendingUp, Activity, Hash } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '../lib/utils'
import { format } from 'date-fns'

interface TelemetryDashboardProps {
  agents: Agent[]
  tasks?: any[]
  messages?: any[]
}

const CHART_STYLE = {
  contentStyle: {
    backgroundColor: '#0a0a0a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#fff',
  },
  itemStyle: { color: '#fff' },
  labelStyle: { color: 'rgba(255,255,255,0.4)', fontSize: '9px' },
}

function safeDate(ts: any): Date {
  if (!ts) return new Date()
  if (typeof ts === 'number') return new Date(ts > 1e10 ? ts : ts * 1000)
  return new Date(ts)
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  agents, tasks = [], messages = []
}) => {

  // ── Core stats ─────────────────────────────────────────────────────────────
  const totalTokens = tasks.reduce((s, t) => s + (t.tokens_used || 0), 0)
  const totalCost = tasks.reduce((s, t) => s + (t.cost_usd || 0), 0)
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const failedTasks = tasks.filter(t => t.status === 'failed')
  const runningTasks = tasks.filter(t => t.status === 'running')
  const successRate = tasks.length > 0
    ? Math.round((completedTasks.length / tasks.filter(t => ['completed','failed'].includes(t.status)).length) * 100) || 0
    : 0

  const avgTaskDuration = useMemo(() => {
    const finished = tasks.filter(t => t.started_at && t.completed_at)
    if (!finished.length) return 0
    const avg = finished.reduce((s, t) => s + (t.completed_at - t.started_at), 0) / finished.length
    return Math.round(avg)
  }, [tasks])

  // ── Token usage per agent ──────────────────────────────────────────────────
  const tokensByAgent = useMemo(() => {
    return agents.map(a => {
      const agentTasks = tasks.filter(t => t.agent_id === a.id)
      return {
        name: a.name,
        tokens: agentTasks.reduce((s, t) => s + (t.tokens_used || 0), 0),
        tasks: agentTasks.length,
        completed: agentTasks.filter(t => t.status === 'completed').length,
        failed: agentTasks.filter(t => t.status === 'failed').length,
        color: a.color,
      }
    }).filter(a => a.tasks > 0).sort((a, b) => b.tokens - a.tokens)
  }, [agents, tasks])

  // ── Task timeline (tasks per hour over last 24h) ───────────────────────────
  const taskTimeline = useMemo(() => {
    const now = Date.now()
    const hours = Array.from({ length: 24 }, (_, i) => {
      const h = new Date(now - (23 - i) * 3600000)
      return {
        label: format(h, 'HH:mm'),
        completed: 0,
        failed: 0,
        tokens: 0,
      }
    })
    tasks.forEach(t => {
      if (!t.created_at) return
      const ts = safeDate(t.created_at).getTime()
      const hoursAgo = Math.floor((now - ts) / 3600000)
      if (hoursAgo >= 0 && hoursAgo < 24) {
        const idx = 23 - hoursAgo
        if (t.status === 'completed') hours[idx].completed++
        if (t.status === 'failed') hours[idx].failed++
        hours[idx].tokens += t.tokens_used || 0
      }
    })
    return hours
  }, [tasks])

  // ── Message volume over time ───────────────────────────────────────────────
  const messageTimeline = useMemo(() => {
    const now = Date.now()
    const hours = Array.from({ length: 24 }, (_, i) => ({
      label: format(new Date(now - (23 - i) * 3600000), 'HH:mm'),
      messages: 0,
    }))
    messages.forEach(m => {
      const ts = typeof m.timestamp === 'number' ? m.timestamp : safeDate(m.created_at).getTime()
      const hoursAgo = Math.floor((now - ts) / 3600000)
      if (hoursAgo >= 0 && hoursAgo < 24) hours[23 - hoursAgo].messages++
    })
    return hours
  }, [messages])

  // ── Task status breakdown (for pie) ───────────────────────────────────────
  const statusBreakdown = [
    { name: 'Completed', value: completedTasks.length, color: '#10b981' },
    { name: 'Failed', value: failedTasks.length, color: '#ef4444' },
    { name: 'Running', value: runningTasks.length, color: '#3b82f6' },
    { name: 'Queued', value: tasks.filter(t => t.status === 'queued').length, color: '#6b7280' },
  ].filter(s => s.value > 0)

  const isEmpty = tasks.length === 0 && messages.length === 0

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-hidden">

      {/* Header */}
      <div className="px-8 py-5 border-b border-white/5 bg-black/20 backdrop-blur-md shrink-0">
        <h2 className="text-white font-mono text-[11px] uppercase tracking-[0.3em] font-bold">Telemetry</h2>
        <p className="text-white/20 text-[9px] font-mono uppercase mt-1 tracking-wider">
          Live data from sidecar · {tasks.length} tasks · {messages.length} messages
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
            <Activity size={28} className="text-white/20" />
            <p className="text-[11px] font-mono text-white/30 uppercase tracking-widest">No data yet</p>
            <p className="text-[10px] font-mono text-white/20">Deploy agents and run tasks to see telemetry</p>
          </div>
        )}

        {/* ── Stat cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Tokens',
              value: totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens.toString(),
              sub: totalCost > 0 ? `$${totalCost.toFixed(4)}` : 'no cost data',
              icon: Brain, color: '#a78bfa', glow: 'shadow-purple-500/10',
            },
            {
              label: 'Tasks Run',
              value: tasks.length.toString(),
              sub: `${runningTasks.length} active now`,
              icon: Zap, color: '#f59e0b', glow: 'shadow-amber-500/10',
            },
            {
              label: 'Success Rate',
              value: tasks.filter(t => ['completed','failed'].includes(t.status)).length > 0 ? `${successRate}%` : '—',
              sub: `${completedTasks.length} completed · ${failedTasks.length} failed`,
              icon: CheckCircle, color: successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444',
              glow: 'shadow-emerald-500/10',
            },
            {
              label: 'Avg Duration',
              value: avgTaskDuration > 0 ? `${avgTaskDuration}s` : '—',
              sub: `across ${completedTasks.length} completed`,
              icon: Clock, color: '#60a5fa', glow: 'shadow-blue-500/10',
            },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={cn('p-5 rounded-2xl bg-white/[0.02] border border-white/6 shadow-xl', s.glow)}>
              <div className="flex items-center justify-between mb-3">
                <s.icon size={15} style={{ color: s.color }} />
                <span className="text-[8px] font-mono text-white/15 uppercase tracking-widest">live</span>
              </div>
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
              <p className="text-2xl font-mono font-bold text-white tracking-tight">{s.value}</p>
              <p className="text-[9px] font-mono text-white/20 mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Charts row 1 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Task activity 24h */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-mono text-[10px] uppercase tracking-widest font-bold">Task Activity — 24h</h3>
              <div className="flex items-center gap-3">
                {[{c:'#10b981',l:'Completed'},{c:'#ef4444',l:'Failed'}].map(x => (
                  <div key={x.l} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: x.c }} />
                    <span className="text-[9px] font-mono text-white/25">{x.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskTimeline} barSize={6} barGap={2}>
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={5} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={20} />
                  <Tooltip {...CHART_STYLE} />
                  <Bar dataKey="completed" fill="#10b981" fillOpacity={0.7} radius={[3,3,0,0]} />
                  <Bar dataKey="failed" fill="#ef4444" fillOpacity={0.7} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Task status pie */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/6">
            <h3 className="text-white font-mono text-[10px] uppercase tracking-widest font-bold mb-5">Task Breakdown</h3>
            {statusBreakdown.length > 0 ? (
              <>
                <div className="h-36 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                        paddingAngle={3} dataKey="value">
                        {statusBreakdown.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={0.8} />)}
                      </Pie>
                      <Tooltip {...CHART_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {statusBreakdown.map(s => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[10px] font-mono text-white/40">{s.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/60 font-bold">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <p className="text-[10px] font-mono text-white/20">No task data</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Charts row 2 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Token usage over time */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/6">
            <h3 className="text-white font-mono text-[10px] uppercase tracking-widest font-bold mb-5">Token Usage — 24h</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={taskTimeline}>
                  <defs>
                    <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={5} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip {...CHART_STYLE} />
                  <Area type="monotone" dataKey="tokens" stroke="#a78bfa" strokeWidth={2} fill="url(#tokenGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Message volume */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/6">
            <h3 className="text-white font-mono text-[10px] uppercase tracking-widest font-bold mb-5">Message Volume — 24h</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={messageTimeline}>
                  <defs>
                    <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={5} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={20} />
                  <Tooltip {...CHART_STYLE} />
                  <Area type="monotone" dataKey="messages" stroke="#60a5fa" strokeWidth={2} fill="url(#msgGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Per-agent breakdown ───────────────────────────────────────────── */}
        {tokensByAgent.length > 0 && (
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/6">
            <h3 className="text-white font-mono text-[10px] uppercase tracking-widest font-bold mb-5">Per-Agent Usage</h3>
            <div className="space-y-3">
              {tokensByAgent.map(a => (
                <div key={a.name} className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: a.color, color: '#000' }}>
                    {a.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono text-white/70 truncate">{a.name}</span>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-[9px] font-mono text-white/25">{a.tasks} tasks</span>
                        <span className="text-[9px] font-mono text-emerald-400/60">{a.completed} ✓</span>
                        {a.failed > 0 && <span className="text-[9px] font-mono text-red-400/60">{a.failed} ✗</span>}
                        <span className="text-[10px] font-mono text-white/50 font-bold w-16 text-right">
                          {a.tokens > 1000 ? `${(a.tokens/1000).toFixed(1)}k` : a.tokens}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: totalTokens > 0 ? `${Math.max(2, (a.tokens / totalTokens) * 100)}%` : '2%',
                          backgroundColor: a.color,
                          opacity: 0.7,
                        }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent failed tasks ───────────────────────────────────────────── */}
        {failedTasks.length > 0 && (
          <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10">
            <div className="flex items-center gap-2 mb-4">
              <XCircle size={13} className="text-red-400" />
              <h3 className="text-red-400 font-mono text-[10px] uppercase tracking-widest font-bold">Recent Failures</h3>
            </div>
            <div className="space-y-2">
              {failedTasks.slice(0, 5).map(t => {
                const agent = agents.find(a => a.id === t.agent_id)
                return (
                  <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/8">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                      style={{ backgroundColor: agent?.color || '#6b7280', color: '#000' }}>
                      {agent?.name.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-white/60 truncate">{t.instruction}</p>
                      {t.error && <p className="text-[9px] font-mono text-red-400/70 mt-0.5 leading-relaxed">{t.error}</p>}
                    </div>
                    <span className="text-[9px] font-mono text-white/20 shrink-0">
                      {safeDate(t.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}