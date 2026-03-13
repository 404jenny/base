import React from 'react';
import { Agent, Message, Insight, SystemLog } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Zap, Brain, AlertTriangle, CheckCircle, Clock, TrendingUp, Sparkles, Activity } from 'lucide-react';

interface DashboardProps {
  tasks?: any[];
  agents: Agent[];
  messages: Message[];
  insights: Insight[];
  logs: SystemLog[];
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ agents, messages, insights, logs, tasks, onNavigate }) => {
  const running = agents.filter(a => a.status === 'running');
  const paused = agents.filter(a => a.status === 'paused');
  const errored = agents.filter(a => a.status === 'error');
  const totalTokens = (tasks && tasks.length > 0)
    ? tasks.reduce((sum: number, t: any) => sum + (t.tokens_used || 0), 0)
    : agents.reduce((sum, a) => sum + a.metrics.tokens, 0);
  const unresolvedInsights = insights.filter(i => !i.resolved);

  const statCards = [
    { label: 'Active Agents', value: running.length, sub: `${agents.length} total`, color: '#10b981', icon: Activity },
    { label: 'Unresolved Alerts', value: unresolvedInsights.length, sub: 'from BASE reporter', color: unresolvedInsights.length > 0 ? '#f59e0b' : '#10b981', icon: AlertTriangle },
    { label: 'Tokens Used', value: totalTokens.toLocaleString(), sub: 'across all agents', color: '#6366f1', icon: Brain },
    { label: 'Messages', value: messages.length, sub: 'in feed', color: '#3b82f6', icon: Zap },
  ];

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running': return '#10b981';
      case 'paused': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'stopped': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">

      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-mono text-lg font-bold tracking-tight">Mission Control</h1>
          <p className="text-white/30 text-[11px] font-mono uppercase tracking-widest mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <Sparkles size={13} className="text-indigo-400" />
          <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">BASE Online</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel rounded-2xl p-5 relative overflow-hidden group cursor-default"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: `radial-gradient(circle at 80% 20%, ${card.color}15, transparent 60%)` }} />
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-xl bg-white/5">
                <card.icon size={16} style={{ color: card.color }} />
              </div>
              <TrendingUp size={12} className="text-white/10" />
            </div>
            <p className="text-2xl font-mono font-bold text-white">{card.value}</p>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-1">{card.label}</p>
            <p className="text-[9px] font-mono text-white/20 mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Agent Fleet */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="col-span-2 glass-panel rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white font-mono text-xs font-bold uppercase tracking-widest">Agent Fleet</h2>
              <p className="text-white/30 text-[9px] font-mono uppercase mt-0.5">{running.length} running · {paused.length} paused · {errored.length} errors</p>
            </div>
            <button onClick={() => onNavigate('orchestration')} className="text-[9px] font-mono text-white/30 hover:text-white uppercase tracking-widest transition-colors">
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {agents.slice(0, 5).map((agent, i) => (
              <motion.div key={agent.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.06 }}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-black font-bold text-xs shrink-0"
                  style={{ backgroundColor: agent.color, boxShadow: `0 0 12px ${agent.color}44` }}
                >
                  {agent.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-xs font-bold truncate">{agent.name}</span>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getStatusColor(agent.status), boxShadow: agent.status === 'running' ? `0 0 6px ${getStatusColor(agent.status)}` : 'none' }} />
                    <span className="text-[9px] font-mono uppercase text-white/30">{agent.status}</span>
                  </div>
                  <p className="text-[10px] font-mono text-white/30 truncate mt-0.5">{agent.currentTask || 'No active task'}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${agent.progress}%`, backgroundColor: agent.color }} />
                  </div>
                  <p className="text-[9px] font-mono text-white/20 mt-1">{Math.round(agent.progress)}%</p>
                </div>
              </motion.div>
            ))}
            {agents.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-white/20 font-mono text-xs uppercase tracking-widest">No agents deployed</p>
                <p className="text-white/10 font-mono text-[10px] mt-1">Press Ctrl+N to deploy your first agent</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-4">

          {/* BASE Insights */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-mono text-xs font-bold uppercase tracking-widest">BASE Insights</h2>
              <button onClick={() => onNavigate('communication')} className="text-[9px] font-mono text-indigo-400/60 hover:text-indigo-400 uppercase tracking-widest transition-colors">View →</button>
            </div>
            <div className="space-y-2">
              {unresolvedInsights.slice(0, 3).map(insight => (
                <div key={insight.id} className={cn('p-3 rounded-xl border text-[10px] font-mono leading-relaxed',
                  insight.type === 'conflict' ? 'bg-red-500/5 border-red-500/15 text-red-300' :
                  insight.type === 'overlap' ? 'bg-amber-500/5 border-amber-500/15 text-amber-300' :
                  'bg-indigo-500/5 border-indigo-500/15 text-indigo-300'
                )}>
                  {insight.message}
                </div>
              ))}
              {unresolvedInsights.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-mono text-emerald-400">All clear — no active alerts</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent activity */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-mono text-xs font-bold uppercase tracking-widest">Recent Activity</h2>
              <button onClick={() => onNavigate('logs')} className="text-[9px] font-mono text-white/30 hover:text-white uppercase tracking-widest transition-colors">Logs →</button>
            </div>
            <div className="space-y-2">
              {logs.slice(0, 4).map(log => (
                <div key={log.id} className="flex items-start gap-2">
                  <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                    log.level === 'error' ? 'bg-red-400' : log.level === 'warn' ? 'bg-amber-400' : log.level === 'success' ? 'bg-emerald-400' : 'bg-white/20'
                  )} />
                  <p className="text-[10px] font-mono text-white/40 leading-relaxed">{log.message}</p>
                </div>
              ))}
              {logs.length === 0 && <p className="text-[10px] font-mono text-white/20">No recent activity</p>}
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-panel rounded-2xl p-5">
            <h2 className="text-white font-mono text-xs font-bold uppercase tracking-widest mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => onNavigate('communication')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors text-left">
                <Sparkles size={13} className="text-indigo-400 shrink-0" />
                <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest">Command BASE</span>
              </button>
              <button onClick={() => onNavigate('orchestration')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors text-left">
                <Zap size={13} className="text-white/40 shrink-0" />
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Orchestration Layer</span>
              </button>
              <button onClick={() => onNavigate('telemetry')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors text-left">
                <Activity size={13} className="text-white/40 shrink-0" />
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">View Telemetry</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};