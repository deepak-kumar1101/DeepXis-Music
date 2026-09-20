-- DeepXis Music Bot - Music Settings Migration
-- Migration: 004_music_settings.sql

ALTER TABLE guilds ADD COLUMN IF NOT EXISTS default_source VARCHAR(32) DEFAULT 'youtube';
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS max_queue INTEGER DEFAULT 500;
