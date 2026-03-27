# Liquid Edge Trading Journal

A full-stack web application for logging, reviewing, and analyzing trades across backtesting, demo, and live (real) accounts.

---

## What It Does

Liquid Edge Trading Journal lets traders:

- **Log trades** with market, category (backtest / demo / real), entry & exit prices, stop loss, take profit, and outcome (win / loss).
- **Work through a Sniper Checklist** before each trade — confirming key technical conditions (4H zone, equal highs/lows, 15-minute liquidity sweep, and target level).
- **Upload chart screenshots** alongside each trade entry for visual reference.
- **Write free-form journal notes** in the "Mental Vault" with automatic red-flag detection that highlights emotional language (e.g. *fear*, *revenge*, *FOMO*) and prompts a pause before saving.
- **Track performance** over time via a historical archive with win-rate tracking, monthly timeline navigation, daily / weekly views, and per-folder filtering.
- **Authenticate** with email and password via Supabase, keeping your journal private and cloud-linked.
- **Toggle light / dark themes** for comfortable use in any environment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · Flask · SQLite |
| Frontend | HTML · Vanilla JS · Tailwind CSS (CDN) |
| Icons | Lucide |
| Auth / Storage | Supabase |
| Fonts | Syne · Inter (Google Fonts) |

---

## Project Structure

```
liquid-edge-journal/
├── app.py            # Flask REST API (trades CRUD, file uploads)
├── index.html        # Single-page frontend shell
├── script.js         # All client-side logic and state management
├── style.css         # Custom styles (glassmorphism, toggles, animations)
├── requirements.txt  # Python dependencies (Flask)
├── trades.db         # SQLite database (created automatically on first run)
└── uploads/          # Uploaded chart screenshots (created automatically)
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
# Install Python dependencies
pip install -r requirements.txt
```

### Running the App

```bash
python app.py
```

The server starts at `http://127.0.0.1:5000`. Open that URL in your browser to use the journal.

The SQLite database (`trades.db`) and the `uploads/` directory are created automatically on first run.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/trades` | List all trades (newest first) |
| `POST` | `/api/trades` | Create a new trade entry |
| `DELETE` | `/api/trades/<id>` | Delete a trade (and its uploaded image) |
| `GET` | `/uploads/<filename>` | Serve an uploaded chart screenshot |

---

## Markets Supported

VIX 10 · VIX 10s · VIX 25 · VIX 50 · VIX 75 · VIX 100 · VIX 10 (1s) · VIX 25 (1s) · VIX 50 (1s) · VIX 75 (1s) · VIX 100 (1s)
