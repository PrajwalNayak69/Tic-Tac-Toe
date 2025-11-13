# Multiplayer Tic-Tac-Toe

Real-time multiplayer Tic-Tac-Toe game with Next.js and Nakama.

## Features

- Real-time multiplayer gameplay
- Automatic matchmaking
- Pre-game lobby with nickname system
- Persistent device-based sessions
- Modern UI with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Nakama Game Server (Lua)
- **Database**: PostgreSQL
- **Deployment**: Render

## Setup Instructions

### Local Development

1. **Clone and install dependencies**
```bash
git clone <repo-url>
cd client
npm install
```

2. **Create `.env` file**
```env
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require
```

3. **Start Nakama with Docker**
```bash
docker build -t nakama-tictactoe .
docker run -p 7350:7350 --env-file .env nakama-tictactoe
```

4. **Configure client for local mode**
In `lib/useNakama.ts`:
```typescript
const isProduction = false;
```

5. **Start Next.js**
```bash
npm run dev
```

Visit `http://localhost:3000`

## Architecture

```
Frontend (Next.js) 
    ↓ WebSocket
Nakama Server (Port 7350)
    ↓
PostgreSQL Database
```

### Key Design Decisions

1. **Device Authentication** - No passwords, uses localStorage device ID
2. **Pre-game Lobby** - Players confirm nicknames before starting
3. **Authoritative Server** - All game logic runs server-side (Lua)
4. **Real-time Sync** - WebSocket broadcasts game state to all players

## Deployment

### Deploy Nakama to Render

1. Create PostgreSQL database on Render
2. Create Web Service (Docker)
3. Set environment variables:
```
DATABASE_URL=<your-postgres-url>
PORT=7350
```
4. Set Health Check Path to `/`
5. Deploy

### Deploy Frontend to Vercel

1. Update `lib/useNakama.ts`:
```typescript
const isProduction = true;
const NAKAMA_HOST = "your-app.onrender.com";
const NAKAMA_PORT = "443";
const USE_SSL = true;
```

2. Deploy:
```bash
vercel
```

## Server Configuration

### Nakama Config (`local.yml`)

```yaml
socket:
  server_key: "defaultkey"
  port: 7350
  address: "0.0.0.0"

server:
  port: 7350
  cors:
    allowed_origins: ["*"]

session:
  token_expiry_sec: 7200
```

### Game Op Codes

- `OP_CODE_MOVE = 1` - Player makes a move
- `OP_CODE_STATE = 2` - Server broadcasts state
- `OP_CODE_READY = 3` - Player ready in lobby

## Testing Multiplayer

### Method 1: Two Browser Windows
1. Open app in Chrome
2. Open app in Firefox/Incognito
3. Enter nicknames
4. Click "Find Match" in both
5. Both ready up and play

### Method 2: Two Devices
1. Find local IP: `ipconfig` or `ifconfig`
2. Access `http://YOUR_IP:3000` from two devices
3. Test matchmaking

### Production Testing
- Open app in normal + incognito mode
- Or share URL with another person

## Common Issues

**"Request timeout"**
- Check Nakama is running: `docker ps`
- Verify NAKAMA_HOST has no `http://` or `https://`

**"CORS error"**
- Check `cors` settings in `local.yml`
- Verify allowed_origins includes your domain

**Players not matching**
- Ensure both connected to same server
- Check both searching at same time

## Project Structure

```
├── client/
│   ├── app/
│   │   └── game/
│   │       └── page.tsx          # Main game component
│   └── lib/
│       └── useNakama.ts          # Nakama connection hook
├── modules/
│   ├── init.lua                   # Runtime initialization
│   └── tic_tac_toe.lua           # Match handler logic
├── Dockerfile
├── docker-compose.yml
└── local.yml                      # Nakama config
```

## License

MIT
