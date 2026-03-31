/*
  SmartAutomation Control - Firmware para ESP32-C3 (VERSÃO MASTER FINAL)
  Dashboard Antigravity v2.0 - Controle Total (Local + MQTT)
*/

#include <WiFi.h>
#include <WiFiClientSecure.h> 
#include <WiFiManager.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

// =========================
// CONFIGURAÇÕES DE REDE
// =========================
const char* DEVICE_ID = "Cx-0002"; 

bool usarIPFixo = false;
IPAddress local_IP(192, 168, 1, 50);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);
IPAddress secondaryDNS(8, 8, 4, 4);

// =========================
// CONFIGURAÇÃO INTERRUPTORES
// =========================
const int RELAY_COUNT = 8;
const int RELE_MODE = 1; 
int RELE_ON, RELE_OFF;

const int RELE_PINS[RELAY_COUNT] = {0, 1, 3, 5, 8, 10, 20, 21};
bool releState[RELAY_COUNT] = {false};
bool releTemporizado[RELAY_COUNT] = {false};
unsigned long tempoInicio[RELAY_COUNT] = {0};
unsigned long tempoDuracao[RELAY_COUNT] = {0};

// =========================
// SENSOR DHT
// =========================
float temperatura = 0.0;
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// =========================
// NTP
// =========================
const long GMT_OFFSET_SEC = -10800; 
const int DAYLIGHT_OFFSET_SEC = 0;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC);

const char* daysOfWeek[] = {"Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"};

// =========================
// PERSISTÊNCIA
// =========================
WebServer server(80);
Preferences prefs;

// =========================
// MQTT
// =========================
const char* mqtt_server = "9fa62893736646bc9986ee92847d588d.s1.eu.hivemq.cloud";
String mqtt_user   = "Orientar_Engenharia"; 
String mqtt_pass   = "Casario4\\orientareng";   

char TOPIC_COMANDO[100];
char TOPIC_STATUS[100];

WiFiClientSecure espClient; 
PubSubClient client(espClient);

// =========================
// AUTENTICAÇÃO WEB
// =========================
const char* ADMIN_USER     = "esa";
const char* ADMIN_PASSWORD = "esa123";
bool usuarioAutenticado = false;

// =========================
// LÓGICA DE CONTROLE
// =========================
void setupReleMode() {
  if (RELE_MODE == 1) { RELE_ON = LOW; RELE_OFF = HIGH; }
  else { RELE_ON = HIGH; RELE_OFF = LOW; }
}

void salvarEstados() {
  prefs.begin("reles", false);
  for (int i = 0; i < RELAY_COUNT; i++) { prefs.putBool(String("r" + String(i)).c_str(), releState[i]); }
  prefs.end();
}

void carregarEstados() {
  prefs.begin("reles", true);
  for (int i = 0; i < RELAY_COUNT; i++) {
    releState[i] = prefs.getBool(String("r" + String(i)).c_str(), false);
    pinMode(RELE_PINS[i], OUTPUT);
    digitalWrite(RELE_PINS[i], releState[i] ? RELE_ON : RELE_OFF);
  }
  prefs.end();
}

void setReleState(int i, bool state, unsigned long t_seconds = 0) {
  if (i < 0 || i >= RELAY_COUNT) return;
  if (state && t_seconds > 0) {
      digitalWrite(RELE_PINS[i], RELE_ON);
      releState[i] = true;
      releTemporizado[i] = true;
      tempoInicio[i] = millis();
      tempoDuracao[i] = t_seconds * 1000UL;
  } else {
      releState[i] = state;
      digitalWrite(RELE_PINS[i], state ? RELE_ON : RELE_OFF);
      releTemporizado[i] = false;
  }
  salvarEstados();
}

void setAllRele(bool state) {
  for (int i = 0; i < RELAY_COUNT; i++) {
    releState[i] = state; digitalWrite(RELE_PINS[i], state ? RELE_ON : RELE_OFF);
    releTemporizado[i] = false;
  }
  salvarEstados();
}

// =========================
// FUNÇÕES MQTT
// =========================
void publishStatus() {
  StaticJsonDocument<2048> doc;
  JsonArray reles = doc.createNestedArray("reles");
  for (int i = 0; i < RELAY_COUNT; i++) { reles.add(releState[i]); }
  doc["temperatura"] = temperatura;
  doc["id"] = DEVICE_ID;
  doc["ip"] = WiFi.localIP().toString();

  char buffer[2048];
  serializeJson(doc, buffer);
  client.publish(TOPIC_STATUS, buffer);
}

void callbackMQTT(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<1024> doc;
  deserializeJson(doc, payload, length);
  bool statusUpdate = false;

  if (doc.containsKey("id") && doc.containsKey("action")) {
      int idx = doc["id"].as<int>() - 1;
      String act = doc["action"].as<String>();
      unsigned long t = doc.containsKey("tempo") ? doc["tempo"].as<unsigned long>() : 0;
      setReleState(idx, act == "on", t);
      statusUpdate = true;
  } else if (doc.containsKey("all")) {
      setAllRele(doc["all"].as<bool>());
      statusUpdate = true;
  }

  if (doc.containsKey("request") && strcmp(doc["request"], "status") == 0) { statusUpdate = true; }
  if (statusUpdate) publishStatus();
}

void reconnectMQTT() {
  while (!client.connected()) {
    if (client.connect(DEVICE_ID, mqtt_user.c_str(), mqtt_pass.c_str())) {
      client.subscribe(TOPIC_COMANDO);
      publishStatus();
    } else { delay(2000); }
  }
}

// =========================
// PORTAL WEB COMPLETO
// =========================
String getDashboardPage() {
  String html = R"rawliteral(<!DOCTYPE html><html><head><meta charset='utf-8'><title>LuminaWeb</title><style>body{font-family:sans-serif;background:#0f172a;color:white;text-align:center;padding:20px;}.card{background:#1e293b;padding:20px;border-radius:20px;display:inline-block;margin:10px;width:250px;border:1px solid #334155;}.btn{display:block;padding:12px;background:#6366f1;color:white;text-decoration:none;border-radius:10px;font-weight:bold;margin-top:10px;}.btn-red{background:#ef4444;}.btn-gray{background:#475569;}</style></head><body><h1>LuminaWeb Dashboard</h1><p>IP: )rawliteral";
  html += WiFi.localIP().toString();
  html += R"rawliteral( | Temp: )rawliteral";
  html += String(temperatura, 1);
  html += R"rawliteral( C</p><hr style='opacity:0.2;'>)rawliteral";
  for (int i = 0; i < RELAY_COUNT; i++) {
    html += "<div class='card'><b>R" + String(i + 1) + "</b><br><a href='/cmd?i=" + String(i + 1) + "' class='btn " + (releState[i] ? "btn-red" : "") + "'>" + (releState[i] ? "OFF" : "ON") + "</a></div>";
  }
  html += "<div style='margin-top:30px;'><a href='/configwifi' class='btn-gray btn'>CONFIGURAR REDE / IP FIXO</a><a href='/resetEsp' class='btn-gray btn'>REINICIAR ESP32</a><a href='/resetwifi' class='btn-red btn'>LIMPAR WI-FI (RESET)</a></div></body></html>";
  return html;
}

void handleRoot() { if (!usuarioAutenticado) server.send(200, "text/html", R"rawliteral(<!DOCTYPE html><html><head><meta charset='utf-8'><title>Login</title><style>body{font-family:sans-serif;text-align:center;background:#0f172a;color:white;margin-top:100px;}input{padding:12px;margin:5px;border-radius:8px;}button{padding:12px 30px;background:#6366f1;color:white;border:none;border-radius:10px;}</style></head><body><h2>Acesso LuminaWeb</h2><form method='POST' action='/login'><input type='text' name='u' placeholder='Usuario'><br><input type='password' name='p' placeholder='Senha'><br><button type='submit'>Entrar</button></form></body></html>)rawliteral"); else server.send(200, "text/html", getDashboardPage()); }

void handleLogin() { if (server.arg("u") == ADMIN_USER && server.arg("p") == ADMIN_PASSWORD) { usuarioAutenticado = true; server.sendHeader("Location", "/", true); server.send(303); } else server.send(401, "text/plain", "Negado"); }

void handleCmd() { if (!usuarioAutenticado) return server.send(401); int idx = server.arg("i").toInt() - 1; setReleState(idx, !releState[idx]); server.sendHeader("Location", "/", true); server.send(303); publishStatus(); }

void handleConfigWiFi() {
  if (!usuarioAutenticado) return server.send(401);
  String html = "<html><body style='font-family:sans-serif; text-align:center;'><h2>Configuracao de Endereco IP</h2><form method='POST' action='/saveconfig'>";
  html += "IP Atual: <input type='text' name='ip' value='" + WiFi.localIP().toString() + "'><br>";
  html += "Gateway: <input type='text' name='gw' value='" + WiFi.gatewayIP().toString() + "'><br>";
  html += "Subnet: <input type='text' name='sn' value='" + WiFi.subnetMask().toString() + "'><br>";
  html += "<br><button type='submit'>SALVAR IP FIXO</button></form><br><a href='/'>VOLTAR</a></body></html>";
  server.send(200, "text/html", html);
}

void handleSaveConfig() {
  if (!usuarioAutenticado) return server.send(401);
  local_IP.fromString(server.arg("ip"));
  gateway.fromString(server.arg("gw"));
  subnet.fromString(server.arg("sn"));
  usarIPFixo = true;
  server.send(200, "text/plain", "IP Salvo. Reiniciando...");
  delay(1000); ESP.restart();
}

// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);
  for (int i = 70; i > 0; i--) { delay(1000); }

  setupReleMode(); carregarEstados(); dht.begin();
  
  snprintf(TOPIC_COMANDO, sizeof(TOPIC_COMANDO), "esp32/%s/comando/rele", DEVICE_ID);
  snprintf(TOPIC_STATUS, sizeof(TOPIC_STATUS), "esp32/%s/status/rele", DEVICE_ID);

  espClient.setInsecure(); client.setServer(mqtt_server, 8883); client.setCallback(callbackMQTT);

  WiFiManager wm;
  if (!wm.autoConnect("ESP-SmartAutomation-Config", "12345678")) { ESP.restart(); }

  timeClient.begin();
  server.on("/", HTTP_GET, handleRoot);
  server.on("/login", HTTP_POST, handleLogin);
  server.on("/cmd", HTTP_GET, handleCmd);
  server.on("/configwifi", HTTP_GET, handleConfigWiFi);
  server.on("/saveconfig", HTTP_POST, handleSaveConfig);
  server.on("/resetwifi", HTTP_GET, [](){ WiFiManager wm; wm.resetSettings(); ESP.restart(); });
  server.on("/resetEsp", HTTP_GET, [](){ ESP.restart(); });
  server.begin();
}

void loop() {
  server.handleClient();
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) reconnectMQTT();
    client.loop();
  }

  static unsigned long lT = 0;
  if(millis() - lT > 30000) { temperatura = dht.readTemperature(); lT = millis(); publishStatus(); }

  for (int i = 0; i < RELAY_COUNT; i++) {
    if (releTemporizado[i] && millis() - tempoInicio[i] >= tempoDuracao[i]) {
      setReleState(i, false); publishStatus();
    }
  }
}
