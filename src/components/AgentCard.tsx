import React, { useState } from 'react'
import { Agent } from '../types'
import { Play, Pause, Square, Trash2, Edit3, Send, ChevronDown, ChevronUp, Activity, Brain, Zap, Check, X, MoreVertical } from 'lucide-react'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'motion/react'

interface AgentCardProps {
  agent: Agent
  tasks?: any[]
  onRun: (id: string, instruction: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string, updates: { name: string; description: string; system_prompt: string; model: string }) => void
}

function statusColor(status: Agent['status']) {
  switch (status) {
    case 'running': return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
    case 'paused': return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
    case 'error': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
    default: return 'bg-white/20'
  }
}

function taskStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'text-emerald-400'
    case 'failed': return 'text-red-400'
    case 'running': return 'text-blue-400'
    case 'paused': return 'text-amber-400'
    default: return 'text-white/30'
  }
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent, tasks = [], onRun, onPause, onResume, onCancel, onDelete, onEdit
}) => {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [runInput, setRunInput] = useState('')
  const [showRun, setShowRun] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editForm, setEditForm] = useState({
    name: agent.name,
    description: agent.description || '',
    system_prompt: agent.system_prompt || '',
    model: agent.model || 'claude',
  })

  const agentTasks = tasks.filter(t => t.agent_id === agent.id).slice(0, 5)
  const isRunning = agent.status === 'running'
  const isPaused = agent.status === 'paused'
  const tokenCount = agentTasks.reduce((sum, t) => sum + (t.tokens_used || 0), 0)

  const handleRun = () => {
    if (!runInput.trim()) return
    onRun(agent.id, runInput.trim())
    setRunInput('')
    setShowRun(false)
  }

  const handleEditSave = () => {
    onEdit(agent.id, editForm)
    setEditing(false)
  }

  return (
    <motion.div layout className={cn(
      'rounded-2xl border overflow-hidden flex flex-col transition-all',
      'bg-white/[0.02] border-white/8',
      isRunning && 'border-white/12 bg-white/[0.03]'
    )}>
      {/* Running shimmer */}
      {isRunning && (
        <motion.div
          initial={{ x: '-100%' }} animate={{ x: '200%' }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none"
        />
      )}

      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 shadow-md"
          style={{ backgroundColor: agent.color, color: '#000' }}>
          {agent.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-mono text-[11px] font-bold uppercase tracking-wide truncate">{agent.name}</h3>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusColor(agent.status))} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-mono text-white/25 uppercase">{agent.model || 'claude'}</span>
            {agent.status !== 'idle' && (
              <span className={cn('text-[9px] font-mono uppercase', agent.status === 'running' ? 'text-emerald-400' : agent.status === 'error' ? 'text-red-400' : 'text-white/30')}>
                · {agent.status}
              </span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isRunning && (
            <button onClick={() => onPause(agent.id)} title="Pause"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-400/60 hover:text-amber-400 hover:bg-amber-400/10 transition-all">
              <Pause size={11} fill="currentColor" />
            </button>
          )}
          {isPaused && (
            <button onClick={() => onResume(agent.id)} title="Resume"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all">
              <Play size={11} fill="currentColor" />
            </button>
          )}
          <button onClick={() => setShowRun(p => !p)} title="Run task"
            className={cn('w-7 h-7 flex items-center justify-center rounded-lg transition-all',
              showRun ? 'bg-white text-black' : 'text-white/25 hover:text-white hover:bg-white/8')}>
            <Send size={11} />
          </button>
          <button onClick={() => setExpanded(p => !p)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/20 hover:text-white/60 transition-all">
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* Quick run input */}
      <AnimatePresence>
        {showRun && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5">
            <div className="p-3 flex gap-2">
              <input autoFocus value={runInput} onChange={e => setRunInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRun(); if (e.key === 'Escape') setShowRun(false) }}
                placeholder="Give this agent a task..."
                className="flex-1 bg-black/40 border border-white/8 rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-white/20 placeholder-white/15 transition-all" />
              <button onClick={handleRun} disabled={!runInput.trim()}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-30 transition-all">
                <Send size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Description + stats */}
      {agent.description && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-mono text-white/30 leading-relaxed line-clamp-2">{agent.description}</p>
        </div>
      )}

      {/* Stat row */}
      <div className="px-4 pb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Zap size={9} className="text-white/20" />
          <span className="text-[9px] font-mono text-white/25">{agentTasks.length} tasks</span>
        </div>
        {tokenCount > 0 && (
          <div className="flex items-center gap-1.5">
            <Brain size={9} className="text-white/20" />
            <span className="text-[9px] font-mono text-white/25">{tokenCount.toLocaleString()} tokens</span>
          </div>
        )}
        {isRunning && agentTasks[0] && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-emerald-400/70 truncate max-w-[100px]">
              {agentTasks[0].instruction?.slice(0, 30)}...
            </span>
          </div>
        )}
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5">

            {/* Edit mode */}
            {editing ? (
              <div className="p-4 space-y-3">
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Editing Agent</p>
                <div>
                  <label className="text-[9px] font-mono text-white/25 uppercase tracking-wider block mb-1">Name</label>
                  <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-black/40 border border-white/8 rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-white/20 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-white/25 uppercase tracking-wider block mb-1">Description</label>
                  <input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="What does this agent do?"
                    className="w-full bg-black/40 border border-white/8 rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-white/20 transition-all placeholder-white/15" />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-white/25 uppercase tracking-wider block mb-1">Model</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['claude', 'gemini'].map(m => (
                      <button key={m} onClick={() => setEditForm(p => ({ ...p, model: m }))}
                        className={cn('py-2 rounded-xl border font-mono text-[10px] uppercase tracking-wider transition-all',
                          editForm.model === m ? 'bg-white text-black border-white' : 'bg-transparent text-white/30 border-white/8 hover:border-white/20')}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-white/25 uppercase tracking-wider block mb-1">System Prompt</label>
                  <textarea value={editForm.system_prompt} onChange={e => setEditForm(p => ({ ...p, system_prompt: e.target.value }))}
                    rows={4}
                    className="w-full bg-black/40 border border-white/8 rounded-xl px-3 py-2 text-white font-mono text-[10px] focus:outline-none focus:border-white/20 transition-all resize-none leading-relaxed placeholder-white/15" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditing(false)}
                    className="flex-1 py-2 rounded-xl border border-white/8 text-white/30 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-all">
                    Cancel
                  </button>
                  <button onClick={handleEditSave}
                    className="flex-1 py-2 rounded-xl bg-white text-black font-mono text-[10px] uppercase tracking-wider font-bold hover:bg-white/90 transition-all flex items-center justify-center gap-1">
                    <Check size={11} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* System prompt preview */}
                {agent.system_prompt && (
                  <div>
                    <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest mb-2">System Prompt</p>
                    <p className="text-[10px] font-mono text-white/40 leading-relaxed line-clamp-3 bg-black/20 rounded-xl p-3 border border-white/5">
                      {agent.system_prompt}
                    </p>
                  </div>
                )}

                {/* Recent tasks */}
                {agentTasks.length > 0 && (
                  <div>
                    <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest mb-2">Recent Tasks</p>
                    <div className="space-y-1.5">
                      {agentTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/5">
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', {
                            'bg-emerald-400': task.status === 'completed',
                            'bg-red-400': task.status === 'failed',
                            'bg-blue-400 animate-pulse': task.status === 'running',
                            'bg-amber-400': task.status === 'paused',
                            'bg-white/20': task.status === 'queued',
                          })} />
                          <p className={cn('text-[10px] font-mono flex-1 truncate', taskStatusColor(task.status))}>
                            {task.instruction}
                          </p>
                          {task.status === 'running' && (
                            <button onClick={() => onCancel(task.id)}
                              className="text-red-400/40 hover:text-red-400 transition-colors shrink-0">
                              <X size={10} />
                            </button>
                          )}
                          {task.tokens_used > 0 && (
                            <span className="text-[9px] font-mono text-white/20 shrink-0">{task.tokens_used.toLocaleString()}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {agentTasks.length === 0 && (
                  <p className="text-[10px] font-mono text-white/20 text-center py-2">No tasks yet — run one above</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditing(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/8 text-white/30 hover:text-white hover:border-white/20 font-mono text-[10px] uppercase tracking-wider transition-all">
                    <Edit3 size={10} /> Edit
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/10 text-red-400/40 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 font-mono text-[10px] transition-all">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-4 z-10 p-6">
            <p className="text-[11px] font-mono text-white text-center leading-relaxed">
              Delete <span className="text-white font-bold">{agent.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-all">
                Cancel
              </button>
              <button onClick={() => { onDelete(agent.id); setShowDeleteConfirm(false) }}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-mono text-[10px] uppercase tracking-wider font-bold transition-all">
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}