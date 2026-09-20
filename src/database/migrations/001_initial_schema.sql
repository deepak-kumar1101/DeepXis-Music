-- DeepXis Music Bot - Initial Database Schema
-- Migration: 001_initial_schema.sql

CREATE TABLE IF NOT EXISTS guilds (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) UNIQUE NOT NULL,
    music_channel_id VARCHAR(32),
    dj_role_id VARCHAR(32),
    volume INTEGER DEFAULT 80 CHECK (volume >= 0 AND volume <= 100),
    default_loop_mode INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(32) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_volume INTEGER DEFAULT 80 CHECK (default_volume >= 0 AND default_volume <= 100),
    autoplay BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playback_history (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    track_title TEXT NOT NULL,
    artist TEXT,
    source VARCHAR(64),
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for analytics and fast retrieval
CREATE INDEX IF NOT EXISTS idx_playback_history_guild ON playback_history(guild_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_user ON playback_history(user_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_played_at ON playback_history(played_at DESC);
