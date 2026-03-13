import { Agent } from '../registry'
import { RunOptions, RunResult } from './native'

export async function runHttpAgent(agent: Agent, options: RunOptions): Promise<RunResult> {
  const config = agent.connection_config
  if (!config.httpEndpoint) throw new Error(`Agent ${agent.name} has no HTTP endpoint configured`)

  const { instruction, context, onChunk } = options

  const body = {
    instruction,
    system_prompt: options.systemPrompt,
    context: context || {},
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.httpAuthHeader) headers['Authorization'] = config.httpAuthHeader

  const response = await fetch(config.httpEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP agent error ${response.status}: ${text}`)
  }

  const contentType = response.headers.get('content-type') || ''

  // Handle streaming response
  if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
    let content = ''
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      content += chunk
      onChunk?.(chunk)
    }

    return { content, tokensUsed: 0, costUsd: 0 }
  }

  // Handle JSON response
  const data = await response.json()
  const content = data.result || data.content || data.output || data.message || JSON.stringify(data)
  onChunk?.(content)
  return { content, tokensUsed: data.tokens_used || 0, costUsd: data.cost || 0 }
}