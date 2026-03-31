'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from './ui/button';
import { Bot, Clipboard } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

// Versão A24 (Original e Estável): Código original fornecido pelo usuário.
const arduinoCode = `/*
  LuminaWeb Control - Firmware para ESP32    ---- A24
  
  Recursos:
  - Servidor Web local com controle, login e configuração de IP/MQTT.
  - Controle via MQTT, sincronizado com a aplicação web.
  - Armazenamento persistente de estados (relés) e agendamentos na memória flash.
  - Sincronização de tempo com servidor NTP para execução de agendamentos.
  - Lógica de agendamento autônoma, sem depender de cliente conectado.
  - Suporte para temporização de relés.
  - Leitura de sensor de temperatura DHT11.
*/

#include <WiFi.h>
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
const char* DEVICE_ID = "Cx-0001"; // Altere para um ID único para cada dispositivo

// =========================
// CONFIGURAÇÕES DE REDE (Valores padrão)
// =========================
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
// Modo de ativação do relé: 1 para ativo em LOW, 2 para ativo em HIGH
const int RELE_MODE = 1; 
int RELE_ON, RELE_OFF;

// Pinos GPIO para os interruptores.
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
// NTP (Network Time Protocol)
// =========================
// Fuso horário em segundos. Ex: -10800 para GMT-3 (Brasília)
const long GMT_OFFSET_SEC = -10800;
const int DAYLIGHT_OFFSET_SEC = 0;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC);

// Mapeamento de dias (NTPClient: Dom=0, Seg=1... | Web: Seg,Ter,Qua...)
const char* daysOfWeek[] = {"Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"};

// =========================
// SERVIDOR WEB & PERSISTÊNCIA
// =========================
WebServer server(80);
Preferences prefs;

// =========================
// MQTT
// =========================
const char* mqtt_server = "broker.hivemq.com";
String mqtt_user   = "usuario_exemplo"; 
String mqtt_pass   = "senha_exemplo";   

char TOPIC_COMANDO[100];
char TOPIC_STATUS[100];

WiFiClient espClient;
PubSubClient client(espClient);

// =========================
// AUTENTICAÇÃO (para WebServer local)
// =========================
const char* ADMIN_USER     = "esa";
const char* ADMIN_PASSWORD = "esa123";
bool authSimulada = true;
bool usuarioAutenticado = false;
unsigned long ultimoAcesso = 0;
const unsigned long TEMPO_SESSAO = 5 * 60 * 1000; // 5 minutos

// =========================
// PROTÓTIPOS DE FUNÇÕES
// =========================
void handleRoot();
String getPage();
String getLoginPage();
void handleLogin();
void handleLogout();
void handleCmd();
void handleSetAll();
void handleResetAll();
void handleInfo();
void handleResetWiFi();
void handleConfigWiFi();
void handleSaveConfig();
void handleResetEsp();
void handleGetTemp();
void callbackMQTT(char* topic, byte* payload, unsigned int length);
void reconnectMQTT();
void publishStatus();
void saveSchedules(const JsonArray& schedules);
void checkSchedules();


// =========================
// LÓGICA DE CONTROLE
// =========================
void setupReleMode() {
  if (RELE_MODE == 1) {
    RELE_ON = LOW;
    RELE_OFF = HIGH;
  } else {
    RELE_ON = HIGH;
    RELE_OFF = LOW;
  }
}

void salvarEstados() {
  prefs.begin("reles", false);
  for (int i = 0; i < RELAY_COUNT; i++) {
    prefs.putBool(String("r" + String(i)).c_str(), releState[i]);
  }
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
    releState[i] = state;
    digitalWrite(RELE_PINS[i], state ? RELE_ON : RELE_OFF);
    releTemporizado[i] = false;
  }
  salvarEstados();
}


bool verificarSessao() {
  if (authSimulada) return true;
  if (usuarioAutenticado) {
    if (millis() - ultimoAcesso > TEMPO_SESSAO) {
      usuarioAutenticado = false;
      return false;
    }
    ultimoAcesso = millis();
    return true;
  }
  return false;
}

// =========================
// LÓGICA DE AGENDAMENTO
// =========================

void saveSchedules(const JsonArray& schedules) {
  String schedulesStr;
  serializeJson(schedules, schedulesStr);
  prefs.begin("luminaweb", false);
  prefs.putString("schedules", schedulesStr);
  prefs.end();
}

void checkSchedules() {
  if (!timeClient.isTimeSet()) return; 

  String currentTime = timeClient.getFormattedTime().substring(0, 5);
  int currentDay = timeClient.getDay(); // 0=Dom, 1=Seg, ...

  prefs.begin("luminaweb", true);
  String schedulesStr = prefs.getString("schedules", "[]");
  prefs.end();

  StaticJsonDocument<2048> doc;
  deserializeJson(doc, schedulesStr);
  JsonArray schedules = doc.as<JsonArray>();

  bool scheduleExecutedThisMinute = false;

  for (JsonObject schedule : schedules) {
    const char* time = schedule["time"];
    JsonArray days = schedule["days"];
    
    bool dayMatch = false;
    for (const char* day : days) {
      for(int i = 0; i < 7; i++){
        if(strcmp(day, daysOfWeek[i]) == 0 && i == currentDay){
          dayMatch = true;
          break;
        }
      }
      if(dayMatch) break;
    }

    if (strcmp(time, currentTime.c_str()) == 0 && dayMatch && !scheduleExecutedThisMinute) {
      const char* action = schedule["action"];
      const char* target = schedule["target"];
      unsigned long duration = schedule["duration"] | 0;

      if (strcmp(target, "all") == 0) {
        setAllRele(strcmp(action, "on") == 0);
      } else if (strstr(target, "interruptor-") != NULL) {
        int releIndex = atoi(target + 12) - 1;
        bool state = (strcmp(action, "on") == 0);
        setReleState(releIndex, state, duration);
      }
      publishStatus();
      scheduleExecutedThisMinute = true; 
    }
  }
  if (scheduleExecutedThisMinute) {
    delay(1000); // Previne múltiplas execuções no mesmo minuto
  }
}

// =========================
// FUNÇÕES MQTT
// =========================
void publishStatus() {
  StaticJsonDocument<2048> doc;
  
  JsonArray reles = doc.createNestedArray("reles");
  for (int i = 0; i < RELAY_COUNT; i++) {
    reles.add(releState[i]);
  }

  doc["temperatura"] = temperatura;

  prefs.begin("luminaweb", true);
  String schedulesStr = prefs.getString("schedules", "[]");
  prefs.end();

  JsonDocument schedulesDoc;
  deserializeJson(schedulesDoc, schedulesStr);
  doc["agendamentos"] = schedulesDoc.as<JsonArray>();

  char buffer[2048];
  serializeJson(doc, buffer);
  client.publish(TOPIC_STATUS, buffer);
}

void callbackMQTT(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<1024> doc;
  deserializeJson(doc, payload, length);

  bool statusNeedsUpdate = false;
  bool scheduleChanged = false;

  // Controle de Relés
  if (doc.containsKey("rele") && doc.containsKey("state")) {
      int releIndex = doc["rele"].as<int>() - 1;
      bool state = doc["state"].as<bool>();
      unsigned long tempo = doc.containsKey("tempo") ? doc["tempo"].as<unsigned long>() : 0;
      setReleState(releIndex, state, tempo);
      statusNeedsUpdate = true;
  } else if (doc.containsKey("all")) {
      setAllRele(doc["all"].as<bool>());
      statusNeedsUpdate = true;
  }

  // Requisição de Status
  if (doc.containsKey("request") && strcmp(doc["request"], "status") == 0) {
     statusNeedsUpdate = true;
  }

  // Gerenciamento de Agendamentos
  if (doc.containsKey("agendamento_add")) {
    prefs.begin("luminaweb", false);
    String schedulesStr = prefs.getString("schedules", "[]");
    StaticJsonDocument<2048> schedDoc;
    deserializeJson(schedDoc, schedulesStr);
    JsonArray schedules = schedDoc.as<JsonArray>();
    schedules.add(doc["agendamento_add"]);
    saveSchedules(schedules);
    prefs.end();
    scheduleChanged = true;
  }

  if (doc.containsKey("agendamento_del")) {
    const char* idToRemove = doc["agendamento_del"]["id"];
    prefs.begin("luminaweb", false);
    String schedulesStr = prefs.getString("schedules", "[]");
    StaticJsonDocument<2048> schedDoc;
    deserializeJson(schedDoc, schedulesStr);
    JsonArray schedules = schedDoc.as<JsonArray>();
    for (int i = 0; i < schedules.size(); i++) {
      if (schedules[i]["id"].as<String>() == idToRemove) {
        schedules.remove(i);
        break;
      }
    }
    saveSchedules(schedules);
    prefs.end();
    scheduleChanged = true;
  }

  if (doc.containsKey("agendamento_clear") && doc["agendamento_clear"] == true) {
    StaticJsonDocument<2048> schedDoc;
    JsonArray schedules = schedDoc.to<JsonArray>();
    saveSchedules(schedules);
    scheduleChanged = true;
  }
  
  if (statusNeedsUpdate || scheduleChanged) {
    publishStatus();
  }
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(DEVICE_ID, mqtt_user.c_str(), mqtt_pass.c_str())) {
      Serial.println("connected");
      client.subscribe(TOPIC_COMANDO);
      publishStatus(); // Envia status inicial ao conectar
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 2 seconds");
      delay(2000);
    }
  }
}

// =========================
// PÁGINAS HTML (com Raw String Literals)
// =========================
String getPage() {
  String html = R"rawliteral(
<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>ESP32 Controle</title>
<style>
  body{font-family:sans-serif;text-align:center;margin-top:10px;}
  button{margin:3px;padding:5px 10px;}
  #resp{border:1px solid #ccc;margin-top:10px;padding:10px;width:80%;margin-left:auto;margin-right:auto;text-align:center;height:100px;overflow:auto;}
</style>
</head><body>
<h2>ESP32 Controle</h2>
<p>IP Atual: )rawliteral";
  html += WiFi.localIP().toString();
  html += R"rawliteral(</p>
<p>Temperatura: <span id='tempVal'>)rawliteral";
  html += String(temperatura, 1);
  html += R"rawliteral( &deg;C</span></p>
<h3>Interruptores Individuais</h3>
)rawliteral";

  for (int i = 0; i < 8; i++) {
    String btnText = releState[i] ? "Desligar" : "Ligar";
    html += "Interruptor " + String(i + 1) + ": ";
    html += "<button id='btn" + String(i) + "' onclick=\\"toggleRele(" + String(i) + ")\\">" + btnText + "</button> ";
    html += "<button onclick=\\"sendCmd('/cmd?i=" + String(i + 1) + "&t=10')\\">Ligar 10s</button><br>";
  }

  html += R"rawliteral(
<h3>Comandos Gerais</h3>
<button onclick="setAll(true)">Ligar Todos</button>
<button onclick="setAll(false)">Desligar Todos</button>
<button onclick="sendCmd('/info')">INFO</button>
<button onclick="sendCmd('/resetwifi')">Reset WiFi</button>
<button onclick="location.href='/configwifi'">Configurar WiFi/MQTT</button>
<button onclick="location.href='/logout'">Logout</button>
<div id='resp'>Aguardando comandos...</div>
<script>
  function sendCmd(url){fetch(url).then(r=>r.text()).then(t=>{document.getElementById('resp').innerText=t;});}
  function toggleRele(idx){
    fetch('/cmd?i='+(idx+1)).then(r=>r.json()).then(data=>{
      document.getElementById('btn'+idx).innerText = data.state ? 'Desligar' : 'Ligar';
      document.getElementById('resp').innerText='Interruptor '+(idx+1)+': '+(data.state?'Ligado':'Desligado');
    });
  }
  function setAll(state){
    fetch(state?'/setAll':'/resetAll').then(r=>r.json()).then(data=>{
      for(let i=0;i<8;i++){document.getElementById('btn'+i).innerText = state?'Desligar':'Ligar';}
      document.getElementById('resp').innerText = state?'Todos ligados':'Todos desligados';
    });
  }
  function updateTemp(){
    fetch('/getTemp').then(r=>r.json()).then(data=>{
      document.getElementById('tempVal').innerText = data.temperatura.toFixed(1)+' °C';
    });
  }
  setInterval(updateTemp, 5000);
</script>
</body></html>
)rawliteral";
  return html;
}

String getConfigWiFiPage() {
  String html = R"rawliteral(
<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>Configuração WiFi/MQTT</title>
<style>body{font-family:sans-serif;text-align:center;margin-top:10px;} input{margin:5px;} button{margin:5px;padding:5px 10px;}</style>
</head><body>
<h2>Configuração WiFi e MQTT</h2>
<form action='/saveconfig' method='POST'>
  <label>Usar IP Fixo:</label>
  <select name='usarIP'>
    <option value='0')rawliteral";
  html += !usarIPFixo ? " selected" : "";
  html += R"rawliteral(>False</option>
    <option value='1')rawliteral";
  html += usarIPFixo ? " selected" : "";
  html += R"rawliteral(>True</option>
  </select><br>
  <label>IP:</label><input type='text' name='ip' value=')rawliteral";
  html += local_IP.toString();
  html += R"rawliteral('><br>
  <label>Gateway:</label><input type='text' name='gateway' value=')rawliteral";
  html += gateway.toString();
  html += R"rawliteral('><br>
  <label>Subnet:</label><input type='text' name='subnet' value=')rawliteral";
  html += subnet.toString();
  html += R"rawliteral('><br>
  <label>Primary DNS:</label><input type='text' name='primaryDNS' value=')rawliteral";
  html += primaryDNS.toString();
  html += R"rawliteral('><br>
  <label>Secondary DNS:</label><input type='text' name='secondaryDNS' value=')rawliteral";
  html += secondaryDNS.toString();
  html += R"rawliteral('><br>
  <label>SSID:</label><input type='text' name='ssid' value=''><br>
  <label>Senha WiFi:</label><input type='password' name='password' value=''><br>
  <label>Usuário MQTT:</label><input type='text' name='mqttUser' value=')rawliteral";
  html += mqtt_user;
  html += R"rawliteral('><br>
  <label>Senha MQTT:</label><input type='password' name='mqttPass' value=''><br>
  <br>
  <button type='submit'>Salvar e Reiniciar</button>
  <button type='button' onclick="location.href='/'">Voltar</button>
  <br><br>
  <button type='button' onclick="fetch('/resetEsp').then(()=>alert('Resetando ESP32...'))">Resetar ESP32</button>
</form>
</body></html>
)rawliteral";
  return html;
}

String getLoginPage() {
  return R"rawliteral(
<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>Login ESP32</title>
<style>body{font-family:sans-serif;text-align:center;margin-top:50px;} input{margin:5px;padding:5px;} button{padding:5px 10px;}</style>
</head><body>
<h2>Login ESP32</h2>
<form method='POST' action='/login'>
  <input type='text' name='usuario' placeholder='Usuário' required><br>
  <input type='password' name='senha' placeholder='Senha' required><br>
  <button type='submit'>Login</button>
</form>
</body></html>
)rawliteral";
}

// =========================
// HANDLERS DO SERVIDOR WEB
// =========================
void handleRoot() {
  if (!verificarSessao()) {
    server.send(200, "text/html", getLoginPage());
    return;
  }
  server.send(200, "text/html", getPage());
}

void handleLogin() {
  if (!server.hasArg("usuario") || !server.hasArg("senha")) {
    server.send(400, "text/plain", "Faltando parametros");
    return;
  }
  if (server.arg("usuario") == ADMIN_USER && server.arg("senha") == ADMIN_PASSWORD) {
    usuarioAutenticado = true;
    ultimoAcesso = millis();
    server.sendHeader("Location", "/", true);
    server.send(303);
  } else {
    server.send(401, "text/plain", "LOGIN_FAIL");
  }
}

void handleLogout() {
  usuarioAutenticado = false;
  server.sendHeader("Location", "/", true);
  server.send(303);
}

void handleCmd() {
  if (!verificarSessao()) return server.send(401);
  if (!server.hasArg("i")) return server.send(400, "text/plain", "Missing i");
  int idx = server.arg("i").toInt() - 1;
  // A Web UI envia segundos, convertemos para ms para o setReleState que espera segundos
  unsigned long t_seconds = server.hasArg("t") ? server.arg("t").toInt() : 0;
  
  bool newState = !releState[idx];
  setReleState(idx, newState, t_seconds);

  String json = "{\\"rele\\":" + String(idx + 1) + ",\\"state\\":" + String(releState[idx]) + "}";
  server.send(200, "application/json", json);
}

void handleSetAll() {
  if (!verificarSessao()) return server.send(401);
  setAllRele(true);
  server.send(200, "application/json", "{\\"all\\":\\"on\\"}");
}

void handleResetAll() {
  if (!verificarSessao()) return server.send(401);
  setAllRele(false);
  server.send(200, "application/json", "{\\"all\\":\\"off\\"}");
}

void handleInfo() {
  if (!verificarSessao()) return server.send(401);
  String json = "{\\"ip\\":\\"" + WiFi.localIP().toString() + "\\",\\"temperatura\\":" + String(temperatura) + ",\\"reles\\":[";
  for (int i = 0; i < 8; i++) {
    json += releState[i] ? "1" : "0";
    if (i < 7) json += ",";
  }
  json += "]}";
  server.send(200, "application/json", json);
}

void handleResetWiFi() {
  if (!verificarSessao()) return server.send(401);
  WiFiManager wm;
  wm.resetSettings();
  server.send(200, "text/plain", "WiFi apagado. Reiniciando...");
  delay(2000);
  ESP.restart();
}

void handleConfigWiFi() {
  if (!verificarSessao()) return server.send(401);
  server.send(200, "text/html", getConfigWiFiPage());
}

void handleSaveConfig() {
  if (!verificarSessao()) return server.send(401);

  prefs.begin("configwifi", false);

  usarIPFixo = server.arg("usarIP") == "1";
  prefs.putBool("usarIPFixo", usarIPFixo);

  if (usarIPFixo) {
    local_IP.fromString(server.arg("ip"));
    gateway.fromString(server.arg("gateway"));
    subnet.fromString(server.arg("subnet"));
    primaryDNS.fromString(server.arg("primaryDNS"));
    secondaryDNS.fromString(server.arg("secondaryDNS"));
    prefs.putString("localIP", local_IP.toString());
    prefs.putString("gateway", gateway.toString());
    prefs.putString("subnet", subnet.toString());
    prefs.putString("primaryDNS", primaryDNS.toString());
    prefs.putString("secondaryDNS", secondaryDNS.toString());
  }
  
  if (server.hasArg("ssid") && server.arg("ssid").length() > 0) {
    // O WiFiManager já lida com isso, mas podemos forçar aqui se necessário.
  }

  if (server.hasArg("mqttUser")) {
    mqtt_user = server.arg("mqttUser");
    prefs.putString("mqttUser", mqtt_user);
  }
  if (server.hasArg("mqttPass") && server.arg("mqttPass").length() > 0) {
    mqtt_pass = server.arg("mqttPass");
    prefs.putString("mqttPass", mqtt_pass);
  }

  prefs.end();

  server.send(200, "text/plain", "Configuração salva! Reiniciando para aplicar...");
  delay(2000);
  ESP.restart();
}

void handleResetEsp() {
  server.send(200, "text/plain", "Resetando ESP32...");
  delay(1000);
  ESP.restart();
}

void handleGetTemp() {
  String json = "{\\"temperatura\\":" + String(temperatura, 1) + "}";
  server.send(200, "application/json", json);
}


// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);
  Serial.println("\\n\\nLuminaWeb Control - Iniciando...");

  // Aguarda roteador inicializar (mantido a pedido)
  Serial.println("Aguardando estabilidade da rede...");
  for (int i = 70; i > 0; i--) {
    Serial.printf("Iniciando WiFi em %d segundos...\\n", i);
    delay(1000);
  }

  setupReleMode();
  carregarEstados();
  dht.begin();
  
  snprintf(TOPIC_COMANDO, sizeof(TOPIC_COMANDO), "luminaweb/%s/comando", DEVICE_ID);
  snprintf(TOPIC_STATUS, sizeof(TOPIC_STATUS), "luminaweb/%s/status", DEVICE_ID);


  prefs.begin("configwifi", true);
  usarIPFixo = prefs.getBool("usarIPFixo", false);
  if (usarIPFixo) {
    local_IP.fromString(prefs.getString("localIP", "192.168.1.50"));
    gateway.fromString(prefs.getString("gateway", "192.168.1.1"));
    subnet.fromString(prefs.getString("subnet", "255.255.255.0"));
    primaryDNS.fromString(prefs.getString("primaryDNS", "8.8.8.8"));
    secondaryDNS.fromString(prefs.getString("secondaryDNS", "8.8.4.4"));
  }
  mqtt_user = prefs.getString("mqttUser", "usuario_exemplo");
  mqtt_pass = prefs.getString("mqttPass", "senha_exemplo");
  prefs.end();

  WiFiManager wm;
  if (usarIPFixo) {
    WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS);
    Serial.println("Tentando conectar com IP fixo: " + local_IP.toString());
  }

  wm.setConnectTimeout(60);
  if (!wm.autoConnect("ESP-LuminaWeb-Config", "12345678")) {
    Serial.println("Falha ao conectar. Reiniciando.");
    ESP.restart();
  }

  Serial.println("\\nWiFi conectado!");
  Serial.print("IP: "); Serial.println(WiFi.localIP());
  Serial.print("MAC: "); Serial.println(WiFi.macAddress());

  timeClient.begin();

  // Configurações de performance do WiFi (mantido a pedido)
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);

  if (MDNS.begin("luminaweb")) {
    Serial.println("MDNS responder iniciado: http://luminaweb.local");
  }

  // Mapeamento dos handlers do servidor web
  server.on("/", HTTP_GET, handleRoot);
  server.on("/login", HTTP_POST, handleLogin);
  server.on("/logout", HTTP_GET, handleLogout);
  server.on("/cmd", HTTP_GET, handleCmd);
  server.on("/setAll", HTTP_GET, handleSetAll);
  server.on("/resetAll", HTTP_GET, handleResetAll);
  server.on("/info", HTTP_GET, handleInfo);
  server.on("/resetwifi", HTTP_GET, handleResetWiFi);
  server.on("/configwifi", HTTP_GET, handleConfigWiFi);
  server.on("/saveconfig", HTTP_POST, handleSaveConfig);
  server.on("/resetEsp", HTTP_GET, handleResetEsp);
  server.on("/getTemp", HTTP_GET, handleGetTemp);
  server.onNotFound([]() { server.send(404, "text/plain", "Nao encontrado."); });
  
  server.begin();
  Serial.println("Servidor HTTP iniciado.");

  client.setServer(mqtt_server, 1883);
  client.setCallback(callbackMQTT);
}

// =========================
// LOOP
// =========================
void loop() {
  server.handleClient();
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      reconnectMQTT();
    }
    client.loop();
  }

  static unsigned long lastTempRead = 0;
  if(millis() - lastTempRead > 2000) { 
      temperatura = dht.readTemperature();
      lastTempRead = millis();
  }

  for (int i = 0; i < RELAY_COUNT; i++) {
    if (releTemporizado[i] && millis() - tempoInicio[i] >= tempoDuracao[i]) {
      setReleState(i, false);
      publishStatus(); // Informa que o relé desligou após o tempo
    }
  }

  // Verifica agendamentos a cada segundo
  static unsigned long lastScheduleCheck = 0;
  if (millis() - lastScheduleCheck >= 1000) {
    lastScheduleCheck = millis();
    if(timeClient.update()) {
      checkSchedules();
    }
  }
}
`;

export function CodeEvaluationCard() {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(arduinoCode);
    toast({
      title: 'Copiado!',
      description: 'O código do firmware foi copiado para a área de transferência.',
    });
  };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Código para o IDE</CardTitle>
        <CardDescription>
          Copie e cole este código no seu Arduino IDE para programar o ESP32.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <div className="relative flex-grow">
          <ScrollArea className="absolute inset-0 h-full w-full pr-4">
            <pre className="text-xs bg-muted/50 p-4 rounded-md whitespace-pre-wrap break-words font-code">
              {arduinoCode}
            </pre>
          </ScrollArea>
        </div>
        <div className="mt-4 flex gap-4">
          <Button onClick={handleCopy} className="flex-1">
            <Clipboard className="mr-2 h-4 w-4" />
            Copiar Código
          </Button>
          <Button variant="secondary" className="flex-1">
            <Bot className="mr-2 h-4 w-4" />
            Analisar Código (Em breve)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
