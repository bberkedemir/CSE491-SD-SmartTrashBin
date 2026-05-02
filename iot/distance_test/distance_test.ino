/*
 * Smart Waste Bin — Step 1: Distance Test
 * HC-SR04 ultrasonic sensor with ESP32
 * 
 * Wiring:
 *   ESP32 VIN  → HC-SR04 VCC   (Beyaz)
 *   ESP32 GND  → HC-SR04 GND   (Kahve)
 *   ESP32 D5   → HC-SR04 Trig  (Yeşil)
 *   HC-SR04 Echo → 10kΩ → midpoint → 10kΩ → GND
 *   Midpoint → ESP32 D18       (Turuncu)
 */

#define TRIG_PIN 5
#define ECHO_PIN 18
#define NUM_SAMPLES 5

/**
 * Takes NUM_SAMPLES readings and returns the median (filters out noise)
 */
float measureDistance() {
  float readings[NUM_SAMPLES];

  for (int i = 0; i < NUM_SAMPLES; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout

    if (duration == 0) {
      readings[i] = -1; // failed reading
    } else {
      readings[i] = duration * 0.034 / 2.0; // convert to cm
    }

    delay(50);
  }

  // Sort for median
  for (int i = 0; i < NUM_SAMPLES - 1; i++) {
    for (int j = i + 1; j < NUM_SAMPLES; j++) {
      if (readings[i] > readings[j]) {
        float temp = readings[i];
        readings[i] = readings[j];
        readings[j] = temp;
      }
    }
  }

  return readings[NUM_SAMPLES / 2]; // median
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  delay(500);
  Serial.println();
  Serial.println("===================================");
  Serial.println("  Smart Waste Bin - Distance Test");
  Serial.println("  TRIG=D5  ECHO=D18 (via divider)");
  Serial.println("===================================");
  Serial.println();
}

void loop() {
  float distance = measureDistance();

  if (distance < 0) {
    Serial.println("[FAIL] No echo received — check wiring!");
  } else {
    Serial.print("Distance: ");
    Serial.print(distance, 1);
    Serial.println(" cm");
  }

  delay(1000);
}
