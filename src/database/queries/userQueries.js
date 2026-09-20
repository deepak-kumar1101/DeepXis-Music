/**
 * DeepXis Music Bot - User and Preference Database Queries
 */

const db = require('../connection');

const userQueries = {
  /**
   * Fetch user by Discord ID
   * @param {string} discordId 
   */
  async getUser(discordId) {
    const text = 'SELECT * FROM users WHERE discord_id = $1;';
    const res = await db.query(text, [discordId]);
    return res.rows[0] || null;
  },

  /**
   * Ensure user exists in database
   * @param {string} discordId 
   */
  async ensureUser(discordId) {
    const text = `
      INSERT INTO users (discord_id)
      VALUES ($1)
      ON CONFLICT (discord_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [discordId]);
    return res.rows[0] || null;
  },

  /**
   * Get user preferences (default_volume, autoplay)
   * @param {string} discordId 
   */
  async getUserPreferences(discordId) {
    const text = `
      SELECT up.*, u.discord_id 
      FROM user_preferences up
      JOIN users u ON up.user_id = u.id
      WHERE u.discord_id = $1;
    `;
    const res = await db.query(text, [discordId]);
    return res.rows[0] || null;
  },

  /**
   * Upsert user preferences
   * @param {string} discordId 
   * @param {object} prefs 
   */
  async upsertPreferences(discordId, { defaultVolume, autoplay }) {
    const user = await this.ensureUser(discordId);
    if (!user) return null;

    const text = `
      INSERT INTO user_preferences (user_id, default_volume, autoplay, updated_at)
      VALUES ($1, COALESCE($2, 80), COALESCE($3, FALSE), CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE
      SET default_volume = COALESCE($2, user_preferences.default_volume),
          autoplay = COALESCE($3, user_preferences.autoplay),
          updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [user.id, defaultVolume, autoplay]);
    return res.rows[0] || null;
  }
};

module.exports = userQueries;
