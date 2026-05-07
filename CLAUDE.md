# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Trash Bin is a full-stack waste collection optimization platform. IoT sensors on bins report fill levels; the backend aggregates data and computes optimal collection routes; the frontend lets admins and truck drivers view bins on a map and follow optimized routes.

## Commands

### Backend

```bash
cd backend
pip install -r requirements.txt          # install dependencies
uvicorn app.main:app --reload            # dev server at http://localhost:8000
# API docs: http://localhost:8000/docs
```

### Frontend

```bash
cd smart-waste-ui
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build
npm run lint         # ESLint
npm run preview      # preview production build
```

### Database

PostgreSQL must be running. Create the database once:
```sql
CREATE DATABASE smart_waste_db;
```

SQLAlchemy creates tables automatically on app startup. The backend reads credentials from `backend/.env`:
```
DATABASE_URL=postgresql://postgres:1234@localhost:5432/smart_waste_db
```

## Architecture

### Components

| Layer | Tech | Location |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite + MUI + Leaflet | `smart-waste-ui/` |
| Backend API | FastAPI + SQLAlchemy + PostgreSQL | `backend/` |
| Hardware/Gateway | BLE sensor nodes, gateway bridge | `smart-waste-collections/` |
| Route optimization | Python TSP algorithms | `backend/app/services/` and `smart-waste-collections/optimization/` |

### Backend (`backend/app/`)

- **`main.py`** — app factory; registers routers under `/api/v1`
- **`core/config.py`** — settings (SECRET_KEY, CORS origins, DB URL)
- **`api/v1/endpoints/`** — route handlers: `auth.py`, `bins.py`, `routes.py`, `logs.py`
- **`services/`** — business logic: `greedy_tsp.py` (nearest-neighbor), `segment_shifting.py` (2-opt + Or-opt)
- **`models/`** — SQLAlchemy models: `User`, `Bin`, `Log`, `TokenBlacklist`
- **`crud/`** — DB operations for each model
- **`schemas/`** — Pydantic schemas for request/response validation

Route optimization calls the public OSRM service (`router.project-osrm.org`) to get distance matrices; internet access is required.

### Frontend (`smart-waste-ui/src/`)

- **`App.tsx`** — React Router layout; protected routes redirect unauthenticated users to `/login`
- **`context/AuthContext.tsx`** — JWT auth state (login, logout, token refresh)
- **`pages/`** — `RoutingPage`, `Dashboard`, `Logs`, `LoginPage`, `RegisterPage`
- **`components/`** — `MapContainer` (Leaflet), `Sidebar`, `AlgorithmComparisonModal`
- **`services/`** — API client functions (axios, proxied to `http://localhost:8000` via Vite)
- **`types/`** — shared TypeScript interfaces

The Vite dev server proxies all `/api` requests to the backend, eliminating CORS friction during development.

### Auth flow

JWT tokens are issued on login and stored client-side. Logout adds the token to a `TokenBlacklist` table. Role-based access distinguishes `admin` from `truck_driver`.

### Hardware layer (`smart-waste-collections/`)

- `gateway/` — BLE gateway that receives sensor data and forwards it to the backend
- `hardware/sensor_node/` — firmware/config for physical bin sensors
- `optimization/` — standalone Python scripts for threshold processing and route optimization (partially duplicated in the backend services)
