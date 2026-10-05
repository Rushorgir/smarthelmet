// =============================================================================
//  INTELLIGENT HELMET FOR RIDER SAFETY — ESP32 FIRMWARE
//  Framework : Arduino (ESP32 Core)
//  Author    : SmartHelmet Project
// =============================================================================
//
//  Peripherals
//  ───────────────────────────────────────────────────────
//   MPU-6050   →  I2C   (SDA = GPIO 8,  SCL = GPIO 9)
//   MQ-3       →  ADC   (GPIO 4)
//   NEO-6M GPS →  UART2 (RX = GPIO 16,  TX = GPIO 17)  9600 baud
//   Red LED    →  GPIO 5   (active-high)
//   Buzzer     →  GPIO 6   (active-high)
//
//  Architecture
//  ───────────────────────────────────────────────────────
//   • Fully non-blocking core loop — zero delay() calls.
//   • Continuous MPU-6050 burst reads with squared-magnitude crash detection.
//   • 10-second millis()-based telemetry cycle (GPS speed, timestamp, alcohol,
//     MAC address) → HTTP POST to Supabase Edge Function.
//   • Instant crash override → emergency HTTP POST with severity + cooldown.
//   • Async LED/buzzer alarm via millis()-driven state machine.
//
// =============================================================================

#include <Arduino.h>
#include <cstdint>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <ArduinoJson.h>

// =============================================================================
//  CONFIGURATION — Loaded securely from config.h (gitignored for safety)
// =============================================================================

#if __has_include("config.h")
    #include "config.h"
#endif

// Wi-Fi credentials
#ifndef WIFI_SSID
    #define WIFI_SSID     "YOUR_WIFI_SSID"
#endif
#ifndef WIFI_PASSWORD
    #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#endif

// Supabase project credentials
#ifndef SUPABASE_URL
    #define SUPABASE_URL       "https://<SUPABASE_PROJECT_ID>.supabase.co"
#endif
#ifndef SUPABASE_ANON_KEY
    #define SUPABASE_ANON_KEY  "<SUPABASE_ANON_KEY>"
#endif

// Supabase Edge Function endpoints
static const char* ENDPOINT_TELEMETRY = "/functions/v1/ingest-telemetry";
static const char* ENDPOINT_ACCIDENT  = "/functions/v1/log-accident";

// =============================================================================
//  PIN CONFIGURATION
// =============================================================================
constexpr uint8_t PIN_SDA     = 8;
constexpr uint8_t PIN_SCL     = 9;
constexpr uint8_t PIN_MQ3     = 4;
constexpr uint8_t PIN_RED_LED = 5;
constexpr uint8_t PIN_BUZZER  = 6;
constexpr uint8_t PIN_GPS_RX  = 16;   // ESP32 RX ← GPS TX
constexpr uint8_t PIN_GPS_TX  = 17;   // ESP32 TX → GPS RX

// =============================================================================
//  SENSOR THRESHOLDS & TIMING
// =============================================================================

// MQ-3 alcohol analog threshold (ESP32 12-bit ADC: 0–4095)
constexpr int ALCOHOL_THRESHOLD = 3000;

// MPU-6050 configured for ±8 g  →  4096 LSB/g
// 2.5 g ≈ 10240 LSB.  We compare squared magnitudes to avoid sqrt().
constexpr int32_t  CRASH_THRESHOLD    = 10240;
constexpr uint64_t CRASH_THRESHOLD_SQ = (uint64_t)CRASH_THRESHOLD * CRASH_THRESHOLD;

// Severity classification boundaries (in LSB, same 4096 LSB/g scale)
constexpr int32_t SEVERITY_35G = (int32_t)(3.5 * 4096);   // 14336
constexpr int32_t SEVERITY_50G = (int32_t)(5.0 * 4096);   // 20480
constexpr int32_t SEVERITY_70G = (int32_t)(7.0 * 4096);   // 28672

constexpr uint64_t SEV_35G_SQ = (uint64_t)SEVERITY_35G * SEVERITY_35G;
constexpr uint64_t SEV_50G_SQ = (uint64_t)SEVERITY_50G * SEVERITY_50G;
constexpr uint64_t SEV_70G_SQ = (uint64_t)SEVERITY_70G * SEVERITY_70G;

// Timing intervals (milliseconds)
constexpr unsigned long TELEMETRY_INTERVAL_MS = 10000;   // 10 seconds
constexpr unsigned long CRASH_COOLDOWN_MS     = 5000;    // 5-second debounce
constexpr unsigned long ALARM_TOGGLE_MS       = 150;     // LED/buzzer blink rate
constexpr unsigned long ALARM_DURATION_MS     = 3000;    // total alarm window
constexpr unsigned long SERIAL_DIAG_MS        = 500;     // serial print rate-limit

// =============================================================================
//  MPU-6050 REGISTERS
// =============================================================================
constexpr uint8_t MPU_ADDR          = 0x68;
constexpr uint8_t MPU_REG_ACCEL_X   = 0x3B;
constexpr uint8_t MPU_REG_ACCEL_CFG = 0x1C;
constexpr uint8_t MPU_REG_PWR_MGMT  = 0x6B;
constexpr uint8_t MPU_REG_WHO_AM_I  = 0x75;

// =============================================================================
//  GLOBAL OBJECTS & STATE
// =============================================================================

// GPS parser + hardware serial
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);   // UART2

// Timing trackers (all non-blocking via millis())
unsigned long lastTelemetryMs  = 0;
unsigned long lastCrashPostMs  = 0;
unsigned long lastSerialDiagMs = 0;

// Asynchronous alarm state machine
bool          alarmActive      = false;
unsigned long alarmStartMs     = 0;
unsigned long alarmToggleMs    = 0;
bool          alarmLedState    = false;

// Cached MAC address (read once at boot)
String macAddress;

// =============================================================================
//  MPU-6050 HELPERS
// =============================================================================

bool mpuWriteReg(uint8_t reg, uint8_t value) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(reg);
    Wire.write(value);
    return (Wire.endTransmission() == 0);
}

uint8_t mpuReadReg(uint8_t reg) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom(MPU_ADDR, (uint8_t)1);
    return Wire.available() ? Wire.read() : 0;
}

/// Burst-read 6 bytes (X, Y, Z) in a single I2C transaction.
bool mpuReadAccel(int16_t &ax, int16_t &ay, int16_t &az) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(MPU_REG_ACCEL_X);
    if (Wire.endTransmission(false) != 0) return false;

    if (Wire.requestFrom(MPU_ADDR, (uint8_t)6) != 6) return false;

    ax = (int16_t)((Wire.read() << 8) | Wire.read());
    ay = (int16_t)((Wire.read() << 8) | Wire.read());
    az = (int16_t)((Wire.read() << 8) | Wire.read());
    return true;
}

// =============================================================================
//  GPS HELPERS
// =============================================================================

/// Build an ISO-8601 / UTC timestamp from GPS date+time.
/// Returns "NO_FIX" when the GPS has no valid date/time.
String gpsTimestamp() {
    if (!gps.date.isValid() || !gps.time.isValid()) {
        return "NO_FIX";
    }
    char buf[28];
    snprintf(buf, sizeof(buf),
             "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
    return String(buf);
}

/// Return speed in km/h, or 0.0 when no fix.
double gpsSpeedKmh() {
    return gps.speed.isValid() ? gps.speed.kmph() : 0.0;
}

/// Return "lat, lng" string, or "NO_FIX" when unavailable.
String gpsLocation() {
    if (!gps.location.isValid()) return "NO_FIX";
    char buf[32];
    snprintf(buf, sizeof(buf), "%.6f, %.6f",
             gps.location.lat(), gps.location.lng());
    return String(buf);
}

// =============================================================================
//  SEVERITY CLASSIFICATION
// =============================================================================

/// Map squared acceleration magnitude to human-readable severity label.
const char* classifySeverity(uint64_t accelSq) {
    if (accelSq > SEV_70G_SQ) return "Extreme";
    if (accelSq > SEV_50G_SQ) return "High";
    if (accelSq > SEV_35G_SQ) return "Medium";
    return "Low";
}

// =============================================================================
//  ASYNC ALARM (LED + BUZZER) STATE MACHINE
// =============================================================================

/// Activate the alarm pattern for ALARM_DURATION_MS.
void alarmStart() {
    alarmActive   = true;
    alarmStartMs  = millis();
    alarmToggleMs = millis();
    alarmLedState = true;
    digitalWrite(PIN_RED_LED, HIGH);
    digitalWrite(PIN_BUZZER,  HIGH);
}

/// Must be called every loop iteration.  Handles toggling and auto-off.
void alarmUpdate() {
    if (!alarmActive) return;

    unsigned long now = millis();

    // Auto-expire the alarm after ALARM_DURATION_MS
    if (now - alarmStartMs >= ALARM_DURATION_MS) {
        alarmActive = false;
        digitalWrite(PIN_RED_LED, LOW);
        digitalWrite(PIN_BUZZER,  LOW);
        return;
    }

    // Toggle LED/buzzer at ALARM_TOGGLE_MS cadence
    if (now - alarmToggleMs >= ALARM_TOGGLE_MS) {
        alarmToggleMs = now;
        alarmLedState = !alarmLedState;
        digitalWrite(PIN_RED_LED, alarmLedState ? HIGH : LOW);
        digitalWrite(PIN_BUZZER,  alarmLedState ? HIGH : LOW);
    }
}

// =============================================================================
//  HTTP POST HELPERS
// =============================================================================

/// Build full URL for a given endpoint path.
String buildUrl(const char* endpoint) {
    return String(SUPABASE_URL) + endpoint;
}

/// Build the Authorization header value.
String authHeader() {
    return String("Bearer ") + SUPABASE_ANON_KEY;
}

/// Fire-and-forget HTTP POST.  Returns the HTTP response code (or < 0 on error).
int httpPost(const String &url, const String &jsonPayload) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[HTTP] WiFi not connected — skipping POST.");
        return -1;
    }

    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", authHeader());
    http.setTimeout(5000);   // 5-second network timeout

    int code = http.POST(jsonPayload);

    if (code > 0) {
        Serial.printf("[HTTP] POST %s → %d\n", url.c_str(), code);
    } else {
        Serial.printf("[HTTP] POST failed: %s\n", http.errorToString(code).c_str());
    }

    http.end();
    return code;
}

// =============================================================================
//  TELEMETRY — periodic 10-second payload
// =============================================================================

void sendTelemetry(int alcoholValue) {
    String timestamp = gpsTimestamp();
    double speed     = gpsSpeedKmh();

    // Build JSON with ArduinoJson
    JsonDocument doc;
    doc["mac_address"]  = macAddress;
    doc["time"]         = timestamp;
    doc["speed"]        = serialized(String(speed, 2));   // 2 decimal places
    doc["alcohollevel"] = alcoholValue;

    String payload;
    serializeJson(doc, payload);

    Serial.println("[TELEMETRY] " + payload);
    httpPost(buildUrl(ENDPOINT_TELEMETRY), payload);
}

// =============================================================================
//  ACCIDENT / CRASH — instant emergency payload
// =============================================================================

void sendAccident(uint64_t accelSq) {
    String timestamp = gpsTimestamp();
    String location  = gpsLocation();
    const char* sev  = classifySeverity(accelSq);

    JsonDocument doc;
    doc["mac_address"] = macAddress;
    doc["location"]    = location;
    doc["reporttime"]  = timestamp;
    doc["severity"]    = sev;

    String payload;
    serializeJson(doc, payload);

    Serial.println("[ACCIDENT] " + payload);
    httpPost(buildUrl(ENDPOINT_ACCIDENT), payload);
}

// =============================================================================
//  Wi-Fi CONNECTION (blocking only at boot; reconnect is non-blocking)
// =============================================================================

/// Attempt initial connection (used in setup — small blocking window is fine).
void wifiConnect() {
    Serial.printf("[WiFi] Connecting to \"%s\" ", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
        delay(250);          // acceptable only during one-time setup
        Serial.print('.');
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected!  IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WiFi] Connection failed — will retry in loop.");
    }
}

/// Non-blocking reconnect check (called from loop).
void wifiReconnectCheck() {
    static unsigned long lastAttempt = 0;
    if (WiFi.status() == WL_CONNECTED) return;

    unsigned long now = millis();
    if (now - lastAttempt < 10000) return;   // retry every 10 s
    lastAttempt = now;

    Serial.println("[WiFi] Attempting reconnect...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// =============================================================================
//  SETUP
// =============================================================================

void setup() {
    // ── Serial ──
    Serial.begin(115200);

    // ── GPIO ──
    pinMode(PIN_MQ3,     INPUT);
    pinMode(PIN_RED_LED,  OUTPUT);
    pinMode(PIN_BUZZER,   OUTPUT);
    digitalWrite(PIN_RED_LED, LOW);
    digitalWrite(PIN_BUZZER,  LOW);

    // ── I2C (MPU-6050) ──
    Wire.begin(PIN_SDA, PIN_SCL);

    // ── GPS UART2 ──
    gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);

    // ── Banner ──
    Serial.println();
    Serial.println("================================================");
    Serial.println("   INTELLIGENT HELMET FOR RIDER SAFETY  v2.0    ");
    Serial.println("================================================");

    // ── MPU-6050 init ──
    uint8_t whoAmI = mpuReadReg(MPU_REG_WHO_AM_I);
    if (whoAmI == 0x68 || whoAmI == 0x70 || whoAmI == 0x72) {
        Serial.println("[OK]   MPU-6050 detected.");
    } else {
        Serial.printf("[WARN] MPU-6050 WHO_AM_I = 0x%02X — check wiring.\n", whoAmI);
    }
    mpuWriteReg(MPU_REG_PWR_MGMT,  0x00);   // wake up
    mpuWriteReg(MPU_REG_ACCEL_CFG, 0x10);   // ±8 g (AFS_SEL = 2)

    // ── Wi-Fi ──
    wifiConnect();
    macAddress = WiFi.macAddress();          // cache once
    Serial.println("[INFO] MAC: " + macAddress);

    // ── Summary ──
    Serial.printf("[CFG]  Alcohol threshold : %d\n",   ALCOHOL_THRESHOLD);
    Serial.printf("[CFG]  Crash threshold   : %ld LSB  (~2.5 g)\n", (long)CRASH_THRESHOLD);
    Serial.printf("[CFG]  Telemetry interval: %lu ms\n", TELEMETRY_INTERVAL_MS);
    Serial.printf("[CFG]  Crash cooldown    : %lu ms\n", CRASH_COOLDOWN_MS);
    Serial.println("[BOOT] System ready.\n");

    // Seed timers so the first tick happens after one full interval
    lastTelemetryMs = millis();
    lastCrashPostMs = 0;
}

// =============================================================================
//  MAIN LOOP — fully non-blocking
// =============================================================================

void loop() {
    unsigned long now = millis();

    // ── 0. Feed GPS parser with any available serial bytes ──
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }

    // ── 1. Wi-Fi keepalive (non-blocking) ──
    wifiReconnectCheck();

    // ── 2. Continuous MPU-6050 accelerometer read ──
    int16_t ax = 0, ay = 0, az = 0;
    bool mpuOk = mpuReadAccel(ax, ay, az);

    uint64_t accelSq = 0;
    if (mpuOk) {
        accelSq = (uint64_t)((int32_t)ax * ax)
                + (uint64_t)((int32_t)ay * ay)
                + (uint64_t)((int32_t)az * az);
    }

    bool crashDetected = mpuOk && (accelSq > CRASH_THRESHOLD_SQ);

    // ── 3. Crash / accident override (instant, debounced) ──
    if (crashDetected && (now - lastCrashPostMs >= CRASH_COOLDOWN_MS)) {
        lastCrashPostMs = now;

        Serial.println("\n*** CRASH DETECTED — EMERGENCY ***");
        alarmStart();
        sendAccident(accelSq);
    }

    // ── 4. 10-second telemetry cycle ──
    if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryMs = now;

        int alcoholValue = analogRead(PIN_MQ3);

        // Alcohol threshold warning (LED/buzzer only — no accident POST)
        if (alcoholValue > ALCOHOL_THRESHOLD && !alarmActive) {
            alarmStart();
            Serial.println("[ALERT] Alcohol level exceeded threshold!");
        }

        sendTelemetry(alcoholValue);
    }

    // ── 5. Async alarm state machine tick ──
    alarmUpdate();

    // ── 6. Rate-limited serial diagnostics ──
    if (now - lastSerialDiagMs >= SERIAL_DIAG_MS) {
        lastSerialDiagMs = now;

        Serial.printf("MQ3: %4d | ACC [X:%6d Y:%6d Z:%6d] | GPS: %s | %s\n",
                       analogRead(PIN_MQ3), ax, ay, az,
                       gps.location.isValid() ? "FIX" : "---",
                       alarmActive ? "ALARM" : "OK");
    }
}