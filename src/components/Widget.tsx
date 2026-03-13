import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Agent, Message } from '../types';
import { Sparkles, X, Maximize2, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';

interface WidgetProps {
  agents: Agent[];
  messages: Message[];
  onExpand: () => void;
  onClose: () => void;
  onBaseCommand: (cmd: string) => void;
}

export const Widget: React.FC<WidgetProps> = ({ agents, messages, onExpand, onClose, onBaseCommand }) => {
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const running = agents.filter(a => a.status === 'running');
  const recentMessages = messages.slice(0, 5);

  const handleExpand = async () => {
    try {
      await invoke('set_widget_mode', { enabled: false });
    } catch (e) { console.error(e); }
    onExpand();
  };

  const handleClose = async () => {
    try {
      await invoke('set_widget_mode', { enabled: false });
    } catch (e) { console.error(e); }
    onClose();
  };

  const handleSend = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    setIsThinking(true);
    try { await onBaseCommand(cmd); } finally { setIsThinking(false); }
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running': return '#10b981';
      case 'paused': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#4b5563';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="flex flex-col h-screen w-full bg-[#080808] border border-white/10 overflow-hidden"
      style={{ boxShadow: '0 0 60px rgba(99,102,241,0.15), 0 25px 50px rgba(0,0,0,0.8)' }}
    >
      {/* Title bar */}
      <div data-tauri-drag-region className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/40 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-indigo-400" />
          <span className="text-[10px] font-mono text-white/60 uppercase tracking-widest font-bold">BASE</span>
          {running.length > 0 && (
            <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-1.5 py-0.5">
              <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] font-mono text-emerald-400">{running.length} running</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExpand} title="Expand to full view" className="text-white/20 hover:text-white transition-colors">
            <Maximize2 size={12} />
          </button>
          <button onClick={handleClose} title="Exit widget" className="text-white/20 hover:text-red-400 transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Agent pills */}
      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest mb-2">Fleet Status</p>
        <div className="flex flex-wrap gap-2">
          {agents.map(agent => (
            <div key={agent.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColor(agent.status), boxShadow: agent.status === 'running' ? `0 0 6px ${getStatusColor(agent.status)}` : 'none' }} />
              <span className="text-[9px] font-mono text-white/50">{agent.name}</span>
              {agent.status === 'running' && (
                <div className="w-8 h-0.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${agent.progress}%` }} />
                </div>
              )}
            </div>
          ))}
          {agents.length === 0 && <p className="text-[9px] font-mono text-white/20">No agents deployed</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest">Recent Activity</p>
        {recentMessages.map(msg => (
          <div key={msg.id} className="flex gap-2">
            <div className="w-5 h-5 rounded-lg shrink-0 flex items-center justify-center text-black text-[8px] font-bold"
              style={{ backgroundColor: agents.find(a => a.id === msg.senderId)?.color || '#333' }}
            >
              {msg.senderName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] font-mono text-white/60 font-bold">{msg.senderName}</span>
                <span className="text-[8px] font-mono text-white/20">
                  {(() => {
                    try {
                      const d = new Date(msg.timestamp);
                      return isNaN(d.getTime()) ? '--:--' : format(d, 'HH:mm');
                    } catch {
                      return '--:--';
                    }
                  })()}
                </span>
              </div>
              <p className="text-[10px] font-mono text-white/40 leading-relaxed line-clamp-2">{msg.content}</p>
            </div>
          </div>
        ))}
        {recentMessages.length === 0 && <p className="text-[9px] font-mono text-white/20">No messages yet</p>}
      </div>

      {/* BASE command */}
      <div className="px-4 py-3 border-t border-white/5 bg-black/20 shrink-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={9} className="text-indigo-400" />
          <span className="text-[8px] font-mono text-indigo-400/50 uppercase tracking-widest">Command BASE</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isThinking}
            placeholder={isThinking ? 'BASE thinking...' : 'Tell BASE what to do...'}
            className="flex-1 bg-white/[0.03] border border-indigo-500/20 rounded-xl px-3 py-2 text-white font-mono text-[10px] focus:outline-none focus:border-indigo-500/40 transition-all placeholder-white/10 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isThinking || !input.trim()}
            className={cn('px-3 py-2 rounded-xl border transition-all',
              input.trim() && !isThinking ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
            )}
          >
            {isThinking
              ? <span className="w-3 h-3 border border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin block" />
              : <Send size={11} />
            }
          </button>
        </div>
      </div>
    </motion.div>
  );
};