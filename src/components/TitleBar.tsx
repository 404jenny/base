import React from 'react';
import { motion } from 'motion/react';
import { Minus, X, LayoutDashboard, Sparkles } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

interface TitleBarProps {
  agentCount: number;
  onWidgetMode: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ agentCount, onWidgetMode }) => {
  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (e) { console.error('Close failed:', e); }
  };

  const handleMinimize = async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (e) { console.error('Minimize failed:', e); }
  };

  const handleWidget = async () => {
    try {
      await invoke('set_widget_mode', { enabled: true });
      onWidgetMode();
    } catch (e) { console.error('Widget mode failed:', e); }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-10 bg-black/60 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 shrink-0 select-none"
    >
      {/* Traffic lights */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleClose}
          title="Close — ends all agents"
          className="w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] transition-colors flex items-center justify-center group"
        >
          <X size={7} className="opacity-0 group-hover:opacity-100 text-black/60 transition-opacity" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleMinimize}
          title="Minimize to tray — agents keep running"
          className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffaa00] transition-colors flex items-center justify-center group"
        >
          <Minus size={7} className="opacity-0 group-hover:opacity-100 text-black/60 transition-opacity" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleWidget}
          title="Widget mode — compact floating window"
          className="w-3 h-3 rounded-full bg-[#28c840] hover:bg-[#1db133] transition-colors flex items-center justify-center group"
        >
          <LayoutDashboard size={7} className="opacity-0 group-hover:opacity-100 text-black/60 transition-opacity" />
        </motion.button>
      </div>

      {/* Center */}
      <div data-tauri-drag-region className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <Sparkles size={11} className="text-indigo-400" />
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em]">base</span>
        {agentCount > 0 && (
          <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2 py-0.5">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-mono text-emerald-400">{agentCount} running</span>
          </div>
        )}
      </div>

      <div data-tauri-drag-region className="w-16" />
    </div>
  );
};