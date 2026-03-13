import React, { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ReporterPanel } from './components/ReporterPanel'
import { Dashboard } from './components/Dashboard'
import { CommunicationFeed } from './components/CommunicationFeed'
import { OrchestrationLayer } from './components/OrchestrationLayer'
import { TelemetryDashboard } from './components/TelemetryDashboard'
import { SystemAuditLogs } from './components/SystemAuditLogs'
import { AgentGraph } from './components/AgentGraph'
import { CommandPalette } from './components/CommandPalette'
import { InterventionModal } from './components/InterventionModal'
import { DeployAgentModal } from './components/DeployAgentModal'
import { MCPConnectionsModal } from './components/MCPConnectionsModal'
import { TitleBar } from './components/TitleBar'
import { Widget } from './components/Widget'
import { AuthPage } from './components/AuthPage'
import Onboarding from './components/Onboarding'
import { Settings } from './components/Settings'
import { useSidecar } from './hooks/useSidecar'
import { useAuth } from './hooks/useAuth'
import { motion, AnimatePresence } from 'motion/react'
import { Agent, Message } from './types'
import { invoke } from '@tauri-apps/api/core'
import { Settings as SettingsIcon, Plug } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)
  const [isWidgetMode, setIsWidgetMode] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMCPOpen, setIsMCPOpen] = useState(false)
  const [interventionContext, setInterventionContext] = useState<{ agent: Agent; message: Message } | null>(null)
  const [baseThinking, setBaseThinking] = useState(false)

  const { user, authState, settings, error, signIn, signUp, signInWithMagicLink, signOut, saveSettings, completeOnboarding, setError } = useAuth()
  const { connected, agents, tasks, messages, send, runAgent, sendToBase, pauseTask, resumeTask, cancelTask, createAgent, deleteAgent, connectAgent, refreshTasks, refreshMessages } = useSidecar()

  // Refresh tasks + messages on connect and periodically
  useEffect(() => {
    if (!connected) return
    refreshTasks()
    refreshMessages()
    const taskInterval = setInterval(refreshTasks, 10000)
    const msgInterval = setInterval(refreshMessages, 15000)
    return () => { clearInterval(taskInterval); clearInterval(msgInterval) }
  }, [connected, refreshTasks, refreshMessages])

  // Send API keys to sidecar whenever they're available
  useEffect(() => {
    if (!connected || !settings) return
    if (settings.anthropic_key || settings.gemini_key || settings.openai_key) {
      send('keys:set', {
        anthropic: settings.anthropic_key || '',
        gemini: settings.gemini_key || '',
        openai: settings.openai_key || '',
        airtable: settings.airtable_key || '',
        slack: settings.slack_key || '',
        notion: settings.notion_key || '',
      }).catch(() => {})
    }
  }, [connected, settings, send])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIsCommandPaletteOpen(prev => !prev) }
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIsDeployModalOpen(true) }
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIsSettingsOpen(true) }
      if (e.key === 'm' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIsMCPOpen(true) }
      if (e.key === 'Escape' && isWidgetMode) handleExpandFromWidget()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWidgetMode])

  // ── Transform sidecar messages into typed Message shape ──────────────────
  const feedMessages: Message[] = messages.map((m: any) => ({
    id: m.id,
    senderId: m.senderId || m.sender_id || 'base',
    senderName: m.senderName || m.sender_name || 'base',
    content: m.content || '',
    type: (
      m.messageType === 'result' || m.message_type === 'result' ? 'output'
      : m.messageType === 'thinking' || m.message_type === 'thinking' ? 'thought'
      : m.messageType === 'error' || m.message_type === 'error' ? 'action'
      : 'output'
    ) as Message['type'],
    timestamp: m.timestamp || (m.created_at ? m.created_at * 1000 : Date.now()),
    reasoning: m.reasoning,
    targetId: m.targetId || m.target_id,
  }))

  // ── Normalize sidecar agents into typed Agent shape ──────────────────────
  const normalizedAgents: Agent[] = agents.map((a: any) => ({
    id: a.id,
    name: a.name || 'Agent',
    type: a.type || a.model || 'claude',
    model: a.model,
    description: a.description,
    system_prompt: a.system_prompt,
    status: a.status || 'idle',
    currentTask: a.currentTask,
    progress: a.progress || 0,
    lastUpdate: a.lastUpdate || a.updated_at || new Date().toISOString(),
    color: a.color || '#6366f1',
    metrics: {
      cpu: a.metrics?.cpu || [],
      memory: a.metrics?.memory || [],
      tokens: tasks.filter((t: any) => t.agent_id === a.id).reduce((sum: number, t: any) => sum + (t.tokens_used || 0), 0) || a.metrics?.tokens || 0,
    }
  }))

  const handleEnterWidget = async () => {
    try { await invoke('set_widget_mode', { enabled: true }) } catch {}
    setIsWidgetMode(true)
  }

  const handleExpandFromWidget = async () => {
    try { await invoke('set_widget_mode', { enabled: false }) } catch {}
    setIsWidgetMode(false)
  }

  const handleIntervene = (message: Message) => {
    const agent = normalizedAgents.find(a => a.id === message.senderId)
    if (agent) setInterventionContext({ agent, message })
  }

  const handleBaseCommand = async (cmd: string) => {
    setBaseThinking(true)
    try { await sendToBase(cmd) } finally { setBaseThinking(false) }
  }

  const handleCommandPaletteAction = (id: string, action: string) => {
    if (id === 'deploy') { setIsDeployModalOpen(true); setIsCommandPaletteOpen(false); return }
    if (id === 'stop-all') {
      tasks.filter((t: any) => t.status === 'running').forEach((t: any) => cancelTask(t.id).catch(() => {}))
      setIsCommandPaletteOpen(false)
      return
    }
    if (id === 'pause-all') {
      tasks.filter((t: any) => t.status === 'running').forEach((t: any) => pauseTask(t.id).catch(() => {}))
      setIsCommandPaletteOpen(false)
      return
    }
    // Per-agent action: find the running task for this agent
    const agentTask = tasks.find((t: any) => t.agent_id === id && t.status === 'running')
    if (action === 'pause' && agentTask) pauseTask(agentTask.id).catch(() => {})
    else if (action === 'stop' && agentTask) cancelTask(agentTask.id).catch(() => {})
    else if (action === 'play') {
      const pausedTask = tasks.find((t: any) => t.agent_id === id && t.status === 'paused')
      if (pausedTask) resumeTask(pausedTask.id).catch(() => {})
    }
  }

  const handleDeploy = async (agentData: any) => {
    await createAgent({
      name: agentData.name || 'New Agent',
      model: agentData.model || 'claude',
      description: agentData.description || agentData.currentTask || '',
      system_prompt: agentData.system_prompt || `You are ${agentData.name}, an AI agent.`,
      color: agentData.color || '#6366f1',
      type: agentData.type || 'research',
    })
  }

  const runningAgents = normalizedAgents.filter(a => a.status === 'running')
  const totalTokens = tasks.reduce((sum: number, t: any) => sum + (t.tokens_used || 0), 0)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div className="flex h-screen w-full bg-[#020203] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="text-black font-bold text-xl">b</span>
          </div>
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <AuthPage
        onSignIn={signIn}
        onSignUp={signUp}
        onMagicLink={signInWithMagicLink}
        error={error}
        onClearError={() => setError(null)}
      />
    )
  }

  // ── Onboarding ─────────────────────────────────────────────────────────────
  if (authState === 'onboarding') {
    return <Onboarding userEmail={user?.email} onComplete={() => completeOnboarding({})} />
  }

  // ── Widget mode ────────────────────────────────────────────────────────────
  if (isWidgetMode) {
    return (
      <Widget
        agents={normalizedAgents}
        messages={feedMessages}
        onExpand={handleExpandFromWidget}
        onClose={handleExpandFromWidget}
        onBaseCommand={handleBaseCommand}
      />
    )
  }

  // ── Full app ───────────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard agents={normalizedAgents} messages={feedMessages} insights={[]} logs={[]} tasks={tasks} onNavigate={setActiveTab} />
      case 'communication':
        return <CommunicationFeed messages={feedMessages} agents={normalizedAgents} onIntervene={handleIntervene} onBaseCommand={handleBaseCommand} baseThinking={baseThinking} />
      case 'orchestration':
        return <OrchestrationLayer
          agents={normalizedAgents}
          tasks={tasks}
          onDeployClick={() => setIsDeployModalOpen(true)}
          onRunAgent={runAgent}
          onPauseTask={pauseTask}
          onResumeTask={resumeTask}
          onCancelTask={cancelTask}
          onDeleteAgent={deleteAgent}
          onUpdateAgent={(id, updates) => send('agent:update', { id, ...updates }).catch(() => {})}
        />
      case 'telemetry':
        return <TelemetryDashboard agents={normalizedAgents} tasks={tasks} messages={feedMessages} />
      case 'graph':
        return <AgentGraph agents={normalizedAgents} tasks={tasks} />
      case 'logs':
        return <SystemAuditLogs agents={normalizedAgents} tasks={tasks} messages={feedMessages} />
      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-[#050505]">
            <p className="text-[#444] font-mono text-xs uppercase tracking-widest">Module under development</p>
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#020203] text-white overflow-hidden selection:bg-white selection:text-black relative">
      <div className="atmosphere" />
      <TitleBar agentCount={runningAgents.length} onWidgetMode={handleEnterWidget} />

      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} agents={normalizedAgents} tasks={tasks} messages={feedMessages} connected={connected} />

        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-6">
              {/* Sidecar connection status */}
              <div className="flex items-center gap-2">
                {connected
                  ? <><span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse" /><span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em]">Online</span></>
                  : <><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-[10px] font-mono text-red-400/60 uppercase tracking-[0.2em]">Engine offline</span></>
                }
              </div>
              <div className="w-px h-5 bg-white/5" />
              <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Active Agents</p>
                  <p className="text-white font-mono text-xs font-bold">{runningAgents.length}</p>
                </div>
                <div className="w-px h-6 bg-white/5" />
                <div className="text-right">
                  <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Total Tokens</p>
                  <p className="text-white font-mono text-xs font-bold">{totalTokens.toLocaleString()}</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
                title="Settings (Ctrl+,)"
              >
                <SettingsIcon size={14} />
              </button>
              <button
                onClick={() => setIsMCPOpen(true)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
                title="MCP Connections (Ctrl+M)"
              >
                <Plug size={14} />
              </button>
            </div>
          </header>

          <div className="flex-1 flex min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex min-w-0"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
            <ReporterPanel agents={normalizedAgents} tasks={tasks} messages={feedMessages} onSendCommand={handleBaseCommand} />
          </div>
        </main>
      </div>

      {/* Modals */}
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} agents={normalizedAgents} onAction={handleCommandPaletteAction} />
      <InterventionModal
        isOpen={!!interventionContext}
        onClose={() => setInterventionContext(null)}
        agent={interventionContext?.agent || null}
        message={interventionContext?.message || null}
        onSend={(agentId, instruction) => {
          runAgent(agentId, instruction).catch(() => {})
          setInterventionContext(null)
        }}
      />
      <DeployAgentModal isOpen={isDeployModalOpen} onClose={() => setIsDeployModalOpen(false)} onDeploy={handleDeploy} />
      <MCPConnectionsModal
        isOpen={isMCPOpen}
        onClose={() => setIsMCPOpen(false)}
        agents={normalizedAgents}
        onConnect={connectAgent}
        onDeleteAgent={deleteAgent}
        send={send}
      />
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        userEmail={user?.email || ''}
        onSave={saveSettings}
        onSignOut={signOut}
        onDeleteAccount={async () => {
          if (!user) return
          await supabase.from('user_settings').delete().eq('id', user.id)
          await signOut()
        }}
      />
    </div>
  )
}