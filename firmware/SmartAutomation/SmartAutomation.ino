/**
 * SmartAutomation - ESP32-C3 Firmware
 * Base Structure for 8-Relay Control + MQTT + Local Web Interface
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <EEPROM.h>
#include "Config.h"
#include "RelayControl.h"
#include "MqttHandler.h"
#include "WifiPortal.h"

// Globals
WiFiClient espClient;
PubSubClient mqttClient(espClient);
WebServer server(80);

unsigned long lastTempUpdate = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\n--- SmartAutomation ESP32-C3 ---");

  // Initialize Hardware
  setupRelays();

  // Initialize Configuration (EEPROM)
  loadConfig();

  // Initialize WiFi
  setupWifi();

  // Initialize mDNS
  if (MDNS.begin(deviceName.c_str())) {
    Serial.println("mDNS responder started: " + deviceName + ".local");
  }

  // Initialize Web Server
  setupWebPortal();
  
  // Initialize MQTT
  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  // Handle local web portal
  server.handleClient();

  // Handle MQTT connection
  if (!mqttClient.connected()) {
    reconnectMqtt();
  }
  mqttClient.loop();

  // Periodic sensor updates (e.g., Temperature)
  if (millis() - lastTempUpdate > 30000) { // Every 30s
    lastTempUpdate = millis();
    updateSensors();
  }

  // Future: Handle Scheduling logic locally if needed (Offline Mode)
}
