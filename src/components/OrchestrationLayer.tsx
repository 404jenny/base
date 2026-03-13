import React, { useState, useMemo } from 'react'
import { Agent } from '../types'
import { AgentCard } from './AgentCard'
import { Plus, Search, Filter, Zap, Activity, Brain, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../lib/utils'

interface OrchestrationLayerProps {
  agents: Agent[]
  tasks?: any[]
  onDeployClick: () => void
  onRunAgent: (agentId: string, instruction: string) => void
  onPauseTask: (taskId: string) => void
  onResumeTask: (taskId: string) => void
  onCancelTask: (taskId: string) => void
  onDeleteAgent: (agentId: string) => void
  onUpdateAgent: (agentId: string, updates: any) => void
}

type FilterStatus = 'all' | 'running' | 'idle' | 'paused' | 'error'

export const OrchestrationLayer: React.FC<OrchestrationLayerProps> = ({
  agents, tasks = [], onDeployClick, onRunAgent, onPauseTask, onResumeTask,
  onCancelTask, onDeleteAgent, onUpdateAgent
}) => {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const filteredAgents = useMemo(() => {
    return agents.filter(a => {
      const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.description || '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = filterStatus === 'all' || a.status === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [agents, search, filterStatus])

  // Get the running task for each agent (to pass pause/cancel correctly)
  const getAgentRunningTaskId = (agentId: string) => {
    return tasks.find(t => t.agent_id === agentId && t.status === 'running')?.id
  }

  const handlePause = (agentId: string) => {
    const taskId = getAgentRunningTaskId(agentId)
    if (taskId) onPauseTask(taskId)
  }

  const handleResume = (agentId: string) => {
    const taskId = tasks.find(t => t.agent_id === agentId && t.status === 'paused')?.id
    if (taskId) onResumeTask(taskId)
  }

  // Fleet stats
  const stats = {
    running: agents.filter(a => a.status === 'running').length,
    idle: agents.filter(a => a.status === 'idle').length,
    error: agents.filter(a => a.status === 'error').length,
    totalTokens: tasks.reduce((sum, t) => sum + (t.tokens_used || 0), 0),
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    failedTasks: tasks.filter(t => t.status === 'failed').length,
  }

  const filterButtons: { id: FilterStatus; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: agents.length },
    { id: 'running', label: 'Running', count: stats.running },
    { id: 'idle', label: 'Idle', count: stats.idle },
    { id: 'paused', label: 'Paused', count: agents.filter(a => a.status === 'paused').length },
    { id: 'error', label: 'Error', count: stats.error },
  ]

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-hidden">

      {/* Header */}
      <div className="px-8 py-5 border-b border-white/5 bg-black/20 backdrop-blur-md shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-mono text-[11px] uppercase tracking-[0.3em] font-bold">Orchestration Layer</h2>
            <p className="text-white/20 text-[9px] font-mono uppercase mt-1 tracking-wider">
              {agents.length} agents · {tasks.filter(t => t.status === 'running').length} active tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search agents..."
                className="bg-white/[0.03] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-[11px] font-mono text-white focus:outline-none focus:border-white/20 w-48 transition-all placeholder-white/15" />
            </div>
            <button onClick={onDeployClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-[10px] font-mono font-bold uppercase hover:bg-white/90 transition-all shadow-lg shadow-white/5">
              <Plus size={13} /> New Agent
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3">
          {[
            { label: 'Running', value: stats.running, color: 'text-emerald-400', dot: 'bg-emerald-400' },
            { label: 'Completed Tasks', value: stats.completedTasks, color: 'text-white/40', dot: 'bg-white/20' },
            { label: 'Failed', value: stats.failedTasks, color: stats.failedTasks > 0 ? 'text-red-400' : 'text-white/40', dot: stats.failedTasks > 0 ? 'bg-red-400' : 'bg-white/20' },
            { label: 'Tokens', value: stats.totalTokens.toLocaleString(), color: 'text-purple-400', dot: 'bg-purple-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
              <span className="text-[9px] font-mono text-white/25 uppercase">{s.label}</span>
              <span className={cn('text-[10px] font-mono font-bold', s.color)}>{s.value}</span>
            </div>
          ))}

          {/* Status filter */}
          <div className="flex items-center gap-1 ml-auto">
            {filterButtons.filter(f => f.count > 0 || f.id === 'all').map(f => (
              <button key={f.id} onClick={() => setFilterStatus(f.id)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-mono uppercase tracking-wider transition-all',
                  filterStatus === f.id ? 'bg-white/12 text-white' : 'text-white/20 hover:text-white/50')}>
                {f.label}
                {f.count > 0 && <span className={cn('font-bold', filterStatus === f.id ? 'text-white' : 'text-white/30')}>{f.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
            {agents.length === 0 ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                  <Brain size={22} className="text-white/20" />
                </div>
                <div className="text-center">
                  <p className="text-[12px] font-mono text-white/30 uppercase tracking-widest mb-2">No agents deployed</p>
                  <p className="text-[10px] font-mono text-white/15">Click "New Agent" to deploy your first agent</p>
                </div>
                <button onClick={onDeployClick}
                  className="mt-2 flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-mono text-[10px] font-bold uppercase hover:bg-white/90 transition-all">
                  <Plus size={13} /> Deploy First Agent
                </button>
              </>
            ) : (
              <p className="text-[11px] font-mono text-white/25">No agents match your search</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredAgents.map(agent => (
                <motion.div key={agent.id} layout
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
                  className="relative">
                  <AgentCard
                    agent={agent}
                    tasks={tasks}
                    onRun={onRunAgent}
                    onPause={handlePause}
                    onResume={handleResume}
                    onCancel={onCancelTask}
                    onDelete={onDeleteAgent}
                    onEdit={onUpdateAgent}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}