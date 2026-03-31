'use client';

import { useState, useEffect, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { ScheduleCard } from '@/components/schedule-card';
import { DeviceControlCard } from '@/components/device-control-card';
import { DeviceSelector } from '@/components/device-selector';
import type { Schedule } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CodeEvaluationCard } from '@/components/code-evaluation-card';
import { ConnectionInfoCard } from '@/components/connection-info-card';
import { SecurityInfoCard } from '@/components/security-info-card';
import { sendCommand } from '@/lib/api';

const DEVICE_ID_STORAGE_KEY = 'luminaweb-deviceId';
const NICKNAME_STORAGE_KEY = 'luminaweb-nicknames';
const RELAY_COUNT = 8;
const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';

export default function Home() {
  const [deviceId, setDeviceId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [relayStates, setRelayStates] = useState<boolean[]>(
    Array(RELAY_COUNT).fill(false)
  );
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [nicknames, setNicknames] = useState<string[]>(
    Array(RELAY_COUNT).fill('')
  );
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const { toast } = useToast();

  const handleConnect = useCallback((idToConnect: string) => {
    if (idToConnect && idToConnect.trim() !== '') {
      setDeviceId(idToConnect);
    }
  }, []);

  useEffect(() => {
    const savedDeviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY) || '';
    setInputValue(savedDeviceId);
    if (savedDeviceId) {
      handleConnect(savedDeviceId);
    }
     try {
      const savedNicknames = localStorage.getItem(NICKNAME_STORAGE_KEY);
      if (savedNicknames) {
        const parsedNicknames = JSON.parse(savedNicknames);
        if (Array.isArray(parsedNicknames) && parsedNicknames.length === RELAY_COUNT) {
          setNicknames(parsedNicknames);
        }
      }
    } catch (error) {
      console.error("Failed to parse nicknames from localStorage", error);
    }
  }, [handleConnect]);

  const publishCommand = useCallback(
    async (message: object) => {
      try {
        await sendCommand(deviceId, message);
      } catch (error: any) {
        console.error('Failed to send command:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao Enviar Comando',
          description:
            error.message ||
            'Não foi possível enviar o comando para o dispositivo.',
        });
      }
    },
    [deviceId, toast]
  );

  useEffect(() => {
    if (!deviceId) {
       if (mqttClient) {
        mqttClient.end();
        setMqttClient(null);
      }
      return;
    }

    const client = mqtt.connect(MQTT_BROKER_URL, { connectTimeout: 10000 });
    setMqttClient(client);

    const statusTopic = `luminaweb/${deviceId}/status`;

    client.on('connect', () => {
      console.log('MQTT Connected');
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
      client.subscribe(statusTopic, (err) => {
        if (!err) {
          // Use the API to request initial status, making it more reliable
          sendCommand(deviceId, { request: 'status' }).catch(err => console.error("Error requesting initial status", err));
        } else {
            console.error('MQTT Subscribe error:', err);
        }
      });
    });

    client.on('message', (topic, payload) => {
      if (topic === statusTopic) {
        try {
          const data = JSON.parse(payload.toString());
          
          if (data.reles && Array.isArray(data.reles)) {
            setRelayStates(data.reles);
          }
          if (data.agendamentos && Array.isArray(data.agendamentos)) {
            setSchedules(data.agendamentos.sort((a: Schedule,b: Schedule) => a.time.localeCompare(b.time)));
          }
          if (typeof data.temperatura === 'number') {
            setTemperature(data.temperatura);
          }
          
        } catch (e) {
          console.error('Failed to parse status message', e);
        }
      }
    });

    client.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
      toast({
        variant: "destructive",
        title: "Erro de Conexão MQTT",
        description: `Falha na conexão, tentando reconectar... (${err.message})`,
      });
    });
    
    client.on('offline', () => {
      console.log("MQTT client offline");
    });

    client.on('reconnect', () => {
      console.log("MQTT client reconnecting");
    });


    return () => {
      if (client) {
        client.end();
        setMqttClient(null);
      }
    };
  }, [deviceId, toast]);

  const handleNicknameChange = (index: number, newName: string) => {
    const updatedNicknames = [...nicknames];
    updatedNicknames[index] = newName;
    setNicknames(updatedNicknames);
    localStorage.setItem(NICKNAME_STORAGE_KEY, JSON.stringify(updatedNicknames));
  };
  
  const handleAddSchedule = (scheduleData: Omit<Schedule, 'id'>) => {
    const newSchedule = { ...scheduleData, id: Date.now().toString() };
    publishCommand({ agendamento_add: newSchedule });
    toast({
      title: 'Agendamento Enviado',
      description: 'O novo agendamento foi enviado para o dispositivo.',
    });
  };

  const handleDeleteSchedule = (id: string) => {
    publishCommand({ agendamento_del: { id } });
    toast({
      title: 'Comando Enviado',
      description: 'O comando para excluir o agendamento foi enviado.',
    });
  };

  const handleClearAllSchedules = () => {
    publishCommand({ agendamento_clear: true });
    toast({
      title: 'Comando Enviado',
      description: 'O comando para limpar todos os agendamentos foi enviado.',
    });
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="space-y-6 lg:space-y-8">
        <DeviceSelector 
          inputValue={inputValue}
          onInputChange={setInputValue}
          onConnect={() => handleConnect(inputValue)}
          temperature={temperature}
        />
        <DeviceControlCard
          relayStates={relayStates}
          setRelayStates={setRelayStates}
          relayCount={RELAY_COUNT}
          nicknames={nicknames}
          onNicknameChange={handleNicknameChange}
          onCommand={publishCommand}
        />
        <ScheduleCard
          schedules={schedules}
          onAddSchedule={handleAddSchedule}
          onDeleteSchedule={handleDeleteSchedule}
          onClearAll={handleClearAllSchedules}
          nicknames={nicknames}
        />
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Configurações Avançadas</AccordionTrigger>
            <AccordionContent>
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <CodeEvaluationCard />
                </div>
                <div className="space-y-6">
                  <ConnectionInfoCard />
                  <SecurityInfoCard />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}