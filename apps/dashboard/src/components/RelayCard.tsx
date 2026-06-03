'use client';

import React from 'react';
import { Power, Activity, Calendar, Timer, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface RelayCardProps {
  id: number;
  label: string;
  isOn: boolean;
  onToggle: (id: number, newState: boolean, seconds?: number) => void;
  onRename?: (id: number, newLabel: string) => void;
  isLoading?: boolean;
  activeTimer?: {
    type: 'delay_on' | 'on_for' | 'delay_off';
    timeLeft: number;
    totalDuration: number;
  };
  onStartTimer: (id: number, type: 'delay_on' | 'on_for' | 'delay_off', seconds: number) => void;
  onCancelTimer: (id: number) => void;
  onOpenSchedule: (id: number) => void;
}

export function RelayCard({ 
  id, 
  label, 
  isOn, 
  onToggle, 
  onRename, 
  isLoading,
  activeTimer,
  onStartTimer,
  onCancelTimer,
  onOpenSchedule
}: RelayCardProps) {
  const [showTimerPanel, setShowTimerPanel] = React.useState(false);
  const [timerSeconds, setTimerSeconds] = React.useState<number>(10);

  const getTimerLabel = () => {
    if (!activeTimer) return '';
    switch (activeTimer.type) {
      case 'delay_on':
        return `Ligando em ${activeTimer.timeLeft}s`;
      case 'on_for':
        return `Ligado por ${activeTimer.timeLeft}s`;
      case 'delay_off':
        return `Desligando em ${activeTimer.timeLeft}s`;
    }
  };

  const getTimerColorClass = () => {
    if (!activeTimer) return '';
    switch (activeTimer.type) {
      case 'delay_on':
        return 'from-amber-500/20 to-orange-500/10 border-orange-500/50 text-orange-400';
      case 'on_for':
        return 'from-emerald-500/20 to-teal-500/10 border-emerald-500/50 text-emerald-400';
      case 'delay_off':
        return 'from-rose-500/20 to-red-500/10 border-rose-500/50 text-red-400';
    }
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={cn(
        "relative p-6 rounded-3xl border transition-all duration-300 overflow-hidden min-h-[250px] flex flex-col justify-between",
        isOn 
          ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
          : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
      )}
    >
      {/* Background Glow */}
      {isOn && (
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full" />
      )}

      {/* Top Bar */}
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "p-3 rounded-2xl",
          isOn ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-500"
        )}>
          <Power className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2">
          {/* Schedule Trigger */}
          <button 
             onClick={(e) => { e.stopPropagation(); onOpenSchedule(id); }}
             className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-blue-400 hover:text-blue-300 hover:bg-slate-700/80 hover:border-blue-500/40 transition-all shadow-sm"
             title="Programação Semanal"
          >
            <Calendar className="w-5 h-5" />
          </button>
          
          {/* Quick Timer Settings toggle */}
          <button 
             onClick={(e) => { e.stopPropagation(); setShowTimerPanel(!showTimerPanel); }}
             className={cn(
               "p-2.5 rounded-xl border transition-all shadow-sm",
               showTimerPanel 
                 ? "bg-indigo-500/30 border-indigo-500/60 text-indigo-300" 
                 : "bg-slate-800/80 border-slate-700/50 text-amber-400 hover:text-amber-300 hover:bg-slate-700/80 hover:border-amber-500/40"
             )}
             title="Temporizador Rápido"
          >
            <Timer className="w-5 h-5" />
          </button>

          {isOn && (
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
          )}
          <span className={cn(
            "text-xs font-extrabold uppercase tracking-wider",
            isOn ? "text-emerald-400" : "text-slate-500"
          )}>
            {isOn ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      {/* Dynamic Content Area */}
      <div className="flex-1 flex flex-col justify-end">
        {/* Name input */}
        <div className="mb-3">
          {isLoading ? (
            <div className="h-6 w-24 bg-slate-800 animate-pulse rounded mb-1" />
          ) : (
            <input
              type="text"
              defaultValue={label === "..." ? "" : label}
              placeholder="..."
              onBlur={(e) => onRename && onRename(id, e.target.value || "...")}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="text-xl font-bold text-white bg-transparent outline-none w-full border-b border-transparent focus:border-indigo-500/50 transition-all hover:bg-white/5 px-1 -ml-1 rounded"
            />
          )}
          <p className="text-xs text-slate-300 font-mono font-bold uppercase tracking-wide">
            Interruptor #{String(id).padStart(2, '0')}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* Active Timer Display */}
          {activeTimer ? (
            <motion.div
              key="active-timer-display"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "p-3 rounded-2xl border bg-gradient-to-br flex items-center justify-between mb-2 shadow-inner",
                getTimerColorClass()
              )}
            >
              <div className="flex-1 mr-2">
                <span className="text-xs font-mono font-bold tracking-tight block">
                  {getTimerLabel()}
                </span>
                {/* Progress Bar */}
                <div className="w-full bg-slate-950/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      activeTimer.type === 'delay_on' ? 'bg-amber-500' : 
                      activeTimer.type === 'on_for' ? 'bg-emerald-500' : 'bg-rose-500'
                    )}
                    style={{ width: `${(activeTimer.timeLeft / activeTimer.totalDuration) * 100}%` }}
                  />
                </div>
              </div>
              <button 
                onClick={() => onCancelTimer(id)}
                className="text-slate-400 hover:text-rose-500 active:scale-90 transition-all"
                title="Cancelar Temporização"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </motion.div>
          ) : showTimerPanel ? (
            /* Timer panel options */
            <motion.div
              key="timer-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-2 border-t border-slate-800/40"
            >
              <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-xs font-bold text-slate-300 uppercase">Tempo:</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-16 bg-slate-900 rounded-lg py-1 px-2 text-right text-sm font-mono font-bold text-white outline-none border border-slate-700 focus:border-indigo-500 transition-colors shadow-inner"
                    min="1"
                  />
                  <span className="text-xs text-slate-400 font-bold uppercase">seg</span>
                </div>
              </div>

              {/* Grid of the 3 requested timer actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    onStartTimer(id, 'delay_on', timerSeconds);
                    setShowTimerPanel(false);
                  }}
                  className="py-2.5 px-1 rounded-xl text-[10px] sm:text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 transition-all text-center leading-tight"
                  title="Aguarda o tempo X especificado e depois liga o interruptor."
                >
                  Ligar em
                </button>
                <button
                  onClick={() => {
                    onStartTimer(id, 'on_for', timerSeconds);
                    setShowTimerPanel(false);
                  }}
                  className="py-2.5 px-1 rounded-xl text-[10px] sm:text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-center leading-tight"
                  title="Desliga o interruptor e depois liga pelo tempo informado, desligando ao final."
                >
                  Ligar por
                </button>
                <button
                  onClick={() => {
                    onStartTimer(id, 'delay_off', timerSeconds);
                    setShowTimerPanel(false);
                  }}
                  className="py-2.5 px-1 rounded-xl text-[10px] sm:text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition-all text-center leading-tight"
                  title="Liga o interruptor se estiver desligado e agenda o desligamento para o tempo X."
                >
                  Desligar em
                </button>
              </div>
            </motion.div>
          ) : (
            /* Standard Toggle Controls */
            <motion.div
              key="standard-controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-2 pt-2"
            >
              <button
                onClick={() => onToggle(id, !isOn)}
                disabled={isLoading}
                className={cn(
                  "py-3.5 rounded-2xl font-extrabold transition-all duration-300 flex items-center justify-center gap-2 text-sm shadow-lg tracking-wide",
                  isOn
                    ? "bg-red-600 text-white hover:bg-red-500 border border-red-500/60 shadow-red-600/20 hover:shadow-red-500/30"
                    : "bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500/60 shadow-emerald-600/20 hover:shadow-emerald-500/30 disabled:opacity-50"
                )}
              >
                {isLoading ? <Activity className="w-4 h-4 animate-spin" /> : (isOn ? "⏻ Desligar" : "⏻ Ligar")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
