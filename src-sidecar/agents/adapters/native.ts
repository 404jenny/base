import { Agent } from '../registry'

export interface RunOptions {
  instruction: string
  systemPrompt: string
  context?: Record<string, any>
  onChunk?: (chunk: string) => void
  signal?: AbortSignal
}

export interface RunResult {
  content: string
  tokensUsed: number
  costUsd: number
}

export async function runNativeAgent(agent: Agent, options: RunOptions): Promise<RunResult> {
  if (agent.model === 'gemini') return runGemini(agent, options)
  if (agent.model === 'gpt-4o' || agent.model === 'openai') return runOpenAI(agent, options)
  return runClaude(agent, options)
}

async function runClaude(agent: Agent, options: RunOptions): Promise<RunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No Anthropic API key configured. Please add it in Settings.')

  const { instruction, systemPrompt, context, onChunk, signal } = options

  const messages: any[] = [{ role: 'user', content: instruction }]
  if (context?.history) messages.unshift(...context.history)

  const tools = [{ type: 'web_search_20250305', name: 'web_search' }]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools,
      stream: true,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(`Claude API error: ${err.error?.message || response.statusText}`)
  }

  let content = ''
  let inputTokens = 0
  let outputTokens = 0
  let currentToolName = ''
  let toolInputBuffer = ''

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const event = JSON.parse(data)

        if (event.type === 'content_block_start') {
          if (event.content_block?.type === 'tool_use') {
            currentToolName = event.content_block.name
            toolInputBuffer = ''
            if (currentToolName === 'web_search') {
              onChunk?.('\n🔍 *Searching the web...*\n')
            }
          }
        }

        if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta') {
            content += event.delta.text
            onChunk?.(event.delta.text)
          }
          if (event.delta?.type === 'input_json_delta') {
            toolInputBuffer += event.delta.partial_json || ''
          }
        }

        if (event.type === 'content_block_stop' && currentToolName === 'web_search') {
          try {
            const parsed = JSON.parse(toolInputBuffer)
            if (parsed.query) onChunk?.(`*Searched: "${parsed.query}"*\n\n`)
          } catch {}
          currentToolName = ''
          toolInputBuffer = ''
        }

        if (event.type === 'message_start') inputTokens = event.message?.usage?.input_tokens || 0
        if (event.type === 'message_delta') outputTokens = event.usage?.output_tokens || 0
      } catch {}
    }
  }

  const tokensUsed = inputTokens + outputTokens
  const costUsd = (inputTokens * 0.000003) + (outputTokens * 0.000015)
  return { content, tokensUsed, costUsd }
}

async function runGemini(agent: Agent, options: RunOptions): Promise<RunResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No Gemini API key configured. Please add it in Settings.')

  const { instruction, systemPrompt, onChunk, signal } = options

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        generationConfig: { maxOutputTokens: 8192 },
        tools: [{ googleSearch: {} }],
      }),
    }
  )

  if (!response.ok) {
    let errMsg = `Gemini API error (${response.status})`
    try {
      const errBody = await response.json()
      errMsg = errBody.error?.message || errMsg
    } catch {}
    throw new Error(errMsg)
  }

  let content = ''
  let tokensUsed = 0

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
        const text = event.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) { content += text; onChunk?.(text) }
        if (event.usageMetadata) tokensUsed = event.usageMetadata.totalTokenCount || 0
      } catch {}
    }
  }

  return { content, tokensUsed, costUsd: tokensUsed * 0.0000001 }
}

async function runOpenAI(agent: Agent, options: RunOptions): Promise<RunResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('No OpenAI API key configured. Please add it in Settings.')

  const { instruction, systemPrompt, onChunk, signal } = options

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(`OpenAI API error: ${err.error?.message || response.statusText}`)
  }

  let content = ''
  let inputTokens = 0
  let outputTokens = 0

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const event = JSON.parse(data)
        const chunk = event.choices?.[0]?.delta?.content || ''
        if (chunk) { content += chunk; onChunk?.(chunk) }
        if (event.usage) {
          inputTokens = event.usage.prompt_tokens || 0
          outputTokens = event.usage.completion_tokens || 0
        }
      } catch {}
    }
  }

  const tokensUsed = inputTokens + outputTokens
  const costUsd = (inputTokens * 0.0000025) + (outputTokens * 0.00001)
  return { content, tokensUsed, costUsd }
}