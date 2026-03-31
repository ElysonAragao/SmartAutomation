'use client';

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Settings, 
  Calendar, 
  History, 
  Thermometer, 
  Wifi, 
  Globe 
} from 'lucide-react';
import mqtt from 'mqtt';
import { RelayCard } from '@/components/RelayCard';
import { db } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  query,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

// Mock data while Firebase is being configured
const INITIAL_RELAYS = [
  { id: 1, label: '...', is_on: false },
  { id: 2, label: '...', is_on: false },
  { id: 3, label: '...', is_on: false },
  { id: 4, label: '...', is_on: false },
  { id: 5, label: '...', is_on: false },
  { id: 6, label: '...', is_on: false },
  { id: 7, label: '...', is_on: false },
  { id: 8, label: '...', is_on: false },
];

export default function Dashboard() {
  const [relays, setRelays] = useState(INITIAL_RELAYS);
  const [temp, setTemp] = useState(24.5);
  const [isBrokerConnected, setIsBrokerConnected] = useState(true);
  const [isDeviceOnline, setIsDeviceOnline] = useState(true);
  const [loadingRelayId, setLoadingRelayId] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState('Cx-0001'); // Current Box ID
  const [inputDeviceId, setInputDeviceId] = useState('Cx-0001'); // Buffered input value
  const [deviceIp, setDeviceIp] = useState('192.168.3.41'); // State matching your current central

  const [mqttClient, setMqttClient] = useState<any>(null);

  useEffect(() => {
    // 1. Fetch Labels from Firestore (Multi-tenant: /boxes/{deviceId}/relays)
    // Só tenta ler do banco se 'db' foi inicializado com chaves válidas
    if (!db) {
       console.log("Firebase Database não inicializado. Usando nomes padrões.");
       setRelays(INITIAL_RELAYS);
       return () => {}; 
    }

    const relaysRef = collection(db, 'boxes', deviceId, 'relays');
    const q = query(relaysRef, orderBy('id', 'asc'));
    
    // Reset para mock data ao trocar de caixa para evitar ver labels da caixa anterior enquanto carrega
    setRelays(INITIAL_RELAYS);

    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as any[];
      
      if (data.length > 0) {
        setRelays(prev => {
           // Mescla o estado local is_on com os labels do banco
           return data.map(dbRelay => {
              const current = prev.find(r => r.id === dbRelay.id);
              // Mantemos o estado de ligado/desligado local (que vem do MQTT) 
              // mas usamos o label que vem do Firestore
              return { 
                ...dbRelay, 
                is_on: current ? current.is_on : false 
              };
           });
        });
      } else {
        console.log(`Caixa ${deviceId} não possui dados no Firestore. Usando padrões.`);
        setRelays(INITIAL_RELAYS);
      }
    });

    // 2. Setup MQTT Connection (Usando variáveis de ambiente)
    const mqttUrl = process.env.NEXT_PUBLIC_MQTT_URL;
    const mqttUser = process.env.NEXT_PUBLIC_MQTT_USER;
    const mqttPass = process.env.NEXT_PUBLIC_MQTT_PASS;

    // Se o MQTT URL não estiver presente (ex: durante o build na Vercel), não inicializa para evitar erros
    if (!mqttUrl) {
      console.log("Aguardando configuração de MQTT nas variáveis de ambiente da Vercel...");
      setIsBrokerConnected(false);
      return () => unsubscribeFirestore();
    }

    const client = mqtt.connect(mqttUrl, {
      clientId: `nextjs_dash_${Math.random().toString(16).substring(2, 10)}`,
      username: mqttUser,
      password: mqttPass,
      connectTimeout: 7000,
      reconnectPeriod: 2000,
    });

    client.on('connect', () => {
      console.log(`✅ Conectado ao HiveMQ! Monitorando: ${deviceId}`);
      setIsBrokerConnected(true);
      
      // Subscribe to status updates for this specific box
      client.subscribe(`esp32/${deviceId}/status/#`);
      client.subscribe(`esp32/status/rele`); 
    });

    client.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        console.log('MQTT Message:', topic, data);
        
        // 1. Atualiza o IP automaticamente se vier na mensagem
        if (data.ip) setDeviceIp(data.ip);
        
        // 2. Atualiza a Temperatura (campo 'temperatura' ou 'value')
        if (data.temperatura !== undefined) setTemp(data.temperatura);
        else if (data.value !== undefined) setTemp(data.value);
        
        // 3. Atualiza o Status dos Relés (pode vir como array ou individual)
        if (data.reles && Array.isArray(data.reles)) {
            // Se vier o array completo (Ex: térmico de temporizador)
            setRelays(prev => prev.map((r, idx) => ({
                ...r,
                is_on: data.reles[idx] !== undefined ? data.reles[idx] : r.is_on
            })));
        } else if (data.is_on !== undefined && data.id) {
            // Se vier atualização individual
            setRelays(prev => prev.map(r => r.id === data.id ? { ...r, is_on: data.is_on } : r));
        }

        // Se recebemos mensagem, o dispositivo está online
        setIsDeviceOnline(true);
      } catch (e) {
        console.error("Error parsing MQTT message:", e);
      }
    });

    setMqttClient(client);

    return () => {
      client.end();
      unsubscribeFirestore();
    };
  }, [deviceId]); // ESSENCIAL: Re-executa tudo quando o Box ID muda

  const handleRename = async (id: number, newLabel: string) => {
    console.log(`Renaming Relay ${id} to: ${newLabel} for Box: ${deviceId}`);
    
    // Atualiza localmente imediato (Otimista)
    setRelays(prev => prev.map(r => r.id === id ? { ...r, label: newLabel } : r));

    try {
      // Gravação Multi-tenant: /boxes/{deviceId}/relays/relay_{id}
      const relayDocRef = doc(db, "boxes", deviceId, "relays", `relay_${id}`);
      await setDoc(relayDocRef, {
        id: id,
        label: newLabel
      }, { merge: true });
    } catch (error) {
      console.error("Erro ao salvar no Firestore:", error);
    }
  };

  const handleDeviceChange = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setDeviceId(inputDeviceId);
      console.log(`Connecting to Box: ${inputDeviceId}`);
      // Future: Trigger status request for the specific Box ID
    }
  };

  const handleToggle = async (id: number, newState: boolean, seconds?: number) => {
    if (!mqttClient) return;
    setLoadingRelayId(id);
    
    // FORMATO COMPATÍVEL COM O FIRMWARE EM MqttHandler.h
    const payload = {
      id: id,
      action: newState ? "on" : "off",
      tempo: seconds || 0
    };

    // Publica no tópico específico da caixa (Cx-0001, etc)
    mqttClient.publish(`esp32/${deviceId}/comando/rele`, JSON.stringify(payload));
    
    // Atualização otimista na tela
    setTimeout(() => {
      setRelays(prev => prev.map(r => r.id === id ? { ...r, is_on: newState } : r));
      setLoadingRelayId(null);
    }, 500);
  };

  const handleSetAll = (state: boolean) => {
    if (!mqttClient) return;
    
    // FORMATO COMPATÍVEL COM O FIRMWARE
    const payload = { all: state };
    mqttClient.publish(`esp32/${deviceId}/comando/rele`, JSON.stringify(payload));

    setRelays(prev => prev.map(r => ({ ...r, is_on: state })));
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar Navigation (Mobile/Desktop) */}
      <nav className="fixed left-0 top-0 h-full w-20 hidden md:flex flex-col items-center py-8 border-r border-slate-800/50 bg-[#020617]/50 backdrop-blur-xl z-50">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-12 shadow-lg shadow-indigo-600/20">
          <Zap className="text-white w-6 h-6 fill-white" />
        </div>
        
        <div className="flex-1 flex flex-col gap-8">
          <button className="p-3 text-indigo-500 bg-indigo-500/10 rounded-xl transition-colors"><Globe className="w-6 h-6" /></button>
          <button className="p-3 text-slate-500 hover:text-indigo-400 transition-colors"><Calendar className="w-6 h-6" /></button>
          <button className="p-3 text-slate-500 hover:text-indigo-400 transition-colors"><History className="w-6 h-6" /></button>
          <button className="p-3 text-slate-500 hover:text-indigo-400 transition-colors"><Settings className="w-6 h-6" /></button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="md:ml-20 p-6 lg:p-12 max-w-7xl mx-auto">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-indigo-500 font-bold tracking-widest uppercase text-xs mb-2">Resumo do Sistema</p>
              <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight">Smart<span className="text-indigo-500">Automation</span></h1>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
               {/* Box ID Selector */}
               <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Código da Caixa (Enter)</label>
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
                    <input 
                      type="text" 
                      value={inputDeviceId} 
                      onChange={(e) => setInputDeviceId(e.target.value)}
                      onKeyDown={handleDeviceChange}
                      className="bg-transparent text-sm font-bold text-indigo-400 outline-none w-24"
                      placeholder="Ex: Cx-0001"
                    />
                  </div>
               </div>

               {/* IP Display Widget */}
               <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden relative">
                  <Globe className="text-blue-500 w-5 h-5" />
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Endereço IP</p>
                    <a href={`http://${deviceIp}`} target="_blank" rel="noreferrer" className="text-lg font-bold hover:text-blue-400 transition-colors">
                      {deviceIp}
                    </a>
                  </div>
               </div>
               <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 blur-2xl rounded-full" />
                  <Thermometer className="text-orange-500 w-5 h-5" />
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Temperatura</p>
                    <p className="text-lg font-bold">{temp}°C</p>
                  </div>
               </div>

               {/* Connection Status */}
               <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <Wifi className={isDeviceOnline ? "text-emerald-500" : "text-rose-500"} />
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Esp32 Status</p>
                    <p className="text-lg font-bold">{isDeviceOnline ? "Online" : "Offline"}</p>
                  </div>
               </div>
            </div>
        </header>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Global Actions - Moved to Top for Mobile Accessibility */}
            <div className="lg:col-span-12">
               <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <button 
                    onClick={() => handleSetAll(true)}
                    className="flex-1 py-6 rounded-3xl bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95 transition-all outline-none"
                  >
                    Ligar Geral
                  </button>
                  <button 
                    onClick={() => handleSetAll(false)}
                    className="flex-1 py-6 rounded-3xl bg-slate-900 text-rose-500 border border-rose-500/20 font-black text-xl hover:bg-rose-600 hover:text-white active:scale-95 transition-all outline-none"
                  >
                    Desligar Geral
                  </button>
               </div>
            </div>

            {/* Relay Grid */}
            <div className="lg:col-span-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500" />
                  Interruptores de Comando (8)
                </h2>
                <div className="h-[2px] flex-1 mx-6 bg-slate-800/50 rounded-full" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnimatePresence>
                  {relays.map((relay) => (
                    <RelayCard 
                      key={relay.id}
                      id={relay.id}
                      label={relay.label}
                      isOn={relay.is_on}
                      onToggle={handleToggle}
                      onRename={handleRename}
                      isLoading={loadingRelayId === relay.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>

        </div>

        {/* Footer info */}
        <footer className="mt-24 pt-8 border-t border-slate-800 text-slate-600 text-sm flex flex-col md:flex-row justify-between gap-4">
            <p>© 2026 SmartAutomation Control Panel</p>
            <div className="flex gap-8">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500" /> HiveMQ Broker: connected</span>
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Firestore Realtime: standby</span>
            </div>
        </footer>
      </main>
    </div>
  );
}
