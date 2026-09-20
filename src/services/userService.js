/**
 * DeepXis Music Bot - User Settings Service
 */

const userQueries = require('../database/queries/userQueries');
const config = require('../config/config');
const logger = require('../utils/logger');

const userService = {
  /**
   * Get user preferences
   * @param {string} discordId 
   */
  async getPreferences(discordId) {
    try {
      const prefs = await userQueries.getUserPreferences(discordId);
      if (!prefs) {
        return {
          discord_id: discordId,
          default_volume: config.player.defaultVolume,
          autoplay: false
        };
      }
      return prefs;
    } catch (err) {
      logger.error('UserService', `Failed to load preferences for user ${discordId}`, err);
      return {
        discord_id: discordId,
        default_volume: config.player.defaultVolume,
        autoplay: false
      };
    }
  },

  /**
   * Set user preferences
   * @param {string} discordId 
   * @param {object} prefs 
   */
  async updatePreferences(discordId, prefs) {
    try {
      return await userQueries.upsertPreferences(discordId, prefs);
    } catch (err) {
      logger.error('UserService', `Failed to update preferences for user ${discordId}`, err);
      return null;
    }
  }
};

module.exports = userService;
