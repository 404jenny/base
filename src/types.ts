export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'offline'

export interface Agent {
  id: string
  name: string
  type: string
  status: AgentStatus
  model?: string
  description?: string
  system_prompt?: string
  currentTask?: string
  progress: number
  lastUpdate: string
  color: string
  metrics: {
    cpu: number[]
    memory: number[]
    tokens: number
  }
}

export interface SystemLog {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  source: string
  message: string
}

export interface Message {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: number | string   // sidecar sends number (unix ms), legacy uses string
  type: 'thought' | 'action' | 'handoff' | 'question' | 'output'
  targetId?: string
  reasoning?: string
}

export interface Insight {
  id: string
  type: 'conflict' | 'overlap' | 'handoff' | 'info'
  message: string
  timestamp: string
  actionable: boolean
  resolved: boolean
}