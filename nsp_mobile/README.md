# NSP Mobile (Flutter MVP)

Public-user Flutter app for the Syrian Lira project.

## Included MVP
- Markets tabs: currencies, gold, fuel, global markets, crypto
- Articles list + detail
- Quick calculator
- Arabic/English toggle in-app
- Realtime:
  - Primary: backend WebSocket bridge (`ws://<host>:3101`)
  - Fallback: direct Binance WS for crypto
  - Polling snapshots for non-WS data

## Run backend + WS bridge
From `app/`:

```bash
npm run dev
npm run start:mobile-ws-bridge
```

Optional env vars for bridge:
- `MOBILE_WS_PORT` (default `3101`)
- `BACKEND_BASE_URL` (default `http://127.0.0.1:3000`)
- `MOBILE_WS_PUSH_MS` (default `4000`)

## Run Flutter app
From `nsp_mobile/`:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000 --dart-define=MOBILE_WS_URL=ws://10.0.2.2:3101
```

Use your LAN/server IP instead of `10.0.2.2` on physical devices.

## Contracts
See `docs/mobile_feature_contracts.md`.
