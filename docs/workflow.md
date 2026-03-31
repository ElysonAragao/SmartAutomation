# Workflow de Integração SmartAutomation

Este workflow define os passos para validar a comunicação entre todos os componentes do sistema.

## 1. Teste de Broker MQTT (HiveMQ)
- [ ] Conectar ao HiveMQ via CLI ou MQTT Dash.
- [ ] Publicar em `esp32/comando/rele` -> `{"id": 1, "action": "on"}`.
- [ ] Verificar se o ESP32 recebe e responde em `esp32/status/rele`.

## 2. Teste de Backend (Supabase)
- [ ] Inserir registro na tabela `relay_status`.
- [ ] Verificar se a Dashboard Next.js reflete a mudança em tempo real via Realtime.
- [ ] Validar se o Edge Function (opcional) sincroniza o estado do MQTT com o DB.

## 3. Teste de Firmware (ESP32-C3)
- [ ] Validar Portal Captivo ao ligar o chip (Acesso em `192.168.4.1`).
- [ ] Configurar WiFi e MQTT via formulário local.
- [ ] Validar se o dispositivo conecta ao Broker e mDNS (`smartautomation.local`).

## 4. Teste de Dashboard (Next.js)
- [ ] Toggle de um relé na interface web.
- [ ] Verificar recebimento do comando no ESP32.
- [ ] Validar persistência do estado no Supabase.

---
*Status: Aguardando setup inicial de credenciais.*
