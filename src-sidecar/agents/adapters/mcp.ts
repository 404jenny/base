import { Agent } from '../registry'
import { RunOptions, RunResult } from './native'

/**
 * MCP (Model Context Protocol) adapter
 * Connects to any MCP-compatible server and runs tasks through it
 */
export async function runMCPAgent(agent: Agent, options: RunOptions): Promise<RunResult> {
  const config = agent.connection_config
  if (!config.mcpUrl) throw new Error(`Agent ${agent.name} has no MCP URL configured`)

  const { instruction, systemPrompt, onChunk, signal } = options

  // Step 1: Initialize MCP session
  const initResponse = await fetch(`${config.mcpUrl}/initialize`, {
    method: 'POST',
    signal,
    headers: buildHeaders(config.mcpAuthToken),
    body: JSON.stringify({
      protocolVersion: '2024-11-05',
      capabilities: { sampling: {} },
      clientInfo: { name: 'base', version: '1.0.0' },
    }),
  })

  if (!initResponse.ok) {
    throw new Error(`MCP init failed: ${initResponse.status} ${await initResponse.text()}`)
  }

  const { serverInfo, capabilities } = await initResponse.json()
  console.log(`[mcp] Connected to ${serverInfo?.name || 'MCP server'}`)

  // Step 2: List available tools
  const toolsResponse = await fetch(`${config.mcpUrl}/tools/list`, {
    method: 'POST',
    signal,
    headers: buildHeaders(config.mcpAuthToken),
    body: JSON.stringify({}),
  })

  let tools: any[] = []
  if (toolsResponse.ok) {
    const data = await toolsResponse.json()
    tools = data.tools || []
    console.log(`[mcp] Available tools: ${tools.map((t: any) => t.name).join(', ')}`)
  }

  // Step 3: Use base's Claude to decide which MCP tools to call + how
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key required for MCP orchestration')

  const toolDefinitions = tools.map((t: any) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema || { type: 'object', properties: {} },
  }))

  // Call Claude with MCP tools available
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt || `You are ${agent.name}. Use the available MCP tools to complete the task.`,
      messages: [{ role: 'user', content: instruction }],
      tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
    }),
  })

  if (!claudeResponse.ok) throw new Error('Claude orchestration failed')

  const claudeData = await claudeResponse.json()
  let fullContent = ''
  let tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0)

  // Step 4: Execute any tool calls Claude requested
  for (const block of claudeData.content || []) {
    if (block.type === 'text') {
      fullContent += block.text
      onChunk?.(block.text)
    } else if (block.type === 'tool_use') {
      const toolChunk = `\n[Calling MCP tool: ${block.name}...]\n`
      fullContent += toolChunk
      onChunk?.(toolChunk)

      // Call the MCP tool
      const toolResult = await callMCPTool(config.mcpUrl, config.mcpAuthToken, block.name, block.input, signal)

      const resultChunk = `[${block.name} result]: ${JSON.stringify(toolResult)}\n`
      fullContent += resultChunk
      onChunk?.(resultChunk)
    }
  }

  return {
    content: fullContent,
    tokensUsed,
    costUsd: tokensUsed * 0.000009,
  }
}

async function callMCPTool(
  mcpUrl: string,
  authToken: string | undefined,
  toolName: string,
  toolInput: any,
  signal?: AbortSignal,
): Promise<any> {
  const response = await fetch(`${mcpUrl}/tools/call`, {
    method: 'POST',
    signal,
    headers: buildHeaders(authToken),
    body: JSON.stringify({
      name: toolName,
      arguments: toolInput,
    }),
  })

  if (!response.ok) {
    throw new Error(`MCP tool call failed: ${response.status}`)
  }

  const data = await response.json()

  // MCP returns content array
  if (data.content) {
    return data.content
      .map((c: any) => c.type === 'text' ? c.text : JSON.stringify(c))
      .join('\n')
  }

  return data
}

function buildHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  return headers
}

/**
 * Test MCP connection — supports both SSE and HTTP REST transports
 */
export async function testMCPConnection(mcpUrl: string, authToken?: string): Promise<{
  ok: boolean
  serverName?: string
  tools?: string[]
  error?: string
  transport?: string
}> {
  // Normalise URL — strip trailing /sse for base URL
  const baseUrl = mcpUrl.replace(/\/sse$/, '').replace(/\/$/, '')
  const isSSE = mcpUrl.includes('/sse')

  // Try SSE/JSON-RPC transport first (used by korotovsky, official Slack MCP, etc.)
  if (isSSE || mcpUrl.includes('localhost') || mcpUrl.includes('127.0.0.1')) {
    try {
      const result = await testSSETransport(baseUrl, authToken)
      if (result.ok) return { ...result, transport: 'sse' }
    } catch {}
  }

  // Fallback: try HTTP REST transport
  try {
    const response = await fetch(`${baseUrl}/initialize`, {
      method: 'POST',
      headers: buildHeaders(authToken),
      body: JSON.stringify({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'base', version: '1.0.0' },
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return { ok: false, error: `Server returned ${response.status}` }
    const { serverInfo } = await response.json()

    const toolsRes = await fetch(`${baseUrl}/tools/list`, {
      method: 'POST',
      headers: buildHeaders(authToken),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    })

    let tools: string[] = []
    if (toolsRes.ok) {
      const data = await toolsRes.json()
      tools = (data.tools || []).map((t: any) => t.name)
    }

    return { ok: true, serverName: serverInfo?.name, tools, transport: 'http' }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Test SSE/JSON-RPC MCP transport (used by korotovsky slack-mcp-server, etc.)
 */
async function testSSETransport(baseUrl: string, authToken?: string): Promise<{
  ok: boolean
  serverName?: string
  tools?: string[]
  error?: string
}> {
  // Send JSON-RPC initialize request to /sse endpoint
  const headers = buildHeaders(authToken)
  headers['Accept'] = 'application/json, text/event-stream'

  // Step 1: initialize
  const initRes = await fetch(`${baseUrl}/sse`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'base', version: '1.0.0' },
      },
    }),
    signal: AbortSignal.timeout(8000),
  })

  // SSE servers return 200 with event-stream or plain JSON
  if (!initRes.ok && initRes.status !== 405) {
    throw new Error(`SSE init failed: ${initRes.status}`)
  }

  // Step 2: list tools via messages endpoint
  const toolsRes = await fetch(`${baseUrl}/sse`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }),
    signal: AbortSignal.timeout(8000),
  })

  let tools: string[] = []
  let serverName: string | undefined

  if (toolsRes.ok) {
    const contentType = toolsRes.headers.get('content-type') || ''
    const text = await toolsRes.text()

    if (contentType.includes('text/event-stream')) {
      // Parse SSE events
      const lines = text.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.result?.tools) tools = data.result.tools.map((t: any) => t.name)
            if (data.result?.serverInfo?.name) serverName = data.result.serverInfo.name
          } catch {}
        }
      }
    } else {
      try {
        const data = JSON.parse(text)
        if (data.result?.tools) tools = data.result.tools.map((t: any) => t.name)
        if (data.result?.serverInfo?.name) serverName = data.result.serverInfo.name
      } catch {}
    }
  }

  // If we got this far without throwing, connection works
  return { ok: true, serverName: serverName || 'MCP Server', tools }
}