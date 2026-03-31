# SmartAutomation - ESP32-C3 Firmware

Este diretório contém o código fonte para o dispositivo ESP32-C3 (8 Canais).

## Estrutura de Arquivos
- `SmartAutomation.ino`: Arquivo principal (Arduino).
- `Config.h`: Definições de pinos e credenciais.
- `MqttHandler.h`: Lógica de comunicação HiveMQ.
- `RelayControl.h`: Controle físico dos relés.
- `WifiPortal.h`: Portal cativo para configuração local.

## Dependências (Arduino IDE)
Instale as seguintes bibliotecas via Library Manager:
1. `PubSubClient` (por Nick O'Leary) - Para MQTT.
2. `ArduinoJson` (por Benoit Blanchon) - Para processamento de comandos.
3. `WebServer` (Nativo ESP32).
4. `DNSServer` (Nativo ESP32).

## Como Usar
1. Abra `SmartAutomation.ino` no Arduino IDE.
2. Configure o tipo de placa como **ESP32-C3 Dev Module**.
3. No arquivo `Config.h`, ajuste os pinos de acordo com seu hardware.
4. Faça o upload.
5. Ao ligar, caso não encontre rede, procure pelo Wi-Fi **SmartAutomation_Config**.
6. Acesse `192.168.4.1` ou `smartautomation.local` para configurar o broker e o WiFi.

---
*Desenvolvido para o Projeto SmartAutomation.*
