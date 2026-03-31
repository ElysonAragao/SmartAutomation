
export const sendCommand = async (deviceId: string, message: object): Promise<boolean> => {
  if (!deviceId) {
    throw new Error('ID do Dispositivo não pode ser vazio. Por favor, insira um ID no seletor de dispositivo.');
  }

  const topic = `luminaweb/${deviceId}/comando`;
  const payload = {
    topic: topic,
    message: message,
  };

  try {
    const response = await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `Falha ao enviar comando para o tópico '${topic}'. Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Not a JSON response
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    return result.success === true;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ocorreu um erro de rede desconhecido.';
    throw new Error(message);
  }
};
