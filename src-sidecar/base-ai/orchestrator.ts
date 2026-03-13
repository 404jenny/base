import EventEmitter from 'events'
import { AgentRegistry } from '../agents/registry'
import { AgentRunner } from '../agents/runner'
import { TaskQueue } from '../tasks/queue'
import { getDB, generateId, now } from '../db'

function getBaseSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return [
    'You are base, the central AI orchestrator for a multi-agent operating system.',
    '',
    'Today\'s date is ' + today + '.',
    '',
    'Your role is to:',
    '1. Understand what the user wants to accomplish',
    '2. Decide which agents to involve and whether they run in parallel or in sequence',
    '3. Coordinate agents — pass outputs from one agent as inputs to the next when needed',
    '4. Report back clearly and concisely',
    '5. Always check in with the user when something goes wrong or is unclear',
    '',
    'Respond with ONLY raw JSON — no markdown, no code fences, no preamble.',
    '',
    'JSON shape:',
    '{',
    '  "thought": "Your reasoning about what to do and why",',
    '  "response": "What you say to the user (warm, direct, 1-2 sentences)",',
    '  "needsConfirmation": false,',
    '  "actions": [',
    '    // PARALLEL: fire these agents at the same time',
    '    { "type": "run_agent", "agentId": "id", "instruction": "..." },',
    '',
    '    // SEQUENTIAL CHAIN: agent A runs, then agent B gets A output injected',
    '    // Add "silent": true to hide agent messages — base will post one unified response',
    '    {',
    '      "type": "chain",',
    '      "silent": true,',
    '      "steps": [',
    '        { "agentId": "id_A", "instruction": "Research X thoroughly" },',
    '        { "agentId": "id_B", "instruction": "Using the research above, write a poem" }',
    '      ]',
    '    },',
    '    // For parallel agents, also use silent: true when base should synthesize',
    '    { "type": "run_agent", "agentId": "id", "instruction": "...", "silent": true }',
    '  ]',
    '}',
    '',
    'CRITICAL RULES:',
    '- ALWAYS populate actions[] — if you mention running an agent it MUST be in actions[]',
    '- Use "run_agent" when agents work independently at the same time',
    '- Use "chain" when agent B needs agent A\'s OUTPUT to do its job (research→write, analyze→summarize)',
    '- Set "silent": true on chains/actions when the user wants one clean unified response from base',
    '- When silent, collect all agent outputs and post ONE synthesized response as base at the end',
    '- Default to silent: true unless the user explicitly wants to see each agent\'s raw output',
    '- In a chain, the previous agent\'s full output is automatically injected into the next step',
    '- NEVER say "I\'ll do X first then Y" without putting it in a chain action',
    '- If clarification is needed, set needsConfirmation: true and actions: []',
    '- NEVER silently reroute to a different agent — always ask first',
    '- If a user asks to test a specific agent, only use that agent',
    '- If an agent fails due to key/quota issues, set needsConfirmation: true',
    '',
    'Keep responses warm, clear, and direct.',
  ].join('\n')
}

export class BaseOrchestrator extends EventEmitter {
  constructor(
    private registry: AgentRegistry,
    private runner: AgentRunner,
    private queue: TaskQueue,
  ) {
    super()
  }

  async handleCommand(
    command: string,
    context: Record<string, any> = {},
    onStream?: (chunk: string) => void,
  ): Promise<{ response: string; actions: any[]; taskIds: string[] }> {

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      const msg = 'I need an Anthropic API key to operate. Please add one in Settings → API Keys.'
      await this.postMessage('base', 'base', 'base', msg)
      return { response: msg, actions: [], taskIds: [] }
    }

    await this.postMessage('user', 'You', 'user', command)

    const agents = await this.registry.list()
    const recentTasks = await this.queue.listRecent(undefined, 10)

    const geminiAvailable = !!process.env.GEMINI_API_KEY
    const openaiAvailable = !!process.env.OPENAI_API_KEY

    const agentWarnings = [
      ...agents
        .filter((a: any) => a.model === 'gemini' && !geminiAvailable)
        .map((a: any) => `WARNING: "${a.name}" uses Gemini but no Gemini key is configured.`),
      ...agents
        .filter((a: any) => (a.model === 'gpt-4o' || a.model === 'openai') && !openaiAvailable)
        .map((a: any) => `WARNING: "${a.name}" uses OpenAI but no OpenAI key is configured.`),
    ]

    const failedTasks = recentTasks.filter((t: any) => t.status === 'failed')
    const failedSummary = failedTasks.length > 0
      ? 'RECENT FAILURES:\n' + failedTasks.map((t: any) => {
          const agent = agents.find((a: any) => a.id === t.agent_id)
          return `- "${agent?.name || t.agent_id}" failed: ${t.error || 'unknown'}\n  Task: ${t.instruction.slice(0, 80)}`
        }).join('\n') + '\n'
      : ''

    const userContext = [
      'Agent fleet (' + agents.length + ' agents):',
      agents.map((a: any) =>
        `- ${a.name} (id: ${a.id}, model: ${a.model}, status: ${a.status}): ${a.description || 'no description'}`
      ).join('\n'),
      '',
      agentWarnings.length > 0 ? 'WARNINGS:\n' + agentWarnings.join('\n') + '\n' : '',
      failedSummary,
      'Recent tasks:',
      recentTasks.slice(0, 8).map((t: any) => {
        const agent = agents.find((a: any) => a.id === t.agent_id)
        return `- [${t.status.toUpperCase()}] ${agent?.name || 'unknown'}: ${t.instruction.slice(0, 60)}` +
          (t.status === 'failed' && t.error ? `\n    Error: ${t.error}` : '')
      }).join('\n') || 'None yet',
      '',
      'User command: ' + command,
    ].join('\n')

    let rawResponse = ''

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: getBaseSystemPrompt(),
          messages: [{ role: 'user', content: userContext }],
          stream: true,
        }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              rawResponse += event.delta.text
              onStream?.(event.delta.text)
            }
          } catch {}
        }
      }

      // Parse plan
      let plan: any = { response: '', actions: [], needsConfirmation: false }
      try {
        let clean = rawResponse
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim()
        const jsonMatch = clean.match(/\{[\s\S]*\}/)
        if (jsonMatch) clean = jsonMatch[0]
        plan = JSON.parse(clean)
      } catch {
        plan = { response: rawResponse.replace(/```json[\s\S]*```/g, '').trim() || rawResponse, actions: [], needsConfirmation: false }
      }

      const responseText = plan.response || plan.summary || 'On it.'
      await this.postMessage('base', 'base', 'base', responseText)

      if (plan.needsConfirmation) {
        return { response: responseText, actions: plan.actions || [], taskIds: [] }
      }

      console.log('[orchestrator] Actions:', JSON.stringify(plan.actions || []))
      console.log('[orchestrator] Agents:', agents.map((a: any) => `${a.id}=${a.name}`).join(', '))

      const taskIds: string[] = []

      for (const action of (plan.actions || [])) {

        // ── PARALLEL ──────────────────────────────────────────────────────
        if (action.type === 'run_agent' && action.agentId) {
          const taskId = await this.launchAgent(
            action.agentId, action.instruction, action.context || {},
            agents, geminiAvailable, openaiAvailable
          )
          if (taskId) taskIds.push(taskId)

        // ── SEQUENTIAL CHAIN ──────────────────────────────────────────────
        } else if (action.type === 'chain' && Array.isArray(action.steps) && action.steps.length > 0) {
          const chainId = generateId('chain')
          const silent = action.silent !== false // default true
          const stepNames = action.steps.map((s: any) => {
            const a = agents.find((ag: any) => ag.id === s.agentId)
            return a?.name || s.agentId
          }).join(' → ')

          console.log(`[orchestrator] Chain ${chainId} (silent=${silent}): ${stepNames}`)
          if (!silent) {
            await this.postMessage('base', 'base', 'base', `🔗 Starting chain: ${stepNames}`)
          }

          this.executeChain(chainId, action.steps, agents, geminiAvailable, openaiAvailable, silent, command)
            .then(chainTaskIds => taskIds.push(...chainTaskIds))
            .catch(err => console.error(`[orchestrator] Chain ${chainId} error:`, err))

        // ── CREATE AGENT ──────────────────────────────────────────────────
        } else if (action.type === 'create_agent') {
          const agent = await this.registry.create({
            name: action.context?.name || 'New Agent',
            model: action.context?.model || 'claude',
            system_prompt: action.context?.system_prompt || '',
            description: action.context?.description || '',
          })
          if (action.context?.instruction) {
            const taskId = await this.launchAgent(agent.id, action.context.instruction, {}, agents, geminiAvailable, openaiAvailable)
            if (taskId) taskIds.push(taskId)
          }
        }
      }

      return { response: responseText, actions: plan.actions || [], taskIds }

    } catch (err: any) {
      console.error('[orchestrator] Error:', err)
      const msg = rawResponse || ('I ran into an error: ' + err.message)
      await this.postMessage('base', 'base', 'base', msg)
      return { response: msg, actions: [], taskIds: [] }
    }
  }

  // ── Launch a single agent with key pre-flight ────────────────────────────
  private async launchAgent(
    agentId: string,
    instruction: string,
    context: Record<string, any>,
    agents: any[],
    geminiAvailable: boolean,
    openaiAvailable: boolean,
  ): Promise<string | null> {
    const agent = agents.find((a: any) => a.id === agentId)
    const agentName = agent?.name || agentId

    if (agent?.model === 'gemini' && !geminiAvailable) {
      await this.postMessage('base', 'base', 'base',
        `⚠️ **${agentName}** needs a Gemini API key. Add it in Settings → API Keys then retry.`
      )
      return null
    }
    if ((agent?.model === 'gpt-4o' || agent?.model === 'openai') && !openaiAvailable) {
      await this.postMessage('base', 'base', 'base',
        `⚠️ **${agentName}** needs an OpenAI API key. Add it in Settings → API Keys then retry.`
      )
      return null
    }

    try {
      const task = await this.runner.run(agentId, instruction, context)
      this.watchTask(task.id, agentName)
      return task.id
    } catch (err: any) {
      await this.postMessage('base', 'base', 'base',
        `⚠️ Failed to start **${agentName}**: ${err.message}`
      )
      return null
    }
  }

  // ── Synthesize multiple agent outputs into one base response ─────────────
  private async synthesizeAndPost(
    results: Array<{ agentName: string; output: string }>,
    originalCommand: string,
  ): Promise<void> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return

    const context = results
      .map(r => `=== ${r.agentName} ===\n${r.output}`)
      .join('\n\n')

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: 'You are base, an AI orchestrator. Multiple agents worked in parallel on a user request. Combine their outputs into one unified response — preserve all the actual content and results, do not summarize or shorten their work. Present it cleanly without mentioning agent names or meta-commentary.',
          messages: [{
            role: 'user',
            content: `Original request: ${originalCommand}\n\nAgent outputs to combine:\n${context}\n\nCombine these into one clean unified response, preserving all content.`
          }],
          stream: true,
        }),
      })

      let synthesized = ''
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              synthesized += event.delta.text
            }
          } catch {}
        }
      }

      if (synthesized.trim()) {
        await this.postMessage('base', 'base', 'base', synthesized.trim())
      }
    } catch (err) {
      console.error('[orchestrator] Synthesis failed:', err)
      // Fallback: just post the last agent output
      const last = results[results.length - 1]
      if (last) await this.postMessage('base', 'base', 'base', last.output)
    }
  }

  // ── Execute a chain: each step waits for the previous output ────────────
  private async executeChain(
    chainId: string,
    steps: Array<{ agentId: string; instruction: string }>,
    agents: any[],
    geminiAvailable: boolean,
    openaiAvailable: boolean,
    silent = true,
    originalCommand = '',
  ): Promise<string[]> {
    const taskIds: string[] = []
    let previousOutput = ''
    let previousAgentName = ''
    const allOutputs: Array<{ agentName: string; output: string }> = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const agent = agents.find((a: any) => a.id === step.agentId)
      const agentName = agent?.name || step.agentId
      const isLast = i === steps.length - 1

      // Strip narration lines, cap at 3000 chars
      const buildContext = (text: string): string => {
        const cleaned = text.split('\n').filter(line => {
          const t = line.trim()
          if (!t) return true
          if (t.length < 100 && /^(Now|Let me|I'll|I will|Based on|Next|Also|Let's|Here|Looking|Search|I can now|I've|I have)/i.test(t)) return false
          return true
        }).join('\n').trim()
        return cleaned.length > 3000 ? cleaned.slice(0, 3000) + '\n[...truncated]' : cleaned
      }

      const instruction = previousOutput
        ? [
            step.instruction,
            '',
            '---',
            `Context from ${previousAgentName} (use this to inform your work — do NOT reproduce it):`,
            '',
            buildContext(previousOutput),
          ].join('\n')
        : step.instruction

      if (!silent) {
        await this.postMessage('base', 'base', 'base',
          `⏳ Step ${i + 1}/${steps.length}: **${agentName}** is working...`
        )
      }

      // Key pre-flight
      if (agent?.model === 'gemini' && !geminiAvailable) {
        await this.postMessage('base', 'base', 'base',
          `⚠️ Chain stopped at step ${i + 1} — **${agentName}** needs a Gemini API key.`
        )
        break
      }
      if ((agent?.model === 'gpt-4o' || agent?.model === 'openai') && !openaiAvailable) {
        await this.postMessage('base', 'base', 'base',
          `⚠️ Chain stopped at step ${i + 1} — **${agentName}** needs an OpenAI API key.`
        )
        break
      }

      try {
        const task = await this.runner.run(step.agentId, instruction, { chainId, chainStep: i, silent })
        taskIds.push(task.id)

        // Wait for completion before next step
        const result = await this.waitForTask(task.id)

        if (result.status === 'failed') {
          await this.postMessage('base', 'base', 'base',
            `⚠️ ${silent ? '' : `Chain stopped at step ${i + 1} — `}**${agentName}** failed: ${result.error || 'unknown error'}`
          )
          break
        }

        previousOutput = result.result || ''
        previousAgentName = agentName
        allOutputs.push({ agentName, output: previousOutput })

        console.log(`[orchestrator] Chain step ${i+1} (${agentName}) result length: ${previousOutput.length}`)
        console.log(`[orchestrator] Chain step ${i+1} preview: ${previousOutput.slice(0, 100)}`)

        if (isLast) {
          if (silent) {
            console.log(`[orchestrator] Posting final chain output as base, length: ${previousOutput.length}`)
            // Build attribution footer from all steps
            const stepAgentNames = steps.map((s: any) => {
              const a = agents.find((ag: any) => ag.id === s.agentId)
              return a?.name || s.agentId
            })
            const attribution = '\n\n---\n' + allOutputs.map((o, idx) => {
              const role = idx === 0 ? '🔍 Research' : idx === allOutputs.length - 1 ? '✍️ Writing' : `⚙️ Step ${idx + 1}`
              return `${role} by **${o.agentName}**`
            }).join(' · ')
            await this.postMessage('base', 'base', 'base', (previousOutput || '(no output from chain)') + attribution)
          } else {
            await this.postMessage('base', 'base', 'base',
              `✅ Chain complete — all ${steps.length} steps done.`
            )
          }
        }

      } catch (err: any) {
        await this.postMessage('base', 'base', 'base',
          `⚠️ Chain failed at step ${i + 1} — **${agentName}**: ${err.message}`
        )
        break
      }
    }

    return taskIds
  }

  // ── Poll task until terminal state ───────────────────────────────────────
  private waitForTask(taskId: string, timeoutMs = 300000): Promise<any> {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      const check = setInterval(async () => {
        try {
          const task = await this.queue.get(taskId)
          if (!task) { clearInterval(check); reject(new Error('Task not found')); return }
          if (['completed', 'failed', 'cancelled'].includes(task.status)) {
            clearInterval(check)
            console.log(`[orchestrator] Task ${taskId} finished: status=${task.status} result_length=${task.result?.length || 0}`)
            resolve(task)
          } else if (Date.now() - start > timeoutMs) {
            clearInterval(check)
            reject(new Error('Task timed out after 5 minutes'))
          }
        } catch (err) {
          clearInterval(check)
          reject(err)
        }
      }, 1000)
    })
  }

  // ── Watch a standalone task and report failures ──────────────────────────
  private watchTask(taskId: string, agentName: string) {
    const check = setInterval(async () => {
      try {
        const task = await this.queue.get(taskId)
        if (!task) { clearInterval(check); return }

        if (task.status === 'completed') {
          clearInterval(check)
        } else if (task.status === 'failed') {
          clearInterval(check)
          const errorMsg = task.error || 'Unknown error'

          let suggestion = 'Would you like me to retry, use a different agent, or handle this differently?'
          if (errorMsg.includes('API key') || errorMsg.includes('key not configured')) {
            suggestion = 'It looks like the API key is missing or invalid. Check Settings → API Keys.'
          } else if (errorMsg.includes('401') || errorMsg.includes('403')) {
            suggestion = 'The API key was rejected. Double-check it has sufficient permissions/credits.'
          } else if (errorMsg.includes('429') || errorMsg.includes('quota')) {
            suggestion = 'Rate limit hit. You may need to wait or upgrade your plan.'
          } else if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) {
            suggestion = 'The provider\'s servers returned an error. Usually temporary — want me to retry?'
          }

          await this.postMessage('base', 'base', 'base',
            `⚠️ **${agentName}** hit an error.\n\n**Error:** ${errorMsg}\n\n${suggestion}`
          )
          try {
            const db = (await import('../db')).getDB()
            db.prepare('UPDATE agents SET status = ? WHERE id = (SELECT agent_id FROM tasks WHERE id = ?)').run('error', taskId)
          } catch {}
        }
      } catch { clearInterval(check) }
    }, 1000)

    setTimeout(() => clearInterval(check), 300000)
  }

  async getStatus() {
    const agents = await this.registry.list()
    const tasks = await this.queue.listRecent(undefined, 20)
    return {
      agents: agents.length,
      agentsRunning: agents.filter((a: any) => a.status === 'running').length,
      tasksRunning: tasks.filter((t: any) => t.status === 'running').length,
      tasksCompleted: tasks.filter((t: any) => t.status === 'completed').length,
      tasksFailed: tasks.filter((t: any) => t.status === 'failed').length,
      totalTokens: tasks.reduce((sum: number, t: any) => sum + (t.tokens_used || 0), 0),
      totalCost: tasks.reduce((sum: number, t: any) => sum + (t.cost_usd || 0), 0),
    }
  }

  private async postMessage(senderId: string, senderName: string, senderType: string, content: string) {
    const db = getDB()
    const id = generateId('msg')
    const ts = now()

    db.prepare(
      'INSERT INTO messages (id, sender_id, sender_name, sender_type, content, message_type, created_at) VALUES (?, ?, ?, ?, ?, \'message\', ?)'
    ).run(id, senderId, senderName, senderType, content, ts)

    const message = { id, senderId, senderName, senderType, content, messageType: 'message', timestamp: ts * 1000, created_at: ts }
    this.emit('message', message)
    return message
  }
}