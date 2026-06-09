/*
  SmartAutomation - v3.0 (IMPLEMENTATION OF COOKIE AUTHENTICATION)
  Fluxo WiFiManager + MQTT Privado SSL + Dashboard Premium
*/

#include <WiFi.h>
#include <WiFiClientSecure.h> 
#include <WiFiManager.h>
#include <WebServer.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// =========================
// CONFIGURAÇÕES
// =========================
String DEVICE_ID = "Cx-0000"; // Será carregado das Preferences
const int RELAY_COUNT = 8;
const int RELE_MODE = 1; 
int RELE_ON, RELE_OFF;
const int RELE_PINS[RELAY_COUNT] = {0, 1, 3, 5, 8, 10, 20, 21};
bool releState[RELAY_COUNT] = {false};
bool releTemporizado[RELAY_COUNT] = {false};
unsigned long tempoInicio[RELAY_COUNT] = {0};
unsigned long tempoDuracao[RELAY_COUNT] = {0};

float temperatura = 0.0;
DHT dht(4, DHT11);

// DADOS DO SEU CLUSTER PRIVADO
const char* mqtt_server = "9fa62893736646bc9986ee92847d588d.s1.eu.hivemq.cloud";
const char* mqtt_user   = "Orientar_Engenharia"; 
const char* mqtt_pass   = "Casario4\\orientareng";   

WiFiClientSecure espClient; 
PubSubClient client(espClient);
WebServer server(80);
Preferences prefs;

const char* ADMIN_U = "esa";
const char* ADMIN_P = "esa123";

// =========================
// LÓGICA E MQTT
// =========================
void setupReleMode() { if (RELE_MODE == 1) { RELE_ON = LOW; RELE_OFF = HIGH; } else { RELE_ON = HIGH; RELE_OFF = LOW; } }

void salvar() { prefs.begin("reles", false); for(int i=0; i<8; i++) prefs.putBool(String("r"+String(i)).c_str(), releState[i]); prefs.end(); }

void publish() {
  StaticJsonDocument<512> doc;
  JsonArray reles = doc.createNestedArray("reles");
  for(int i=0; i<8; i++) reles.add(releState[i]);
  doc["id"] = DEVICE_ID; doc["ip"] = WiFi.localIP().toString(); doc["temperatura"] = temperatura;
  char b[512]; serializeJson(doc, b);
  String topic = "esp32/" + DEVICE_ID + "/status/rele";
  client.publish(topic.c_str(), b);
}

void setRele(int i, bool st, unsigned long t=0) {
  if (i<0 || i>=8) return;
  digitalWrite(RELE_PINS[i], st ? RELE_ON : RELE_OFF);
  releState[i] = st;
  if(st && t > 0) { releTemporizado[i]=true; tempoInicio[i]=millis(); tempoDuracao[i]=t*1000UL; }
  else releTemporizado[i]=false;
  salvar();
}

void reconnect() {
  if (!client.connected()) {
    Serial.print("Connecting MQTT...");
    if (client.connect(DEVICE_ID.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("OK");
      String topic = "esp32/" + DEVICE_ID + "/comando/rele";
      client.subscribe(topic.c_str());
      publish();
    } else { Serial.printf("Fail %d\n", client.state()); delay(5000); }
  }
}

// =========================
// AUTHENTICATION
// =========================
bool checkAuth() {
  if (server.hasHeader("Cookie")) {
    String cookie = server.header("Cookie");
    if (cookie.indexOf("auth=logado") != -1) {
      return true;
    }
  }
  return false;
}

// =========================
// WEB PORTAL
// =========================
void handleRoot() {
  if (!checkAuth()) { 
    String loginHtml = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'><style>body{background:#020617;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}form{background:#0f172a;padding:2rem;border-radius:1rem;border:1px solid #1e293b;width:300px}input{width:100%;margin:10px 0;padding:10px;background:#1e293b;border:1px solid #334155;color:white;border-radius:0.5rem}button{width:100%;padding:10px;background:#4f46e5;color:white;border:none;border-radius:0.5rem;cursor:pointer;font-weight:bold}</style></head><body><form method='POST' action='/login'><h2>SmartAutomation</h2><input name='u' placeholder='Usuário'><input name='p' type='password' placeholder='Senha'><button>Entrar</button></form></body></html>";
    server.send(200, "text/html", loginHtml); 
    return; 
  }

  String h = "<html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><style>";
  h += "body{background:#020617;color:#f8fafc;font-family:sans-serif;margin:0;display:flex;flex-direction:column;align-items:center;padding:2rem}";
  h += ".card{background:#0f172a;border:1px solid #1e293b;border-radius:1.5rem;padding:2rem;width:100%;max-width:500px;text-align:center;box-shadow:0 10px 15px -3px rgba(0,0,0,0.5)}";
  h += "table{width:100%;margin:20px 0;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #1e293b}";
  h += ".btn{display:inline-block;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;transition:0.3s;margin:2px}";
  h += ".btn-on{background:#059669;color:white}.btn-off{background:#dc2626;color:white}.btn-timer{background:#4f46e5;color:white}.btn-danger{background:#991b1b;color:white}.btn-sec{background:#334155;color:white}.btn-cfg{background:#ca8a04;color:white}";
  h += "input[type=number]{background:#1e293b;border:1px solid #334155;color:white;padding:5px;border-radius:4px;width:60px;margin-right:5px}";
  h += "h1{margin-top:0;font-size:24px}p{color:#64748b;font-size:14px}";
  h += "</style><script>function conf(msg, url){if(confirm(msg))location.href=url;} function timerCmd(i){let val=document.getElementById('t'+i).value; if(val>0) location.href='/cmd?i='+i+'&t='+val;}</script></head><body>";
  h += "<div class='card'><h1>SmartAutomation</h1><p style='color:#ca8a04;font-weight:bold;font-size:18px'>Caixa: " + DEVICE_ID + "</p><p>IP Local: " + WiFi.localIP().toString() + "</p><p>Temperatura: " + String(temperatura,1) + " C</p><table>";
  
  for(int i=0; i<8; i++) {
    h += "<tr><td align='left'><b>Relé " + String(i+1) + "</b></td><td align='right'>";
    h += "<a href='/cmd?i=" + String(i+1) + "' class='btn " + String(releState[i] ? "btn-off" : "btn-on") + "'>" + (releState[i] ? "OFF" : "ON") + "</a>";
    h += "<br><input type='number' id='t" + String(i+1) + "' value='10' min='1'><a href='#' class='btn btn-timer' onclick='timerCmd(" + String(i+1) + ")'>SET</a></td></tr>";
  }
  
  h += "</table><div style='margin-bottom:20px'><a href='/cmd?all=1' class='btn btn-on'>Ligar Tudo</a>";
  h += "<a href='/cmd?all=0' class='btn btn-off'>Desliga Tudo</a></div><hr style='border:0;border-top:1px solid #1e293b;margin:20px 0'>";
  h += "<a href='/config' class='btn btn-cfg'>Configurações</a>";
  h += "<a href='#' class='btn btn-sec' onclick=\"conf('Reiniciar o ESP32 agora?', '/reboot')\">Reiniciar ESP32</a>";
  h += "<a href='#' class='btn btn-danger' onclick=\"conf('ATENÇÃO: Deseja apagar as credenciais de Wi-Fi? O ESP32 entrará em Modo AP novamente.', '/res')\">Reset Wi-Fi</a>";
  h += "<br><br><a href='/logout' class='btn btn-danger' style='background:#ef4444'>SAIR DO SISTEMA</a></div></body></html>";
  server.send(200, "text/html", h);
}

void handleConfig() {
  if (!checkAuth()) { server.send(401); return; }
  prefs.begin("config", true);
  String ip = prefs.getString("ip", "");
  String gw = prefs.getString("gw", "");
  String sn = prefs.getString("sn", "");
  prefs.end();

  String h = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'><style>body{background:#020617;color:white;font-family:sans-serif;padding:2rem;display:flex;justify-content:center} .card{background:#0f172a;padding:2rem;border-radius:1rem;width:100%;max-width:400px} input{width:100%;padding:10px;margin:10px 0;background:#1e293b;border:1px solid #334155;color:white;border-radius:0.5rem} .btn{width:100%;padding:10px;background:#ca8a04;color:white;border:none;border-radius:0.5rem;cursor:pointer;font-weight:bold;display:block;text-align:center;text-decoration:none;margin-top:10px} .cx-row{display:flex;align-items:center;background:#1e293b;border:1px solid #334155;border-radius:0.5rem;padding:0 10px;margin:10px 0} .cx-row span{color:#64748b;font-weight:bold}</style></head><body><div class='card'><h2>Configurações</h2><form method='POST' action='/savecfg'>";
  h += "Número da Caixa:<div class='cx-row'><span>Cx-</span><input name='cx' value='" + (DEVICE_ID.startsWith("Cx-") ? DEVICE_ID.substring(3) : "") + "' placeholder='Digite num' style='border:none;background:transparent;outline:none'></div>";
  h += "IP Fixo: <input name='ip' value='" + ip + "' placeholder='Ex: 192.168.3.200'>";
  h += "Gateway: <input name='gw' value='" + gw + "' placeholder='Ex: 192.168.3.1'>";
  h += "Subnet: <input name='sn' value='" + sn + "' placeholder='Ex: 255.255.255.0'>";
  h += "<button class='btn'>Salvar e Reiniciar</button><br><a href='/' class='btn' style='background:#334155'>Voltar</a></form></div></body></html>";
  server.send(200, "text/html", h);
}

void handleSaveCfg() {
  if (!checkAuth()) { server.send(401); return; }
  prefs.begin("config", false);
  String num = server.arg("cx");
  if(num != "") prefs.putString("cx", "Cx-" + num);
  prefs.putString("ip", server.arg("ip"));
  prefs.putString("gw", server.arg("gw"));
  prefs.putString("sn", server.arg("sn"));
  prefs.end();
  server.send(200, "text/html", "Salvo! Reiniciando...");
  delay(2000);
  ESP.restart();
}

// =========================
// SETUP
// =========================
void setup() {
  // 1. SILÊNCIO TOTAL: Força rádio OFF imediatamente
  WiFi.mode(WIFI_OFF);
  
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- ESP32 INICIADO ---");

  // 2. ESTRATÉGIA DE DEEP SLEEP (Evita travamento do roteador)
  // Se o motivo do boot for "Power ON" (energia voltou), entra em sono profundo
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  if (wakeup_reason == ESP_SLEEP_WAKEUP_UNDEFINED) {
    Serial.println("Energia reestabelecida! Entrando em Deep Sleep por 60s para deixar o roteador carregar...");
    Serial.flush();
    // Dorme por 60 segundos. No Deep Sleep o rádio é desligado fisicamente.
    esp_deep_sleep(60ULL * 1000000ULL); 
  }

  Serial.println("Roteador já deve estar pronto. Iniciando sistema...");
  
  setupReleMode(); 
  
  // Carrega IP Fixo e ID da Caixa se existir
  prefs.begin("config", true);
  if(prefs.isKey("cx")) DEVICE_ID = prefs.getString("cx");
  
  if(prefs.isKey("ip") && prefs.getString("ip") != "") {
    IPAddress local_IP, gateway, subnet;
    local_IP.fromString(prefs.getString("ip"));
    gateway.fromString(prefs.getString("gw"));
    subnet.fromString(prefs.getString("sn"));
    WiFi.config(local_IP, gateway, subnet);
    Serial.println("Usando IP Fixo: " + prefs.getString("ip"));
  }
  Serial.println("DEVICE ID: " + DEVICE_ID);
  prefs.end();

  prefs.begin("reles", true);
  for(int i=0; i<8; i++) {
    releState[i] = prefs.getBool(String("r"+String(i)).c_str(), false);
    pinMode(RELE_PINS[i], OUTPUT);
    digitalWrite(RELE_PINS[i], releState[i] ? RELE_ON : RELE_OFF);
  }
  prefs.end();
  dht.begin();

  espClient.setInsecure();
  client.setServer(mqtt_server, 8883);
  client.setCallback([](char* tc, byte* py, unsigned int l){
    StaticJsonDocument<256> d; deserializeJson(d, py, l);
    if(d.containsKey("id")){ int i=d["id"].as<int>()-1; setRele(i, d["action"].as<String>()=="on", d.containsKey("tempo")?d["tempo"].as<int>():0); }
    else if(d.containsKey("all")){ bool s=d["all"].as<bool>(); for(int j=0; j<8; j++) setRele(j,s); }
    publish();
  });

  WiFiManager wm;
  wm.setConnectTimeout(30);
  wm.setConfigPortalTimeout(180); // 3 minutos de portal, depois tenta de novo
  if (!wm.autoConnect("ESP-SmartAutomation-Config", "12345678")) { 
    Serial.println("Falha na conexão. Aguardando 2 minutos antes de reiniciar...");
    delay(120000);
    ESP.restart(); 
  }

  Serial.println("");
  Serial.println("WiFi Conectado!");
  Serial.print("Endereço IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("ID do Dispositivo: ");
  Serial.println(DEVICE_ID);

  // Estabilidade Máxima de WiFi
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.setTxPower(WIFI_POWER_17dBm); // Reduzido de 19.5 para 17 para evitar "cegar" o roteador próximo

  // Configura a coleta de cabeçalhos para os cookies
  const char * headerkeys[] = {"Cookie"};
  size_t headerkeyssize = sizeof(headerkeys) / sizeof(char*);
  server.collectHeaders(headerkeys, headerkeyssize);

  server.on("/", handleRoot);
  server.on("/config", handleConfig);
  server.on("/savecfg", HTTP_POST, handleSaveCfg);
  server.on("/login", HTTP_POST, [](){ 
    if(server.arg("u")==ADMIN_U && server.arg("p")==ADMIN_P){ 
      server.sendHeader("Location","/"); 
      server.sendHeader("Set-Cookie", "auth=logado; Path=/; HttpOnly");
      server.send(303); 
    } else {
      server.send(401, "text/plain", "Usuario ou senha invalidos."); 
    }
  });
  server.on("/logout", [](){ 
    server.sendHeader("Location","/"); 
    server.sendHeader("Set-Cookie", "auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/");
    server.send(303); 
  });
  server.on("/reboot", [](){ if(!checkAuth()) return server.send(401); server.send(200, "text/html", "Reiniciando..."); delay(1000); ESP.restart(); });
  server.on("/res", [](){ if(!checkAuth()) return server.send(401); WiFiManager wm; wm.resetSettings(); ESP.restart(); });
  server.on("/cmd", [](){
      if(!checkAuth()) return server.send(401);
      if(server.hasArg("all")) { bool s=server.arg("all")=="1"; for(int j=0; j<8; j++) setRele(j,s); }
      else { int i=server.arg("i").toInt()-1; int t=server.hasArg("t")?server.arg("t").toInt():0; setRele(i, t>0?true:!releState[i], t); }
      publish(); server.sendHeader("Location","/"); server.send(303);
  });
  
  server.begin();
  Serial.println("System Running!");
}

void loop() {
  server.handleClient();
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) reconnect();
    client.loop();
  }
  static unsigned long lT = 0;
  if(millis() - lT > 30000) { temperatura = dht.readTemperature(); lT = millis(); if(client.connected()) publish(); }
  for (int i = 0; i < 8; i++) { if (releTemporizado[i] && millis()-tempoInicio[i] >= tempoDuracao[i]) { setRele(i, false); if(client.connected()) publish(); } }
}
