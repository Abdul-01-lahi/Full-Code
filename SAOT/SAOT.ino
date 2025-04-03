#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>

// WiFi credentials
#define WIFI_SSID "Abdul Redmi Note 13"
#define WIFI_PASSWORD "abdulllll"

// Firebase credentials
#define API_KEY "AIzaSyDfDcMpEVl4eeDUXv3JbBtBgEu5byna8Uo"
#define DATABASE_URL "https://rain-genie-default-rtdb.firebaseio.com/"
#define USER_EMAIL "abdullahioye10@gmail.com"
#define USER_PASSWORD "abdullahi"

// Sensor pins
#define AOUT_PIN A0
#define RELAY_PIN D5
#define DHTPIN D2
#define PIR_PIN D1
#define DHTTYPE DHT11
#define DEFAULT_THRESHOLD 500  // Default soil moisture threshold (reversed scale)

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// DHT sensor object
DHT dht(DHTPIN, DHTTYPE);

// Configuration settings structure
struct ConfigSettings {
  bool manualPumpControl;
  int soilMoistureThreshold;
};

ConfigSettings settings;

// Sensor variables
bool currentMotion = false;
bool previousMotion = false;
unsigned long lastMotionTime = 0;
unsigned long sendDataPrevMillis = 0;
unsigned long lastPumpStatusUpdate = 0;
bool lastPumpState = false;
unsigned long lastPumpUpdate = 0;

void sendToFirebase(const String &path, int value);
void sendToFirebase(const String &path, float value);
void sendToFirebase(const String &path, bool value);

void setup() {
  Serial.begin(9600);
  
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  digitalWrite(RELAY_PIN, LOW);
  dht.begin();
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nConnected to Wi-Fi");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  config.api_key = API_KEY;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  config.database_url = DATABASE_URL;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  // Default settings
  settings.manualPumpControl = false;
  settings.soilMoistureThreshold = DEFAULT_THRESHOLD;
  
  Serial.println("System Initialized - Firebase Monitoring:");
  Serial.println("1. Soil Moisture → Controls Pump");
  Serial.println("2. DHT11 → Environment Data");
  Serial.println("3. PIR → Motion Detection");
  delay(10);
}

void loop() {
  // Check for manual control setting
  if (Firebase.RTDB.getBool(&fbdo, "/settings/manualPumpControl")) {
    settings.manualPumpControl = fbdo.boolData();
  }

  // Read soil moisture and reverse the value (1024 = wet, 0 = dry)
  int moistureValue = 1023 - analogRead(AOUT_PIN);
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  currentMotion = digitalRead(PIR_PIN);
  
  // Motion detection logic
  if (currentMotion != previousMotion) {
    if (currentMotion) {
      lastMotionTime = millis();
      Serial.println("Motion detected!");
      sendToFirebase("/sensorData/motion", true);
    } else {
      Serial.println("Motion ended");
      Serial.print("Duration: ");
      Serial.print((millis() - lastMotionTime)/1000);
      Serial.println(" seconds");
      sendToFirebase("/sensorData/motion", false);
    }
    previousMotion = currentMotion;
  }

  // Pump control logic
  bool pumpStatus = false;
  
  if (settings.manualPumpControl) {
    // Manual mode - check for pump status changes more frequently
    if (millis() - lastPumpStatusUpdate > 10) { // Check every 500ms
      if (Firebase.RTDB.getBool(&fbdo, "/sensorData/pumpStatus")) {
        if (fbdo.boolData() != lastPumpState) {
          pumpStatus = fbdo.boolData();
          lastPumpState = pumpStatus;
          Serial.println("Manual pump control: " + String(pumpStatus ? "ON" : "OFF"));
        }
      }
      lastPumpStatusUpdate = millis();
    }
    pumpStatus = lastPumpState; // Use the last known state
  } else {
    // Auto mode - control based on soil moisture (now reversed)
    bool needsWater = moistureValue < settings.soilMoistureThreshold;
    
    if (needsWater) {
      pumpStatus = true;
      Serial.println("Auto mode: Soil dry (" + String(moistureValue) + 
                    " < " + String(settings.soilMoistureThreshold) + 
                    "), turning pump ON");
    }
  }

  digitalWrite(RELAY_PIN, pumpStatus ? HIGH : LOW);
  if (Firebase.ready() && (millis() - lastPumpUpdate > 50)) { // Faster pump updates (50ms)
    lastPumpUpdate = millis();
    sendToFirebase("/sensorData/pumpStatus", pumpStatus);
  }

  // Send data to Firebase
  if (Firebase.ready() && (millis() - sendDataPrevMillis > 100 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    sendToFirebase("/sensorData/soilMoisture", moistureValue);
    sendToFirebase("/sensorData/temperature", temperature);
    sendToFirebase("/sensorData/humidity", humidity);
//    sendToFirebase("/sensorData/pumpStatus", pumpStatus);
  }

  delay(10);
}

void sendToFirebase(const String &path, int value) {
  if (Firebase.RTDB.setInt(&fbdo, path, value)) {
    Serial.println("Sent to " + path + ": " + String(value));
  } else {
    Serial.println("Failed to send to " + path);
    Serial.println("Reason: " + fbdo.errorReason());
  }
}

void sendToFirebase(const String &path, float value) {
  if (Firebase.RTDB.setFloat(&fbdo, path, value)) {
    Serial.println("Sent to " + path + ": " + String(value));
  } else {
    Serial.println("Failed to send to " + path);
    Serial.println("Reason: " + fbdo.errorReason());
  }
}

void sendToFirebase(const String &path, bool value) {
  if (Firebase.RTDB.setBool(&fbdo, path, value)) {
    Serial.println("Sent to " + path + ": " + String(value));
  } else {
    Serial.println("Failed to send to " + path);
    Serial.println("Reason: " + fbdo.errorReason());
  }
}
