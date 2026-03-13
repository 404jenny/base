import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Brain, X, Send, AlertCircle, Zap } from 'lucide-react'
import { Agent, Message } from '../types'

interface InterventionModalProps {
  isOpen: boolean
  onClose: () => void
  agent: Agent | null
  message: Message | null
  onSend?: (agentId: string, instruction: string) => void
}

export const InterventionModal: React.FC<InterventionModalProps> = ({
  isOpen, onClose, agent, message, onSend
}) => {
  const [intervention, setIntervention] = useState('')

  if (!isOpen || !agent || !message) return null

  const handleSend = () => {
    if (!intervention.trim()) return
    onSend?.(agent.id, intervention.trim())
    setIntervention('')
    onClose()
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="w-full max-w-xl bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10"
        >
          {/* Header */}
          <div className="p-7 border-b border-white/5 bg-gradient-to-br from-purple-500/8 to-transparent">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: agent.color }}>
                  <span className="text-black font-bold text-sm">{agent.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-white font-mono text-sm font-bold">{agent.name}</h3>
                  <p className="text-white/30 text-[9px] font-mono uppercase tracking-wider">{agent.model || agent.type}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Original message */}
            <div className="p-4 bg-black/30 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={11} className="text-white/25" />
                <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">Agent message</span>
              </div>
              <p className="text-white/60 text-[11px] font-mono leading-relaxed line-clamp-4">
                {message.content}
              </p>
            </div>
          </div>

          {/* Intervention input */}
          <div className="p-7 space-y-4">
            <div>
              <label className="text-[9px] font-mono text-white/30 uppercase tracking-widest block mb-2">
                Send instruction to agent
              </label>
              <textarea
                autoFocus
                value={intervention}
                onChange={e => setIntervention(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
                placeholder="Override the agent's current task or give new instructions..."
                rows={4}
                className="w-full bg-white/[0.02] border border-white/8 rounded-2xl px-4 py-3 text-white font-mono text-[11px] focus:outline-none focus:border-white/20 transition-all resize-none placeholder-white/15 leading-relaxed"
              />
              <p className="text-[9px] font-mono text-white/15 mt-2">Ctrl+Enter to send</p>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-white/8 text-white/30 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-all">
                Cancel
              </button>
              <button onClick={handleSend} disabled={!intervention.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-black rounded-xl font-mono text-[10px] font-bold uppercase hover:bg-white/90 disabled:opacity-30 transition-all">
                <Zap size={12} /> Intervene
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}