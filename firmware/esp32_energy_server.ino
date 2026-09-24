#include <Adafruit_INA219.h>
#include <WebServer.h>
#include <WiFi.h>
#include <Wire.h>

// Configure the local Wi-Fi network before uploading this sketch.
const char *WIFI_SSID = "YOUR_HOTSPOT_NAME";
const char *WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD";

// ESP32-S3 I2C pins and INA219 sensor addresses.
constexpr uint8_t I2C_SDA = 8;
constexpr uint8_t I2C_SCL = 9;
constexpr uint8_t TEG_ADDRESS = 0x40;
constexpr uint8_t TURBINE_ADDRESS = 0x41;

Adafruit_INA219 tegSensor(TEG_ADDRESS);
Adafruit_INA219 turbineSensor(TURBINE_ADDRESS);
WebServer server(80);

struct SourceReading {
  float voltage;
  float currentMilliAmps;
  float powerMilliWatts;
};

SourceReading readSensor(Adafruit_INA219 &sensor) {
  // INA219 reports current in milliamps and voltage in volts.
  const float busVoltage = sensor.getBusVoltage_V();
  const float shuntVoltage = sensor.getShuntVoltage_mV() / 1000.0f;
  const float current = sensor.getCurrent_mA();
  return {busVoltage + shuntVoltage, current, (busVoltage + shuntVoltage) * current};
}

// Return the latest readings as JSON for the mobile app.
void sendData() {
  const SourceReading teg = readSensor(tegSensor);
  const SourceReading turbine = readSensor(turbineSensor);
  const float totalPower = teg.powerMilliWatts + turbine.powerMilliWatts;

  String json = "{\"teg\":{";
  json += "\"voltage\":" + String(teg.voltage, 4);
  json += ",\"current_mA\":" + String(teg.currentMilliAmps, 4);
  json += ",\"power_mW\":" + String(teg.powerMilliWatts, 4);
  json += "},\"turbine\":{";
  json += "\"voltage\":" + String(turbine.voltage, 4);
  json += ",\"current_mA\":" + String(turbine.currentMilliAmps, 4);
  json += ",\"power_mW\":" + String(turbine.powerMilliWatts, 4);
  json += "},\"total_power_mW\":" + String(totalPower, 4) + "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

// Connect to Wi-Fi and print the device IP for the app configuration.
void connectToWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 20000) {
    delay(500);
    Serial.print('.');
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connection failed; retrying in loop.");
  }
}

void setup() {
  // Initialize serial logging, the I2C bus, sensors, and the HTTP server.
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);

  if (!tegSensor.begin(&Wire)) {
    Serial.println("INA219 TEG (0x40) not found.");
  }
  if (!turbineSensor.begin(&Wire)) {
    Serial.println("INA219 turbine (0x41) not found.");
  }

  connectToWifi();
  server.on("/data", HTTP_GET, sendData);
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();
  Serial.println("HTTP server started at /data");
}

void loop() {
  // Reconnect automatically if the Wi-Fi connection drops during a demo.
  if (WiFi.status() != WL_CONNECTED) {
    connectToWifi();
  }
  server.handleClient();
  delay(5);
}
