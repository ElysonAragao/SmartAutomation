/**
 * MQTT Message Handler for SmartAutomation
 * Integrates with HiveMQ Cloud
 */

#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <PubSubClient.h>
#include <ArduinoJson.h> // Ensure you have this library installed
#include "Config.h"
#include "RelayControl.h"

extern PubSubClient mqttClient;

void setupMqtt() {
  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(mqttCallback);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println("MQTT Message [" + String(topic) + "]: " + message);

  // Parse JSON message: {"id": 1, "action": "on"}
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.println("Failed to parse JSON!");
    return;
  }

  // Comandos específicos para esta caixa
  String commandTopic = "esp32/" + deviceName + "/comando/rele";
  
  if (String(topic) == commandTopic) {
    if (doc.containsKey("all")) {
      bool state = doc["all"];
      for (int i = 1; i <= 8; i++) setRelay(i, state);
      
      // Publish update back
      String statusMsg = "{\"all\":" + String(state ? "true" : "false") + ",\"box\":\"" + deviceName + "\"}";
      mqttClient.publish(("esp32/" + deviceName + "/status/rele").c_str(), statusMsg.c_str());
    } else if (doc.containsKey("id")) {
      int id = doc["id"];
      String action = doc["action"];
      if (action == "on") setRelay(id, true);
      else setRelay(id, false);
      
      String statusMsg = "{\"id\":" + String(id) + ",\"is_on\":" + (action == "on" ? "true" : "false") + "}";
      mqttClient.publish(("esp32/" + deviceName + "/status/rele").c_str(), statusMsg.c_str());
    }
  }
}

void reconnectMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT: " + String(mqttServer) + "...");
    
    // Unique Client ID
    String clientID = "ESP32-SmartAuth-";
    clientID += String(WiFi.macAddress());

    if (mqttClient.connect(clientID.c_str(), mqttUser, mqttPass)) {
      Serial.println("Connected!");
      // Subscreve ao tópico específico desta caixa
      String commandTopic = "esp32/" + deviceName + "/comando/rele";
      mqttClient.subscribe(commandTopic.c_str());
      Serial.println("Subscribed to: " + commandTopic);
    } else {
      Serial.print("Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void updateSensors() {
  // Mock temperature reading
  float temp = 24.5 + (random(-10, 10) / 10.0);
  StaticJsonDocument<256> doc;
  doc["sensor_type"] = "temp";
  doc["value"] = temp;
  doc["box"] = deviceName;
  doc["ip"] = WiFi.localIP().toString(); // Include IP address
  
  String msg;
  serializeJson(doc, msg);
  mqttClient.publish(("esp32/" + deviceName + "/status/sensores").c_str(), msg.c_str());
  Serial.println("Published temp: " + String(temp) + " | Box: " + deviceName);
}

#endif
