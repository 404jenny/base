import React, { useState, useEffect } from 'react';
import { Command, Search, Zap, Play, Pause, Square, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Agent } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  onAction: (id: string, action: 'play' | 'pause' | 'stop') => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, agents, onAction }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // Toggle handled by parent
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase()) || 
    a.type.toLowerCase().includes(query.toLowerCase())
  );

  const commands = [
    { id: 'deploy', icon: Zap, label: 'Deploy New Agent', shortcut: 'N' },
    { id: 'stop-all', icon: Square, label: 'Stop All Agents', shortcut: 'S' },
    { id: 'pause-all', icon: Pause, label: 'Pause All Agents', shortcut: 'P' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="w-full max-w-2xl bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10"
        >
          <div className="flex items-center px-6 py-4 border-b border-white/5">
            <Search size={18} className="text-white/20 mr-4" />
            <input
              autoFocus
              placeholder="Type a command or search agents..."
              className="flex-1 bg-transparent border-none text-white font-mono text-sm focus:outline-none placeholder-white/10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/20 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">ESC</span>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            <div className="px-4 py-2">
              <h3 className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] mb-2">Global Commands</h3>
              <div className="space-y-1">
                {commands.map(cmd => (
                  <button 
                    key={cmd.id}
                    onClick={() => onAction(cmd.id, 'execute')}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <cmd.icon size={16} className="text-white/40 group-hover:text-white" />
                      <span className="text-xs font-mono text-white/60 group-hover:text-white">{cmd.label}</span>
                    </div>
                    <span className="text-[9px] font-mono text-white/20 group-hover:text-white/40">{cmd.shortcut}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-2 mt-2">
              <h3 className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] mb-2">Agents</h3>
              <div className="space-y-1">
                {filteredAgents.map(agent => (
                  <div 
                    key={agent.id}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                      <div>
                        <span className="text-xs font-mono text-white/60 group-hover:text-white block">{agent.name}</span>
                        <span className="text-[9px] font-mono text-white/20 uppercase">{agent.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onAction(agent.id, 'play')} className="p-1.5 hover:text-emerald-400"><Play size={12} /></button>
                      <button onClick={() => onAction(agent.id, 'pause')} className="p-1.5 hover:text-amber-400"><Pause size={12} /></button>
                      <button onClick={() => onAction(agent.id, 'stop')} className="p-1.5 hover:text-rose-400"><Square size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-white/20 bg-white/5 px-1 py-0.5 rounded border border-white/5">↑↓</span>
                <span className="text-[9px] font-mono text-white/20 uppercase">Navigate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-white/20 bg-white/5 px-1 py-0.5 rounded border border-white/5">ENTER</span>
                <span className="text-[9px] font-mono text-white/20 uppercase">Execute</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Command size={12} className="text-white/10" />
              <span className="text-[9px] font-mono text-white/10 uppercase">BASE OS v1.0.4</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
