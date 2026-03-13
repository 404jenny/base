import EventEmitter from 'events'
import { AgentRegistry, Agent } from './registry'
import { TaskQueue, Task } from '../tasks/queue'
import { runNativeAgent } from './adapters/native'
import { runHttpAgent } from './adapters/http'
import { runMCPAgent } from './adapters/mcp'
import { getDB, generateId, now } from '../db'

interface ActiveTask {
  taskId: string
  agentId: string
  abortController: AbortController
  paused: boolean
}

export class AgentRunner extends EventEmitter {
  private activeTasks = new Map<string, ActiveTask>()

  constructor(
    private registry: AgentRegistry,
    private queue: TaskQueue,
  ) {
    super()
  }

  async run(agentId: string, instruction: string, context: Record<string, any> = {}): Promise<Task> {
    const agent = await this.registry.get(agentId)
    if (!agent) throw new Error(`Agent ${agentId} not found`)

    // Create task
    const task = await this.queue.create(agentId, instruction, context)

    // Run async (don't await — fire and forget, stream updates via events)
    this.executeTask(agent, task).catch(err => {
      console.error(`[runner] Task ${task.id} failed:`, err)
    })

    return task
  }

  private async executeTask(agent: Agent, task: Task): Promise<void> {
    const abortController = new AbortController()
    this.activeTasks.set(task.id, { taskId: task.id, agentId: agent.id, abortController, paused: false })

    try {
      // Mark running
      await this.queue.setStatus(task.id, 'running')
      await this.registry.setStatus(agent.id, 'running')
      this.emitTaskUpdate(task.id)
      this.emitAgentUpdate(agent.id)

      // Post a "thinking" message — skip if silent
      if (!task.context?.silent) {
        await this.postMessage({
          senderId: agent.id,
          senderName: agent.name,
          senderType: 'agent',
          content: `Starting task: ${task.instruction}`,
          messageType: 'thinking',
          taskId: task.id,
        })
      }

      const systemPrompt = agent.system_prompt ||
        `You are ${agent.name}. ${agent.description || ''}`.trim() ||
        'You are a helpful AI agent.'

      let result: { content: string; tokensUsed: number; costUsd: number }

      if (agent.type === 'http') {
        result = await runHttpAgent(agent, {
          instruction: task.instruction,
          systemPrompt,
          context: task.context,
          signal: abortController.signal,
          onChunk: async (chunk) => {
            await this.queue.appendResult(task.id, chunk)
            this.emit('task:update', { id: task.id, chunk })
          },
        })
      } else if (agent.type === 'mcp') {
        result = await runMCPAgent(agent, {
          instruction: task.instruction,
          systemPrompt,
          context: task.context,
          signal: abortController.signal,
          onChunk: async (chunk) => {
            await this.queue.appendResult(task.id, chunk)
            this.emit('task:update', { id: task.id, chunk })
          },
        })
      } else {
        // native (claude / gemini)
        result = await runNativeAgent(agent, {
          instruction: task.instruction,
          systemPrompt,
          context: task.context,
          signal: abortController.signal,
          onChunk: async (chunk) => {
            await this.queue.appendResult(task.id, chunk)
            this.emit('task:update', { id: task.id, chunk })
          },
        })
      }

      // Complete
      const completed = await this.queue.setStatus(task.id, 'completed', {
        result: result.content,
        tokens_used: result.tokensUsed,
        cost_usd: result.costUsd,
      })

      await this.registry.setStatus(agent.id, 'idle')
      await this.registry.update(agent.id, { metadata: { last_active: now() } })

      // Post result message — skip if task is silent (orchestrator will synthesize)
      if (!task.context?.silent) {
        await this.postMessage({
          senderId: agent.id,
          senderName: agent.name,
          senderType: 'agent',
          content: result.content,
          messageType: 'result',
          taskId: task.id,
        })
      }

      this.emitTaskUpdate(task.id)
      this.emitAgentUpdate(agent.id)

    } catch (err: any) {
      if (err.name === 'AbortError') {
        const active = this.activeTasks.get(task.id)
        const status = active?.paused ? 'paused' : 'cancelled'
        await this.queue.setStatus(task.id, status)
      } else {
        await this.queue.setStatus(task.id, 'failed', { error: err.message })
        await this.registry.setStatus(agent.id, 'error')
        await this.postMessage({
          senderId: agent.id,
          senderName: agent.name,
          senderType: 'agent',
          content: `Task failed: ${err.message}`,
          messageType: 'error',
          taskId: task.id,
        })
      }
      this.emitTaskUpdate(task.id)
      this.emitAgentUpdate(agent.id)
    } finally {
      this.activeTasks.delete(task.id)
    }
  }

  async pause(taskId: string): Promise<void> {
    const active = this.activeTasks.get(taskId)
    if (!active) throw new Error(`Task ${taskId} is not running`)
    active.paused = true
    active.abortController.abort()
    await this.queue.setStatus(taskId, 'paused')
    await this.registry.setStatus(active.agentId, 'paused')
    this.emitTaskUpdate(taskId)
    this.emitAgentUpdate(active.agentId)
  }

  async resume(taskId: string): Promise<void> {
    const task = await this.queue.get(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)
    if (task.status !== 'paused') throw new Error(`Task ${taskId} is not paused`)

    const agent = await this.registry.get(task.agent_id)
    if (!agent) throw new Error(`Agent not found`)

    // Re-run with accumulated context
    const context = {
      ...task.context,
      resume_from: task.result || '',
      original_instruction: task.instruction,
    }

    const newTask = await this.queue.create(task.agent_id, task.instruction, context)
    this.executeTask(agent, newTask)
  }

  async cancel(taskId: string): Promise<void> {
    const active = this.activeTasks.get(taskId)
    if (active) {
      active.paused = false
      active.abortController.abort()
    } else {
      await this.queue.setStatus(taskId, 'cancelled')
      this.emitTaskUpdate(taskId)
    }
  }

  private async postMessage(params: {
    senderId: string
    senderName: string
    senderType: string
    content: string
    messageType: string
    taskId?: string
    parentMessageId?: string
  }) {
    const db = getDB()
    const id = generateId('msg')
    db.prepare(`
      INSERT INTO messages (id, sender_id, sender_name, sender_type, content, message_type, task_id, parent_message_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.senderId, params.senderName, params.senderType, params.content, params.messageType, params.taskId || null, params.parentMessageId || null, now())

    const message = { id, ...params, created_at: now() }
    this.emit('message', message)
    return message
  }

  private emitTaskUpdate(taskId: string) {
    this.queue.get(taskId).then(task => {
      if (task) this.emit('task:update', task)
    })
  }

  private emitAgentUpdate(agentId: string) {
    this.registry.get(agentId).then(agent => {
      if (agent) this.emit('agent:update', agent)
    })
  }
}