# DeepXis Music Bot

A production-quality, modular, scalable Discord music bot built with **Node.js**, **discord.js v14**, **discord-player**, **Spotify Web API**, and **PostgreSQL**.

Designed for high-fidelity audio playback, custom branded UI (with strict zero-Unicode-emoji design), multi-guild scalability, persistent database settings, and automated voice connection recovery.

---

## Architecture Overview

```text
deepxis-music/
├── src/
│   ├── index.js                      # Application bootstrap & healthcheck server
│   ├── bot.js                        # Discord Client initialization & command loader
│   ├── config/
│   │   ├── config.js                 # Central validated settings
│   │   ├── permissions.js            # DJ role & permission check helpers
│   │   └── assets.js                 # Centralized custom asset registry & embed parser
│   ├── database/
│   │   ├── connection.js             # PostgreSQL pg.Pool with graceful in-memory fallback
│   │   ├── migrate.js                # Schema migration runner
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql# Guilds, users, preferences, playback history
│   │   └── queries/                  # Parameterized SQL query modules
│   ├── services/
│   │   ├── spotifyService.js         # Spotify Web API client (tracks, albums, playlists)
│   │   ├── guildService.js           # Guild settings with in-memory caching layer
│   │   └── userService.js            # User preferences management
│   ├── player/
│   │   ├── player.js                 # Discord Player setup with @discord-player/extractor
│   │   ├── queue.js                  # Per-guild queue lifecycle manager
│   │   ├── resolver.js               # Multi-source resolver bridging Spotify & Discord Player
│   │   └── playerEvents.js           # Playback events (playerStart, error, emptyChannel)
│   ├── ui/
│   │   ├── emoji.js                  # Emoji and asset formatter (Zero Unicode emojis)
│   │   ├── embeds.js                 # Branded embed builders (Player dashboard, Queue, Errors)
│   │   ├── buttons.js                # ActionRow buttons (Row 1 controls & Row 2 controls)
│   │   ├── menus.js                  # Interactive select menus
│   │   └── playerPanel.js            # Combined player panel generator
│   ├── commands/
│   │   ├── music/                    # Play, pause, skip, queue, volume, loop, shuffle, etc.
│   │   ├── admin/                    # /setdj, /setchannel, /setvolume
│   │   └── utility/                  # /ping, /help, /invite, /support, /status
│   ├── events/                       # ready, interactionCreate, voiceStateUpdate
│   └── utils/                        # logger, formatTime, progressBar, validators, errors
├── assets/                           # Custom images, gifs, stickers
├── .env.example                      # Configuration template
├── package.json
└── README.md
```

---

## Features

- **Multi-Source Audio Playback**: Plays tracks from search queries, web streams, and Spotify (tracks, albums, playlists).
- **Spotify Web API Catalog Bridge**: Resolves rich metadata, album artwork, track names, and artist information from Spotify's official Web API.
- **Strict Custom Visual Asset System**:
  - Zero default/Unicode emojis anywhere in the UI.
  - Automatically parses HTML embed codes (`<a href="..."><img src="..." /></a>`) and Discord custom emoji tags (`<:name:id>` / `<a:name:id>`).
  - Gracefully falls back to clean, branded text buttons (`[Play]`, `[Pause]`, `[Skip]`) until custom assets are registered.
- **Interactive Player Dashboard**: Real-time control buttons for Previous, Pause/Resume, Skip, Shuffle, Loop, Queue, and Stop.
- **PostgreSQL Persistence**:
  - Stores per-guild DJ roles, designated music channels, and default volumes.
  - Stores user playback preferences.
  - Records full playback history and analytics per guild.
- **DJ Permission Engine**: Allows server administrators to designate DJ roles with automatic admin overrides.
- **Health & Monitoring**: Lightweight HTTP endpoint (`/` and `/health`) for uptime monitoring and hosting platforms (Railway, Render, Fly.io, Heroku, VPS).

---

## Requirements

- **Node.js**: `v18.0.0` or newer (Recommended: Node.js 20 LTS or Node.js 22+)
- **Discord Bot Token**: With `Guilds`, `GuildVoiceStates`, and `GuildMessages` intents enabled.
- **Spotify Developer Credentials**: Client ID and Client Secret from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
- **PostgreSQL Database**: Local or hosted (Supabase, Neon, Railway, AWS RDS, etc.).

---

## Installation & Setup

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd "DeepXis Music Bot"
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
# Discord Application Credentials
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# Spotify Web API Credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# PostgreSQL Connection String
DATABASE_URL=postgresql://user:password@localhost:5432/deepxis_music

# Server & UI Defaults
PORT=3000
DEFAULT_VOLUME=80
EMBED_COLOR=#7C3AED
```

### 3. Run Database Migrations

Apply the database schema to your PostgreSQL database:

```bash
npm run migrate
```

*(If PostgreSQL is not yet configured, the bot will start in in-memory fallback mode and output a notice).*

### 4. Start the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

---

## Custom Asset Configuration Guide

DeepXis Music strictly adheres to a **Zero-Unicode-Emoji** design. To replace text labels with custom Discord emojis or animated GIFs:

### Method 1: Environment Variables (`.env`)
You can provide either Discord emoji syntax or extracted image URLs in `.env`:
```env
ASSET_PLAY=<:custom_play:123456789012345678>
ASSET_PAUSE=<:custom_pause:123456789012345678>
ASSET_NEXT=<:custom_skip:123456789012345678>
ASSET_LOADING_GIF=https://cdn3.emoji.gg/emojis/45625-vinylrecord.gif
```

### Method 2: HTML Embed Code Support
The built-in parser in `src/config/assets.js` can parse HTML embed codes directly:
```html
<a href="https://emoji.gg/emoji/45625-vinylrecord">
    <img src="https://cdn3.emoji.gg/emojis/45625-vinylrecord.gif" width="64px" height="64px" alt="VinylRecord">
</a>
```
The parser extracts `https://cdn3.emoji.gg/emojis/45625-vinylrecord.gif` automatically.

---

## Slash Commands Reference

### Playback Commands
| Command | Description |
| :--- | :--- |
| `/play <query>` | Play a song, album, playlist, or Spotify URL |
| `/pause` | Pause current playback |
| `/resume` | Resume paused playback |
| `/skip` | Skip the current track |
| `/previous` | Replay the previous song from history |
| `/stop` | Stop playback and clear the queue |
| `/disconnect` | Disconnect the bot from voice |

### Queue Commands
| Command | Description |
| :--- | :--- |
| `/queue [page]` | View current server queue with navigation buttons |
| `/clear` | Remove all upcoming tracks from queue |
| `/remove <position>` | Remove a specific track by its position number |
| `/move <from> <to>` | Reorder a track to a new queue position |

### Controls & Info
| Command | Description |
| :--- | :--- |
| `/volume [0-100]` | Set or inspect playback volume |
| `/seek <time>` | Seek to a specific timestamp (e.g. `1:30`, `90s`) |
| `/loop <off\|track\|queue\|autoplay>` | Set repeat mode |
| `/shuffle` | Randomize the upcoming queue |
| `/nowplaying` | Display the interactive player dashboard |
| `/lyrics [query]` | Fetch synchronized song lyrics |

### Administration
| Command | Description |
| :--- | :--- |
| `/setdj [role]` | Configure or clear the server's DJ role |
| `/setchannel [channel]` | Restrict bot commands to a designated text channel |
| `/setvolume <1-100>` | Set server default starting volume |

### Utility
| Command | Description |
| :--- | :--- |
| `/ping` | Check roundtrip latency and Discord WebSocket ping |
| `/status` | View system health, memory usage, and connection states |
| `/invite` | Get bot authorization invite link |
| `/help` | Interactive command guide |
| `/support` | Community and documentation links |

---

## Healthcheck HTTP Endpoint

When deployed on cloud hosting (Railway, Fly.io, Render, VPS), DeepXis Music exposes:

- `GET /` — Full JSON telemetry (uptime, connected guilds, active players, database state, Spotify status).
- `GET /health` — Simple `200 OK` `{ "status": "ok" }`.

---

## License

MIT License. Designed for DeepXis.
"# DeepXis-Music" 
