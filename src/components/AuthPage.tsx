import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, Mail, Lock, ArrowRight, Eye, EyeOff, Zap } from 'lucide-react'
import { cn } from '../lib/utils'

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<boolean>
  onSignUp: (email: string, password: string) => Promise<boolean>
  onMagicLink: (email: string) => Promise<boolean>
  error: string | null
  onClearError: () => void
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSignIn, onSignUp, onMagicLink, error, onClearError }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const handleSubmit = async () => {
    if (!email) return
    setLoading(true)
    onClearError()
    try {
      if (mode === 'magic') {
        const ok = await onMagicLink(email)
        if (ok) setMagicSent(true)
      } else if (mode === 'signup') {
        await onSignUp(email, password)
      } else {
        await onSignIn(email, password)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full bg-[#020203] text-white overflow-hidden">
      {/* Left — branding */}
      <div className="w-1/2 relative flex flex-col items-start justify-end p-16 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 60%, rgba(99,102,241,0.15), transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(16,185,129,0.08), transparent 50%)' }} />

        {/* Animated orbs */}
        <motion.div animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-32 left-32 w-64 h-64 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent)' }} />
        <motion.div animate={{ y: [0, 20, 0], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-48 right-16 w-48 h-48 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15), transparent)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <span className="text-black font-bold text-xl">B</span>
            </div>
            <span className="font-mono font-bold text-xl tracking-tighter">BASE</span>
          </div>

          <h1 className="text-5xl font-mono font-bold leading-tight mb-6 tracking-tighter">
            The OS for<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #6366f1, #10b981)' }}>AI Agents</span>
          </h1>
          <p className="text-white/40 font-mono text-sm leading-relaxed max-w-sm">
            Orchestrate, monitor, and command your AI agents from a single interface. Deploy Claude and Gemini agents, watch them think, and direct them in real time.
          </p>

          <div className="flex items-center gap-8 mt-12">
            {[{ n: '2', l: 'AI Models' }, { n: '∞', l: 'Agents' }, { n: '1', l: 'Interface' }].map(s => (
              <div key={s.l}>
                <p className="text-2xl font-mono font-bold text-white">{s.n}</p>
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — auth form */}
      <div className="w-1/2 flex items-center justify-center p-16 border-l border-white/5">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {magicSent ? (
              <motion.div key="magic-sent" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6">
                  <Mail size={28} className="text-indigo-400" />
                </div>
                <h2 className="text-white font-mono text-lg font-bold mb-2">Check your email</h2>
                <p className="text-white/40 font-mono text-sm">We sent a magic link to <span className="text-white">{email}</span>. Click it to sign in.</p>
                <button onClick={() => setMagicSent(false)} className="mt-6 text-[10px] font-mono text-white/30 hover:text-white uppercase tracking-widest transition-colors">
                  ← Try again
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-white font-mono text-lg font-bold mb-1">
                  {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Magic link'}
                </h2>
                <p className="text-white/30 font-mono text-xs mb-8 uppercase tracking-widest">
                  {mode === 'signin' ? 'Sign in to your BASE account' : mode === 'signup' ? 'Start orchestrating agents' : 'Sign in without a password'}
                </p>

                {/* Mode tabs */}
                <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/5 mb-6">
                  {(['signin', 'signup', 'magic'] as const).map(m => (
                    <button key={m} onClick={() => { setMode(m); onClearError(); }}
                      className={cn('flex-1 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all',
                        mode === m ? 'bg-white text-black font-bold' : 'text-white/30 hover:text-white'
                      )}>
                      {m === 'signin' ? 'Sign In' : m === 'signup' ? 'Sign Up' : 'Magic'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white font-mono text-xs focus:outline-none focus:border-white/20 transition-all placeholder-white/10"
                    />
                  </div>

                  {mode !== 'magic' && (
                    <div className="relative">
                      <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-10 py-3.5 text-white font-mono text-xs focus:outline-none focus:border-white/20 transition-all placeholder-white/10"
                      />
                      <button onClick={() => setShowPassword(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  )}

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] font-mono text-red-400">
                      {error}
                    </motion.div>
                  )}

                  <button onClick={handleSubmit} disabled={loading || !email}
                    className="w-full py-3.5 bg-white text-black rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>

                <p className="text-center text-[10px] font-mono text-white/20 mt-6 uppercase tracking-widest">
                  Your keys are encrypted and never shared
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}