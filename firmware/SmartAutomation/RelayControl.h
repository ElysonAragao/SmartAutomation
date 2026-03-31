/**
 * Relay Hardware Control for SmartAutomation
 * Manages 8 physical relay pins on ESP32-C3
 */

#ifndef RELAY_CONTROL_H
#define RELAY_CONTROL_H

#include <Arduino.h>
#include "Config.h"

extern const int relayPins[8];

void setupRelays() {
  for (int i = 0; i < 8; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], RELE_OFF); // Off by default (based on mode)
    Serial.println("Relay pin setup: GPIO " + String(relayPins[i]));
  }
}

void setRelay(int relayID, bool state) {
  if (relayID >= 1 && relayID <= 8) {
    digitalWrite(relayPins[relayID - 1], state ? RELE_ON : RELE_OFF);
    Serial.println("Relay " + String(relayID) + " set to " + (state ? "ON" : "OFF"));
  } else {
    Serial.println("Invalid relay ID: " + String(relayID));
  }
}

bool getRelayStatus(int relayID) {
  if (relayID >= 1 && relayID <= 8) {
    return digitalRead(relayPins[relayID - 1]) == RELE_ON;
  }
  return false;
}

#endif
