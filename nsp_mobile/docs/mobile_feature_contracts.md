# NSP Mobile Feature and API Contracts

## MVP User Features
- Markets dashboard:
  - Currencies (buy/sell + delta)
  - Gold (ounce, 24K, optional 21/18/14K)
  - Fuel (USD primary + SYP reference)
  - Global markets (forex/commodities from `/api/forex`)
  - Crypto
- Articles:
  - Articles list
  - Article details by slug
- Advanced calculator:
  - Convert from SYP/currency/gold/fuel/crypto/forex
  - Compare output in selected targets

## Endpoints Used
- `GET /api/rates`
  - Main aggregate payload for currencies/gold/fuel + settings subset
- `GET /api/forex`
  - Forex rows + `realtime` metadata
- `GET /api/crypto`
  - Crypto rows + `realtime` metadata
- `GET /api/articles`
  - Published article cards
- `GET /api/articles/{slug}`
  - Article details
- `GET /api/settings`
  - Full settings including locale-ready name fields and realtime flags

## Realtime Strategy (MVP)
- Native WebSocket for crypto:
  - Connect to Binance trade streams (`<symbol>@trade`) in app
  - Map supported app codes to USDT symbols (BTCUSDT, ETHUSDT, etc.)
- Fallback:
  - Keep periodic HTTP refresh (`/api/crypto`) for unsupported symbols or WS downtime
- Other sections:
  - Polling from existing APIs (`/api/rates`, `/api/forex`) on interval

## Data Notes
- Locale:
  - Prefer `nameAr` for Arabic and `nameEn` otherwise
- Numeric formatting:
  - Keep API values as numeric primitives and format in UI
- Timestamps:
  - Parse ISO strings to local `DateTime`
