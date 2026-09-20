-- DeepXis Music Bot - Spotify OAuth2 User Accounts
-- Migration: 003_spotify_accounts.sql

CREATE TABLE IF NOT EXISTS spotify_accounts (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(32) UNIQUE NOT NULL,
    spotify_id VARCHAR(64),
    display_name VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spotify_accounts_discord ON spotify_accounts(discord_id);
