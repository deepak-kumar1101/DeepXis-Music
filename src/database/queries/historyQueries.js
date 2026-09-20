/**
 * DeepXis Music Bot - Playback History Database Queries
 */

const db = require('../connection');
const logger = require('../../utils/logger');

const historyQueries = {
  /**
   * Log a track play event into playback_history
   * @param {string} guildId 
   * @param {string} userId 
   * @param {string} trackTitle 
   * @param {string} artist 
   * @param {string} source 
   */
  async logPlayback(guildId, userId, trackTitle, artist, source = 'unknown') {
    if (!db.isAvailable()) return null;

    try {
      const text = `
        INSERT INTO playback_history (guild_id, user_id, track_title, artist, source)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const res = await db.query(text, [
        guildId,
        userId,
        trackTitle,
        artist || null,
        source
      ]);
      return res.rows[0] || null;
    } catch (err) {
      logger.error('History', `Failed to log playback for track "${trackTitle}"`, err);
      return null;
    }
  },

  /**
   * Fetch recent tracks played in a guild
   * @param {string} guildId 
   * @param {number} limit 
   */
  async getRecentPlays(guildId, limit = 10) {
    if (!db.isAvailable()) return [];

    try {
      const text = `
        SELECT track_title, artist, source, played_at
        FROM playback_history
        WHERE guild_id = $1
        ORDER BY played_at DESC
        LIMIT $2;
      `;
      const res = await db.query(text, [guildId, limit]);
      return res.rows;
    } catch (err) {
      logger.error('History', `Failed to fetch recent plays for guild ${guildId}`, err);
      return [];
    }
  }
};

module.exports = historyQueries;
