import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X, Plus, Plug, Unplug, CheckCircle, XCircle, Loader,
  Wrench, Trash2, ChevronRight, Globe, Lock, Zap, AlertCircle, RefreshCw
} from 'lucide-react'

interface MCPServer {
  id: string
  name: string
  url: string
  authToken?: string
  status: 'idle' | 'testing' | 'connected' | 'error'
  serverName?: string
  tools?: string[]
  error?: string
  agentId?: string
}

interface MCPConnectionsModalProps {
  isOpen: boolean
  onClose: () => void
  agents: any[]
  onConnect: (payload: {
    name: string
    description?: string
    type: 'mcp'
    connection_config: { mcpUrl: string; mcpAuthToken?: string }
  }) => Promise<any>
  onDeleteAgent: (id: string) => Promise<any>
  send: (type: string, payload?: any) => Promise<any>
}

const PRESET_SERVERS = [
  { label: 'Filesystem', url: 'http://localhost:3100', description: 'Read/write local files' },
  { label: 'GitHub', url: 'https://mcp.github.io', description: 'Repos, PRs, issues' },
  { label: 'Postgres', url: 'http://localhost:3200', description: 'Database queries' },
  { label: 'Slack (local)', url: 'http://localhost:8080/sse', description: 'Local Slack MCP bridge' },
]

function StatusBadge({ status, error }: { status: MCPServer['status']; error?: string }) {
  if (status === 'testing') return (
    <span className="flex items-center gap-1.5 text-[9px] font-mono text-amber-400 uppercase tracking-wider">
      <Loader size={10} className="animate-spin" /> Testing
    </span>
  )
  if (status === 'connected') return (
    <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 uppercase tracking-wider">
      <CheckCircle size={10} /> Connected
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1.5 text-[9px] font-mono text-red-400 uppercase tracking-wider" title={error}>
      <XCircle size={10} /> Failed
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 text-[9px] font-mono text-white/25 uppercase tracking-wider">
      <Plug size={10} /> Not tested
    </span>
  )
}

export const MCPConnectionsModal: React.FC<MCPConnectionsModalProps> = ({
  isOpen, onClose, agents, onConnect, onDeleteAgent, send
}) => {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', authToken: '' })
  const [deployingId, setDeployingId] = useState<string | null>(null)

  // Derive MCP agents from the fleet
  const mcpAgents = agents.filter(a => a.type === 'mcp')

  const testConnection = useCallback(async (id: string) => {
    const server = servers.find(s => s.id === id)
    if (!server) return

    setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'testing', error: undefined } : s))

    try {
      const result = await send('mcp:test', { mcpUrl: server.url, mcpAuthToken: server.authToken || undefined })
      if (result.ok) {
        setServers(prev => prev.map(s => s.id === id ? {
          ...s, status: 'connected', serverName: result.serverName, tools: result.tools
        } : s))
      } else {
        setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', error: result.error } : s))
      }
    } catch (err: any) {
      setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', error: err.message } : s))
    }
  }, [servers, send])

  const handleAddServer = () => {
    if (!form.url.trim()) return
    const id = Math.random().toString(36).slice(2)
    const rawUrl = form.url.trim()
    setServers(prev => [...prev, {
      id,
      name: form.name.trim() || (() => { try { return new URL(rawUrl.startsWith('http') ? rawUrl : 'http://' + rawUrl).hostname } catch { return rawUrl } })(),
      url: rawUrl,
      authToken: form.authToken.trim() || undefined,
      status: 'idle',
    }])
    setForm({ name: '', url: '', authToken: '' })
    setIsAdding(false)
    // Auto-test
    setTimeout(() => testConnection(id), 100)
  }

  const handleDeploy = async (server: MCPServer) => {
    setDeployingId(server.id)
    try {
      await onConnect({
        name: server.serverName || server.name,
        description: server.tools?.length
          ? `MCP server with ${server.tools.length} tools: ${server.tools.slice(0, 3).join(', ')}${server.tools.length > 3 ? '...' : ''}`
          : `MCP connection to ${server.url}`,
        type: 'mcp',
        connection_config: { mcpUrl: server.url, mcpAuthToken: server.authToken },
      })
      setServers(prev => prev.map(s => s.id === server.id ? { ...s, agentId: 'deployed' } : s))
    } catch (err: any) {
      console.error('Deploy failed:', err)
    } finally {
      setDeployingId(null)
    }
  }

  const handleRemoveServer = (id: string) => {
    setServers(prev => prev.filter(s => s.id !== id))
  }

  if (!isOpen) return null

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
          className="w-full max-w-2xl bg-[#080808] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-7 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Plug size={15} className="text-white/60" />
              </div>
              <div>
                <h2 className="text-white font-mono text-[11px] font-bold uppercase tracking-[0.2em]">MCP Connections</h2>
                <p className="text-white/25 text-[9px] font-mono uppercase tracking-wider mt-0.5">
                  Model Context Protocol servers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-black rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-white/90 transition-all"
              >
                <Plus size={12} /> Add Server
              </button>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">

            {/* Add server form */}
            <AnimatePresence>
              {isAdding && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-b border-white/5 overflow-hidden"
                >
                  <div className="p-6 space-y-4 bg-white/[0.02]">
                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">New MCP Server</p>

                    {/* Presets */}
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_SERVERS.map(p => (
                        <button key={p.label}
                          onClick={() => setForm(f => ({ ...f, name: p.label, url: p.url }))}
                          className="px-3 py-1.5 rounded-lg border border-white/8 text-[9px] font-mono text-white/40 hover:text-white hover:border-white/20 transition-all uppercase tracking-wider"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-mono text-white/25 uppercase tracking-widest block mb-1.5">Name</label>
                        <input
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="My MCP Server"
                          className="w-full bg-white/[0.02] border border-white/8 rounded-xl px-3 py-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-white/20 transition-all placeholder-white/15"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-white/25 uppercase tracking-widest block mb-1.5">
                          <Globe size={9} className="inline mr-1 opacity-50" />Server URL
                        </label>
                        <input
                          autoFocus
                          value={form.url}
                          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                          placeholder="https://my-mcp-server.com"
                          className="w-full bg-white/[0.02] border border-white/8 rounded-xl px-3 py-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-white/20 transition-all placeholder-white/15"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-mono text-white/25 uppercase tracking-widest block mb-1.5">
                        <Lock size={9} className="inline mr-1 opacity-50" />Auth Token <span className="text-white/15 normal-case">(optional)</span>
                      </label>
                      <input
                        type="password"
                        value={form.authToken}
                        onChange={e => setForm(f => ({ ...f, authToken: e.target.value }))}
                        placeholder="Bearer token or API key..."
                        className="w-full bg-white/[0.02] border border-white/8 rounded-xl px-3 py-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-white/20 transition-all placeholder-white/15"
                      />
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button onClick={() => { setIsAdding(false); setForm({ name: '', url: '', authToken: '' }) }}
                        className="px-5 py-2.5 text-[10px] font-mono text-white/30 hover:text-white uppercase tracking-wider transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleAddServer} disabled={!form.url.trim()}
                        className="px-6 py-2.5 bg-white text-black rounded-xl text-[10px] font-mono font-bold uppercase hover:bg-white/90 disabled:opacity-30 transition-all flex items-center gap-2">
                        <Zap size={11} /> Add & Test
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Connected MCP agents (from fleet) */}
            {mcpAgents.length > 0 && (
              <div className="px-6 pt-5 pb-3">
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-3">Active in Fleet</p>
                <div className="space-y-2">
                  {mcpAgents.map(agent => (
                    <motion.div key={agent.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10"
                          style={{ backgroundColor: agent.color + '20', borderColor: agent.color + '40' }}>
                          <Plug size={12} style={{ color: agent.color }} />
                        </div>
                        <div>
                          <p className="text-white text-[11px] font-mono font-bold">{agent.name}</p>
                          <p className="text-white/30 text-[9px] font-mono mt-0.5">
                            {agent.description?.slice(0, 60) || 'MCP connection'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-mono uppercase tracking-wider ${
                          agent.status === 'running' ? 'text-emerald-400' :
                          agent.status === 'error' ? 'text-red-400' : 'text-white/25'
                        }`}>
                          {agent.status}
                        </span>
                        <button
                          onClick={() => onDeleteAgent(agent.id)}
                          className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Staged servers (ready to deploy) */}
            {servers.length > 0 && (
              <div className="px-6 py-5">
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-3">
                  Staged Servers
                </p>
                <div className="space-y-3">
                  {servers.map(server => (
                    <motion.div key={server.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="border border-white/8 rounded-2xl overflow-hidden bg-white/[0.01]"
                    >
                      {/* Server header row */}
                      <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            server.status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                            server.status === 'error' ? 'bg-red-500' :
                            server.status === 'testing' ? 'bg-amber-400 animate-pulse' :
                            'bg-white/20'
                          }`} />
                          <div className="min-w-0">
                            <p className="text-white text-[11px] font-mono font-bold truncate">{server.name}</p>
                            <p className="text-white/30 text-[9px] font-mono truncate">{server.url}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <StatusBadge status={server.status} error={server.error} />

                          <button onClick={() => testConnection(server.id)}
                            disabled={server.status === 'testing'}
                            className="text-white/20 hover:text-white transition-colors disabled:opacity-30"
                            title="Re-test connection">
                            <RefreshCw size={12} className={server.status === 'testing' ? 'animate-spin' : ''} />
                          </button>

                          <button onClick={() => handleRemoveServer(server.id)}
                            className="text-white/15 hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Tools list (on connected) */}
                      {server.status === 'connected' && server.tools && server.tools.length > 0 && (
                        <div className="px-4 pb-3 border-t border-white/5 pt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Wrench size={9} className="text-white/25" />
                            <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest">
                              {server.tools.length} tools available
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {server.tools.map(tool => (
                              <span key={tool} className="px-2 py-1 bg-white/5 border border-white/8 rounded-lg text-[8px] font-mono text-white/50 uppercase">
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error detail */}
                      {server.status === 'error' && server.error && (
                        <div className="px-4 pb-3 border-t border-white/5 pt-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                            <p className="text-[9px] font-mono text-red-400/70 leading-relaxed">{server.error}</p>
                          </div>
                        </div>
                      )}

                      {/* Deploy CTA (only when connected) */}
                      {server.status === 'connected' && !server.agentId && (
                        <div className="px-4 pb-4 border-t border-white/5 pt-3 flex items-center justify-between">
                          <p className="text-[9px] font-mono text-white/25">
                            {server.serverName ? `Server: ${server.serverName}` : 'Ready to deploy'}
                          </p>
                          <button
                            onClick={() => handleDeploy(server)}
                            disabled={deployingId === server.id}
                            className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-black rounded-xl text-[10px] font-mono font-bold uppercase hover:bg-emerald-400 disabled:opacity-50 transition-all"
                          >
                            {deployingId === server.id
                              ? <><Loader size={11} className="animate-spin" /> Deploying...</>
                              : <><Zap size={11} /> Deploy as Agent</>
                            }
                          </button>
                        </div>
                      )}

                      {server.agentId && (
                        <div className="px-4 pb-4 border-t border-white/5 pt-3 flex items-center gap-2">
                          <CheckCircle size={12} className="text-emerald-400" />
                          <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">Deployed to fleet</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {servers.length === 0 && mcpAgents.length === 0 && !isAdding && (
              <div className="flex flex-col items-center justify-center py-20 px-8 gap-4">
                <div className="w-14 h-14 rounded-3xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                  <Unplug size={22} className="text-white/20" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-white/40 font-mono text-[11px] uppercase tracking-widest">No MCP servers</p>
                  <p className="text-white/15 font-mono text-[10px] max-w-xs leading-relaxed">
                    Connect any MCP-compatible server to extend your agents with custom tools and capabilities
                  </p>
                </div>
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-mono text-white/50 hover:text-white hover:bg-white/8 hover:border-white/20 transition-all uppercase tracking-wider mt-2"
                >
                  <Plus size={12} /> Add your first server
                </button>

                {/* Quick-start presets */}
                <div className="mt-4 grid grid-cols-2 gap-2 w-full max-w-sm">
                  {PRESET_SERVERS.map(p => (
                    <button key={p.label}
                      onClick={() => { setForm({ name: p.label, url: p.url, authToken: '' }); setIsAdding(true) }}
                      className="p-3 text-left border border-white/5 rounded-xl hover:border-white/15 hover:bg-white/[0.02] transition-all group"
                    >
                      <p className="text-[10px] font-mono text-white/50 group-hover:text-white font-bold transition-colors">{p.label}</p>
                      <p className="text-[9px] font-mono text-white/20 mt-0.5">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-7 py-4 border-t border-white/5 shrink-0 flex items-center justify-between">
            <p className="text-[9px] font-mono text-white/20">
              MCP v2024-11-05 · <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener"
                className="underline hover:text-white/40 transition-colors">docs</a>
            </p>
            <div className="flex items-center gap-2 text-[9px] font-mono text-white/20">
              <div className={`w-1.5 h-1.5 rounded-full ${mcpAgents.length + servers.filter(s => s.status === 'connected').length > 0 ? 'bg-emerald-500' : 'bg-white/15'}`} />
              {mcpAgents.length} active · {servers.filter(s => s.status === 'connected').length} staged
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}