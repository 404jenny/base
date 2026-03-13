import { useState, useEffect, useCallback, useRef } from 'react';
import { Agent, Message, Insight, SystemLog } from '../types';
import { INITIAL_AGENTS, INITIAL_MESSAGES, INITIAL_INSIGHTS, INITIAL_LOGS } from '../constants';

// ─── System prompts ───────────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  Research: `You are ResearchBot, an expert AI research agent inside BASE — an agent operating system. Research topics thoroughly, surface key findings, data points, and actionable insights. Be concise but thorough. Format output clearly with sections when helpful.`,
  Creative: `You are CopyGen, a creative writing AI agent inside BASE. Produce compelling, polished written content. Produce drafts, refine ideas, suggest hooks, headlines, and narrative structures.`,
  Data: `You are DataPipeline, a data analysis AI agent inside BASE. Analyze data, identify patterns, produce structured insights. Be precise and methodical.`,
  Security: `You are SecureOps, a security AI agent inside BASE. Identify vulnerabilities, analyze risks, recommend mitigations. Flag issues with severity levels and actionable steps.`,
};

const BASE_SYSTEM_PROMPT = `You are BASE, an intelligent meta-agent and orchestrator inside an AI agent operating system called BASE.

You have access to a fleet of AI agents. When the user gives you a command, you must:
1. Understand their intent
2. Decide the best course of action — route to an existing agent, retask an idle agent, or recommend deploying a new one
3. Extract the actual task to be executed
4. Respond ONLY with a JSON object (no markdown, no explanation) in this exact format:

{
  "thinking": "Brief reasoning about what the user wants and how you'll handle it (1-2 sentences)",
  "action": "retask" | "new",
  "targetAgentId": "existing agent id if action is retask, otherwise null",
  "targetAgentName": "name of agent if retasking, otherwise null",
  "agentType": "Research" | "Creative" | "Data" | "Security",
  "agentName": "name for new agent if action is new, otherwise null",
  "agentColor": "hex color for new agent if action is new, otherwise null",
  "model": "claude" | "gemini",
  "task": "the actual task the agent should execute — be specific and detailed"
}

Model selection guide: use claude for reasoning/analysis/writing, gemini for speed/broad knowledge.
Color guide for new agents: Research=#3b82f6, Creative=#10b981, Data=#f59e0b, Security=#ef4444`;

// ─── API calls ────────────────────────────────────────────────────────────────

async function callClaude(messages: {role: string, content: string}[], system: string, signal?: AbortSignal): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY || '';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, system, messages }),
    signal,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any)?.error?.message || `Claude error ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function streamClaude(task: string, agentType: string, onChunk: (t: string) => void, signal: AbortSignal) {
  const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY || '';
  const system = AGENT_SYSTEM_PROMPTS[agentType] || AGENT_SYSTEM_PROMPTS.Research;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, stream: true, system, messages: [{ role: 'user', content: task }] }),
    signal,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any)?.error?.message || `Claude error ${res.status}`); }
  await streamSSE(res, onChunk, 'text_delta');
}

async function streamGemini(task: string, agentType: string, onChunk: (t: string) => void, signal: AbortSignal) {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
  const system = AGENT_SYSTEM_PROMPTS[agentType] || AGENT_SYSTEM_PROMPTS.Research;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: task }] }], generationConfig: { maxOutputTokens: 1024 } }),
    signal,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any)?.error?.message || `Gemini error ${res.status}`); }
  await streamSSE(res, onChunk, 'gemini');
}

async function streamSSE(res: Response, onChunk: (t: string) => void, mode: string) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const d = line.slice(6).trim();
      if (!d || d === '[DONE]') continue;
      try {
        const p = JSON.parse(d);
        if (mode === 'gemini') { const t = p?.candidates?.[0]?.content?.parts?.[0]?.text; if (t) onChunk(t); }
        else { if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta') onChunk(p.delta.text); }
      } catch {}
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [insights, setInsights] = useState<Insight[]>(INITIAL_INSIGHTS);
  const [logs, setLogs] = useState<SystemLog[]>(INITIAL_LOGS);
  const [baseThinking, setBaseThinking] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  // ─── Progress simulation ───────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => {
        if (agent.status !== 'running') return agent;
        return { ...agent, progress: Math.min(99, agent.progress + Math.random() * 1.5), lastUpdate: new Date().toISOString(),
          metrics: { ...agent.metrics, cpu: [...agent.metrics.cpu.slice(1), Math.floor(Math.random() * 40 + 40)], memory: [...agent.metrics.memory.slice(1), Math.floor(Math.random() * 20 + 30)], tokens: agent.metrics.tokens + Math.floor(Math.random() * 80) } };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ─── Simulated messages for seeded agents ─────────────────────────────────
  useEffect(() => {
    const simulate = () => {
      const running = agents.filter(a => a.status === 'running' && !abortControllers.current.has(a.id));
      if (!running.length) return;
      const sender = running[Math.floor(Math.random() * running.length)];
      const types: Message['type'][] = ['thought', 'action', 'output'];
      const type = types[Math.floor(Math.random() * types.length)];
      const pool = { thought: ['Analyzing alternative sources.', 'Reconsidering approach.'], action: ['Refining parameters.', 'Executing batch process.'], output: ['Completed initial analysis.', 'Identified key action items.'] };
      setMessages(prev => [{ id: Math.random().toString(36).substring(7), senderId: sender.id, senderName: sender.name, content: pool[type][Math.floor(Math.random() * pool[type].length)], timestamp: new Date().toISOString(), type, reasoning: Math.random() > 0.5 ? 'Maintaining data integrity.' : undefined }, ...prev].slice(0, 100));
    };
    const t = setTimeout(simulate, Math.random() * 5000 + 5000);
    return () => clearTimeout(t);
  }, [agents, messages.length]);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const addLog = (level: SystemLog['level'], source: string, message: string) => {
    setLogs(prev => [{ id: Math.random().toString(36).substring(7), timestamp: new Date().toISOString(), level, source, message }, ...prev].slice(0, 100));
  };

  const addMessage = (senderId: string, senderName: string, content: string, type: Message['type'], reasoning?: string): string => {
    const id = Math.random().toString(36).substring(7);
    setMessages(prev => [{ id, senderId, senderName, content, timestamp: new Date().toISOString(), type, reasoning }, ...prev].slice(0, 100));
    return id;
  };

  // ─── Run a task on an agent (streaming) ───────────────────────────────────
  const runAgentTask = useCallback(async (agentId: string, agentName: string, agentType: string, task: string, model: 'claude' | 'gemini') => {
    const modelLabel = model === 'claude' ? 'Claude Sonnet' : 'Gemini Flash';
    addMessage(agentId, agentName, `Starting via ${modelLabel}: "${task}"`, 'thought', 'Task dispatched by BASE.');
    const outputId = addMessage(agentId, agentName, '', 'output');

    const controller = new AbortController();
    abortControllers.current.set(agentId, controller);

    const onChunk = (chunk: string) => {
      setMessages(prev => prev.map(m => m.id === outputId ? { ...m, content: m.content + chunk } : m));
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, metrics: { ...a.metrics, tokens: a.metrics.tokens + chunk.length } } : a));
    };

    try {
      if (model === 'gemini') await streamGemini(task, agentType, onChunk, controller.signal);
      else await streamClaude(task, agentType, onChunk, controller.signal);
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'stopped', progress: 100 } : a));
      addLog('success', agentName, `Task completed via ${modelLabel}.`);
      setInsights(prev => [{ id: Math.random().toString(36).substring(7), type: 'info', message: `${agentName} finished. Review output in the feed.`, timestamp: new Date().toISOString(), actionable: false, resolved: false }, ...prev].slice(0, 10));
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const errorText = err?.message?.includes('401') || err?.message?.includes('API_KEY') ? `Invalid API key. Check your .env file.` : err?.message || 'Unknown error.';
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'error' } : a));
      addMessage(agentId, agentName, `⚠️ ${errorText}`, 'thought');
      addLog('error', agentName, errorText);
    } finally {
      abortControllers.current.delete(agentId);
    }
  }, []);

  // ─── BASE: interpret user command and route ────────────────────────────────
  const sendCommand = useCallback(async (userInput: string, currentAgents: Agent[]) => {
    if (!userInput.trim()) return;
    setBaseThinking(true);

    // Show user message in feed
    addMessage('user', 'You', userInput, 'question');
    addLog('info', 'BASE', `Processing command: "${userInput}"`);

    try {
      // BASE reasoning — Claude decides what to do
      const agentContext = currentAgents.map(a => `- ${a.name} (id: ${a.id}, type: ${a.type}, status: ${a.status}, task: "${a.currentTask || 'none'}")`).join('\n');
      const prompt = `Current agent fleet:\n${agentContext}\n\nUser command: "${userInput}"\n\nDecide how to handle this command.`;

      const rawDecision = await callClaude([{ role: 'user', content: prompt }], BASE_SYSTEM_PROMPT);

      // Parse BASE's decision
      let decision: any;
      try {
        const cleaned = rawDecision.replace(/```json|```/g, '').trim();
        decision = JSON.parse(cleaned);
      } catch {
        throw new Error('BASE could not parse routing decision.');
      }

      // Show BASE's thinking in feed
      addMessage('base', 'BASE', decision.thinking, 'thought', 'Routing decision made by BASE meta-agent.');
      addLog('info', 'BASE', `Action: ${decision.action} → ${decision.targetAgentName || decision.agentName}`);

      if (decision.action === 'retask' && decision.targetAgentId) {
        // Retask existing agent
        const target = currentAgents.find(a => a.id === decision.targetAgentId);
        if (!target) throw new Error(`Agent ${decision.targetAgentId} not found.`);

        // Cancel any running task
        abortControllers.current.get(target.id)?.abort();
        abortControllers.current.delete(target.id);

        setAgents(prev => prev.map(a => a.id === target.id ? { ...a, status: 'running', progress: 0, currentTask: decision.task } : a));
        addLog('success', 'BASE', `Retasked ${target.name}: "${decision.task}"`);
        await runAgentTask(target.id, target.name, target.type, decision.task, decision.model || 'claude');

      } else {
        // Deploy new agent
        const agentId = Math.random().toString(36).substring(7);
        const newAgent: Agent = {
          id: agentId,
          name: decision.agentName || 'New Agent',
          type: decision.agentType || 'Research',
          status: 'running',
          currentTask: decision.task,
          progress: 0,
          lastUpdate: new Date().toISOString(),
          color: decision.agentColor || '#3b82f6',
          metrics: { cpu: [0,0,0,0,0], memory: [0,0,0,0,0], tokens: 0 },
        };
        setAgents(prev => [...prev, newAgent]);
        addLog('success', 'BASE', `Deployed new agent: ${newAgent.name}`);
        await runAgentTask(agentId, newAgent.name, newAgent.type, decision.task, decision.model || 'claude');
      }

    } catch (err: any) {
      const msg = err?.message || 'BASE encountered an error.';
      addMessage('base', 'BASE', `⚠️ ${msg}`, 'thought');
      addLog('error', 'BASE', msg);
    } finally {
      setBaseThinking(false);
    }
  }, [runAgentTask]);

  // ─── Manual controls ───────────────────────────────────────────────────────
  const updateAgentStatus = useCallback((id: string, action: 'play' | 'pause' | 'stop') => {
    if (action === 'stop') { abortControllers.current.get(id)?.abort(); abortControllers.current.delete(id); }
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: action === 'play' ? 'running' : action === 'pause' ? 'paused' : 'stopped' } : a));
    addLog(action === 'stop' ? 'warn' : 'info', 'Operator', `Agent ${id}: ${action}`);
  }, []);

  const resolveInsight = useCallback((id: string) => {
    setInsights(prev => prev.map(i => i.id === id ? { ...i, resolved: true } : i));
  }, []);

  const deployAgent = useCallback(async (agentData: { name: string; type: string; currentTask: string; color: string; model?: 'claude' | 'gemini' }) => {
    const agentId = Math.random().toString(36).substring(7);
    const model = agentData.model ?? 'claude';
    const newAgent: Agent = { ...agentData, id: agentId, status: 'running', progress: 0, lastUpdate: new Date().toISOString(), metrics: { cpu: [0,0,0,0,0], memory: [0,0,0,0,0], tokens: 0 } };
    setAgents(prev => [...prev, newAgent]);
    addLog('success', 'System', `Agent deployed: ${newAgent.name} via ${model === 'claude' ? 'Claude' : 'Gemini'}`);
    if (agentData.currentTask?.trim()) {
      await runAgentTask(agentId, newAgent.name, newAgent.type, agentData.currentTask, model);
    }
  }, [runAgentTask]);

  return { agents, messages, insights, logs, baseThinking, updateAgentStatus, resolveInsight, deployAgent, sendCommand };
};