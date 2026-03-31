import { NextResponse } from 'next/server';
import * as mqtt from 'mqtt';

export async function POST(request: Request) {
  const body = await request.json();
  const { topic, message } = body;

  if (!topic || !message) {
    return NextResponse.json({ error: 'Missing topic or message' }, { status: 400 });
  }

  try {
    // Wrap connection and publishing in a single promise to handle all states.
    await new Promise((resolve, reject) => {
      const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
        connectTimeout: 5000 // 5 second timeout
      });

      // Reject on error
      client.on('error', (err) => {
        client.end();
        reject(new Error(`MQTT connection error: ${err.message}`));
      });
      
      // Reject on timeout (offline is emitted when connectTimeout is exceeded)
      client.on('offline', () => {
        client.end();
        reject(new Error('MQTT client went offline. Could not connect to broker.'));
      });

      // On connect, publish and then resolve/reject
      client.on('connect', () => {
        client.publish(topic, JSON.stringify(message), (err) => {
          client.end(); // Always end the connection
          if (err) {
            reject(new Error(`MQTT publish error: ${err.message}`));
          } else {
            resolve(true);
          }
        });
      });
    });
    
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('MQTT operation in API route failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to communicate with MQTT broker.' },
      { status: 500 }
    );
  }
}
