# Smart Waste Mobile

React Native (Expo) mobile app for truck drivers to view trash bin fill levels and follow optimized collection routes.

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [Expo Go](https://expo.dev/go) installed on your Android or iOS device
- The Smart Waste backend running (see `../backend/`)
- Your phone and development machine on the **same Wi-Fi network**

## Setup

### 1. Install dependencies

```bash
cd smart-waste-mobile
npm install --legacy-peer-deps
```

### 2. Set the backend URL

Open [`services/api.ts`](services/api.ts) and update `API_BASE_URL` to your machine's local IP address:

```ts
export const API_BASE_URL = 'http://<YOUR_LAN_IP>:8000';
```

Find your IP on Windows:
```bash
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter
```

On macOS/Linux:
```bash
ifconfig | grep "inet "
```

> **Why not `localhost`?** Expo Go runs on your physical device, so `localhost` resolves to the phone itself, not your development machine.

### 3. Start the backend

```bash
cd ../backend
pip install -r requirements.txt   # first time only
uvicorn app.main:app --host 0.0.0.0 --reload
```

The `--host 0.0.0.0` flag makes the backend reachable from other devices on your network.

### 4. Start the mobile app

```bash
npm start
```

Scan the QR code shown in the terminal with **Expo Go** (Android) or the Camera app (iOS).

## Screens

### Login
Sign in with your truck driver credentials. Sessions are persisted across app restarts.

### Map (Home tab)
- Interactive map with color-coded bin markers (tap any marker for details)
  - Green — below 50% · Yellow — 50–75% · Orange — 75–90% · Red — above 90%
- Stats overlay shows total bin count and how many need collection
- Fill level legend in the bottom-left corner
- **"Get Route"** FAB — calls the backend optimizer using your live GPS position; draws the route polyline and numbered stop badges on the map
- Route ready banner shows distance, duration, and a **Start** button
- **Refresh** button reloads bins from the backend
- **GPS** button re-centers the map on your current location
- Logout button (top-right)

### Route (Route tab)
- Continuous GPS tracking (every 10 m) with live distance to the current stop
- **Proximity alert** — banner + haptic vibration when within 50 m of the next bin
- **Navigate** — opens current stop in Google Maps with driving directions
- **Mark Collected** — calls the backend, advances to next stop automatically
- **Skip** — skips an inaccessible bin with a confirmation dialog; skipped bins are shown in the summary
- Progress bar and stop list with colour-coded status (current / collected / skipped)
- When all stops are resolved, navigates automatically to the Summary screen

### Route Summary
- Appears automatically when the last stop is resolved
- Shows collected vs. skipped bins, fill-level changes, distance, duration, and completion percentage
- Warning if any bins were skipped
- Links back to Map and Logs

### Logs (Logs tab)
- Pull-to-refresh list of all collection events with human-readable timestamps (e.g. "3h ago", "Yesterday")
- Fill before → after with colour-coded chips and delta label
- Infinite scroll — loads 20 entries at a time
- Retry button on connection error

## Project Structure

```
smart-waste-mobile/
├── app/
│   ├── _layout.tsx          # Root layout (AuthProvider + theme)
│   ├── index.tsx            # Redirect to login or map based on auth state
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx        # Login screen
│   └── (driver)/
│       ├── _layout.tsx      # Tab bar + auth guard
│       ├── index.tsx        # Map / home screen
│       ├── route.tsx        # Active route + live GPS tracking
│       ├── summary.tsx      # Route completion summary
│       └── logs.tsx         # Collection logs with pagination
├── components/
│   ├── EmptyState.tsx       # Reusable empty state with icon + CTA
│   └── ErrorState.tsx       # Reusable error state with retry button
├── context/
│   └── AuthContext.tsx      # JWT auth state, session persistence
├── services/
│   └── api.ts               # Axios client + all backend API calls
├── types/
│   └── index.ts             # Shared TypeScript interfaces
└── app.json                 # Expo config (permissions, scheme)
```

## Key Dependencies

| Package | Purpose |
|---|---|
| `expo-router` | File-based navigation |
| `expo-location` | GPS location for route start point |
| `react-native-paper` | Material Design UI components |
| `@react-native-async-storage/async-storage` | JWT token persistence |
| `axios` | HTTP client for backend API |

## Backend API Endpoints Used

| Endpoint | Usage |
|---|---|
| `POST /api/v1/auth/login` | Sign in |
| `GET /api/v1/auth/me` | Restore session on app launch |
| `POST /api/v1/auth/logout` | Sign out (blacklists token) |
| `GET /api/v1/bins/` | Fetch all bins with fill levels |
| `GET /api/v1/routes/optimize` | Get optimized collection route |
| `POST /api/v1/bins/{id}/collect` | Mark a bin as collected |
| `GET /api/v1/logs/` | Fetch collection history |

## Troubleshooting

**Cannot connect to backend**
- Make sure the backend is running with `--host 0.0.0.0`
- Confirm `API_BASE_URL` uses your LAN IP, not `localhost`
- Both devices must be on the same Wi-Fi network

**Location permission denied**
- The app falls back to the campus gate coordinates (36.892539, 30.663895) if GPS is unavailable
- Grant location permission in your device Settings → Apps → Smart Waste

**"No bins" after tapping Get Route**
- All bins may be below the 75% fill threshold — use the admin web UI to simulate trash fills
