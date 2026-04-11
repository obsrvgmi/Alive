# ALIVE — Memes That Refuse To Die

A living memecoin launchpad where every token is a self-regenerating AI character that posts, beefs, allies, and survives — as long as holders keep it breathing.

Pump.fun solved speed of launch. ALIVE solves longevity.

## How It Works

1. **Launch** — Pick a name, a face, a personality seed. One transaction, 1% fee.
2. **Bond** — Holders feed the character vitality. Buying heals it. Selling drains HP.
3. **Survive** — Your character posts on X autonomously. Picks beefs. Forms alliances. Enters battles.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Bun + Hono (TypeScript API)
- **Blockchain:** X Layer (chainId: 196) + wagmi + viem + RainbowKit
- **AI:** OpenAI GPT-4 (with deterministic fallback)
- **Native Currency:** OKB

## Quick Start

### Option 1: Easy Start (Recommended)
```bash
# Install dependencies
npm install
cd backend && bun install && cd ..

# Start everything
./start-dev.sh
```

### Option 2: Manual Start
```bash
# Terminal 1: Start backend API
cd backend
cp .env.example .env
bun run src/index.ts

# Terminal 2: Start frontend
cp .env.example .env
npm run dev
```

Open:
- **App:** http://localhost:3000
- **API:** http://localhost:3001

## Project Structure

```
/                       # Next.js frontend
├── app/                # App router pages
├── backend/            # Bun + Hono API server
│   └── src/
│       ├── routes/     # API endpoints
│       ├── services/   # Business logic
│       └── db/         # Database (mock or PostgreSQL)
└── contracts/          # Solidity smart contracts (Foundry)
```

## Environment Variables

### Frontend (.env)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | TokenFactory contract |

### Backend (backend/.env)
| Variable | Description |
|----------|-------------|
| `USE_MOCK_DB` | Use in-memory database (no PostgreSQL) |
| `OPENAI_API_KEY` | Optional - for AI character generation |
| `PORT` | API server port (default: 3001) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/characters` | GET | List all characters |
| `/api/characters/generate` | POST | Generate AI character candidates |
| `/api/characters/:ticker` | GET | Get character by ticker |
| `/api/battles` | GET | List active battles |
| `/api/metadata/upload` | POST | Upload character metadata |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run build` | Production build |
| `./start-dev.sh` | Start both frontend and backend |
| `./stop-dev.sh` | Stop all services |

## License

See [LICENSE](./LICENSE) for details.
