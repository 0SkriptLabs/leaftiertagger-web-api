# LeafTiers Web API

Express.js server for the LeafTiers ranking system with a dark green leaf-themed design.

## Features

- Player tier management with multiple gamemodes
- Real-time leaderboard with filtering
- Admin panel for managing player tiers
- Animated leaf background with 20 falling leaves
- Custom leaf cursor
- Dark green theme matching the LeafTiers brand

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. The server will run on port 3000 (or PORT environment variable)

## API Endpoints

- `GET /api/tiers` - Returns tier data for Minecraft mod
- `GET /api/tiers/full` - Returns full tier data for web interface
- `POST /api/tiers` - Add/update player tier (requires admin password)
- `DELETE /api/tiers/:username` - Remove player tier (requires admin password)
- `POST /api/auth` - Admin authentication

## Images

The following gamemode icons are needed in `public/images/`:
- sword.png
- axe.png
- mace.png
- vanilla.png
- uhc.png
- pot.png
- nethop.png
- smp.png

## Environment Variables

- `PORT` - Server port (default: 3000)
- `ADMIN_PASSWORD` - Admin password for API authentication
- `DATA_FILE` - Path to tiers.json file