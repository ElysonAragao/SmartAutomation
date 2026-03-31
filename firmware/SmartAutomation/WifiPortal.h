/**
 * WiFi Captive Portal / Local Config Page for SmartAutomation
 */

#ifndef WIFI_PORTAL_H
#define WIFI_PORTAL_H

#include <WebServer.h>
#include "Config.h"
#include "Favicon.h"

extern WebServer server;

const char config_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <title>SmartAutomation - ESP32-C3 Config</title>
    <style>
        :root {
            --primary: #6366f1;
            --bg: #0f172a;
            --card: #1e293b;
            --text: #f1f5f9;
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: var(--bg); color: var(--text); padding: 20px; display: flex; justify-content: center; }
        .card { background-color: var(--card); padding: 30px; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        h1 { font-size: 24px; margin-bottom: 20px; color: var(--primary); text-align: center; }
        .input-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-size: 14px; opacity: 0.8; }
        input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: white; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: var(--primary); border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 10px; }
        .footer { text-align: center; font-size: 12px; margin-top: 20px; opacity: 0.5; }
    </style>
</head>
<body>
    <div class="card">
        <h1>SmartAutomation Config</h1>
        <form action="/save" method="POST">
            <div class="input-group">
                <label>WiFi SSID</label>
                <input type="text" name="ssid" placeholder="Rede Wi-Fi">
            </div>
            <div class="input-group">
                <label>Senha WiFi</label>
                <input type="password" name="pass" placeholder="Senha do Wi-Fi">
            </div>
            <hr style="border:0.5px solid #334155; margin: 20px 0;">
            <div class="input-group">
                <label>MQTT Broker (Host)</label>
                <input type="text" name="mqtt_host" placeholder="Ex: cloud.hivemq.com">
            </div>
            <div class="input-group">
                <label>MQTT Usuário/Senha</label>
                <input type="text" name="mqtt_user" placeholder="Usuário HiveMQ">
                <input type="password" name="mqtt_pass" placeholder="Senha HiveMQ" style="margin-top:5px;">
            </div>
            <button type="submit">Salvar Configurações</button>
        </form>
        <div class="footer">SmartAutomation ESP32-C3 Firmware v1.0</div>
    </div>
</body>
</html>
)rawliteral";

void handleFavicon() {
  server.sendHeader("Content-Type", "image/x-icon");
  server.sendHeader("Content-Length", String(favicon_ico_len));
  server.send(200, "image/x-icon", (const char*)favicon_ico, favicon_ico_len);
}

void handleRoot() {
  server.send(200, "text/html", config_html);
}

void handleSave() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  String mqttHost = server.arg("mqtt_host");
  String mqttUserVal = server.arg("mqtt_user");
  String mqttPassVal = server.arg("mqtt_pass");

  Serial.println("Configurações recebidas:");
  Serial.println("SSID: " + ssid);
  
  // Actually save to EEPROM here
  // strncpy(currentConfig.wifiSSID, ssid.c_str(), 32);
  // saveConfig();

  server.send(200, "text/plain", "Configurações salvas. Reiniciando o dispositivo...");
  delay(2000);
  ESP.restart();
}

void setupWebPortal() {
  server.on("/", handleRoot);
  server.on("/favicon.ico", handleFavicon);
  server.on("/save", HTTP_POST, handleSave);
  server.begin();
  Serial.println("HTTP Server started");
}

#endif
