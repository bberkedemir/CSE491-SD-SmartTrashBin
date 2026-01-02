/*
 * Smart Waste Bin Sensor Node - ESP32
 * Measures fill level using ultrasonic sensor and broadcasts via BLE
 */

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLEAdvertising.h>

// Pin definitions
#define TRIG_PIN 5
#define ECHO_PIN 18
#define BATTERY_PIN 34  // ADC pin for battery voltage

// Bin configuration
#define BIN_ID "VAR_012"           // Unique bin identifier
#define BIN_DEPTH_CM 80            // Total depth of bin in cm
#define SENSOR_OFFSET_CM 5         // Distance from sensor to bin top

// Measurement settings
#define NUM_SAMPLES 5              // Number of readings for median filter
#define SLEEP_INTERVAL 900000      // 15 minutes in milliseconds
#define MAX_DISTANCE_CM 200        // Maximum measurable distance

// BLE UUIDs
//#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
//#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEAdvertising *pAdvertising;
float batteryVoltage = 0.0;

// Function prototypes
float measureDistance();
int calculateFillLevel(float distance);
float readBatteryVoltage();
void setupBLE();
void broadcastData(int fillLevel, float voltage);
void enterDeepSleep();

void setup() {
  Serial.begin(115200);
  Serial.println("Smart Waste Bin Sensor Starting...");
  
  // Configure ultrasonic sensor pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Initialize BLE
  setupBLE();
  
  delay(100);
}

void loop() {
  Serial.println("\n--- New Measurement Cycle ---");
  
  // Measure distance to waste surface
  float distance = measureDistance();
  Serial.print("Distance measured: ");
  Serial.print(distance);
  Serial.println(" cm");
  
  // Calculate fill level percentage
  int fillLevel = calculateFillLevel(distance);
  Serial.print("Fill level: ");
  Serial.print(fillLevel);
  Serial.println("%");
  
  // Read battery voltage
  batteryVoltage = readBatteryVoltage();
  Serial.print("Battery voltage: ");
  Serial.print(batteryVoltage);
  Serial.println("V");
  
  // Broadcast data via BLE
  broadcastData(fillLevel, batteryVoltage);
  
  // Enter deep sleep to save power
  Serial.println("Entering sleep mode...");
  delay(100);
  enterDeepSleep();
}

/**
 * Measures distance using ultrasonic sensor with median filtering
 * Returns: distance in centimeters
 */
float measureDistance() {
  float readings[NUM_SAMPLES];
  
  // Take multiple readings
  for (int i = 0; i < NUM_SAMPLES; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    
    // Measure echo time
    long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
    
    if (duration == 0) {
      readings[i] = MAX_DISTANCE_CM;
    } else {
      readings[i] = duration * 0.034 / 2; // Convert to cm
    }
    
    delay(50); // Wait between readings
  }
  
  // Sort readings for median calculation
  for (int i = 0; i < NUM_SAMPLES - 1; i++) {
    for (int j = i + 1; j < NUM_SAMPLES; j++) {
      if (readings[i] > readings[j]) {
        float temp = readings[i];
        readings[i] = readings[j];
        readings[j] = temp;
      }
    }
  }
  
  // Return median value
  return readings[NUM_SAMPLES / 2];
}

/**
 * Converts distance measurement to fill level percentage
 * Returns: fill level from 0-100%
 */
int calculateFillLevel(float distance) {
  // Adjust for sensor offset
  float adjustedDistance = distance - SENSOR_OFFSET_CM;
  
  // Handle edge cases
  if (adjustedDistance <= 0) {
    return 100; // Overflow condition
  }
  if (adjustedDistance >= BIN_DEPTH_CM) {
    return 0; // Empty bin
  }
  
  // Calculate fill percentage
  float emptySpace = adjustedDistance;
  float fillPercentage = ((BIN_DEPTH_CM - emptySpace) / BIN_DEPTH_CM) * 100.0;
  
  // Clamp to 0-100 range
  int fillLevel = (int)fillPercentage;
  if (fillLevel < 0) fillLevel = 0;
  if (fillLevel > 100) fillLevel = 100;
  
  return fillLevel;
}

/**
 * Reads battery voltage using ADC
 * Returns: voltage in volts
 */
float readBatteryVoltage() {
  int rawValue = analogRead(BATTERY_PIN);
  
  // ESP32 ADC: 0-4095 for 0-3.3V
  // With voltage divider (e.g., 2:1), multiply by 2
  float voltage = (rawValue / 4095.0) * 3.3 * 2.0;
  
  return voltage;
}

/**
 * Initializes BLE for advertising
 */
void setupBLE() {
  Serial.println("Initializing BLE...");
  
  BLEDevice::init(BIN_ID);
  
  // Create BLE Server
  BLEServer *pServer = BLEDevice::createServer();
  
  // Get advertising instance
  pAdvertising = BLEDevice::getAdvertising();
  
  Serial.println("BLE initialized");
}

/**
 * Broadcasts sensor data via BLE advertising
 */
void broadcastData(int fillLevel, float voltage) {
  // Create custom manufacturer data packet
  // Format: [BIN_ID(6), FILL(1), VOLTAGE(2), TIMESTAMP(4)]
  
  std::string manufacturerData;
  
  // Add bin ID (first 6 chars)
  String binId = String(BIN_ID);
  for (int i = 0; i < 6 && i < binId.length(); i++) {
    manufacturerData += (char)binId[i];
  }
  
  // Add fill level (1 byte)
  manufacturerData += (char)fillLevel;
  
  // Add battery voltage (2 bytes, in millivolts)
  uint16_t voltageMillivolts = (uint16_t)(voltage * 1000);
  manufacturerData += (char)(voltageMillivolts & 0xFF);
  manufacturerData += (char)((voltageMillivolts >> 8) & 0xFF);
  
  // Add timestamp (4 bytes - seconds since boot)
  uint32_t timestamp = millis() / 1000;
  manufacturerData += (char)(timestamp & 0xFF);
  manufacturerData += (char)((timestamp >> 8) & 0xFF);
  manufacturerData += (char)((timestamp >> 16) & 0xFF);
  manufacturerData += (char)((timestamp >> 24) & 0xFF);
  
  // Set manufacturer data
  BLEAdvertisementData advertisementData;
  advertisementData.setManufacturerData(manufacturerData);
  advertisementData.setName(BIN_ID);
  
  pAdvertising->setAdvertisementData(advertisementData);
  
  // Start advertising
  pAdvertising->start();
  Serial.println("BLE advertising started");
  
  // Advertise for 5 seconds
  delay(5000);
  
  // Stop advertising to save power
  pAdvertising->stop();
  Serial.println("BLE advertising stopped");
}

/**
 * Enters deep sleep mode to conserve battery
 */
void enterDeepSleep() {
  esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL * 1000); // Convert to microseconds
  esp_deep_sleep_start();
}