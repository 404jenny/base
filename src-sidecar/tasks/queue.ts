import EventEmitter from 'events'
import { getDB, generateId, now } from '../db'

export type TaskStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface Task {
  id: string
  agent_id: string
  instruction: string
  status: TaskStatus
  result: string | null
  error: string | null
  context: Record<string, any>
  tokens_used: number
  cost_usd: number
  started_at: number | null
  completed_at: number | null
  created_at: number
  metadata: Record<string, any>
}

function rowToTask(row: any): Task {
  return {
    ...row,
    context: JSON.parse(row.context || '{}'),
    metadata: JSON.parse(row.metadata || '{}'),
  }
}

export class TaskQueue extends EventEmitter {
  async create(agentId: string, instruction: string, context: Record<string, any> = {}): Promise<Task> {
    const db = getDB()
    const id = generateId('task')

    db.prepare(`
      INSERT INTO tasks (id, agent_id, instruction, status, context, created_at)
      VALUES (?, ?, ?, 'queued', ?, ?)
    `).run(id, agentId, instruction, JSON.stringify(context), now())

    const task = (await this.get(id))!
    this.emit('task:queued', task)
    return task
  }

  async get(id: string): Promise<Task | null> {
    const db = getDB()
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    return row ? rowToTask(row) : null
  }

  async listRecent(agentId?: string, limit = 50): Promise<Task[]> {
    const db = getDB()
    const rows = agentId
      ? db.prepare('SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?').all(agentId, limit)
      : db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?').all(limit)
    return rows.map(rowToTask)
  }

  async setStatus(id: string, status: TaskStatus, extra: Partial<Task> = {}): Promise<Task> {
    const db = getDB()
    const updates: Record<string, any> = { status }
    if (status === 'running' && !extra.started_at) updates.started_at = now()
    if (['completed', 'failed', 'cancelled'].includes(status)) updates.completed_at = now()
    if (extra.result !== undefined) updates.result = extra.result
    if (extra.error !== undefined) updates.error = extra.error
    if (extra.tokens_used !== undefined) updates.tokens_used = extra.tokens_used
    if (extra.cost_usd !== undefined) updates.cost_usd = extra.cost_usd

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE tasks SET ${fields} WHERE id = ?`).run(...Object.values(updates), id)

    return (await this.get(id))!
  }

  async appendResult(id: string, chunk: string): Promise<void> {
    const db = getDB()
    db.prepare(`
      UPDATE tasks SET result = COALESCE(result, '') || ? WHERE id = ?
    `).run(chunk, id)
  }
}