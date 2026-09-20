-- DeepXis Music Bot - Add Prefix and Follow Owner Settings
-- Migration: 002_prefix_and_follow.sql

ALTER TABLE guilds ADD COLUMN IF NOT EXISTS prefix VARCHAR(10) DEFAULT '!';
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS follow_owner BOOLEAN DEFAULT TRUE;
