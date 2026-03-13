import React, { useMemo } from 'react'
import { Agent } from '../types'
import { motion } from 'motion/react'
import { Share2, Zap, Brain } from 'lucide-react'

interface AgentGraphProps {
  agents: Agent[]
  tasks?: any[]
}

export const AgentGraph: React.FC<AgentGraphProps> = ({ agents, tasks = [] }) => {
  const centerX = 400
  const centerY = 280
  const radius = agents.length <= 1 ? 0 : agents.length <= 4 ? 150 : 200

  const nodes = useMemo(() => agents.map((agent, i) => {
    const angle = (i / agents.length) * 2 * Math.PI - Math.PI / 2
    return {
      ...agent,
      x: agents.length === 1 ? centerX : centerX + radius * Math.cos(angle),
      y: agents.length === 1 ? centerY : centerY + radius * Math.sin(angle),
    }
  }), [agents])

  // Build real connections from shared tasks / same-time activity
  const connections = useMemo(() => {
    const conns: { from: string; to: string; label: string; active: boolean }[] = []
    // Connect agents that have run tasks close together in time (within 60s)
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at)
    for (let i = 0; i < completedTasks.length; i++) {
      for (let j = i + 1; j < completedTasks.length; j++) {
        const a = completedTasks[i], b = completedTasks[j]
        if (a.agent_id === b.agent_id) continue
        const timeDiff = Math.abs((a.completed_at || 0) - (b.completed_at || 0))
        if (timeDiff < 60) {
          const existing = conns.find(c =>
            (c.from === a.agent_id && c.to === b.agent_id) ||
            (c.from === b.agent_id && c.to === a.agent_id)
          )
          if (!existing) conns.push({ from: a.agent_id, to: b.agent_id, label: 'Activity', active: false })
        }
      }
    }
    // Running agents connect to base
    agents.filter(a => a.status === 'running').forEach(a => {
      if (!conns.find(c => c.from === 'base' && c.to === a.id)) {
        conns.push({ from: a.id, to: 'base', label: 'Running', active: true })
      }
    })
    return conns.slice(0, 12) // cap for readability
  }, [agents, tasks])

  const statusColor = (status: string) => {
    switch (status) {
      case 'running': return '#10b981'
      case 'paused':  return '#f59e0b'
      case 'error':   return '#ef4444'
      default:        return '#ffffff20'
    }
  }

  if (agents.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
        <div className="px-8 py-5 border-b border-white/5 bg-black/20 backdrop-blur-md">
          <h2 className="text-white font-mono text-[11px] uppercase tracking-[0.3em] font-bold">Topology</h2>
          <p className="text-white/20 text-[9px] font-mono uppercase mt-1 tracking-wider">Agent relationship graph</p>
        </div>
        <div className="flex-1 flex items-center justify-center opacity-40">
          <div className="text-center space-y-3">
            <Share2 size={28} className="text-white/20 mx-auto" />
            <p className="text-[11px] font-mono text-white/30 uppercase tracking-widest">No agents deployed</p>
            <p className="text-[10px] font-mono text-white/15">Deploy agents to see their topology</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
      <div className="px-8 py-5 border-b border-white/5 bg-black/20 backdrop-blur-md shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-mono text-[11px] uppercase tracking-[0.3em] font-bold">Topology</h2>
            <p className="text-white/20 text-[9px] font-mono uppercase mt-1 tracking-wider">
              {agents.length} agents · {connections.length} connections
            </p>
          </div>
          <div className="flex items-center gap-4">
            {[
              { color: 'bg-emerald-400', label: 'Running' },
              { color: 'bg-amber-400', label: 'Paused' },
              { color: 'bg-white/20', label: 'Idle' },
              { color: 'bg-red-400', label: 'Error' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-[9px] font-mono text-white/25 uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-black/20 overflow-hidden">
        {/* Grid background */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <svg className="w-full h-full" viewBox="0 0 800 560" preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="6" refX="20" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.12)" />
            </marker>
            <marker id="arrow-active" markerWidth="8" markerHeight="6" refX="20" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(16,185,129,0.6)" />
            </marker>
          </defs>

          {/* Connection lines */}
          {connections.map((conn, i) => {
            const from = nodes.find(n => n.id === conn.from)
            const to = nodes.find(n => n.id === conn.to)
            if (!from || !to) return null
            return (
              <g key={i}>
                <motion.line
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={conn.active ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)'}
                  strokeWidth={conn.active ? 1.5 : 1}
                  strokeDasharray={conn.active ? undefined : '4 4'}
                  markerEnd={conn.active ? 'url(#arrow-active)' : 'url(#arrow)'}
                />
                {conn.active && (
                  <motion.circle r="3" fill="#10b981" opacity={0.8}>
                    <animateMotion
                      path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                      dur="2s" repeatCount="indefinite"
                    />
                  </motion.circle>
                )}
              </g>
            )
          })}

          {/* Agent nodes */}
          {nodes.map((node, i) => (
            <motion.g key={node.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, delay: i * 0.08 }}
            >
              {/* Pulse ring for running agents */}
              {node.status === 'running' && (
                <motion.circle
                  cx={node.x} cy={node.y} r={38}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="1"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />
              )}

              {/* Dashed orbit ring */}
              <circle
                cx={node.x} cy={node.y} r={38}
                fill="none"
                stroke={node.color}
                strokeWidth="0.5"
                strokeDasharray="3 5"
                opacity={0.3}
              />

              {/* Main circle */}
              <circle
                cx={node.x} cy={node.y} r={28}
                fill="rgba(0,0,0,0.85)"
                stroke={node.color}
                strokeWidth="1.5"
              />

              {/* Status dot */}
              <circle
                cx={node.x + 18} cy={node.y - 18} r={5}
                fill={statusColor(node.status)}
              />

              {/* Letter */}
              <text
                x={node.x} y={node.y + 5}
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {node.name.charAt(0).toUpperCase()}
              </text>

              {/* Name label */}
              <text
                x={node.x} y={node.y + 52}
                textAnchor="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="1"
              >
                {node.name.toUpperCase().slice(0, 12)}
              </text>

              {/* Model label */}
              <text
                x={node.x} y={node.y + 64}
                textAnchor="middle"
                fill="rgba(255,255,255,0.25)"
                fontSize="8"
                fontFamily="monospace"
              >
                {(node.model || node.type || '').toUpperCase()}
              </text>
            </motion.g>
          ))}
        </svg>

        {/* Stats overlay */}
        <div className="absolute bottom-6 right-6 p-4 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/8 space-y-2 min-w-[160px]">
          <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-3">Fleet Status</p>
          {[
            { label: 'Total', value: agents.length },
            { label: 'Running', value: agents.filter(a => a.status === 'running').length, color: 'text-emerald-400' },
            { label: 'Idle', value: agents.filter(a => a.status === 'idle').length },
            { label: 'Errors', value: agents.filter(a => a.status === 'error').length, color: agents.some(a => a.status === 'error') ? 'text-red-400' : undefined },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-white/30">{s.label}</span>
              <span className={`text-[10px] font-mono font-bold ${s.color || 'text-white/50'}`}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}