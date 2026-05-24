# Campus Sense

<p align="center">
  <img src="smart-waste-ui/src/assets/logo.png" alt="Campus Sense logo" width="120" />
</p>

<p align="center">
  <strong>Campus operations platform for smart waste collection, driver routing, IoT fill monitoring, and road anomaly detection.</strong>
</p>

<p align="center">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-Web_UI-61DAFB?logo=react&logoColor=black" />
  <img alt="Expo" src="https://img.shields.io/badge/Expo-Mobile-000020?logo=expo&logoColor=white" />
  <img alt="YOLO" src="https://img.shields.io/badge/YOLO-Road_Anomaly_Detection-111111" />
  <img alt="ESP32" src="https://img.shields.io/badge/ESP32-IoT_Sensor-3C3C3C" />
</p>

## Overview

Campus Sense is a CSE491 Software Design project that models a smarter campus operations workflow from sensor data to collection execution and road-condition awareness. The system combines a FastAPI backend, PostgreSQL persistence, a React admin dashboard, an Expo driver app, ESP32 ultrasonic sensor firmware, route optimization algorithms, live driver tracking, and a YOLO-based road anomaly detection pipeline.

The goal is to reduce unnecessary collection trips while giving operators and drivers a real-time view of bin status, optimized routes, collection logs, and road-condition evidence captured during routes.

## Product Highlights

- Monitor waste bins on an interactive map with live fill percentages and status colors.
- Import, export, add, delete, and simulate bin data from the admin web UI.
- Optimize collection routes from the truck's current location using OSRM road distances.
- Compare a greedy nearest-neighbor baseline against an improved nearest-neighbor + 2-opt + Or-Opt algorithm.
- Track active driver sessions through WebSocket updates.
- Let drivers collect, skip, and complete stops from the mobile app with GPS proximity behavior.
- Capture road videos and synchronized GPS logs from the mobile app.
- Analyze uploaded road footage with a trained YOLO model and persist detected anomalies with crop images, timestamps, confidence scores, and coordinates.
- Review, update, import, and delete road anomaly records from the admin dashboard.
- Update bin fill levels from ESP32 + HC-SR04 ultrasonic sensor firmware through an IoT API-key endpoint.

## Architecture

```mermaid
flowchart LR
    Sensor["ESP32 + HC-SR04 Sensor"] --> IoT["IoT Fill Endpoint"]
    Admin["React Admin UI"] --> API["FastAPI Backend"]
    Driver["Expo Driver App"] --> API
    IoT --> API
    API --> DB["PostgreSQL"]
    API --> OSRM["OSRM Routing API"]
    Driver --> Uploads["Video + GPS Uploads"]
    Uploads --> API
    API --> YOLO["YOLO Road Anomaly Pipeline"]
    YOLO --> DB
    API --> WS["WebSocket Driver Tracking"]
    WS --> Admin
```

## Tech Stack

| Layer | Tools |
| --- | --- |
| Backend API | FastAPI, SQLAlchemy, Pydantic, Uvicorn |
| Database | PostgreSQL |
| Web dashboard | React, TypeScript, Vite, Material UI, Leaflet, Recharts |
| Mobile app | Expo, React Native, Expo Router, React Native Paper, React Native Maps |
| Routing | OSRM, nearest-neighbor TSP, 2-opt, Or-Opt |
| Computer vision | Ultralytics YOLO, OpenCV, ByteTrack |
| IoT | ESP32, HC-SR04 ultrasonic sensor, Arduino firmware |

## Repository Structure

```text
.
|-- backend/                  FastAPI API, database models, auth, routing, IoT, tracking, anomaly workflows
|-- smart-waste-ui/           React admin dashboard and map interface
|-- smart-waste-mobile/       Expo driver app for routes, logs, GPS tracking, and anomaly capture
|-- iot/                      ESP32 ultrasonic sensor firmware and distance tests
|-- road-anomaly-detection/   YOLO training, tracking, extraction, and test output scripts
|-- smart-waste-collections/  Earlier gateway and threshold-routing prototypes
|-- sample_bins.json          Sample bin seed data
```

## Core Features

### Admin Web Dashboard

The web application gives operators a map-first control surface for monitoring and managing the system:

- Bin markers with fill-level visualization.
- Dashboard metrics for total bins, average fill, and bins requiring attention.
- Route optimization controls and algorithm comparison.
- Driver session panel with live WebSocket tracking.
- Collection log and anomaly log pages.
- Admin-only user, truck, bin import/export, and cleanup actions.

### Driver Mobile App

The Expo app supports the collection workflow in the field:

- Driver authentication and persisted sessions.
- Route map, optimized stops, and collection progress.
- GPS tracking while driving an active route.
- Stop collection, skip handling, route summary, and log review.
- Camera recording for road anomaly evidence with synchronized GPS samples.
- Retryable upload flow for recorded anomaly sessions.

### Route Optimization

The backend exposes two route strategies:

- `GET /api/v1/routes/optimize-greedy` uses a nearest-neighbor TSP baseline.
- `GET /api/v1/routes/optimize` uses nearest neighbor, then improves the route with 2-opt and Or-Opt segment shifting.

Routes are generated from bins above a configurable fill threshold, use OSRM road distances, and can respect a truck capacity limit when a driver has an assigned truck.

### Road Anomaly Detection

The road anomaly pipeline uses YOLO tracking to detect and extract road issues from driver-recorded footage. Supported classes include longitudinal crack, transverse crack, alligator crack, other corruption, and pothole. The backend stores detected anomalies with image paths, confidence scores, video timestamps, GPS coordinates, upload metadata, and repair status.

### IoT Fill Monitoring

The ESP32 firmware reads distance from an HC-SR04 ultrasonic sensor, converts distance into a bin fill percentage, and sends updates to:

```http
PUT /api/v1/iot/bins/{bin_id}/fill?api_key=...
```

The backend validates the API key, updates the bin, and records fill-change logs.

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL
- Expo Go for testing the mobile app on a physical device
- Arduino IDE or compatible ESP32 toolchain for firmware uploads

### 1. Backend

Create a PostgreSQL database:

```sql
CREATE DATABASE smart_waste_db;
```

Create `backend/.env` and adjust values for your machine:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/smart_waste_db
SECRET_KEY=replace-this-for-local-dev
IOT_API_KEY=smartbin-iot-2026
ALLOWED_ORIGINS=["http://localhost:5173","http://localhost:3000"]
ANOMALY_MODEL_PATH=road-anomaly-detection/best.pt
```

Install and run the API:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment before installing dependencies:

```bash
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate
```

Then install and run the API:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs are available at:

```text
http://localhost:8000/docs
```

### 2. Web Dashboard

```bash
cd smart-waste-ui
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

### 3. Mobile App

Set the backend URL in `smart-waste-mobile/services/api.ts` to your development machine's LAN IP address:

```ts
export const API_BASE_URL = 'http://<YOUR_LAN_IP>:8000';
```

Then start Expo:

```bash
cd smart-waste-mobile
npm install --legacy-peer-deps
npm start
```

Scan the QR code with Expo Go. The phone and backend machine must be on the same network.

### 4. IoT Firmware

Open the firmware in Arduino IDE:

```text
iot/smart_waste_iot/smart_waste_iot.ino
```

Update these values before flashing:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `SERVER_IP`
- `SERVER_PORT`
- `BIN_ID`
- `API_KEY`

## Useful API Areas

| Area | Endpoints |
| --- | --- |
| Auth | `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/logout` |
| Bins | `/api/v1/bins`, `/api/v1/bins/upload`, `/api/v1/bins/export`, `/api/v1/bins/{id}/collect` |
| Routes | `/api/v1/routes/optimize`, `/api/v1/routes/optimize-greedy` |
| Logs | `/api/v1/logs` |
| IoT | `/api/v1/iot/bins/{id}/fill` |
| Tracking | `/api/v1/tracking/start`, `/api/v1/tracking/position`, `/api/v1/tracking/ws` |
| Anomalies | `/api/v1/anomalies/uploads`, `/api/v1/anomalies/map`, `/api/v1/anomalies/import-folder` |
| Users and trucks | `/api/v1/users`, `/api/v1/trucks` |

## Demo Flow

1. Start PostgreSQL and the FastAPI backend.
2. Run the React admin dashboard.
3. Register or log in as an admin.
4. Import `sample_bins.json` or add bins directly on the map.
5. Use simulation or the ESP32 firmware to update fill levels.
6. Generate a route from the web UI or driver app.
7. Start a route in the mobile app and watch the driver session update on the admin map.
8. Record a road anomaly session from the mobile app and upload it for analysis.
9. Review detected anomalies in the admin anomaly log page.

## Contributors

- Berat Berke Demir
- Melike Esra Öz
- Yavuz Selim Gezginci

## Notes

This repository is an academic prototype intended to demonstrate full-stack system design, IoT integration, routing algorithms, and computer-vision-assisted infrastructure monitoring. Development defaults in the codebase should be replaced before any production deployment.
