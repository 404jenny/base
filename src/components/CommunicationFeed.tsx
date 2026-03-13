import React, { useState, useRef, useEffect } from 'react'
import { Message, Agent } from '../types'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../lib/utils'
import {
  MessageSquare, Brain, Zap, FileText, HelpCircle,
  Search, Pin, Archive, Download, Trash2,
  X, CheckCheck, Filter, MoreHorizontal,
  FolderOpen, Star, Clock, Hash, ArrowUp, Sparkles,
  Copy, Check, AlertCircle, SquarePen
} from 'lucide-react'

interface CommunicationFeedProps {
  messages: Message[]
  agents: Agent[]
  onIntervene: (message: Message) => void
  onBaseCommand?: (cmd: string) => void
  baseThinking?: boolean
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  pinned: boolean
  archived: boolean
  saved: boolean
}

interface PinnedMessage {
  messageId: string
  pinnedAt: number
}

type FilterMode = 'all' | 'pinned' | 'saved' | 'archived'
type SidePanel = null | 'search' | 'conversations' | 'pinned'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupIntoConversations(messages: Message[]): Conversation[] {
  if (!messages.length) return []
  const buckets: Message[][] = []
  let current: Message[] = []
  let lastTs = 0

  for (const msg of messages) {
    const ts = typeof msg.timestamp === 'number' ? msg.timestamp : Date.now()
    if (lastTs && ts - lastTs > 15 * 60 * 1000) {
      if (current.length) { buckets.push(current); current = [] }
    }
    current.push(msg)
    lastTs = ts
  }
  if (current.length) buckets.push(current)

  return buckets.reverse().map(msgs => {
    const firstUser = msgs.find(m => m.senderId === 'user')
    const title = firstUser
      ? firstUser.content.slice(0, 58) + (firstUser.content.length > 58 ? '…' : '')
      : 'Conversation'
    const ts = typeof msgs[0].timestamp === 'number' ? msgs[0].timestamp : Date.now()
    const lastMsgTs: number = typeof msgs[msgs.length - 1].timestamp === 'number' ? msgs[msgs.length - 1].timestamp as number : Date.now()
    return { id: 'conv_' + ts, title, messages: msgs, createdAt: ts, updatedAt: lastMsgTs, pinned: false, archived: false, saved: false }
  })
}

function safeFormat(ts: any, fmt: string): string {
  try {
    const d = new Date(typeof ts === 'number' ? ts : Date.now())
    if (isNaN(d.getTime())) return '--:--'
    return format(d, fmt)
  } catch { return '--:--' }
}

function typeColor(type: Message['type']) {
  switch (type) {
    case 'thought': return 'text-purple-400'
    case 'action': return 'text-blue-400'
    case 'handoff': return 'text-emerald-400'
    case 'question': return 'text-amber-400'
    default: return 'text-white/50'
  }
}

function typeIcon(type: Message['type']) {
  switch (type) {
    case 'thought': return <Brain size={10} />
    case 'action': return <Zap size={10} />
    case 'handoff': return <FileText size={10} />
    case 'question': return <HelpCircle size={10} />
    default: return <MessageSquare size={10} />
  }
}

function agentColor(agents: Agent[], senderId: string): string {
  if (senderId === 'user') return '#e5e7eb'
  if (senderId === 'base') return '#a78bfa'
  return agents.find(a => a.id === senderId)?.color || '#4b5563'
}

// ─── Pipeline Bar ─────────────────────────────────────────────────────────────

const STAGES = ['Queued', 'Routing', 'Executing', 'Complete']

function PipelineBar({ active, onDismiss }: { active: boolean; onDismiss: () => void }) {
  const [stage, setStage] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const start = useRef(Date.now())

  useEffect(() => {
    if (!active) return
    setStage(0); setElapsed(0); start.current = Date.now()
    const t1 = setTimeout(() => setStage(1), 300)
    const t2 = setTimeout(() => setStage(2), 900)
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start.current) / 1000)), 250)
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(timer) }
  }, [active])

  useEffect(() => {
    if (!active && stage === 2) {
      setStage(3)
      const t = setTimeout(onDismiss, 2500)
      return () => clearTimeout(t)
    }
  }, [active, stage])

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      className="mx-6 mb-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
      {STAGES.map((s, i) => (
        <React.Fragment key={s || Math.random().toString()}>
          <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all',
            i === stage ? 'bg-white/10 text-white' : i < stage ? 'text-emerald-400' : 'text-white/20')}>
            {i < stage ? <CheckCheck size={9} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
            {s}
          </div>
          {i < STAGES.length - 1 && <div className={cn('flex-1 h-px', i < stage ? 'bg-emerald-400/30' : 'bg-white/8')} />}
        </React.Fragment>
      ))}
      <span className="text-[9px] font-mono text-white/20 shrink-0">{elapsed}s</span>
    </motion.div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({ message, agents, pinned, onPin, onCopy, onIntervene }: {
  message: Message; agents: Agent[]; pinned: boolean
  onPin: () => void; onCopy: () => void; onIntervene: () => void
}) {
  const [hover, setHover] = useState(false)
  const [copied, setCopied] = useState(false)
  const isUser = message.senderId === 'user'
  const isBase = message.senderId === 'base'
  const color = agentColor(agents, message.senderId)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {})
    onCopy(); setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>

      {/* Avatar */}
      <div className="w-7 h-7 rounded-xl shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold shadow-md"
        style={{ backgroundColor: color, color: '#000' }}>
        {isUser ? 'U' : isBase ? '⬡' : message.senderName.charAt(0)}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col gap-1 max-w-[76%] min-w-0 overflow-hidden', isUser ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] font-mono text-white/35">{isUser ? 'You' : message.senderName}</span>
          <span className={cn('flex items-center gap-1 text-[9px] font-mono uppercase', typeColor(message.type))}>
            {typeIcon(message.type)}{message.type}
          </span>
          <span className="text-[9px] font-mono text-white/20">{safeFormat(message.timestamp, 'HH:mm')}</span>
          {pinned && <Pin size={9} className="text-amber-400" />}
        </div>

        <div className={cn('relative px-4 py-3 rounded-2xl text-[12px] font-mono leading-relaxed transition-colors w-full overflow-hidden',
          isUser ? 'bg-white/10 text-white rounded-tr-sm'
            : isBase ? 'bg-purple-500/8 border border-purple-500/12 text-white/85 rounded-tl-sm'
              : 'bg-white/[0.03] border border-white/5 text-white/75 rounded-tl-sm')}>

          <p className="whitespace-pre-wrap break-all overflow-hidden w-full" style={{ overflowWrap: 'anywhere' }}>{message.content}</p>

          {message.reasoning && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain size={10} className="text-purple-400" />
                <span className="text-[9px] font-mono text-purple-400 uppercase tracking-widest">Reasoning</span>
              </div>
              <p className="text-white/30 text-[10px] font-mono italic leading-relaxed">{message.reasoning}</p>
            </div>
          )}

          {/* Hover actions */}
          <AnimatePresence>
            {hover && (
              <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                className={cn('absolute -top-8 flex items-center gap-0.5 bg-[#0e0e0e] border border-white/10 rounded-xl p-1 shadow-2xl z-20',
                  isUser ? 'right-0' : 'left-0')}>
                {[
                  { icon: copied ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />, fn: handleCopy, tip: 'Copy' },
                  { icon: <Pin size={11} className={pinned ? 'text-amber-400' : ''} />, fn: onPin, tip: pinned ? 'Unpin' : 'Pin' },
                  { icon: <Brain size={11} />, fn: onIntervene, tip: 'Intervene' },
                ].map((b, i) => (
                  <button key={i} onClick={b.fn} title={b.tip}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/10 transition-all">
                    {b.icon}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConvRow({ conv, active, onSelect, onPin, onSave, onArchive, onDelete }: {
  conv: Conversation & Partial<Conversation>; active: boolean
  onSelect: () => void; onPin: () => void; onSave: () => void
  onArchive: () => void; onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)

  return (
    <div onClick={onSelect}
      className={cn('group relative rounded-xl cursor-pointer transition-all', active ? 'bg-white/10' : 'hover:bg-white/[0.04]')}>
      <div className="flex items-start gap-2.5 p-3">
        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
          {conv.saved ? <Star size={10} className="text-amber-400" />
            : conv.pinned ? <Pin size={10} className="text-blue-400" />
              : conv.archived ? <Archive size={10} className="text-white/25" />
                : <Hash size={10} className="text-white/20" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[11px] font-mono truncate', active ? 'text-white' : 'text-white/55')}>{conv.title}</p>
          <p className="text-[9px] font-mono text-white/20 mt-0.5">
            {conv.messages.length} msgs · {safeFormat(conv.updatedAt, 'MMM d, HH:mm')}
          </p>
        </div>
        <button onClick={e => { e.stopPropagation(); setMenu(p => !p) }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-white/20 hover:text-white hover:bg-white/10 transition-all">
          <MoreHorizontal size={11} />
        </button>
      </div>

      <AnimatePresence>
        {menu && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute right-1 top-10 z-30 bg-[#0e0e0e] border border-white/10 rounded-xl p-1 shadow-2xl w-36"
            onClick={e => e.stopPropagation()}>
            {[
              { icon: <Pin size={10} />, label: conv.pinned ? 'Unpin' : 'Pin', fn: () => { onPin(); setMenu(false) } },
              { icon: <Star size={10} />, label: conv.saved ? 'Unsave' : 'Save', fn: () => { onSave(); setMenu(false) } },
              { icon: <Archive size={10} />, label: conv.archived ? 'Unarchive' : 'Archive', fn: () => { onArchive(); setMenu(false) } },
              { icon: <Trash2 size={10} />, label: 'Delete', fn: () => { onDelete(); setMenu(false) }, danger: true },
            ].map(item => (
              <button key={item.label} onClick={item.fn}
                className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-mono transition-colors',
                  item.danger ? 'text-red-400/60 hover:text-red-400 hover:bg-red-500/5' : 'text-white/35 hover:text-white hover:bg-white/5')}>
                {item.icon}{item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export const CommunicationFeed: React.FC<CommunicationFeedProps> = ({
  messages, agents, onIntervene, onBaseCommand, baseThinking = false
}) => {
  const [input, setInput] = useState('')
  const [sidePanel, setSidePanel] = useState<SidePanel>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [newConvMode, setNewConvMode] = useState(false)
  const [pinnedMsgs, setPinnedMsgs] = useState<PinnedMessage[]>([])
  const [convMeta, setConvMeta] = useState<Record<string, Partial<Conversation>>>({})
  const [showPipeline, setShowPipeline] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  // Track if user has scrolled up manually
  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    userScrolledUp.current = distFromBottom > 80
  }

  // Only auto-scroll if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])
  useEffect(() => { if (baseThinking) setShowPipeline(true) }, [baseThinking])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000) }

  // Build conversations merging with meta overrides
  const allConvs: Conversation[] = groupIntoConversations(messages).map(c => ({ ...c, ...convMeta[c.id] }))

  const activeConv = activeConvId ? allConvs.find(c => c.id === activeConvId) ?? null : null
  const displayMsgs = newConvMode ? [] : (activeConv ? activeConv.messages : messages)

  // Exit new conv mode when first message arrives
  const prevMsgCount = React.useRef(messages.length)
  useEffect(() => {
    if (newConvMode && messages.length > prevMsgCount.current) {
      setNewConvMode(false)
    }
    prevMsgCount.current = messages.length
  }, [messages.length, newConvMode])

  const visibleConvs = allConvs.filter(c => {
    if (filterMode === 'pinned') return c.pinned
    if (filterMode === 'saved') return c.saved
    if (filterMode === 'archived') return c.archived
    return !c.archived
  })

  const searchResults = searchQuery.length > 1
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  const setMeta = (id: string, field: keyof Conversation, val: any) =>
    setConvMeta(p => ({ ...p, [id]: { ...p[id], [field]: val } }))

  const toggleMeta = (id: string, field: 'pinned' | 'saved' | 'archived') =>
    setMeta(id, field, !(convMeta[id]?.[field] ?? false))

  const togglePin = (msgId: string) =>
    setPinnedMsgs(p => p.find(x => x.messageId === msgId)
      ? p.filter(x => x.messageId !== msgId)
      : [...p, { messageId: msgId, pinnedAt: Date.now() }])

  const handleSend = () => {
    if (!input.trim() || !onBaseCommand) return
    setNewConvMode(false)
    setActiveConvId(null)
    onBaseCommand(input.trim()); setInput('')
  }

  const handleExport = () => {
    const data = { exportedAt: new Date().toISOString(), conversations: allConvs.map(c => ({ title: c.title, createdAt: new Date(c.createdAt).toISOString(), messages: c.messages.map(m => ({ sender: m.senderName, content: m.content, type: m.type, timestamp: new Date(typeof m.timestamp === 'number' ? m.timestamp : Date.now()).toISOString() })) })) }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `base-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
    showToast('Conversations exported')
  }

  const pinnedMsgObjects = pinnedMsgs
    .map(p => messages.find(m => m.id === p.messageId))
    .filter(Boolean) as Message[]

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ── Side Panel ── */}
      <AnimatePresence>
        {sidePanel && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 272, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="shrink-0 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col overflow-hidden">

            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 shrink-0">
              <span className="text-[10px] font-mono text-white/35 uppercase tracking-widest">
                {sidePanel === 'search' ? 'Search' : sidePanel === 'conversations' ? 'Conversations' : 'Pinned Messages'}
              </span>
              {sidePanel === 'conversations' && (
                <button
                  onClick={() => { setActiveConvId(null); setNewConvMode(true); setSidePanel(null) }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-white/30 hover:text-white hover:bg-white/10 transition-all"
                  title="Start new conversation"
                >
                  <SquarePen size={10} />
                  <span className="text-[9px] font-mono uppercase tracking-wider">New</span>
                </button>
              )}
              <button onClick={() => setSidePanel(null)} className="text-white/20 hover:text-white/60 transition-colors"><X size={12} /></button>
            </div>

            {/* Search */}
            {sidePanel === 'search' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="p-3 border-b border-white/5 shrink-0">
                  <div className="relative">
                    <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                    <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search all messages..."
                      className="w-full bg-white/[0.03] border border-white/8 rounded-xl pl-8 pr-3 py-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-white/20 placeholder-white/15 transition-all" />
                  </div>
                </div>
                <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {searchQuery.length > 1 && searchResults.length === 0 && (
                    <p className="text-center text-[10px] font-mono text-white/20 py-10">No results for "{searchQuery}"</p>
                  )}
                  {searchResults.map(msg => (
                    <div key={msg.id || msg.timestamp?.toString() || Math.random().toString()} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] cursor-pointer transition-all">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-mono text-white/35">{msg.senderName}</span>
                        <span className="text-[9px] font-mono text-white/20">{safeFormat(msg.timestamp, 'MMM d · HH:mm')}</span>
                      </div>
                      <p className="text-[10px] font-mono text-white/55 leading-relaxed line-clamp-3">
                        {msg.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                          part.toLowerCase() === searchQuery.toLowerCase()
                            ? <mark key={i} className="bg-amber-400/25 text-amber-200 rounded px-0.5 not-italic">{part}</mark>
                            : part
                        )}
                      </p>
                    </div>
                  ))}
                  {!searchQuery && (
                    <div className="py-10 text-center">
                      <Search size={18} className="text-white/10 mx-auto mb-2" />
                      <p className="text-[10px] font-mono text-white/20">Type to search messages</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conversations */}
            {sidePanel === 'conversations' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex gap-0.5 p-2 border-b border-white/5 shrink-0">
                  {(['all', 'pinned', 'saved', 'archived'] as FilterMode[]).map(f => (
                    <button key={f} onClick={() => setFilterMode(f)}
                      className={cn('flex-1 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wide transition-all',
                        filterMode === f ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/45')}>
                      {f}
                    </button>
                  ))}
                </div>
                <div className="px-2 pt-2 shrink-0">
                  <button onClick={handleExport}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] text-white/25 hover:text-white/60 transition-all">
                    <Download size={10} />
                    <span className="text-[9px] font-mono uppercase tracking-wider">Export conversations</span>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 mt-1">
                  {visibleConvs.length === 0 && (
                    <p className="text-center text-[10px] font-mono text-white/20 py-10">
                      {filterMode === 'all' ? 'No conversations yet' : `No ${filterMode} conversations`}
                    </p>
                  )}
                  {visibleConvs.map(conv => (
                    <div key={conv.id || conv.title}>
                    <ConvRow
                      conv={conv}
                      active={activeConvId === conv.id}
                      onSelect={() => setActiveConvId(activeConvId === conv.id ? null : conv.id)}
                      onPin={() => { toggleMeta(conv.id, 'pinned'); showToast(conv.pinned ? 'Unpinned' : 'Conversation pinned') }}
                      onSave={() => { toggleMeta(conv.id, 'saved'); showToast(conv.saved ? 'Removed from saved' : 'Conversation saved') }}
                      onArchive={() => { toggleMeta(conv.id, 'archived'); if (activeConvId === conv.id) setActiveConvId(null); showToast(conv.archived ? 'Unarchived' : 'Conversation archived') }}
                      onDelete={() => { setConvMeta(p => ({ ...p, [conv.id]: { ...p[conv.id], archived: true } })); if (activeConvId === conv.id) setActiveConvId(null) }}
                    />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pinned messages */}
            {sidePanel === 'pinned' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {pinnedMsgObjects.length === 0 ? (
                  <div className="py-10 text-center">
                    <Pin size={18} className="text-white/10 mx-auto mb-2" />
                    <p className="text-[10px] font-mono text-white/20">No pinned messages</p>
                    <p className="text-[9px] font-mono text-white/12 mt-1">Hover any message to pin it</p>
                  </div>
                ) : pinnedMsgObjects.map(msg => (
                  <div key={msg.id || msg.timestamp?.toString() || Math.random().toString()} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-amber-400/60">{msg.senderName}</span>
                        <span className="text-[9px] font-mono text-white/20">{safeFormat(msg.timestamp, 'MMM d')}</span>
                      </div>
                      <button onClick={() => togglePin(msg.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all">
                        <X size={10} />
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-white/55 leading-relaxed line-clamp-4">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {activeConv ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 min-w-0">
                <Hash size={10} className="text-white/25 shrink-0" />
                <span className="text-[10px] font-mono text-white/55 truncate max-w-[180px]">{activeConv.title}</span>
                <button onClick={() => setActiveConvId(null)} className="text-white/20 hover:text-white/60 transition-colors shrink-0 ml-1"><X size={10} /></button>
              </div>
            ) : (
              <div>
                <h2
                  className="text-white font-mono text-[11px] uppercase tracking-[0.25em] font-bold cursor-pointer hover:text-white/70 transition-colors"
                  onClick={() => { setActiveConvId(null); setNewConvMode(false) }}
                  title="Back to live feed"
                >Communication Layer</h2>
                <p className="text-white/20 text-[9px] font-mono uppercase mt-0.5 tracking-wider">
                  {messages.length} messages · {allConvs.filter(c => !c.archived).length} conversations
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Agent dots */}
            <div className="flex -space-x-1.5 mr-1">
              {agents.slice(0, 5).map(a => (
                <div key={a.id || a.name} title={a.name}
                  className="w-5 h-5 rounded-lg border border-black/60 flex items-center justify-center text-[8px] font-bold"
                  style={{ backgroundColor: a.color, color: '#000' }}>
                  {a.name.charAt(0)}
                </div>
              ))}
            </div>

            {([
              { panel: 'search' as SidePanel, icon: <Search size={13} />, tip: 'Search messages' },
              { panel: 'conversations' as SidePanel, icon: <FolderOpen size={13} />, tip: 'Conversations' },
              { panel: 'pinned' as SidePanel, icon: <Pin size={13} />, tip: 'Pinned', badge: pinnedMsgs.length },
            ]).map(b => (
              <button key={b.panel} onClick={() => setSidePanel(sidePanel === b.panel ? null : b.panel)} title={b.tip}
                className={cn('relative w-7 h-7 flex items-center justify-center rounded-xl transition-all',
                  sidePanel === b.panel ? 'bg-white/12 text-white' : 'text-white/22 hover:text-white/60 hover:bg-white/6')}>
                {b.icon}
                {b.badge ? <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-[8px] font-bold text-black flex items-center justify-center">{b.badge}</span> : null}
              </button>
            ))}

            <button onClick={handleExport} title="Export" className="w-7 h-7 flex items-center justify-center rounded-xl text-white/22 hover:text-white/60 hover:bg-white/6 transition-all">
              <Download size={13} />
            </button>
          </div>
        </div>

        {/* Pipeline */}
        <AnimatePresence>
          {showPipeline && (
            <div className="pt-3 shrink-0">
              <PipelineBar active={baseThinking} onDismiss={() => setShowPipeline(false)} />
            </div>
          )}
        </AnimatePresence>

        {/* Active conv banner */}
        <AnimatePresence>
          {activeConv && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="shrink-0 overflow-hidden">
              <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center gap-3">
                <Clock size={10} className="text-blue-400/60 shrink-0" />
                <p className="text-[10px] font-mono text-blue-300/60 flex-1 truncate">
                  <span className="text-blue-200/75">{activeConv.title}</span>
                  <span className="text-blue-300/35 ml-2">· {activeConv.messages.length} msgs · {safeFormat(activeConv.createdAt, 'MMM d, HH:mm')}</span>
                </p>
                <div className="flex items-center gap-0.5 shrink-0">
                  {[
                    { icon: <Pin size={10} />, active: activeConv.pinned, fn: () => { toggleMeta(activeConv.id, 'pinned'); showToast(activeConv.pinned ? 'Unpinned' : 'Pinned') }, tip: 'Pin' },
                    { icon: <Star size={10} />, active: activeConv.saved, fn: () => { toggleMeta(activeConv.id, 'saved'); showToast(activeConv.saved ? 'Unsaved' : 'Saved') }, tip: 'Save' },
                    { icon: <Archive size={10} />, active: activeConv.archived, fn: () => { toggleMeta(activeConv.id, 'archived'); setActiveConvId(null) }, tip: 'Archive' },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.fn} title={btn.tip}
                      className={cn('w-6 h-6 flex items-center justify-center rounded-lg transition-all',
                        btn.active ? 'text-blue-400 bg-blue-500/10' : 'text-white/20 hover:text-white/60 hover:bg-white/8')}>
                      {btn.icon}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {newConvMode ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
              <SquarePen size={24} className="text-white/20" />
              <p className="text-[11px] font-mono text-white/30 uppercase tracking-widest">New conversation</p>
              <p className="text-[10px] font-mono text-white/15">Send a message to base below</p>
            </div>
          ) : displayMsgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
              <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <Sparkles size={16} className="text-white/20" />
              </div>
              <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest">Send a command to base</p>
            </div>
          ) : displayMsgs.map(msg => (
            <div key={msg.id || msg.timestamp?.toString() || Math.random().toString()}>
            <Bubble
              message={msg}
              agents={agents}
              pinned={pinnedMsgs.some(p => p.messageId === msg.id)}
              onPin={() => { togglePin(msg.id); showToast(pinnedMsgs.some(p => p.messageId === msg.id) ? 'Unpinned' : 'Message pinned') }}
              onCopy={() => showToast('Copied')}
              onIntervene={() => onIntervene(msg)}
            />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/30 backdrop-blur-xl shrink-0">
          <div className="relative flex items-center">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={baseThinking ? 'base is thinking…' : 'Send a command to base…'}
              disabled={baseThinking}
              className="w-full bg-white/[0.03] border border-white/8 rounded-2xl px-5 py-3.5 pr-12 text-white font-mono text-[12px] focus:outline-none focus:border-white/18 transition-all placeholder-white/15 disabled:opacity-40"
            />
            <button onClick={handleSend} disabled={!input.trim() || baseThinking}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-xl bg-white/8 text-white/35 hover:bg-white hover:text-black disabled:opacity-20 transition-all">
              {baseThinking
                ? <span className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                : <ArrowUp size={13} />}
            </button>
          </div>
          <p className="text-[9px] font-mono text-white/12 mt-2 px-1">
            ↵ send · hover message to pin, copy, or intervene
            {activeConvId && <span className="text-blue-400/40 ml-3">Viewing past conversation</span>}
          </p>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-[#111] border border-white/10 rounded-xl shadow-xl backdrop-blur-xl">
            <Check size={11} className="text-emerald-400" />
            <span className="text-[11px] font-mono text-white/70">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}