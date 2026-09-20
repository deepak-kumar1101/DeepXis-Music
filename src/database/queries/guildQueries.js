/**
 * DeepXis Music Bot - Guild Database Queries
 */

const db = require('../connection');

const guildQueries = {
  /**
   * Fetch guild settings by Discord guild ID
   * @param {string} guildId 
   */
  async getGuild(guildId) {
    const text = 'SELECT * FROM guilds WHERE guild_id = $1;';
    const res = await db.query(text, [guildId]);
    return res.rows[0] || null;
  },

  /**
   * Ensure a guild record exists, creating it with default values if absent
   * @param {string} guildId 
   */
  async ensureGuild(guildId) {
    const text = `
      INSERT INTO guilds (guild_id)
      VALUES ($1)
      ON CONFLICT (guild_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [guildId]);
    return res.rows[0] || null;
  },

  /**
   * Set designated music channel for a guild
   * @param {string} guildId 
   * @param {string|null} channelId 
   */
  async setMusicChannel(guildId, channelId) {
    const text = `
      INSERT INTO guilds (guild_id, music_channel_id, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (guild_id) DO UPDATE 
      SET music_channel_id = EXCLUDED.music_channel_id, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [guildId, channelId]);
    return res.rows[0] || null;
  },

  /**
   * Set DJ role ID for a guild
   * @param {string} guildId 
   * @param {string|null} roleId 
   */
  async setDJRole(guildId, roleId) {
    const text = `
      INSERT INTO guilds (guild_id, dj_role_id, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (guild_id) DO UPDATE 
      SET dj_role_id = EXCLUDED.dj_role_id, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [guildId, roleId]);
    return res.rows[0] || null;
  },

  /**
   * Set default volume for a guild
   * @param {string} guildId 
   * @param {number} volume 
   */
  async setVolume(guildId, volume) {
    const text = `
      INSERT INTO guilds (guild_id, volume, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (guild_id) DO UPDATE 
      SET volume = EXCLUDED.volume, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [guildId, volume]);
    return res.rows[0] || null;
  },

  /**
   * Set prefix for a guild
   * @param {string} guildId 
   * @param {string} prefix 
   */
  async setPrefix(guildId, prefix) {
    const text = `
      INSERT INTO guilds (guild_id, prefix, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (guild_id) DO UPDATE 
      SET prefix = EXCLUDED.prefix, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [guildId, prefix]);
    return res.rows[0] || null;
  },

  /**
   * Toggle follow owner for a guild
   * @param {string} guildId 
   * @param {boolean} enabled 
   */
  async setFollowOwner(guildId, enabled) {
    const text = `
      INSERT INTO guilds (guild_id, follow_owner, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (guild_id) DO UPDATE 
      SET follow_owner = EXCLUDED.follow_owner, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [guildId, enabled]);
    return res.rows[0] || null;
  },

  /**
   * Set default search music source for a guild
   * @param {string} guildId 
   * @param {'youtube'|'soundcloud'|'spotify'} source 
   */
  async setDefaultSource(guildId, source) {
    const text = `
      INSERT INTO guilds (guild_id, default_source, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (guild_id) DO UPDATE 
      SET default_source = EXCLUDED.default_source, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [guildId, source]);
    return res.rows[0] || null;
  },

  /**
   * Set max queue size for a guild
   * @param {string} guildId 
   * @param {number} maxQueue 
   */
  async setMaxQueue(guildId, maxQueue) {
    const text = `
      INSERT INTO guilds (guild_id, max_queue, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (guild_id) DO UPDATE 
      SET max_queue = EXCLUDED.max_queue, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(text, [guildId, maxQueue]);
    return res.rows[0] || null;
  }
};

module.exports = guildQueries;
