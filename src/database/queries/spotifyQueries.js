/**
 * DeepXis Music Bot - Spotify Account Queries
 * Manages storage and retrieval of linked Spotify OAuth2 accounts with in-memory fallback.
 */

const db = require('../connection');
const logger = require('../../utils/logger');

// In-memory fallback cache for when PostgreSQL is unavailable
const memoryStore = new Map();

const spotifyQueries = {
  /**
   * Fetch connected Spotify account by Discord ID
   * @param {string} discordId 
   * @returns {Promise<object|null>}
   */
  async getAccount(discordId) {
    if (!discordId) return null;

    try {
      if (db.isAvailable()) {
        const text = 'SELECT * FROM spotify_accounts WHERE discord_id = $1 LIMIT 1;';
        const res = await db.query(text, [discordId]);
        if (res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          // Sync with memory store
          memoryStore.set(discordId, row);
          return row;
        }
      }
    } catch (err) {
      logger.warn('SpotifyQueries', `Failed to query DB for discordId ${discordId}, falling back to memory store`, err.message);
    }

    // In-memory fallback
    return memoryStore.get(discordId) || null;
  },

  /**
   * Upsert a user's Spotify account credentials
   * @param {object} accountData 
   * @returns {Promise<object>}
   */
  async saveAccount({ discordId, spotifyId, displayName, accessToken, refreshToken, expiresAt, scope }) {
    const record = {
      discord_id: discordId,
      spotify_id: spotifyId || null,
      display_name: displayName || null,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(expiresAt),
      scope: scope || null,
      updated_at: new Date()
    };

    // Save in memory cache immediately
    memoryStore.set(discordId, record);

    try {
      if (db.isAvailable()) {
        const text = `
          INSERT INTO spotify_accounts (discord_id, spotify_id, display_name, access_token, refresh_token, expires_at, scope, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          ON CONFLICT (discord_id) DO UPDATE
          SET spotify_id = EXCLUDED.spotify_id,
              display_name = EXCLUDED.display_name,
              access_token = EXCLUDED.access_token,
              refresh_token = EXCLUDED.refresh_token,
              expires_at = EXCLUDED.expires_at,
              scope = EXCLUDED.scope,
              updated_at = CURRENT_TIMESTAMP
          RETURNING *;
        `;
        const res = await db.query(text, [
          discordId,
          spotifyId || null,
          displayName || null,
          accessToken,
          refreshToken,
          new Date(expiresAt),
          scope || null
        ]);
        if (res.rows && res.rows.length > 0) {
          memoryStore.set(discordId, res.rows[0]);
          return res.rows[0];
        }
      }
    } catch (err) {
      logger.warn('SpotifyQueries', `Failed to persist account to DB for discordId ${discordId}`, err.message);
    }

    return record;
  },

  /**
   * Update access token after refresh
   * @param {string} discordId 
   * @param {string} accessToken 
   * @param {Date|number} expiresAt 
   */
  async updateTokens(discordId, accessToken, expiresAt) {
    const cached = memoryStore.get(discordId);
    if (cached) {
      cached.access_token = accessToken;
      cached.expires_at = new Date(expiresAt);
      cached.updated_at = new Date();
    }

    try {
      if (db.isAvailable()) {
        const text = `
          UPDATE spotify_accounts
          SET access_token = $2,
              expires_at = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE discord_id = $1
          RETURNING *;
        `;
        const res = await db.query(text, [discordId, accessToken, new Date(expiresAt)]);
        if (res.rows && res.rows.length > 0) {
          memoryStore.set(discordId, res.rows[0]);
          return res.rows[0];
        }
      }
    } catch (err) {
      logger.warn('SpotifyQueries', `Failed to update refreshed tokens in DB for discordId ${discordId}`, err.message);
    }

    return cached || null;
  },

  /**
   * Disconnect and remove Spotify account
   * @param {string} discordId 
   */
  async deleteAccount(discordId) {
    memoryStore.delete(discordId);

    try {
      if (db.isAvailable()) {
        const text = 'DELETE FROM spotify_accounts WHERE discord_id = $1;';
        await db.query(text, [discordId]);
      }
    } catch (err) {
      logger.warn('SpotifyQueries', `Failed to delete account from DB for discordId ${discordId}`, err.message);
    }

    return true;
  }
};

module.exports = spotifyQueries;
