/*
 * Smart Waste Bin — Final IoT Firmware
 * ESP32 + HC-SR04 → Wi-Fi → Backend HTTP PUT
 *
 * Wiring:
 *   ESP32 VIN  → HC-SR04 VCC   (Beyaz)
 *   ESP32 GND  → HC-SR04 GND   (Kahve)
 *   ESP32 D5   → HC-SR04 Trig  (Yeşil)
 *   HC-SR04 Echo → 10kΩ → midpoint → 10kΩ → GND
 *   Midpoint → ESP32 D18       (Turuncu)
 */

#include <WiFi.h>
#include <HTTPClient.h>

// ─── Wi-Fi ───
const char* WIFI_SSID     = "Test";
const char* WIFI_PASSWORD = "test1234";

// ─── Backend ───
const char* SERVER_IP  = "10.157.85.64";
const int   SERVER_PORT = 8000;
const int   BIN_ID      = 105;
const char* API_KEY     = "smartbin-iot-2026";

// ─── Sensor Pins ───
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;

// ─── Calibration ───
const float EMPTY_DISTANCE_CM = 28.6;
const float FULL_DISTANCE_CM  = 3.0;

// ─── Timing ───
const unsigned long SEND_INTERVAL_MS = 10000; // 10 seconds

// ──────────────────────────────────────
// Sensor Functions (from your tested code)
// ──────────────────────────────────────

float measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    return -1;
  }

  float distance = duration * 0.034 / 2.0;
  return distance;
}

float getStableDistance() {
  float values[5];
  int validCount = 0;

  for (int i = 0; i < 5; i++) {
    float d = measureDistanceCm();

    if (d > 2 && d < 400) {
      values[validCount] = d;
      validCount++;
    }

    delay(80);
  }

  if (validCount == 0) {
    return -1;
  }

  // Bubble sort for median
  for (int i = 0; i < validCount - 1; i++) {
    for (int j = 0; j < validCount - i - 1; j++) {
      if (values[j] > values[j + 1]) {
        float temp = values[j];
        values[j] = values[j + 1];
        values[j + 1] = temp;
      }
    }
  }

  return values[validCount / 2];
}

int calculateFillPercent(float distanceCm) {
  if (distanceCm < 0) {
    return -1;
  }

  if (distanceCm >= EMPTY_DISTANCE_CM) {
    return 0;
  }

  if (distanceCm <= FULL_DISTANCE_CM) {
    return 100;
  }

  float fill = ((EMPTY_DISTANCE_CM - distanceCm) / (EMPTY_DISTANCE_CM - FULL_DISTANCE_CM)) * 100.0;

  if (fill < 0) fill = 0;
  if (fill > 100) fill = 100;

  return (int)fill;
}

// ──────────────────────────────────────
// Wi-Fi Connection
// ──────────────────────────────────────

void connectWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[ERROR] Wi-Fi connection failed!");
  }
}

// ──────────────────────────────────────
// HTTP PUT to Backend
// ──────────────────────────────────────

void sendFillToBackend(int fill) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] Wi-Fi disconnected, reconnecting...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;

  // Build URL: PUT /api/v1/iot/bins/105/fill?api_key=smartbin-iot-2026
  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT)
             + "/api/v1/iot/bins/" + String(BIN_ID)
             + "/fill?api_key=" + String(API_KEY);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Body: {"fill": 73}
  String body = "{\"fill\":" + String(fill) + "}";

  int httpCode = http.PUT(body);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.print("PUT -> ");
    Serial.print(httpCode);
    Serial.print(" | ");
    Serial.println(response);
  } else {
    Serial.print("[ERROR] HTTP PUT failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// ──────────────────────────────────────
// Setup & Loop
// ──────────────────────────────────────

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  delay(500);
  Serial.println();
  Serial.println("========================================");
  Serial.println("  Smart Waste Bin — IoT Demo Firmware");
  Serial.println("  Bin ID: " + String(BIN_ID));
  Serial.println("  Server: " + String(SERVER_IP) + ":" + String(SERVER_PORT));
  Serial.println("========================================");
  Serial.println();

  connectWiFi();
}

void loop() {
  float distance = getStableDistance();
  int fill = calculateFillPercent(distance);

  if (fill < 0) {
    Serial.println("[FAIL] Measurement failed — check wiring!");
  }else if(distance < 0){
    Serial.println("[FAIL] Must be full!");

  } else {
    Serial.print("Distance: ");
    Serial.print(distance, 1);
    Serial.print(" cm | Fill: ");
    Serial.print(fill);
    Serial.print("% → ");

    sendFillToBackend(fill);
  }

  delay(SEND_INTERVAL_MS);
}
