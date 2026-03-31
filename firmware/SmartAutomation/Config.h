/**
 * Configuration for SmartAutomation ESP32-C3
 * Pins and Server Settings
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// Pins for ESP32-C3 (Actual pins from user's current code)
const int relayPins[8] = {0, 1, 3, 5, 8, 10, 20, 21}; 

// Relay Activation Mode (1 for Active LOW, 2 for Active HIGH)
const int RELE_MODE = 1; 
const int RELE_ON = (RELE_MODE == 1) ? LOW : HIGH;
const int RELE_OFF = (RELE_MODE == 1) ? HIGH : LOW;

// MQTT Cloud Connection (HiveMQ)
const char* mqttServer = "hivemq_clound_uri_here"; // To be updated
const int mqttPort = 1883; // or 8883 for SSL
const char* mqttUser = ""; // Your HiveMQ user
const char* mqttPass = ""; // Your HiveMQ pass

// Default device settings
String deviceName = "smartautomation"; // IMPORTANTE: Este deve ser o "Código da Caixa" usado no Dashboard (Ex: Cx-0001)

// WiFi Defaults (AP mode if no credentials)
const char* defaultSSID = "SmartAutomation_Config";
const char* defaultPass = "12345678";

// EEPROM Data Structure
struct Config {
  char wifiSSID[32];
  char wifiPass[64];
  char mqttUser[64];
  char mqttPass[64];
  char mqttServer[128];
  bool staticIP;
  char localIP[16];
  char gateway[16];
  char subnet[16];
};

Config currentConfig;

// Forward Declarations
void loadConfig();
void saveConfig();
void setupWifi();
void reconnectMqtt();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void setupWebPortal();
void setupRelays();
void updateSensors();

#endif
