<div align="center">
  <h1>🧭 Market Compass</h1>
  <p><strong>A full-stack quantitative trading platform with live charts, technical indicators, strategy backtesting, and an academic-grade implementation of the Overnight Return Temporal Market Anomaly.</strong></p>
  <p>
    <img src="https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/React-19.2-61dafb?logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TanStack_Start-1.x-ff4154?logo=reactrouter" alt="TanStack Start" />
    <img src="https://img.shields.io/badge/Vite-8.x-646cff?logo=vite" alt="Vite" />
    <img src="https://img.shields.io/badge/Supabase-Auth-3ecf8e?logo=supabase" alt="Supabase" />
  </p>
</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Pages & Routes](#-pages--routes)
- [API Endpoints](#-api-endpoints)
- [Overnight Strategy Backtest](#-overnight-strategy-backtest)
- [Stock Universe](#-stock-universe)
- [Trading Dashboard](#-trading-dashboard)
- [Deployment](#-deployment)
- [Paper Reference](#-paper-reference)
- [License](#-license)

---

## 🔭 Overview

Market Compass is a professional-grade quantitative trading platform built with modern web technologies. It combines **live market data visualization**, **technical analysis**, **no-code strategy building**, and a research-backed **overnight return anomaly backtester** — all in a sleek dark-mode interface.

The platform connects to **Binance** for live cryptocurrency data and **Yahoo Finance** for global stock, ETF, and commodity data, covering 200+ instruments across US, European, and Asian markets.

---

## ✨ Features

### 1. 📊 Live Trading Dashboard
- **Real-time candlestick charts** powered by [lightweight-charts](https://github.com/nicehash/lightweight-charts) (TradingView's charting library)
- **Multiple chart types**: Candlestick, Line, Area, Baseline
- **Interval selection**: 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M
- **Symbol search** with auto-complete across all Binance pairs
- **Customizable watchlist** with live price updates

### 2. 📈 Technical Indicators
- **SMA** — Simple Moving Average
- **EMA** — Exponential Moving Average
- **WMA** — Weighted Moving Average
- **VWAP** — Volume Weighted Average Price
- **Bollinger Bands** — with configurable period and multiplier
- **RSI** — Relative Strength Index
- **MACD** — Moving Average Convergence Divergence

Each indicator has configurable parameters (period, color, visibility) with real-time updates.

### 3. 🛠️ No-Code Strategy Builder
- Build trading strategies visually using condition blocks (AND/OR logic)
- Rule conditions based on: price crossovers, indicator levels, volume thresholds
- **Historical backtesting** with configurable:
  - Initial capital
  - Position sizing (% of equity)
  - Stop-loss and take-profit
  - Fee model (percentage or flat)
- Results include: equity curve, trade list, win rate, Sharpe ratio, max drawdown
- **Export** backtest reports

### 4. 🌙 Overnight Return Anomaly Backtester
A research-grade implementation of the strategy described in:
> *"The Overnight Return Temporal Market Anomaly"* — Basdekidou (2017), International Journal of Economics and Finance

**The ORA Rule:**
```
Buy at the Close of the current daily session.
Hold position overnight.
Sell at the Open of the next day's session.
```

#### Features:
- Tests **200+ stocks, ETFs, leveraged ETNs, and commodities** across 4 regions
- Side-by-side comparison of **Overnight** vs **Daytime** vs **Buy & Hold** strategies
- **Configurable parameters**: initial capital, commission model (per-share or bps), compound vs flat capital mode
- **20+ metrics per stock** including: Sharpe, Sortino, Calmar, Profit Factor, Max Drawdown, Consecutive Win/Loss streaks
- **Portfolio-level analytics**: aggregate PnL, portfolio Sharpe, portfolio max drawdown, region breakdown
- **Interactive 3-line equity curves** (Overnight/Daytime/Buy&Hold) for both portfolio aggregate and individual stocks
- **Paper-style results tables** mirroring Tables 1-4 from the original research paper
- **21-column sortable results table** with sticky totals footer

### 5. 🔐 Authentication
- Supabase-powered authentication (email/password, OAuth)
- Protected routes for authenticated features (alerts, schedules, paper trading)

### 6. 📱 Additional Features
- **Price Alerts** — configurable alerts for price levels
- **Trading Schedules** — scheduled order execution
- **Paper Trading** — simulated trading with virtual capital
- **Strategy Library** — save and manage custom strategies

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [TanStack Start](https://tanstack.com/start) (React meta-framework with SSR & API routes) |
| **UI Library** | React 19.2 |
| **Language** | TypeScript 5.8 |
| **Bundler** | Vite 8 |
| **Styling** | Tailwind CSS 4 |
| **Charts** | [Lightweight Charts](https://github.com/nicehash/lightweight-charts) 5.2 (TradingView) |
| **UI Components** | Radix UI primitives + shadcn/ui patterns |
| **Authentication** | [Supabase](https://supabase.com/) Auth |
| **Market Data** | Binance API (crypto), [Yahoo Finance](https://github.com/nicehash/yahoo-finance2) (stocks/ETFs) |
| **Server** | Nitro (via TanStack Start) |

---

## 📁 Project Structure

```
Market Compass/
├── public/                          # Static assets
├── src/
│   ├── components/
│   │   ├── trading/
│   │   │   ├── Chart.tsx            # Main candlestick chart component
│   │   │   ├── Header.tsx           # Top navigation bar with symbol/interval/chart type
│   │   │   ├── IndicatorsPanel.tsx   # Indicator configuration sidebar
│   │   │   ├── StrategyPanel.tsx     # No-code strategy builder modal
│   │   │   ├── SymbolSearch.tsx      # Autocomplete symbol search
│   │   │   ├── Watchlist.tsx         # Left sidebar watchlist
│   │   │   └── types.ts             # Indicator type definitions
│   │   └── ui/                      # shadcn/ui components (button, dialog, etc.)
│   │
│   ├── integrations/
│   │   └── supabase/                # Supabase client & auth middleware
│   │
│   ├── lib/
│   │   ├── overnight-backtest.ts    # ⭐ Overnight strategy engine (metrics, aggregation)
│   │   ├── stock-universe.ts        # 200+ stock/ETF universe definitions
│   │   ├── binance.ts               # Binance API client
│   │   ├── indicators.ts            # Technical indicator calculations (SMA, EMA, RSI, etc.)
│   │   ├── strategy.ts              # Strategy backtesting engine
│   │   ├── rule-eval.ts             # Strategy rule evaluator
│   │   ├── export-report.ts         # Backtest report export
│   │   ├── alert-shared.ts          # Alert type definitions
│   │   ├── alerts.functions.ts      # Alert server functions
│   │   ├── paper.functions.ts       # Paper trading functions
│   │   ├── schedules.functions.ts   # Schedule server functions
│   │   └── strategies.functions.ts  # Strategy CRUD functions
│   │
│   ├── routes/
│   │   ├── index.tsx                # Main trading dashboard (/)
│   │   ├── overnight-backtest.tsx   # ⭐ Overnight strategy results UI
│   │   ├── auth.tsx                 # Login/signup page
│   │   ├── _authenticated/
│   │   │   ├── route.tsx            # Auth guard layout
│   │   │   ├── alerts.tsx           # Price alerts management
│   │   │   ├── schedules.tsx        # Trading schedules
│   │   │   ├── strategies.tsx       # Saved strategies
│   │   │   └── paper.tsx            # Paper trading dashboard
│   │   └── api/public/market/
│   │       ├── klines.ts            # Proxy for Binance kline data
│   │       ├── quote.ts             # Yahoo Finance quote endpoint
│   │       ├── search.ts            # Symbol search endpoint
│   │       ├── overnight-backtest.ts       # ⭐ Batch overnight backtest API
│   │       └── overnight-backtest-single.ts # ⭐ Single stock backtest API
│   │
│   ├── router.tsx                   # TanStack Router configuration
│   ├── server.ts                    # Server entry point
│   ├── start.ts                     # App start configuration
│   └── styles.css                   # Global styles & design tokens
│
├── supabase/                        # Supabase migration files
├── package.json
├── vite.config.ts
├── tsconfig.json
└── The_Overnight_Return_Temporal_Market_Anomaly.pdf  # Reference paper
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** or **bun**
- A [Supabase](https://supabase.com/) project (for auth features)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/market-compass.git
cd market-compass

# Install dependencies
npm install

# Set up environment variables (see below)
cp .env.example .env

# Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 8080 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Note:** Binance API and Yahoo Finance are accessed without API keys (public endpoints).

---

## 🗺️ Pages & Routes

| Route | Auth Required | Description |
|-------|:---:|-------------|
| `/` | ❌ | Main trading dashboard with live charts, watchlist, and indicators |
| `/overnight-backtest` | ❌ | Overnight return strategy backtester |
| `/auth` | ❌ | Login / Sign up page |
| `/alerts` | ✅ | Price alert management |
| `/schedules` | ✅ | Trading schedule management |
| `/strategies` | ✅ | Saved strategy library |
| `/paper` | ✅ | Paper (simulated) trading |

---

## 🔌 API Endpoints

All API endpoints are server-side rendered through TanStack Start's server handlers.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/public/market/klines` | Fetch candlestick data from Binance |
| `GET` | `/api/public/market/quote` | Get real-time quote from Yahoo Finance |
| `GET` | `/api/public/market/search` | Search symbols across Yahoo Finance |
| `POST` | `/api/public/market/overnight-backtest` | Run batch overnight backtest across 200+ stocks |
| `GET` | `/api/public/market/overnight-backtest-single` | Run overnight backtest for a single stock (with full equity curves) |

### Overnight Backtest API Parameters

**POST** `/api/public/market/overnight-backtest`

```json
{
  "initialCapital": 100000,
  "feeModel": "per_share",
  "feeValue": 0.01,
  "compoundMode": true
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `initialCapital` | number | 100000 | Starting capital per instrument ($) |
| `feeModel` | `"per_share"` \| `"bps"` | `"per_share"` | Commission model |
| `feeValue` | number | 0.01 | Commission value ($0.01/share or basis points) |
| `compoundMode` | boolean | true | `true` = reinvest equity, `false` = flat capital per trade (paper methodology) |

---

## 🌙 Overnight Strategy Backtest

### Strategy Definition (ORA Rule)

The Overnight Return Anomaly (ORA) rule, as defined by Basdekidou (2017):

1. **Buy** at the **Close** of the current daily session
2. **Hold** position overnight
3. **Sell** at the **Open** of the next day's session

A **Daytime counterpart** is simultaneously computed for comparison:
1. **Buy** at the **Open**
2. **Sell** at the **Close** of the same day

### Metrics Computed

For **each stock** and **each strategy** (Overnight & Daytime):

| Category | Metrics |
|----------|---------|
| **Return** | Total Return %, Annualized Return %, Annual Std Dev (σ) |
| **Risk-Adjusted** | Sharpe Ratio, Sortino Ratio, Calmar Ratio |
| **Trade Stats** | Total Trades, Wins, Losses, Win Rate %, Consecutive Wins/Losses |
| **P&L** | Gross Profit, Gross Loss, Net Profit (after commission), Profit Factor |
| **Risk** | Max Drawdown %, Best Trade %, Worst Trade %, Avg Win %, Avg Loss % |
| **Benchmark** | Buy & Hold Return % |

### Portfolio-Level Aggregates

| Metric | Description |
|--------|-------------|
| Portfolio Sharpe | Computed from aggregate equity curve daily returns |
| Portfolio Max Drawdown | Peak-to-trough from aggregate equity curve |
| Portfolio Annualized Return | From aggregate curve |
| Total PnL / Gross Profit / Loss | Sum across all stocks |
| Region Breakdown | Profitability rates by geographic region |

### Dashboard Panels

1. **Annual Returns Table** — Mirrors Tables 1 & 2 from the paper (Overnight vs Daytime vs Buy&Hold)
2. **Trade Performance Table** — Mirrors Tables 3 & 4 (Total Trades, Winners, Losers, Gross/Net Profit)
3. **Portfolio Overview Cards** — Best/worst stocks, profitable counts, failed fetches
4. **Region Breakdown** — Per-region profitability analysis
5. **Aggregate 3-Line Equity Chart** — Green (Overnight), Red (Daytime), Indigo (Buy & Hold)
6. **Individual Stock Chart** — Click any row to see its equity curve + 12 mini-metrics
7. **21-Column Sortable Table** — All metrics with sticky header, footer, and totals row

---

## 🌍 Stock Universe

The backtester covers **200+ instruments** across 5 categories:

| Category | Count | Examples |
|----------|:-----:|---------|
| **ETF & Leveraged** | 17 | SPY, QQQ, TQQQ, SQQQ, UPRO, UGAZ, SOXL |
| **US Stocks** | ~80 | AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, JPM |
| **European Stocks** | ~40 | NESN.SW, SAP.DE, ASML.AS, AZN.L, MC.PA |
| **Asian Stocks** | ~40 | 7203.T, 9984.T, 005930.KS, 0700.HK, RELIANCE.NS |
| **Other (Emerging)** | ~20 | VALE, PBR, BABA, ITUB, PETR4.SA |

All data is sourced from **Yahoo Finance** via the `yahoo-finance2` package with a 2-year lookback period.

---

## 📊 Trading Dashboard

The main dashboard (`/`) is a professional trading workspace:

```
┌──────────────────────────────────────────────────────┐
│  Header: Symbol Search | Interval | Chart Type       │
├──────────┬─────────────────────────┬─────────────────┤
│          │                         │                 │
│ Watchlist│   Candlestick Chart     │  Indicators     │
│          │   + Overlays            │  Panel          │
│  (left)  │   (center)              │  (right)        │
│          │                         │                 │
├──────────┴─────────────────────────┴─────────────────┤
│  Strategy Builder (modal overlay)                     │
└──────────────────────────────────────────────────────┘
```

- **Left Sidebar**: Watchlist with live prices from Binance
- **Center**: Full-width candlestick chart with indicator overlays
- **Right Sidebar**: Indicator configuration (add/remove/configure indicators)
- **Modal**: No-code strategy builder with backtest engine

---

## 🚢 Deployment

### Vercel (Recommended)

Since this app uses TanStack Start with server-side API routes, **Vercel** is the recommended deployment platform:

```bash
npx vercel --prod
```

Vercel will auto-detect the framework and configure serverless functions for the API routes.

### Other Platforms

Any platform that supports **Node.js server rendering** will work:
- **Render**
- **Railway**
- **AWS Lambda** (via adapter)
- **Docker**

---

## 📄 Paper Reference

The overnight strategy implementation is based on:

> **Basdekidou, V. A.** (2017). *The Overnight Return Temporal Market Anomaly*. International Journal of Economics and Finance, 9(3), 1-10.  
> DOI: [10.5539/ijef.v9n3p1](https://doi.org/10.5539/ijef.v9n3p1)

**Key findings from the paper:**
- Nearly 100% of abnormal returns on momentum strategies occur overnight
- The average intraday component of momentum profit is statistically insignificant
- Overnight returns are bigger among large-cap stocks and 3x ETFs/ETNs
- An overnight return strategy is *less risky* than a daytime strategy (lower annual σ)
- UGAZ 3x ETN: Overnight Sharpe 0.93 vs Daytime Sharpe -0.30

---

## 📜 License

This project is for educational and research purposes. Market data is sourced from public APIs (Binance, Yahoo Finance). No financial advice is provided.

---

<div align="center">
  <sub>Built with ❤️ using React, TanStack Start, and lightweight-charts</sub>
</div>
