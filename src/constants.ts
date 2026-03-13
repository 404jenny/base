import { Agent, Message, Insight, SystemLog } from './types';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'researcher-1',
    name: 'ResearchBot',
    type: 'Information Retrieval',
    status: 'running',
    currentTask: 'Analyzing market trends for 2026',
    progress: 65,
    lastUpdate: new Date().toISOString(),
    color: '#3b82f6',
    metrics: { cpu: [45, 52, 48, 60, 55], memory: [30, 32, 31, 35, 34], tokens: 12400 },
  },
  {
    id: 'writer-1',
    name: 'CopyGen',
    type: 'Content Generation',
    status: 'idle',
    progress: 0,
    lastUpdate: new Date().toISOString(),
    color: '#10b981',
    metrics: { cpu: [10, 12, 11, 10, 12], memory: [15, 16, 15, 16, 15], tokens: 4500 },
  },
  {
    id: 'analyst-1',
    name: 'DataPipeline',
    type: 'Data Processing',
    status: 'paused',
    currentTask: 'Cleaning dataset_v2.csv',
    progress: 42,
    lastUpdate: new Date().toISOString(),
    color: '#f59e0b',
    metrics: { cpu: [85, 88, 82, 90, 87], memory: [60, 62, 61, 65, 64], tokens: 8900 },
  },
  {
    id: 'coordinator-1',
    name: 'Orchestrator',
    type: 'System Management',
    status: 'running',
    currentTask: 'Monitoring agent health',
    progress: 100,
    lastUpdate: new Date().toISOString(),
    color: '#8b5cf6',
    metrics: { cpu: [5, 6, 5, 7, 6], memory: [10, 11, 10, 12, 11], tokens: 1200 },
  },
];

export const INITIAL_LOGS: SystemLog[] = [
  { id: 'l1', timestamp: new Date().toISOString(), level: 'info', source: 'System', message: 'BASE OS v1.0.4 initialized.' },
  { id: 'l2', timestamp: new Date().toISOString(), level: 'success', source: 'Orchestrator', message: 'Agent fleet heartbeat detected.' },
  { id: 'l3', timestamp: new Date().toISOString(), level: 'info', source: 'ResearchBot', message: 'Starting task: Market Analysis 2026.' },
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    senderId: 'researcher-1',
    senderName: 'ResearchBot',
    content: 'Searching for "AI Agent Operating Systems" in recent publications.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    type: 'action',
  },
  {
    id: 'm2',
    senderId: 'researcher-1',
    senderName: 'ResearchBot',
    content: 'Found 12 relevant papers. Starting synthesis.',
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    type: 'thought',
    reasoning: 'Synthesis is required to provide a concise summary for the next stage.',
  },
  {
    id: 'm3',
    senderId: 'researcher-1',
    senderName: 'ResearchBot',
    content: 'DataPipeline, can you verify the statistical significance of these findings?',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    type: 'question',
    targetId: 'analyst-1',
  },
];

export const INITIAL_INSIGHTS: Insight[] = [
  {
    id: 'i1',
    type: 'handoff',
    message: 'ResearchBot just finished — should I auto-handoff to DataPipeline?',
    timestamp: new Date().toISOString(),
    actionable: true,
    resolved: false,
  },
];
