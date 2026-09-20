/**
 * DeepXis Music Bot - SQLite (WAL) & In-Memory TTL Cache Engine
 * Caches search queries (30 min), track metadata (24 hr), and Spotify-to-source mappings (30 days).
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let sqliteDb = null;
let useSqlite = false;

// In-memory fallback structures
const memorySearchCache = new Map();
const memoryMetadataCache = new Map();
const memorySpotifyMapping = new Map();

function initCache() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'music_cache.db');
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA synchronous = NORMAL;');

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS search_cache (
        cache_key TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        results_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_search_expires ON search_cache(expires_at);

      CREATE TABLE IF NOT EXISTS metadata_cache (
        cache_key TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_metadata_expires ON metadata_cache(expires_at);

      CREATE TABLE IF NOT EXISTS spotify_mapping (
        spotify_id TEXT PRIMARY KEY,
        matched_source TEXT NOT NULL,
        matched_url TEXT NOT NULL,
        score REAL NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mapping_expires ON spotify_mapping(expires_at);
    `);

    useSqlite = true;
    logger.info('Cache', `Initialized SQLite cache in WAL mode at ${dbPath}`);
  } catch (err) {
    useSqlite = false;
    logger.info('Cache', `Operating with in-memory TTL caching engine (node:sqlite skipped: ${err.message})`);
  }
}

// Initialize on module load
initCache();

const cache = {
  isUsingSqlite() {
    return useSqlite;
  },

  // 1. Search Results Cache (30 min TTL)
  getSearch(query, provider) {
    const key = `${provider}:${query.toLowerCase().trim()}`;
    const now = Date.now();

    if (useSqlite && sqliteDb) {
      try {
        const stmt = sqliteDb.prepare('SELECT results_json, expires_at FROM search_cache WHERE cache_key = ?;');
        const row = stmt.get(key);
        if (row && row.expires_at > now) {
          return JSON.parse(row.results_json);
        }
      } catch {}
    }

    const item = memorySearchCache.get(key);
    if (item && item.expiresAt > now) {
      return item.results;
    }
    return null;
  },

  setSearch(query, provider, results, ttlSeconds = 1800) {
    const key = `${provider}:${query.toLowerCase().trim()}`;
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    const json = JSON.stringify(results);

    if (useSqlite && sqliteDb) {
      try {
        const stmt = sqliteDb.prepare(`
          INSERT INTO search_cache (cache_key, provider, results_json, expires_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET results_json = excluded.results_json, expires_at = excluded.expires_at;
        `);
        stmt.run(key, provider, json, expiresAt);
      } catch {}
    }

    memorySearchCache.set(key, { results, expiresAt });
  },

  // 2. Metadata Cache (24 hr TTL)
  getMetadata(id, provider) {
    const key = `${provider}:${id}`;
    const now = Date.now();

    if (useSqlite && sqliteDb) {
      try {
        const stmt = sqliteDb.prepare('SELECT metadata_json, expires_at FROM metadata_cache WHERE cache_key = ?;');
        const row = stmt.get(key);
        if (row && row.expires_at > now) {
          return JSON.parse(row.metadata_json);
        }
      } catch {}
    }

    const item = memoryMetadataCache.get(key);
    if (item && item.expiresAt > now) {
      return item.metadata;
    }
    return null;
  },

  setMetadata(id, provider, metadata, ttlSeconds = 86400) {
    const key = `${provider}:${id}`;
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    const json = JSON.stringify(metadata);

    if (useSqlite && sqliteDb) {
      try {
        const stmt = sqliteDb.prepare(`
          INSERT INTO metadata_cache (cache_key, provider, metadata_json, expires_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET metadata_json = excluded.metadata_json, expires_at = excluded.expires_at;
        `);
        stmt.run(key, provider, json, expiresAt);
      } catch {}
    }

    memoryMetadataCache.set(key, { metadata, expiresAt });
  },

  // 3. Spotify Track Mapping Cache (30 days TTL)
  getSpotifyMapping(spotifyId) {
    const now = Date.now();

    if (useSqlite && sqliteDb) {
      try {
        const stmt = sqliteDb.prepare('SELECT matched_source, matched_url, score, expires_at FROM spotify_mapping WHERE spotify_id = ?;');
        const row = stmt.get(spotifyId);
        if (row && row.expires_at > now) {
          return {
            matchedSource: row.matched_source,
            matchedUrl: row.matched_url,
            score: row.score
          };
        }
      } catch {}
    }

    const item = memorySpotifyMapping.get(spotifyId);
    if (item && item.expiresAt > now) {
      return item;
    }
    return null;
  },

  setSpotifyMapping(spotifyId, matchedSource, matchedUrl, score, ttlSeconds = 30 * 86400) {
    const expiresAt = Date.now() + (ttlSeconds * 1000);

    if (useSqlite && sqliteDb) {
      try {
        const stmt = sqliteDb.prepare(`
          INSERT INTO spotify_mapping (spotify_id, matched_source, matched_url, score, expires_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(spotify_id) DO UPDATE SET matched_source = excluded.matched_source, matched_url = excluded.matched_url, score = excluded.score, expires_at = excluded.expires_at;
        `);
        stmt.run(spotifyId, matchedSource, matchedUrl, score, expiresAt);
      } catch {}
    }

    memorySpotifyMapping.set(spotifyId, { matchedSource, matchedUrl, score, expiresAt });
  },

  invalidateMapping(spotifyId) {
    if (useSqlite && sqliteDb) {
      try {
        const stmt = sqliteDb.prepare('DELETE FROM spotify_mapping WHERE spotify_id = ?;');
        stmt.run(spotifyId);
      } catch {}
    }
    memorySpotifyMapping.delete(spotifyId);
  }
};

module.exports = cache;
