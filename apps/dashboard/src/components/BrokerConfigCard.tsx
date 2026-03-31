'use client';

import React from 'react';
import { 
  Cloud, 
  Terminal, 
  ShieldCheck, 
  Copy, 
  CheckCircle2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function BrokerConfigCard() {
  const [copied, setCopied] = React.useState(false);
  const topic = "esp32/comando/rele";

  const handleCopy = () => {
    navigator.clipboard.writeText(topic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-md">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-500/10 rounded-2xl">
          <Cloud className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Configuração do Broker</h2>
          <p className="text-sm text-slate-500">Comunicação segura via HiveMQ Cloud</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Topic Info */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tópico de Comando</label>
          <div className="flex items-center gap-3 p-4 bg-[#020617] rounded-2xl border border-slate-800 group">
             <code className="text-indigo-400 flex-1 truncate text-sm font-mono">{topic}</code>
             <button 
                onClick={handleCopy}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-white"
             >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
             </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Este tópico é utilizado para enviar comandos em tempo real do Dashboard para o ESP32 através de qualquer localidade via Internet.
          </p>
        </div>

        {/* Local Access */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Acesso Local (Offline)</label>
          <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20">
             <div className="flex items-center gap-3 mb-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-bold text-indigo-300">smartautomation.local</span>
             </div>
             <p className="text-xs text-indigo-300/60 leading-relaxed">
               Acesse o portal de configuração diretamente via rede Wi-Fi local para redefinir credenciais caso perca a conexão.
             </p>
          </div>
        </div>

      </div>

      {/* Security Info */}
      <div className="mt-8 pt-8 border-t border-slate-800 flex items-center gap-3">
         <ShieldCheck className="w-5 h-5 text-emerald-500" />
         <span className="text-xs font-medium text-slate-400">Status de Segurança: Encriptação TLS (Port 8883) recomendada.</span>
      </div>
    </div>
  );
}
