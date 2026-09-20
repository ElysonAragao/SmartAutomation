import { NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import mqtt from 'mqtt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Validar a chave de segurança CRON_SECRET
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const authHeader = request.headers.get('authorization');
    
    // Suporta tanto o padrão Vercel Cron (Bearer token) quanto ?secret=... (cron-job.org)
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret) {
      if (secret !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.warn('Aviso: CRON_SECRET não está definido nas variáveis de ambiente. Endpoint desprotegido.');
    }

    if (!db) {
      return NextResponse.json({ error: 'Firebase Database not initialized' }, { status: 500 });
    }

    // Hora, minuto e dia atuais
    const now = new Date();
    // Converter para o fuso horário correto (Brasil/São Paulo)
    const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false };
    const formatter = new Intl.DateTimeFormat('pt-BR', options);
    const hourMin = formatter.format(now); // Ex: "18:00"
    
    // Pegar o dia da semana no Brasil
    const dayFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
    // Mas o JS array é 0 (Domingo) a 6 (Sábado). Vamos pegar convertendo a data para o TZ do Brasil.
    const spDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const day = spDate.getDay(); 

    const dateStr = spDate.toISOString().substring(0, 10);
    const execKey = `${dateStr} ${hourMin}`;

    let executedCount = 0;

    const debugSchedules: any[] = [];
    
    // 2. Buscar TODOS os schedules de TODAS as centrais de uma só vez (Collection Group)
    // Isso evita o problema de "phantom documents" onde a central (box) não existe como documento,
    // mas possui a subcoleção "schedules".
    const schedulesQuery = collectionGroup(db, 'schedules');
    const schedulesSnapshot = await getDocs(schedulesQuery);
    
    for (const scheduleDoc of schedulesSnapshot.docs) {
      const schedule = scheduleDoc.data();
      const deviceId = scheduleDoc.ref.parent.parent?.id; // Pega o ID da box pai (ex: Cx-0001)
      
      if (!deviceId) continue;
      
      const debugInfo: any = { id: scheduleDoc.id, deviceId, schedule, skipReason: 'none' };
        
        // 4. Comparar os horários e se está habilitado
        if (!schedule.enabled) {
          debugInfo.skipReason = 'not_enabled';
          debugSchedules.push(debugInfo);
          continue;
        }
        if (!schedule.days.includes(day)) {
          debugInfo.skipReason = 'wrong_day';
          debugSchedules.push(debugInfo);
          continue;
        }
        if (schedule.time !== hourMin) {
          debugInfo.skipReason = 'wrong_time';
          debugSchedules.push(debugInfo);
          continue;
        }
        
        // Evita executar duas vezes no mesmo minuto
        if (schedule.lastExecuted === execKey) {
          debugInfo.skipReason = 'already_executed';
          debugSchedules.push(debugInfo);
          continue;
        }

        // 5. Se o horário for o exato, conecta no MQTT e manda o sinal
        const mqttUrl = process.env.NEXT_PUBLIC_MQTT_URL;
        const mqttUser = process.env.NEXT_PUBLIC_MQTT_USER;
        const mqttPass = process.env.NEXT_PUBLIC_MQTT_PASS;

        if (mqttUrl) {
          await new Promise<void>((resolve, reject) => {
            const client = mqtt.connect(mqttUrl, {
              clientId: `cron_dash_${Math.random().toString(16).substring(2, 10)}`,
              username: mqttUser,
              password: mqttPass,
              connectTimeout: 5000,
            });

            client.on('connect', async () => {
              // Envia todos os comandos e aguarda a confirmação de envio (QoS 1)
              const publishPromises = schedule.relayIds.map((relayId: number) => {
                return new Promise<void>((pubResolve) => {
                  const payload = { 
                    id: relayId, 
                    action: schedule.action, 
                    tempo: 0 
                  };
                  client.publish(`esp32/${deviceId}/comando/rele`, JSON.stringify(payload), { qos: 1 }, () => {
                    pubResolve();
                  });
                });
              });
              
              await Promise.all(publishPromises);
              
              // 6. Atualizar a flag lastExecuted no Firebase
              try {
                await updateDoc(doc(db, 'boxes', deviceId, 'schedules', scheduleDoc.id), {
                  lastExecuted: execKey
                });
                executedCount++;
                debugInfo.executed = true;
              } catch (e) {
                console.error("Erro ao atualizar lastExecuted no Firebase", e);
                debugInfo.error = 'firebase_update_failed';
              }

              client.end(false, () => {
                resolve();
              });
            });

            client.on('error', (err) => {
              console.error(`Erro de Conexão MQTT no cron para ${deviceId}:`, err);
              debugInfo.error = 'mqtt_connection_error';
              client.end();
              resolve(); // Resolve para não travar o loop
            });
          });
        } else {
          debugInfo.skipReason = 'missing_mqtt_url';
        }
        
        debugSchedules.push(debugInfo);
      }

    return NextResponse.json({ 
      success: true, 
      message: `Cron finalizado. Tarefas executadas: ${executedCount}. DataBase/Hora: ${execKey}`,
      executedCount,
      debug: {
        mqttUrlDefined: !!process.env.NEXT_PUBLIC_MQTT_URL,
        hourMin,
        day,
        schedules: debugSchedules
      }
    });

  } catch (error: any) {
    console.error("Erro no Cron:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
