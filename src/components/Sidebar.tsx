import React, { useMemo } from 'react'
import { LayoutDashboard, MessageSquare, Zap, Activity, Share2, FileText } from 'lucide-react'
import { cn } from '../lib/utils'
import { motion } from 'motion/react'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  agents?: any[]
  tasks?: any[]
  messages?: any[]
  connected?: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, agents = [], tasks = [], messages = [], connected = false
}) => {
  const menuItems = [
    { id: 'dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'communication',  icon: MessageSquare,   label: 'Feed' },
    { id: 'orchestration',  icon: Zap,             label: 'Agents' },
    { id: 'telemetry',      icon: Activity,        label: 'Telemetry' },
    { id: 'graph',          icon: Share2,           label: 'Topology' },
    { id: 'logs',           icon: FileText,         label: 'Audit Log' },
  ]

  // ── Real system load: ratio of running tasks vs agents ───────────────────
  const runningCount   = agents.filter(a => a.status === 'running').length
  const totalAgents    = agents.length
  const runningTasks   = tasks.filter(t => t.status === 'running').length
  const failedRecent   = tasks.filter(t => t.status === 'failed').length
  const totalTokens    = tasks.reduce((s: number, t: any) => s + (t.tokens_used || 0), 0)

  const systemLoad = useMemo(() => {
    if (!connected || totalAgents === 0) return 0
    // Load = running tasks weight + agent activity
    const taskLoad   = Math.min(runningTasks * 15, 60)
    const agentLoad  = totalAgents > 0 ? (runningCount / totalAgents) * 30 : 0
    const msgLoad    = Math.min(messages.length / 10, 10)
    return Math.min(Math.round(taskLoad + agentLoad + msgLoad), 100)
  }, [connected, runningTasks, runningCount, totalAgents, messages.length])

  const loadLabel = systemLoad === 0
    ? 'Idle' : systemLoad < 30
    ? 'Nominal' : systemLoad < 60
    ? 'Moderate' : systemLoad < 85
    ? 'High' : 'Critical'

  const loadColor = systemLoad === 0
    ? 'from-white/20 to-white/10' : systemLoad < 30
    ? 'from-emerald-500 to-teal-400' : systemLoad < 60
    ? 'from-amber-400 to-yellow-400' : systemLoad < 85
    ? 'from-orange-500 to-amber-400' : 'from-red-500 to-rose-400'

  const loadTextColor = systemLoad === 0
    ? 'text-white/20' : systemLoad < 30
    ? 'text-emerald-400' : systemLoad < 60
    ? 'text-amber-400' : systemLoad < 85
    ? 'text-orange-400' : 'text-red-400'

  // Unread messages badge for feed tab
  const unreadMessages = messages.length

  return (
    <div className="w-56 bg-black/40 backdrop-blur-2xl border-r border-white/5 flex flex-col h-full z-10 shrink-0">

      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.08)] shrink-0">
            <span className="text-black font-bold text-base tracking-tighter">b</span>
          </div>
          <div>
            <h1 className="text-white font-mono font-bold tracking-tight text-sm leading-none">base</h1>
            <p className="text-white/20 text-[8px] mt-0.5 font-mono uppercase tracking-[0.2em]">agent os</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {menuItems.map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden',
              activeTab === item.id
                ? 'bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]'
                : 'text-white/30 hover:text-white/80 hover:bg-white/[0.04]'
            )}>
            {activeTab === item.id && (
              <motion.div layoutId="active-pill"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white rounded-full" />
            )}
            <item.icon size={15} className={cn('transition-all duration-200 shrink-0',
              activeTab === item.id ? 'text-white' : 'text-white/25 group-hover:text-white/50')} />
            <span className="font-mono text-[10px] uppercase tracking-widest font-medium flex-1 text-left">{item.label}</span>

            {/* Live badge for feed */}
            {item.id === 'communication' && unreadMessages > 0 && activeTab !== 'communication' && (
              <span className="w-4 h-4 rounded-full bg-white/10 text-white/50 text-[8px] font-bold flex items-center justify-center">
                {unreadMessages > 99 ? '99' : unreadMessages}
              </span>
            )}
            {/* Running indicator for orchestration */}
            {item.id === 'orchestration' && runningCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        ))}
      </nav>

      {/* System stats */}
      <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-4">

        {/* Live agent + task counts */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[8px] font-mono text-white/20 uppercase tracking-wider mb-1">Agents</p>
            <div className="flex items-end gap-1">
              <span className="text-sm font-mono font-bold text-white leading-none">{totalAgents}</span>
              {runningCount > 0 && (
                <span className="text-[9px] font-mono text-emerald-400 leading-none mb-0.5">{runningCount} live</span>
              )}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[8px] font-mono text-white/20 uppercase tracking-wider mb-1">Tokens</p>
            <span className="text-sm font-mono font-bold text-white leading-none">
              {totalTokens > 999 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}
            </span>
          </div>
        </div>

        {/* System load bar */}
        <div className="p-3 bg-white/[0.02] rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-mono text-white/25 uppercase tracking-wider">System Load</span>
            <span className={cn('text-[8px] font-mono uppercase font-bold', loadTextColor)}>{loadLabel}</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${Math.max(systemLoad, connected ? 2 : 0)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={cn('h-full rounded-full bg-gradient-to-r', loadColor)}
            />
          </div>
          {failedRecent > 0 && (
            <p className="text-[8px] font-mono text-red-400/60 mt-1.5">{failedRecent} failed task{failedRecent !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Connection dot */}
        <div className="flex items-center gap-2 px-1">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
            connected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse')} />
          <span className="text-[8px] font-mono text-white/20 uppercase tracking-wider">
            {connected ? 'Engine online' : 'Engine offline'}
          </span>
        </div>
      </div>
    </div>
  )
}