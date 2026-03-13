import { getDB, generateId, now } from '../db'

export type AgentType = 'native' | 'mcp' | 'http' | 'openai'
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'offline'
export type AgentModel = 'claude' | 'gemini' | 'gpt-4' | 'gpt-4o' | 'custom'

export interface AgentConnectionConfig {
  // For MCP agents
  mcpUrl?: string
  mcpAuthToken?: string
  // For HTTP agents
  httpEndpoint?: string
  httpAuthHeader?: string
  httpInputSchema?: Record<string, any>
  httpOutputSchema?: Record<string, any>
  // For OpenAI Assistants
  openaiApiKey?: string
  openaiAssistantId?: string
  // For custom/other
  customConfig?: Record<string, any>
}

export interface Agent {
  id: string
  name: string
  description: string
  type: AgentType
  status: AgentStatus
  model: AgentModel | string
  system_prompt: string
  connection_config: AgentConnectionConfig
  tools: string[]
  color: string
  icon: string
  created_at: number
  updated_at: number
  last_active: number | null
  metadata: Record<string, any>
}

export interface CreateAgentPayload {
  name: string
  description?: string
  type?: AgentType
  model?: string
  system_prompt?: string
  connection_config?: AgentConnectionConfig
  tools?: string[]
  color?: string
  icon?: string
  metadata?: Record<string, any>
}

export interface ConnectAgentPayload {
  name: string
  description?: string
  type: 'mcp' | 'http' | 'openai'
  connection_config: AgentConnectionConfig
  model?: string
}

function rowToAgent(row: any): Agent {
  return {
    ...row,
    connection_config: JSON.parse(row.connection_config || '{}'),
    tools: JSON.parse(row.tools || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
  }
}

export class AgentRegistry {
  async list(): Promise<Agent[]> {
    const db = getDB()
    const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all()
    return rows.map(rowToAgent)
  }

  async get(id: string): Promise<Agent | null> {
    const db = getDB()
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id)
    return row ? rowToAgent(row) : null
  }

  async create(payload: CreateAgentPayload): Promise<Agent> {
    const db = getDB()
    const id = generateId('agent')
    const ts = now()

    db.prepare(`
      INSERT INTO agents (id, name, description, type, model, system_prompt, connection_config, tools, color, icon, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      payload.name,
      payload.description || '',
      payload.type || 'native',
      payload.model || 'claude',
      payload.system_prompt || '',
      JSON.stringify(payload.connection_config || {}),
      JSON.stringify(payload.tools || []),
      payload.color || '#a78bfa',
      payload.icon || '◈',
      ts,
      ts,
      JSON.stringify(payload.metadata || {})
    )

    return (await this.get(id))!
  }

  async connect(payload: ConnectAgentPayload): Promise<Agent> {
    // Connect a third-party agent
    return this.create({
      name: payload.name,
      description: payload.description,
      type: payload.type,
      model: payload.model || 'custom',
      connection_config: payload.connection_config,
    })
  }

  async update(id: string, payload: Partial<CreateAgentPayload>): Promise<Agent> {
    const db = getDB()
    const existing = await this.get(id)
    if (!existing) throw new Error(`Agent ${id} not found`)

    const updates: Record<string, any> = { updated_at: now() }
    if (payload.name !== undefined) updates.name = payload.name
    if (payload.description !== undefined) updates.description = payload.description
    if (payload.model !== undefined) updates.model = payload.model
    if (payload.system_prompt !== undefined) updates.system_prompt = payload.system_prompt
    if (payload.tools !== undefined) updates.tools = JSON.stringify(payload.tools)
    if (payload.color !== undefined) updates.color = payload.color
    if (payload.icon !== undefined) updates.icon = payload.icon
    if (payload.connection_config !== undefined) updates.connection_config = JSON.stringify(payload.connection_config)
    if (payload.metadata !== undefined) updates.metadata = JSON.stringify(payload.metadata)

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = [...Object.values(updates), id]
    db.prepare(`UPDATE agents SET ${fields} WHERE id = ?`).run(...values)

    return (await this.get(id))!
  }

  async setStatus(id: string, status: AgentStatus): Promise<void> {
    const db = getDB()
    db.prepare('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), id)
  }

  async delete(id: string): Promise<void> {
    const db = getDB()
    // Delete related records first to avoid FK constraint errors
    try { db.prepare('DELETE FROM messages WHERE sender_id = ?').run(id) } catch {}
    try { db.prepare('DELETE FROM tasks WHERE agent_id = ?').run(id) } catch {}
    try { db.prepare('DELETE FROM agent_connections WHERE agent_id = ?').run(id) } catch {}
    db.prepare('DELETE FROM agents WHERE id = ?').run(id)
  }
}