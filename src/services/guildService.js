/**
 * DeepXis Music Bot - Guild Settings Service
 * Provides caching over PostgreSQL to optimize multi-guild performance.
 */

const guildQueries = require('../database/queries/guildQueries');
const config = require('../config/config');
const logger = require('../utils/logger');

// In-memory cache for guild settings (guildId -> { data, cachedAt })
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const guildService = {
  /**
   * Get guild settings (cached)
   * @param {string} guildId 
   */
  async getSettings(guildId) {
    const cached = cache.get(guildId);
    if (cached && (Date.now() - cached.cachedAt < CACHE_TTL)) {
      return cached.data;
    }

    try {
      let settings = await guildQueries.getGuild(guildId);
      if (!settings) {
        settings = {
          guild_id: guildId,
          music_channel_id: null,
          dj_role_id: null,
          volume: config.player.defaultVolume,
          default_loop_mode: 0
        };
      }
      cache.set(guildId, { data: settings, cachedAt: Date.now() });
      return settings;
    } catch (err) {
      logger.error('GuildService', `Failed to load settings for guild ${guildId}`, err);
      // Fallback in-memory default
      return {
        guild_id: guildId,
        music_channel_id: null,
        dj_role_id: null,
        volume: config.player.defaultVolume,
        default_loop_mode: 0
      };
    }
  },

  /**
   * Update designated music channel
   * @param {string} guildId 
   * @param {string|null} channelId 
   */
  async setMusicChannel(guildId, channelId) {
    const updated = await guildQueries.setMusicChannel(guildId, channelId);
    cache.delete(guildId); // Invalidate cache
    return updated;
  },

  /**
   * Update DJ role
   * @param {string} guildId 
   * @param {string|null} roleId 
   */
  async setDJRole(guildId, roleId) {
    const updated = await guildQueries.setDJRole(guildId, roleId);
    cache.delete(guildId); // Invalidate cache
    return updated;
  },

  /**
   * Update guild default volume
   * @param {string} guildId 
   * @param {number} volume 
   */
  async setVolume(guildId, volume) {
    const updated = await guildQueries.setVolume(guildId, volume);
    cache.delete(guildId); // Invalidate cache
    return updated;
  },

  /**
   * Get guild command prefix
   * @param {string} guildId 
   * @returns {Promise<string>}
   */
  async getPrefix(guildId) {
    const settings = await this.getSettings(guildId);
    return settings?.prefix || config.bot.defaultPrefix || '!';
  },

  /**
   * Set custom command prefix for a guild
   * @param {string} guildId 
   * @param {string} prefix 
   */
  async setPrefix(guildId, prefix) {
    const updated = await guildQueries.setPrefix(guildId, prefix);
    cache.delete(guildId);
    return updated;
  },

  /**
   * Set follow owner state for a guild
   * @param {string} guildId 
   * @param {boolean} enabled 
   */
  async setFollowOwner(guildId, enabled) {
    const updated = await guildQueries.setFollowOwner(guildId, enabled);
    cache.delete(guildId);
    return updated;
  }
};

module.exports = guildService;
