import { WebSocketServer, WebSocket } from 'ws'
import { initDB, getDB } from './db'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load .env from src-sidecar directory (fallback keys for dev)
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
  console.log('[base-sidecar] Loaded .env from', envPath)
} else {
  dotenv.config() // fallback to CWD
}
import { AgentRegistry } from './agents/registry'
import { AgentRunner } from './agents/runner'
import { TaskQueue } from './tasks/queue'
import { BaseOrchestrator } from './base-ai/orchestrator'
import { testMCPConnection } from './agents/adapters/mcp'

const PORT = 41801
let started = false

interface WSMessage {
  id: string
  type: string
  payload: any
}

async function main() {
  if (started) return
  started = true

  console.log('[base-sidecar] Starting...')
  await initDB()
  console.log('[base-sidecar] Database ready')

  const registry = new AgentRegistry()
  const queue = new TaskQueue()
  const runner = new AgentRunner(registry, queue)
  const orchestrator = new BaseOrchestrator(registry, runner, queue)

  // Reset any agents/tasks stuck in 'running' state from a previous crash
  const db = getDB()
  db.prepare(`UPDATE agents SET status = 'idle' WHERE status IN ('running', 'paused')`).run()
  db.prepare(`UPDATE tasks SET status = 'failed', error = 'Interrupted: sidecar restarted' WHERE status IN ('running', 'queued')`).run()
  console.log('[base-sidecar] Reset stuck tasks/agents from previous session')

  const wss = new WebSocketServer({ port: PORT })
  console.log(`[base-sidecar] WebSocket server on ws://localhost:${PORT}`)

  const broadcast = (event: string, data: any) => {
    const msg = JSON.stringify({ event, data })
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(msg)
    })
  }

  runner.on('agent:update', (agent: any) => broadcast('agent:update', agent))
  runner.on('task:update', (task: any) => broadcast('task:update', task))
  runner.on('message', (msg: any) => broadcast('message', msg))
  queue.on('task:queued', (task: any) => broadcast('task:queued', task))
  orchestrator.on('message', (msg: any) => broadcast('message', msg))

  wss.on('connection', async (ws: WebSocket) => {
    console.log('[sidecar] Client connected, total clients:', wss.clients.size)

    const processedIds = new Set<string>()

    const agents = await registry.list()
    const tasks = await queue.listRecent(undefined, 100)
    const db2 = getDB()
    const recentMessages = db2.prepare(
      'SELECT * FROM messages ORDER BY created_at DESC LIMIT 100'
    ).all().reverse()
    ws.send(JSON.stringify({ event: 'init', data: { agents, tasks, messages: recentMessages } }))

    ws.on('message', async (raw: Buffer) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString())
        const { id, type, payload } = msg

        if (processedIds.has(id)) return
        processedIds.add(id)

        console.log('[sidecar] received:', type)

        const reply = (data: any, error?: string) => {
          ws.send(JSON.stringify({ id, type: `${type}:reply`, data, error }))
        }

        switch (type) {

          case 'agent:list': {
            const agents = await registry.list()
            reply(agents)
            break
          }

          case 'agent:create': {
            const agent = await registry.create(payload)
            broadcast('agent:update', agent)
            reply(agent)
            break
          }

          case 'agent:update': {
            const agent = await registry.update(payload.id, payload)
            broadcast('agent:update', agent)
            reply(agent)
            break
          }

          case 'agent:delete': {
            await registry.delete(payload.id)
            broadcast('agent:deleted', { id: payload.id })
            reply({ ok: true })
            break
          }

          case 'agent:connect': {
            const agent = await registry.connect(payload)
            broadcast('agent:update', agent)
            reply(agent)
            break
          }

          case 'mcp:test': {
            const result = await testMCPConnection(payload.mcpUrl, payload.mcpAuthToken)
            reply(result)
            break
          }

          case 'task:list': {
            const tasks = await queue.listRecent(payload?.agentId, payload?.limit || 100)
            reply(tasks)
            break
          }

          case 'task:run': {
            const task = await runner.run(payload.agentId, payload.instruction, payload.context)
            reply(task)
            break
          }

          case 'task:pause': {
            await runner.pause(payload.taskId)
            reply({ ok: true })
            break
          }

          case 'task:resume': {
            await runner.resume(payload.taskId)
            reply({ ok: true })
            break
          }

          case 'task:cancel': {
            await runner.cancel(payload.taskId)
            reply({ ok: true })
            break
          }

          case 'message:list': {
            const db3 = getDB()
            const limit = payload?.limit || 100
            const rows = db3.prepare(
              'SELECT * FROM messages ORDER BY created_at DESC LIMIT ?'
            ).all(limit).reverse()
            reply(rows)
            break
          }

          case 'base:command': {
            const result = await orchestrator.handleCommand(payload.command, payload.context, (chunk: string) => {
              ws.send(JSON.stringify({ event: 'base:stream', data: { chunk, commandId: payload.commandId } }))
            })
            reply(result)
            break
          }

          case 'base:status': {
            const status = await orchestrator.getStatus()
            reply(status)
            break
          }

          case 'keys:set': {
            if (payload.anthropic) {
              process.env.ANTHROPIC_API_KEY = payload.anthropic
              console.log('[sidecar] Anthropic key set:', payload.anthropic.slice(0, 12) + '...')
            }
            if (payload.gemini) {
              process.env.GEMINI_API_KEY = payload.gemini
              console.log('[sidecar] Gemini key set:', payload.gemini.slice(0, 8) + '...')
            }
            if (payload.openai) {
              process.env.OPENAI_API_KEY = payload.openai
              console.log('[sidecar] OpenAI key set:', payload.openai.slice(0, 8) + '...')
            }
            reply({ ok: true })
            break
          }

          case 'keys:check': {
            reply({
              anthropic: !!process.env.ANTHROPIC_API_KEY,
              gemini: !!process.env.GEMINI_API_KEY,
              openai: !!process.env.OPENAI_API_KEY,
              anthropicPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 12) || null,
              geminiPrefix: process.env.GEMINI_API_KEY?.slice(0, 8) || null,
            })
            break
          }

          default:
            reply(null, `Unknown message type: ${type}`)
        }
      } catch (err: any) {
        console.error('[base-sidecar] Error:', err)
        ws.send(JSON.stringify({ event: 'error', data: { message: err.message } }))
      }
    })

    ws.on('close', () => console.log('[base-sidecar] Client disconnected'))
  })

  process.on('SIGTERM', () => {
    console.log('[base-sidecar] Shutting down...')
    wss.close()
    process.exit(0)
  })
}

main().catch(console.error)