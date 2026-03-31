'use client';

import React from 'react';
import { Power, Activity, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface RelayCardProps {
  id: number;
  label: string;
  isOn: boolean;
  onToggle: (id: number, newState: boolean, seconds?: number) => void;
  onRename?: (id: number, newLabel: string) => void;
  isLoading?: boolean;
}

export function RelayCard({ id, label, isOn, onToggle, onRename, isLoading }: RelayCardProps) {
  const [showSchedule, setShowSchedule] = React.useState(false);

  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative p-6 rounded-3xl border transition-all duration-300 overflow-hidden min-h-[220px]",
        isOn 
          ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
          : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
      )}
    >
      {/* Background Glow */}
      {isOn && (
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full" />
      )}

      <div className="flex items-start justify-between mb-8">
        <div className={cn(
          "p-3 rounded-2xl",
          isOn ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-500"
        )}>
          <Power className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2">
          <button 
             onClick={() => setShowSchedule(!showSchedule)}
             className={cn(
               "p-2 rounded-lg transition-colors",
               showSchedule ? "bg-indigo-500/20 text-indigo-400" : "text-slate-500 hover:text-indigo-400"
             )}
          >
            <Calendar className="w-4 h-4" />
          </button>
          {isOn && (
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
          <span className={cn(
            "text-xs font-bold uppercase tracking-wider",
            isOn ? "text-emerald-500" : "text-slate-500"
          )}>
            {isOn ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showSchedule ? (
           <motion.div 
             key="schedule-form"
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -20 }}
             className="space-y-3"
           >
              <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Agendamento Diário</h4>
              <div className="grid grid-cols-2 gap-2">
                 <input type="time" className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-indigo-400 outline-none" />
                 <input type="number" placeholder="Duração (min)" className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-indigo-400 outline-none" />
              </div>
              <button 
                onClick={() => setShowSchedule(false)}
                className="w-full py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-xl text-[10px] font-bold uppercase transition-colors"
              >
                Salvar Agendamento
              </button>
           </motion.div>
        ) : (
           <motion.div 
             key="control-ui"
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.95 }}
           >
              <div className="flex items-center justify-between mb-2">
                {isLoading ? (
                  <div className="h-6 w-24 bg-slate-800 animate-pulse rounded" />
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
                <div className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-700 ml-2">
                  <input 
                    type="number" 
                    placeholder="Sec" 
                    className="w-12 bg-transparent text-xs font-mono outline-none text-indigo-400 text-center"
                    min="1"
                    id={`timer-input-${id}`}
                  />
                  <span className="text-[10px] text-slate-500 font-bold uppercase">s</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-6 font-mono text-xs opacity-60 uppercase tracking-tighter">
                Interruptor #{id}
              </p>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => onToggle(id, !isOn)}
                  disabled={isLoading}
                  className={cn(
                    "py-3 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2",
                    isOn
                      ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      : "bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                  )}
                >
                  {isLoading ? <Activity className="w-4 h-4 animate-spin" /> : (isOn ? "Desligar" : "Ligar")}
                </button>

                <button
                  onClick={() => {
                    const input = document.getElementById(`timer-input-${id}`) as HTMLInputElement;
                    const seconds = parseInt(input?.value || "0");
                    if (seconds > 0) onToggle(id, true, seconds);
                  }}
                  disabled={isLoading || isOn}
                  className="py-3 rounded-2xl font-bold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-all text-sm disabled:opacity-30"
                >
                  Temporizar
                </button>
              </div>
           </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
