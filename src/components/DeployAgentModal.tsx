import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Zap, Brain, MessageSquare, ArrowRight, ArrowLeft, Check, Shield, Activity, Cpu, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

interface DeployAgentModalProps {
  isOpen: boolean
  onClose: () => void
  onDeploy: (agent: {
    name: string
    type: string
    model: string
    description: string
    system_prompt: string
    color: string
  }) => void
}

const AGENT_TYPES = [
  { id: 'research', label: 'Research', icon: Brain, color: '#3b82f6', description: 'Information retrieval and analysis' },
  { id: 'creative', label: 'Creative', icon: MessageSquare, color: '#10b981', description: 'Content generation and writing' },
  { id: 'data', label: 'Data', icon: Activity, color: '#f59e0b', description: 'Data processing and analysis' },
  { id: 'security', label: 'Security', icon: Shield, color: '#ef4444', description: 'Monitoring and threat detection' },
  { id: 'assistant', label: 'Assistant', icon: Sparkles, color: '#8b5cf6', description: 'General-purpose task assistant' },
  { id: 'custom', label: 'Custom', icon: Cpu, color: '#6b7280', description: 'Define your own purpose' },
]

const MODELS = [
  { id: 'claude', label: 'Claude', sub: 'Anthropic · claude-sonnet-4', color: '#f59e0b' },
  { id: 'gemini', label: 'Gemini', sub: 'Google · gemini-2.0-flash', color: '#60a5fa' },
  { id: 'gpt-4o', label: 'GPT-4o', sub: 'OpenAI · gpt-4o', color: '#10b981' },
]

const DEFAULT_PROMPTS: Record<string, string> = {
  research: 'You are a research agent. Your job is to find, analyze, and summarize information accurately. Use web search to find current information. Always cite your sources.',
  creative: 'You are a creative writing agent. You help with content creation, copywriting, storytelling, and creative projects. Be imaginative and adapt to the user\'s voice and style.',
  data: 'You are a data analysis agent. You help analyze data, identify patterns, create summaries, and provide actionable insights. Be precise and methodical.',
  security: 'You are a security monitoring agent. You analyze systems for vulnerabilities, monitor for threats, and provide security recommendations. Be thorough and cautious.',
  assistant: 'You are a helpful AI assistant. You help with a wide range of tasks including research, writing, analysis, and problem-solving. Be helpful, accurate, and concise.',
  custom: '',
}

export const DeployAgentModal: React.FC<DeployAgentModalProps> = ({ isOpen, onClose, onDeploy }) => {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    type: 'research',
    model: 'claude',
    description: '',
    system_prompt: DEFAULT_PROMPTS.research,
    color: '#3b82f6',
  })

  const selectedType = AGENT_TYPES.find(t => t.id === formData.type)

  const handleTypeSelect = (type: typeof AGENT_TYPES[0]) => {
    setFormData(prev => ({
      ...prev,
      type: type.id,
      color: type.color,
      system_prompt: prev.system_prompt === DEFAULT_PROMPTS[prev.type]
        ? DEFAULT_PROMPTS[type.id]
        : prev.system_prompt,
    }))
  }

  const handleSubmit = () => {
    onDeploy({
      name: formData.name.trim() || `${selectedType?.label || 'New'} Agent`,
      type: formData.type,
      model: formData.model,
      description: formData.description.trim(),
      system_prompt: formData.system_prompt.trim() || DEFAULT_PROMPTS[formData.type] || `You are ${formData.name}, a helpful AI agent.`,
      color: formData.color,
    })
    onClose()
    setStep(1)
    setFormData({ name: '', type: 'research', model: 'claude', description: '', system_prompt: DEFAULT_PROMPTS.research, color: '#3b82f6' })
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="w-full max-w-xl bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10">

          {/* Header */}
          <div className="p-7 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <Zap size={16} className="text-white/60" />
              </div>
              <div>
                <h2 className="text-white font-mono text-sm font-bold uppercase tracking-wider">Deploy Agent</h2>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={cn('h-1 rounded-full transition-all duration-500',
                      step >= i ? 'w-5 bg-white' : 'w-2 bg-white/10')} />
                  ))}
                  <span className="text-white/20 text-[9px] font-mono uppercase ml-1 tracking-widest">Step {step}/3</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/20 hover:text-white transition-colors"><X size={18} /></button>
          </div>

          {/* Body */}
          <div className="p-7 min-h-[360px]">
            <AnimatePresence mode="wait">

              {/* Step 1 — Name + Type */}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-white/35 uppercase tracking-widest block">Agent Name</label>
                    <input autoFocus value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Research Bot, News Watcher..."
                      className="w-full bg-white/[0.02] border border-white/8 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/20 transition-all placeholder-white/15" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-white/35 uppercase tracking-widest block">Agent Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {AGENT_TYPES.map(type => (
                        <button key={type.id} onClick={() => handleTypeSelect(type)}
                          className={cn('p-3.5 rounded-2xl border transition-all text-left',
                            formData.type === type.id ? 'bg-white/5 border-white/20' : 'bg-transparent border-white/5 hover:border-white/10')}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <type.icon size={13} style={{ color: type.color }} />
                            <span className="text-[11px] font-mono text-white font-bold">{type.label}</span>
                          </div>
                          <p className="text-[9px] font-mono text-white/25 leading-relaxed">{type.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2 — Model + Description */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-white/35 uppercase tracking-widest block">AI Model</label>
                    <div className="grid grid-cols-3 gap-3">
                      {MODELS.map(m => (
                        <button key={m.id} onClick={() => setFormData(p => ({ ...p, model: m.id }))}
                          className={cn('p-4 rounded-2xl border transition-all text-left',
                            formData.model === m.id ? 'bg-white/5 border-white/20' : 'bg-transparent border-white/5 hover:border-white/10')}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-mono text-white font-bold">{m.label}</span>
                            {formData.model === m.id && <Check size={12} className="text-emerald-400" />}
                          </div>
                          <p className="text-[9px] font-mono" style={{ color: m.color }}>{m.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-white/35 uppercase tracking-widest block">Description <span className="text-white/15">(optional)</span></label>
                    <input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      placeholder="What does this agent do?"
                      className="w-full bg-white/[0.02] border border-white/8 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/20 transition-all placeholder-white/15" />
                  </div>
                </motion.div>
              )}

              {/* Step 3 — System prompt + summary */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-white/35 uppercase tracking-widest block">System Prompt</label>
                    <textarea value={formData.system_prompt} onChange={e => setFormData(p => ({ ...p, system_prompt: e.target.value }))}
                      placeholder="Define how this agent thinks and behaves..."
                      className="w-full h-36 bg-white/[0.02] border border-white/8 rounded-2xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-white/20 transition-all resize-none placeholder-white/15 leading-relaxed" />
                  </div>

                  <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[9px] font-mono text-white/20 uppercase mb-1">Name</p>
                      <p className="text-[11px] font-mono text-white truncate">{formData.name || 'Untitled'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-white/20 uppercase mb-1">Type</p>
                      <p className="text-[11px] font-mono text-white capitalize">{formData.type}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-white/20 uppercase mb-1">Model</p>
                      <p className="text-[11px] font-mono text-white capitalize">{formData.model}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-7 py-5 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
            <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
              className="px-5 py-2.5 text-[10px] font-mono font-bold uppercase text-white/30 hover:text-white transition-colors flex items-center gap-2">
              {step === 1 ? 'Cancel' : <><ArrowLeft size={13} /> Back</>}
            </button>
            <button onClick={step === 3 ? handleSubmit : () => setStep(s => s + 1)}
              disabled={step === 1 && !formData.name.trim()}
              className="px-7 py-2.5 bg-white text-black rounded-xl text-[10px] font-mono font-bold uppercase hover:bg-white/90 transition-all flex items-center gap-2 disabled:opacity-30">
              {step === 3 ? <><Check size={13} /> Deploy Agent</> : <>Next <ArrowRight size={13} /></>}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}