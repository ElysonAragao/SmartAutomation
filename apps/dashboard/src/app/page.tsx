'use client';

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Settings, 
  Calendar, 
  History, 
  Thermometer, 
  Wifi, 
  Globe,
  Trash2,
  Plus,
  X,
  Check,
  Power,
  Video
} from 'lucide-react';
import mqtt from 'mqtt';
import { RelayCard } from '@/components/RelayCard';
import { db, auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  query,
  orderBy,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

interface Schedule {
  id: string;
  label: string;
  days: number[];
  time: string;
  action: 'on' | 'off';
  relayIds: number[];
  enabled: boolean;
}

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
  const [isBrokerConnected, setIsBrokerConnected] = useState(false);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [loadingRelayId, setLoadingRelayId] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState(''); 
  const [inputDeviceId, setInputDeviceId] = useState(''); 
  const [deviceIp, setDeviceIp] = useState('...'); 

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [mqttClient, setMqttClient] = useState<any>(null);
  const [cameraUrl, setCameraUrl] = useState<string | null>(null);

  // Timers State
  const [activeTimers, setActiveTimers] = useState<{[key: number]: {
    type: 'delay_on' | 'on_for' | 'delay_off';
    timeLeft: number;
    totalDuration: number;
    durationY?: number;
  }}>({});

  // Weekly Schedules State
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedRelayForNewSchedule, setSelectedRelayForNewSchedule] = useState<number | null>(null);

  // Schedule Form State
  const [scheduleLabel, setScheduleLabel] = useState('');
  const [scheduleTime, setScheduleTime] = useState('12:00');
  const [scheduleAction, setScheduleAction] = useState<'on' | 'off'>('on');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleRelays, setScheduleRelays] = useState<number[]>([]);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);

  // Track executed schedules to prevent duplicates in the same minute
  const [executedSchedules, setExecutedSchedules] = useState<{[key: string]: string}>({});

  // Camera Modal State
  const [showCameraModal, setShowCameraModal] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      if (auth) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        throw new Error('Autenticação não configurada.');
      }
    } catch (err: any) {
      console.error(err);
      setLoginError('E-mail ou senha incorretos.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      setDeviceId('');
      setInputDeviceId('');
    }
  };

  useEffect(() => {
    let unsubscribeFirestore = () => {}; 

    if (db && deviceId && user) {
       const relaysRef = collection(db, 'boxes', deviceId, 'relays');
       const q = query(relaysRef, orderBy('id', 'asc'));
       
       setRelays(INITIAL_RELAYS);

       unsubscribeFirestore = onSnapshot(q, (snapshot) => {
         const data = snapshot.docs.map(doc => ({
           ...doc.data()
         })) as any[];
         
         setRelays(prev => {
           return INITIAL_RELAYS.map(initial => {
             const dbRelay = data.find(d => d.id === initial.id);
             if (dbRelay) {
                const current = prev.find(r => r.id === initial.id);
                return { ...dbRelay, is_on: current ? current.is_on : false };
             }
             const current = prev.find(r => r.id === initial.id);
             return { ...initial, is_on: current ? current.is_on : false };
           });
         });
       });

       const deviceDocRef = doc(db, 'boxes', deviceId);
       const unsubscribeDevice = onSnapshot(deviceDocRef, (docSnap) => {
         if (docSnap.exists()) {
           const data = docSnap.data();
           if (data.camera_url) {
             setCameraUrl(data.camera_url);
           }
         }
       });

       const originalUnsubscribe = unsubscribeFirestore;
       unsubscribeFirestore = () => {
         originalUnsubscribe();
         unsubscribeDevice();
       };
    }

    const mqttUrl = process.env.NEXT_PUBLIC_MQTT_URL;
    const mqttUser = process.env.NEXT_PUBLIC_MQTT_USER;
    const mqttPass = process.env.NEXT_PUBLIC_MQTT_PASS;

    if (!mqttUrl || !deviceId || !user) {
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
      
      if (deviceId) {
        const statusTopic = `esp32/${deviceId}/status/#`;
        client.subscribe(statusTopic, (err) => {
           if (!err) console.log(`📡 Inscrito com sucesso em: ${statusTopic}`);
        });
      }
    });

    client.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (data.ip) setDeviceIp(data.ip);
        if (data.temperatura !== undefined) setTemp(data.temperatura);
        else if (data.value !== undefined) setTemp(data.value);
        
        if (data.reles && Array.isArray(data.reles)) {
            setRelays(prev => prev.map((r, idx) => ({
                ...r,
                is_on: data.reles[idx] !== undefined ? data.reles[idx] : r.is_on
            })));
        } else if (data.is_on !== undefined && data.id) {
            setRelays(prev => prev.map(r => r.id === data.id ? { ...r, is_on: data.is_on } : r));
        }
        setIsDeviceOnline(true);
      } catch (e) {
        console.warn("Error parsing MQTT message:", e);
      }
    });

    client.on('error', (err) => {
      console.warn("⚠️ Erro de Conexão MQTT:", err);
      setIsBrokerConnected(false);
    });

    client.on('close', () => {
      setIsBrokerConnected(false);
    });

    setMqttClient(client);

    return () => {
      if (client) client.end();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [deviceId]); 

  useEffect(() => {
    if (db && deviceId && user) {
      const schedulesRef = collection(db, 'boxes', deviceId, 'schedules');
      const unsubscribe = onSnapshot(schedulesRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Schedule[];
        setSchedules(data);
      });
      return () => unsubscribe();
    }
  }, [deviceId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        const next = { ...prev };
        let changed = false;

        Object.keys(next).forEach(key => {
          const relayId = parseInt(key);
          const timer = next[relayId];

          if (timer.timeLeft <= 1) {
            delete next[relayId];
            changed = true;

            if (timer.type === 'delay_on') {
              // "Ligar em" expirou — agora LIGA o interruptor
              handleToggle(relayId, true);
            } else if (timer.type === 'on_for') {
              handleToggle(relayId, false);
            } else if (timer.type === 'delay_off') {
              handleToggle(relayId, false);
            }
          } else {
            next[relayId] = {
              ...timer,
              timeLeft: timer.timeLeft - 1
            };
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [mqttClient, deviceId]);

  useEffect(() => {
    const checkSchedules = () => {
      if (schedules.length === 0 || !mqttClient || !deviceId) return;
      
      const now = new Date();
      const day = now.getDay();
      const hourMin = now.toTimeString().substring(0, 5);
      const dateStr = now.toISOString().substring(0, 10);
      const execKey = `${dateStr} ${hourMin}`;

      schedules.forEach(schedule => {
        if (!schedule.enabled) return;
        if (!schedule.days.includes(day)) return;
        if (schedule.time !== hourMin) return;
        if (executedSchedules[schedule.id] === execKey) return;

        schedule.relayIds.forEach(relayId => {
          handleToggle(relayId, schedule.action === 'on');
        });

        setExecutedSchedules(prev => ({
          ...prev,
          [schedule.id]: execKey
        }));
      });
    };

    const interval = setInterval(checkSchedules, 10000);
    return () => clearInterval(interval);
  }, [schedules, mqttClient, deviceId, executedSchedules]);

  const startTimer = (relayId: number, type: 'delay_on' | 'on_for' | 'delay_off', seconds: number) => {
    cancelTimer(relayId);

    if (type === 'delay_on') {
      // "Ligar em" — aguarda X segundos e depois LIGA
      setActiveTimers(prev => ({
        ...prev,
        [relayId]: {
          type,
          timeLeft: seconds,
          totalDuration: seconds
        }
      }));
    } else if (type === 'on_for') {
      // "Ligar por" — desliga primeiro, depois liga por X seg, depois desliga
      handleToggle(relayId, false);
      setTimeout(() => {
        handleToggle(relayId, true);
      }, 300);
      setActiveTimers(prev => ({
        ...prev,
        [relayId]: {
          type,
          timeLeft: seconds,
          totalDuration: seconds
        }
      }));
    } else if (type === 'delay_off') {
      // "Desligar em" — apenas liga se estiver desligado, depois desliga após X seg
      const relay = relays.find(r => r.id === relayId);
      if (!relay?.is_on) {
        handleToggle(relayId, true);
      }
      setActiveTimers(prev => ({
        ...prev,
        [relayId]: {
          type,
          timeLeft: seconds,
          totalDuration: seconds
        }
      }));
    }
  };

  const cancelTimer = (relayId: number) => {
    setActiveTimers(prev => {
      const next = { ...prev };
      delete next[relayId];
      return next;
    });
  };

  const handleSaveSchedule = async (newSchedule: Omit<Schedule, 'id'> & { id?: string }) => {
    if (db && deviceId) {
      const schedulesRef = collection(db, 'boxes', deviceId, 'schedules');
      if (newSchedule.id) {
        const docRef = doc(db, 'boxes', deviceId, 'schedules', newSchedule.id);
        await setDoc(docRef, newSchedule, { merge: true });
      } else {
        const docRef = doc(schedulesRef);
        await setDoc(docRef, { ...newSchedule, id: docRef.id });
      }
    } else {
      if (newSchedule.id) {
        setSchedules(prev => prev.map(s => s.id === newSchedule.id ? { ...s, ...newSchedule } as Schedule : s));
      } else {
        const localId = `local_${Math.random().toString(36).substr(2, 9)}`;
        setSchedules(prev => [...prev, { ...newSchedule, id: localId } as Schedule]);
      }
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (db && deviceId) {
      await deleteDoc(doc(db, 'boxes', deviceId, 'schedules', scheduleId));
    } else {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    }
  };

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    if (db && deviceId) {
      await updateDoc(doc(db, 'boxes', deviceId, 'schedules', scheduleId), { enabled });
    } else {
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, enabled } : s));
    }
  };

  const handleRename = async (id: number, newLabel: string) => {
    setRelays(prev => prev.map(r => r.id === id ? { ...r, label: newLabel } : r));
    try {
      if (db) {
        await setDoc(doc(db, "boxes", deviceId, "relays", `relay_${id}`), { id: id, label: newLabel }, { merge: true });
      }
    } catch (error) {
      console.warn("Erro ao salvar no Firestore:", error);
    }
  };

  const handleDeviceChange = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const fullId = inputDeviceId.startsWith('Cx-') ? inputDeviceId : `Cx-${inputDeviceId}`;
      setDeviceId(fullId);
      setIsDeviceOnline(false); 
    }
  };

  const handleLogout = () => {
    setDeviceId('');
    setInputDeviceId('');
    setDeviceIp('...');
    setIsDeviceOnline(false);
    setActiveTimers({});
  };

  const handleToggle = async (id: number, newState: boolean, seconds?: number) => {
    if (!mqttClient) return;
    setLoadingRelayId(id);
    const payload = { id: id, action: newState ? "on" : "off", tempo: seconds || 0 };
    mqttClient.publish(`esp32/${deviceId}/comando/rele`, JSON.stringify(payload));
    setTimeout(() => {
      setRelays(prev => prev.map(r => r.id === id ? { ...r, is_on: newState } : r));
      setLoadingRelayId(null);
    }, 500);
  };

  const handleSetAll = (state: boolean) => {
    if (!mqttClient) return;
    mqttClient.publish(`esp32/${deviceId}/comando/rele`, JSON.stringify({ all: state }));
    setRelays(prev => prev.map(r => ({ ...r, is_on: state })));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <Zap className="w-12 h-12 text-indigo-500 animate-pulse mb-4" />
        <p className="text-slate-400 font-bold animate-pulse">Carregando sistema...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="text-indigo-500 w-8 h-8 fill-indigo-500/50" />
            </div>
            <h1 className="text-2xl font-extrabold text-white text-center">SmartAutomation</h1>
            <p className="text-slate-500 text-sm font-medium mt-2">Faça login para acessar suas centrais</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">E-mail</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:bg-slate-900 text-white rounded-xl px-4 py-3 outline-none transition-all font-medium placeholder-slate-600"
                placeholder="seu@email.com"
              />
            </div>
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Senha</label>
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:bg-slate-900 text-white rounded-xl px-4 py-3 outline-none transition-all font-medium placeholder-slate-600"
                placeholder="••••••••"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[38px] text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm p-3 rounded-xl font-medium text-center">
                {loginError}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'Entrando...' : 'Entrar no Painel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-indigo-500/30">
      <nav className="fixed left-0 top-0 h-full w-20 hidden md:flex flex-col items-center py-8 border-r border-slate-800/50 bg-[#020617]/50 backdrop-blur-xl z-50">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-12 shadow-lg shadow-indigo-600/20">
          <Zap className="text-white w-6 h-6 fill-white" />
        </div>
        <div className="flex-1 flex flex-col gap-8">
          <button className="p-3 text-indigo-500 bg-indigo-500/10 rounded-xl transition-colors"><Globe className="w-6 h-6" /></button>
          <button 
             onClick={() => { setScheduleRelays([]); setIsAddingSchedule(false); setShowScheduleModal(true); }}
             className="p-3 text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <Calendar className="w-6 h-6" />
          </button>
          <button className="p-3 text-slate-500 hover:text-indigo-400 transition-colors"><History className="w-6 h-6" /></button>
          <button className="p-3 text-slate-500 hover:text-indigo-400 transition-colors"><Settings className="w-6 h-6" /></button>
        </div>
      </nav>

      <main className="md:ml-20 p-6 lg:p-12 max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-indigo-500 font-bold tracking-widest uppercase text-xs mb-2">Resumo do Sistema</p>
              <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight">Smart<span className="text-indigo-500">Automation</span></h1>
            </div>
            <div className="flex flex-col md:flex-row flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Sua Conta</label>
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-2.5 rounded-2xl bg-slate-900/50 border border-slate-800">
                      <span className="text-sm font-bold text-slate-400">{user.email}</span>
                    </div>
                    <button onClick={handleSignOut} className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all text-xs font-bold">SAIR</button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Código da Caixa (Enter)</label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
                      <span className="text-sm font-bold text-slate-500">Cx-</span>
                      <input 
                        type="text" 
                        value={inputDeviceId.startsWith('Cx-') ? inputDeviceId.substring(3) : inputDeviceId} 
                        onChange={(e) => setInputDeviceId(e.target.value)}
                        onKeyDown={handleDeviceChange}
                        className="bg-transparent text-sm font-bold text-indigo-400 outline-none w-16"
                        placeholder="0000"
                      />
                    </div>
                    {deviceId && (
                      <button onClick={handleLogout} className="p-2.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-2xl hover:bg-slate-700 hover:text-white transition-all text-xs font-bold" title="Desconectar Caixa"><X className="w-4 h-4"/></button>
                    )}
                  </div>
               </div>
               <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden relative">
                  <Globe className="text-blue-500 w-5 h-5" />
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Endereço IP</p>
                    <a href={`http://${deviceIp}`} target="_blank" rel="noreferrer" className="text-lg font-bold hover:text-blue-400 transition-colors">{deviceIp}</a>
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
               <div className="flex flex-col">
                 <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <Wifi className={isDeviceOnline ? "text-emerald-500" : "text-rose-500"} />
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Esp32 Status</p>
                      <p className="text-lg font-bold">{isDeviceOnline ? "Online" : "Offline"}</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setShowCameraModal(true)} 
                   className="mt-2 w-full text-center text-red-500 font-black tracking-widest uppercase text-sm hover:text-red-400 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 drop-shadow-md"
                 >
                    <Video className="w-4 h-4" /> Cameras
                 </button>
               </div>
            </div>
        </header>

        {!deviceId ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-[3rem] text-center">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
              <Settings className="w-10 h-10 text-indigo-500 animate-spin-slow" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Aguardando Identidade da Caixa</h2>
            <p className="text-slate-500 max-w-sm">Informe o código da caixa (ex: Cx-0001) no campo acima e pressione Enter para iniciar o controle.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-12">
                 <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <button onClick={() => handleSetAll(true)} className="flex-1 py-6 rounded-3xl bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95 transition-all">Ligar Geral</button>
                    <button onClick={() => handleSetAll(false)} className="flex-1 py-6 rounded-3xl bg-slate-900 text-rose-500 border border-rose-500/20 font-black text-xl hover:bg-rose-600 hover:text-white active:scale-95 transition-all">Desligar Geral</button>
                 </div>
              </div>

              <div className="lg:col-span-12">
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
                        activeTimer={activeTimers[relay.id]}
                        onStartTimer={startTimer}
                        onCancelTimer={cancelTimer}
                        onOpenSchedule={(relayId) => {
                          setSelectedRelayForNewSchedule(relayId);
                          setScheduleRelays([relayId]);
                          setScheduleLabel(`Agendar Relé ${relayId}`);
                          setScheduleTime('18:00');
                          setScheduleAction('on');
                          setScheduleDays([1, 2, 3, 4, 5]);
                          setIsAddingSchedule(true);
                          setShowScheduleModal(true);
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
          </div>
        )}

        <footer className="mt-24 pt-8 border-t border-slate-800 text-slate-600 text-sm flex flex-col md:flex-row justify-between gap-4">
            <p>© 2026 SmartAutomation Control Panel</p>
            <div className="flex gap-8">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500" /> HiveMQ Broker: connected</span>
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Firestore Realtime: standby</span>
            </div>
        </footer>
      </main>

      <AnimatePresence>
        {showScheduleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-xl font-bold text-white">Programação Semanal</h2>
                </div>
                <button onClick={() => setShowScheduleModal(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                {isAddingSchedule ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-1.5">Nome da Programação</label>
                      <input type="text" value={scheduleLabel} onChange={(e) => setScheduleLabel(e.target.value)} placeholder="Ex: Ligar Jardim" className="w-full bg-slate-800/50 border border-slate-700 focus:border-indigo-500 focus:bg-slate-800 focus:outline-none rounded-xl px-4 py-3 text-sm text-white font-medium transition-all shadow-inner" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-1.5">Ação</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setScheduleAction('on')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm border transition flex items-center justify-center gap-1.5 shadow-sm ${scheduleAction === 'on' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-emerald-500/10' : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800'}`}><Power className="w-4 h-4" /> Ligar</button>
                          <button type="button" onClick={() => setScheduleAction('off')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm border transition flex items-center justify-center gap-1.5 shadow-sm ${scheduleAction === 'off' ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-rose-500/10' : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800'}`}><Power className="w-4 h-4" /> Desligar</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-1.5">Horário</label>
                        <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono font-bold focus:border-indigo-500 focus:bg-slate-800 transition-all shadow-inner outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-2">Dias da Semana</label>
                      <div className="flex justify-between gap-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                          <button key={idx} type="button" onClick={() => setScheduleDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])} className={`w-10 h-10 rounded-xl font-extrabold text-xs border transition-all shadow-sm ${scheduleDays.includes(idx) ? 'bg-indigo-500 border-indigo-400 text-white shadow-indigo-500/20' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{day}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-2">Interruptores Vinculados</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {relays.map((relay) => (
                          <button key={relay.id} type="button" onClick={() => setScheduleRelays(prev => prev.includes(relay.id) ? prev.filter(r => r !== relay.id) : [...prev, relay.id])} className={`p-3 rounded-xl border text-left transition-all shadow-sm ${scheduleRelays.includes(relay.id) ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-indigo-500/10' : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}>
                            <span className="text-[10px] font-mono font-bold text-slate-500 block mb-0.5">#{String(relay.id).padStart(2, '0')}</span>
                            <span className="text-xs font-extrabold truncate block">{relay.label === '...' ? `Relé ${relay.id}` : relay.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-5 border-t border-slate-800">
                      <button type="button" onClick={() => setIsAddingSchedule(false)} className="flex-1 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white text-slate-300 transition-all rounded-2xl text-xs font-extrabold uppercase">Voltar</button>
                      <button type="button" onClick={async () => {
                        const sched = { label: scheduleLabel, time: scheduleTime, action: scheduleAction, days: scheduleDays, relayIds: scheduleRelays, enabled: true };
                        await handleSaveSchedule(editingScheduleId ? { ...sched, id: editingScheduleId } : sched);
                        setIsAddingSchedule(false);
                      }} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold uppercase flex items-center justify-center gap-1.5"><Check className="w-4 h-4" /> Salvar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="p-4 bg-slate-950/45 border border-slate-850 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${schedule.action === 'on' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{schedule.action}</span>
                            <h4 className="text-sm font-bold text-white">{schedule.label}</h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={schedule.enabled} onChange={() => handleToggleSchedule(schedule.id, !schedule.enabled)} className="cursor-pointer" />
                          <button onClick={() => { setEditingScheduleId(schedule.id); setScheduleLabel(schedule.label); setScheduleTime(schedule.time); setScheduleAction(schedule.action); setScheduleDays(schedule.days); setScheduleRelays(schedule.relayIds); setIsAddingSchedule(true); }} className="text-xs font-bold text-slate-400 hover:text-white">Editar</button>
                          <button onClick={() => handleDeleteSchedule(schedule.id)} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => { setIsAddingSchedule(true); setEditingScheduleId(null); }} className="w-full py-3 bg-indigo-600 rounded-2xl text-xs font-bold uppercase text-white"><Plus className="w-4 h-4 inline" /> Criar Novo</button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCameraModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden h-[85vh] flex flex-col relative">
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Monitoramento</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase">Central de Câmeras</p>
                  </div>
                </div>
                <button onClick={() => setShowCameraModal(false)} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 w-full h-full bg-black relative">
                <iframe 
                  src={cameraUrl || process.env.NEXT_PUBLIC_DVR_STREAM_URL || "http://localhost:5001"} 
                  className="w-full h-full border-none absolute top-0 left-0"
                  title="Camera Stream"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
