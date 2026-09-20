/**
 * DeepXis Music Bot - Queue Adapter
 * Bridges queue operations to PlayerManager and GuildPlayer.
 */

const playerManager = require('./queue/PlayerManager');

const queueManager = {
  /**
   * Get an existing queue/player for a guild
   * @param {string} guildId 
   * @returns {import('./queue/GuildPlayer').GuildPlayer|null}
   */
  getQueue(guildId) {
    return playerManager.get(guildId);
  },

  /**
   * Retrieve or create a voice queue for a guild
   * @param {import('discord.js').Guild} guild 
   * @param {import('discord.js').VoiceBasedChannel} voiceChannel 
   * @param {import('discord.js').TextBasedChannel} textChannel 
   * @returns {Promise<import('./queue/GuildPlayer').GuildPlayer>}
   */
  async createOrGetQueue(guild, voiceChannel, textChannel) {
    return await playerManager.createOrGetPlayer(guild, voiceChannel, textChannel);
  },

  /**
   * Safely destroy a guild queue
   * @param {string} guildId 
   */
  deleteQueue(guildId) {
    playerManager.deletePlayer(guildId);
  }
};

module.exports = queueManager;
