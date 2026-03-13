import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Key, User, Palette, Bell, Bot, Download, Upload, Eye, EyeOff, Check, X, Save, LogOut, Trash2, Plus, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import { UserSettings } from '../lib/supabase'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  settings: UserSettings | null
  userEmail: string
  onSave: (settings: Partial<UserSettings>) => Promise<boolean>
  onSignOut: () => void
  onDeleteAccount?: () => Promise<void>
}

// ─── Key detection ────────────────────────────────────────────────────────────
interface DetectedKey {
  field: keyof UserSettings
  label: string
  provider: string
  category: 'ai' | 'integration'
  color: string
  dot: string
}

function detectKey(value: string): DetectedKey | null {
  if (!value || value.length < 8) return null
  const v = value.trim()

  // AI model keys
  if (v.startsWith('sk-ant-'))
    return { field: 'anthropic_key', label: 'Anthropic — Claude', provider: 'Anthropic', category: 'ai', color: 'amber', dot: '#f59e0b' }
  if (v.startsWith('AIza'))
    return { field: 'gemini_key', label: 'Google — Gemini', provider: 'Google', category: 'ai', color: 'blue', dot: '#60a5fa' }
  if (v.startsWith('sk-') || v.startsWith('sk-proj-'))
    return { field: 'openai_key', label: 'OpenAI — GPT', provider: 'OpenAI', category: 'ai', color: 'emerald', dot: '#10b981' }

  // Integration keys
  if (v.startsWith('key_') || (v.startsWith('pat') && v.includes('.')))
    return { field: 'airtable_key', label: 'Airtable', provider: 'Airtable', category: 'integration', color: 'yellow', dot: '#fbbf24' }
  if (v.startsWith('xoxb-') || v.startsWith('xoxp-') || v.startsWith('xapp-'))
    return { field: 'slack_key', label: 'Slack', provider: 'Slack', category: 'integration', color: 'purple', dot: '#a855f7' }
  if (v.startsWith('secret_') || v.startsWith('ntn_') || (v.length === 50 && v.match(/^[a-f0-9]+$/)))
    return { field: 'notion_key', label: 'Notion', provider: 'Notion', category: 'integration', color: 'white', dot: '#ffffff' }

  return { field: 'anthropic_key', label: 'Unknown Provider', provider: 'Unknown', category: 'ai', color: 'gray', dot: '#6b7280' }
}

const DOT_COLORS: Record<string, string> = {
  amber: 'text-amber-400 border-amber-500/25 bg-amber-500/5',
  blue: 'text-blue-400 border-blue-500/25 bg-blue-500/5',
  yellow: 'text-yellow-400 border-yellow-500/25 bg-yellow-500/5',
  purple: 'text-purple-400 border-purple-500/25 bg-purple-500/5',
  white: 'text-white/70 border-white/15 bg-white/5',
  gray: 'text-white/30 border-white/10 bg-white/[0.02]',
  emerald: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5',
  indigo: 'text-indigo-400 border-indigo-500/25 bg-indigo-500/5',
}

const TABS = [
  { id: 'keys', label: 'API Keys', icon: Key },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'agents', label: 'Agent Defaults', icon: Bot },
  { id: 'data', label: 'Import / Export', icon: Download },
]

// ─── Smart key input ──────────────────────────────────────────────────────────
function SmartKeyInput({ onDetect }: { onDetect: (field: keyof UserSettings, value: string) => void }) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const detected = value.length > 8 ? detectKey(value) : null
  const isUnknown = detected?.provider === 'Unknown'

  const handleAdd = () => {
    if (!detected || isUnknown || !value.trim()) return
    onDetect(detected.field, value.trim())
    setAdded(detected.label)
    setValue('')
    setTimeout(() => setAdded(null), 2500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste any API key — provider is detected automatically"
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 pr-20 text-white font-mono text-xs focus:outline-none focus:border-white/25 transition-all placeholder-white/15"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button onClick={() => setShow(p => !p)} className="text-white/20 hover:text-white/50 transition-colors">
            {show ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            onClick={handleAdd}
            disabled={!detected || isUnknown || !value.trim()}
            className="text-white/20 hover:text-white/60 disabled:opacity-20 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {added ? (
          <motion.div key="added" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Check size={11} className="text-emerald-400" />
            <span className="text-[10px] font-mono text-emerald-400">{added} key added</span>
          </motion.div>
        ) : detected && value.length > 8 ? (
          <motion.div key="detected" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border', DOT_COLORS[detected.color])}>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: detected.dot }} />
            <span className="text-[10px] font-mono flex-1">
              {isUnknown ? 'Provider not recognized' : `Detected: ${detected.label}`}
            </span>
            {detected.category === 'integration' && !isUnknown && (
              <span className="text-[9px] font-mono opacity-50 uppercase tracking-wider">Integration</span>
            )}
            {isUnknown && <AlertCircle size={10} className="shrink-0 opacity-60" />}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ─── Key row ──────────────────────────────────────────────────────────────────
function KeyRow({ label, dot, value, onRemove }: {
  label: string; dot: string; value: string; onRemove: () => void
}) {
  const [show, setShow] = useState(false)
  const masked = value ? (value.slice(0, 10) + '••••••' + value.slice(-4)) : ''

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 group">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-xs font-mono text-white/60 truncate">{show ? value : masked}</p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setShow(p => !p)} className="text-white/20 hover:text-white/60 transition-colors">
          {show ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
        <button onClick={onRemove} className="text-red-400/40 hover:text-red-400 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
      <Check size={11} className="text-emerald-400 shrink-0" />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Settings: React.FC<SettingsProps> = ({
  isOpen, onClose, settings, userEmail, onSave, onSignOut, onDeleteAccount
}) => {
  const [activeTab, setActiveTab] = useState('keys')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const [anthropicKey, setAnthropicKey] = useState(settings?.anthropic_key || '')
  const [geminiKey, setGeminiKey] = useState(settings?.gemini_key || '')
  const [openaiKey, setOpenaiKey] = useState(settings?.openai_key || '')
  const [airtableKey, setAirtableKey] = useState(settings?.airtable_key || '')
  const [slackKey, setSlackKey] = useState(settings?.slack_key || '')
  const [notionKey, setNotionKey] = useState(settings?.notion_key || '')
  const [defaultModel, setDefaultModel] = useState(settings?.default_model || 'claude')
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings?.notifications_enabled ?? true)
  const [displayName, setDisplayName] = useState(userEmail.split('@')[0])

  const handleDetectedKey = (field: keyof UserSettings, value: string) => {
    if (field === 'anthropic_key') setAnthropicKey(value)
    else if (field === 'gemini_key') setGeminiKey(value)
    else if (field === 'openai_key') setOpenaiKey(value)
    else if (field === 'airtable_key') setAirtableKey(value)
    else if (field === 'slack_key') setSlackKey(value)
    else if (field === 'notion_key') setNotionKey(value)
  }

  const handleSave = async () => {
    setSaving(true)
    const ok = await onSave({
      anthropic_key: anthropicKey || null,
      gemini_key: geminiKey || null,
      openai_key: openaiKey || null,
      airtable_key: airtableKey || null,
      slack_key: slackKey || null,
      notion_key: notionKey || null,
      default_model: defaultModel as 'claude' | 'gemini',
      notifications_enabled: notificationsEnabled,
    })
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  const handleExport = () => {
    const data = {
      anthropic_key: anthropicKey, gemini_key: geminiKey,
      airtable_key: airtableKey, slack_key: slackKey, notion_key: notionKey, openai_key: openaiKey,
      default_model: defaultModel, exported_at: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'base-settings.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (data.anthropic_key) setAnthropicKey(data.anthropic_key)
        if (data.gemini_key) setGeminiKey(data.gemini_key)
        if (data.openai_key) setOpenaiKey(data.openai_key)
        if (data.airtable_key) setAirtableKey(data.airtable_key)
        if (data.slack_key) setSlackKey(data.slack_key)
        if (data.notion_key) setNotionKey(data.notion_key)
        if (data.default_model) setDefaultModel(data.default_model)
      } catch {}
    }
    reader.readAsText(file)
  }

  const handleDeleteAccount = async () => {
    if (!onDeleteAccount) return
    setDeletingAccount(true)
    await onDeleteAccount()
    setDeletingAccount(false)
  }

  if (!isOpen) return null

  // Build saved keys grouped
  const aiKeys = [
    anthropicKey && { label: 'Anthropic — Claude', dot: '#f59e0b', value: anthropicKey, field: 'anthropic_key' as keyof UserSettings },
    geminiKey && { label: 'Google — Gemini', dot: '#60a5fa', value: geminiKey, field: 'gemini_key' as keyof UserSettings },
    openaiKey && { label: 'OpenAI — GPT', dot: '#10b981', value: openaiKey, field: 'openai_key' as keyof UserSettings },
  ].filter(Boolean) as { label: string; dot: string; value: string; field: keyof UserSettings }[]

  const integrationKeys = [
    airtableKey && { label: 'Airtable', dot: '#fbbf24', value: airtableKey, field: 'airtable_key' as keyof UserSettings },
    slackKey && { label: 'Slack', dot: '#a855f7', value: slackKey, field: 'slack_key' as keyof UserSettings },
    notionKey && { label: 'Notion', dot: '#ffffff', value: notionKey, field: 'notion_key' as keyof UserSettings },
  ].filter(Boolean) as { label: string; dot: string; value: string; field: keyof UserSettings }[]

  const removeKey = (field: keyof UserSettings) => {
    if (field === 'anthropic_key') setAnthropicKey('')
    else if (field === 'gemini_key') setGeminiKey('')
    else if (field === 'openai_key') setOpenaiKey('')
    else if (field === 'airtable_key') setAirtableKey('')
    else if (field === 'slack_key') setSlackKey('')
    else if (field === 'notion_key') setNotionKey('')
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div key="settings-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        <motion.div key="settings-panel" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-3xl h-[640px] bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex"
        >
          {/* Sidebar */}
          <div className="w-52 border-r border-white/5 flex flex-col py-6 shrink-0">
            <div className="px-6 mb-6">
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Settings</p>
            </div>
            <nav className="flex-1 px-3 space-y-1">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left',
                    activeTab === tab.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white hover:bg-white/5'
                  )}
                >
                  <tab.icon size={14} />
                  <span className="font-mono text-[11px] uppercase tracking-widest">{tab.label}</span>
                </button>
              ))}
            </nav>
            <div className="px-3 mt-4 space-y-1">
              <button onClick={onSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all"
              >
                <LogOut size={14} />
                <span className="font-mono text-[11px] uppercase tracking-widest">Sign Out</span>
              </button>
              {onDeleteAccount && (
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600/40 hover:text-red-500 hover:bg-red-500/5 transition-all"
                >
                  <Trash2 size={14} />
                  <span className="font-mono text-[11px] uppercase tracking-widest">Delete Account</span>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 shrink-0">
              <h2 className="text-white font-mono text-sm font-bold uppercase tracking-widest">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <AnimatePresence mode="wait">

                {activeTab === 'keys' && (
                  <motion.div key="keys" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">

                    {/* Smart detector */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={12} className="text-purple-400" />
                        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Smart Key Detector</span>
                      </div>
                      <SmartKeyInput onDetect={handleDetectedKey} />
                      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-2">
                        {[
                          { label: 'Anthropic', hint: 'sk-ant-...', dot: '#f59e0b' },
                          { label: 'Gemini', hint: 'AIza...', dot: '#60a5fa' },
                          { label: 'Airtable', hint: 'key_ or pat...', dot: '#fbbf24' },
                          { label: 'Slack', hint: 'xoxb-...', dot: '#a855f7' },
                          { label: 'Notion', hint: 'secret_...', dot: '#ffffff' },
                        ].map(p => (
                          <div key={p.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.02]">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.dot }} />
                            <span className="text-[9px] font-mono text-white/30 truncate">{p.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Keys */}
                    {aiKeys.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest px-1">AI Models</p>
                        {aiKeys.map((k, i) => (
                          <div key={(k.field as string) || i}>
                            <KeyRow label={k.label} dot={k.dot} value={k.value} onRemove={() => removeKey(k.field)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Integration Keys */}
                    {integrationKeys.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest px-1">Integrations</p>
                        {integrationKeys.map((k, i) => (
                          <div key={(k.field as string) || i}>
                            <KeyRow label={k.label} dot={k.dot} value={k.value} onRemove={() => removeKey(k.field)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {aiKeys.length === 0 && integrationKeys.length === 0 && (
                      <div className="py-8 text-center">
                        <Key size={20} className="text-white/10 mx-auto mb-3" />
                        <p className="text-[11px] font-mono text-white/20">No keys added yet</p>
                        <p className="text-[10px] font-mono text-white/10 mt-1">Paste any API key above to get started</p>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-[10px] font-mono text-emerald-400/60 leading-relaxed">Keys are encrypted and stored in your account. Hit Save to persist.</p>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'profile' && (
                  <motion.div key="profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest block mb-3">Display Name</label>
                      <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-white/20 transition-all"
                      />
                    </div>
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest block mb-3">Email</label>
                      <p className="text-white/60 font-mono text-xs">{userEmail}</p>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'appearance' && (
                  <motion.div key="appearance" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest block mb-4">Theme</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['dark', 'light'].map(t => (
                          <button key={t} className={cn('py-3 rounded-xl border font-mono text-xs uppercase tracking-widest transition-all',
                            t === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed')}>
                            {t}{t === 'light' && ' (soon)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'notifications' && (
                  <motion.div key="notifications" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div>
                        <p className="text-white font-mono text-xs font-bold">Agent task completed</p>
                        <p className="text-white/30 font-mono text-[10px] mt-0.5">Notify when an agent finishes a task</p>
                      </div>
                      <button onClick={() => setNotificationsEnabled(p => !p)}
                        className={cn('w-10 h-5 rounded-full transition-all relative', notificationsEnabled ? 'bg-emerald-500' : 'bg-white/10')}
                      >
                        <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', notificationsEnabled ? 'left-5' : 'left-0.5')} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'agents' && (
                  <motion.div key="agents" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest block mb-4">Default AI Model</label>
                      <div className="grid grid-cols-2 gap-3">
                        {(['claude', 'gemini'] as const).map(m => (
                          <button key={m} onClick={() => setDefaultModel(m)}
                            className={cn('py-3 rounded-xl border font-mono text-xs font-bold uppercase tracking-widest transition-all',
                              defaultModel === m ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/10 hover:border-white/20'
                            )}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                      <p className="text-[10px] font-mono text-indigo-400/70">BASE will use this model when routing commands unless you specify otherwise.</p>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'data' && (
                  <motion.div key="data" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                    <button onClick={handleExport}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <Download size={18} className="text-white/40" />
                      <div>
                        <p className="text-white font-mono text-xs font-bold">Export Settings</p>
                        <p className="text-white/30 font-mono text-[10px] mt-0.5">Download all keys and preferences as JSON</p>
                      </div>
                    </button>
                    <label className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <Upload size={18} className="text-white/40" />
                      <div>
                        <p className="text-white font-mono text-xs font-bold">Import Settings</p>
                        <p className="text-white/30 font-mono text-[10px] mt-0.5">Load settings from a previously exported JSON file</p>
                      </div>
                      <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                      <p className="text-[10px] font-mono text-amber-400/70 leading-relaxed">Exported files contain all your API keys. Keep them secure.</p>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-white/5 flex items-center justify-end gap-3 shrink-0">
              <button onClick={onClose} className="px-5 py-2.5 text-[10px] font-mono text-white/30 hover:text-white uppercase tracking-widest transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-white text-black rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-white/90 transition-all flex items-center gap-2 disabled:opacity-40"
              >
                {saving ? <span className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : saved ? <><Check size={12} /> Saved!</> : <><Save size={12} /> Save</>}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60" onClick={() => setShowDeleteConfirm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-[61] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-[#0A0A0A] border border-red-500/20 rounded-2xl p-6 shadow-2xl"
            >
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mb-4 mx-auto">
                <Trash2 size={14} className="text-red-400" />
              </div>
              <h3 className="text-white font-mono text-xs font-bold uppercase tracking-widest text-center mb-2">Delete Account</h3>
              <p className="text-white/40 font-mono text-[10px] text-center leading-relaxed mb-6">This will permanently delete your account and all data. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white font-mono text-[10px] uppercase tracking-widest transition-all">
                  Cancel
                </button>
                <button onClick={handleDeleteAccount} disabled={deletingAccount}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-mono text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                  {deletingAccount ? <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}