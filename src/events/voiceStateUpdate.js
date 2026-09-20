/**
 * DeepXis Music Bot - VoiceStateUpdate Event Handler
 * Handles 24/7 voice persistence and the Follow Owner feature.
 */

const queueManager = require('../player/queue');
const config = require('../config/config');
const logger = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState, client) {
    const guildId = oldState.guild.id;
    const botId = client.user.id;

    // 1. Bot disconnected manually
    if (oldState.id === botId) {
      if (oldState.channelId && !newState.channelId) {
        logger.info('Voice', `Bot was disconnected from voice channel in guild ${guildId}`);
        queueManager.deleteQueue(guildId);
        return;
      }
    }

    // 2. Follow Owner Feature (Owner ID: 1434050490282410079)
    const ownerId = config.bot.ownerId;
    if (config.bot.followOwner && (newState.id === ownerId || oldState.id === ownerId)) {
      if (newState.channel && newState.channelId !== oldState.channelId) {
        logger.info('FollowOwner', `Owner (${ownerId}) joined/moved to channel "${newState.channel.name}" in guild ${guildId}`);
        const queue = queueManager.getQueue(guildId);
        if (queue) {
          try {
            await queue.connect(newState.channel);
            logger.info('FollowOwner', `Bot successfully moved to follow owner in "${newState.channel.name}".`);
          } catch (err) {
            logger.error('FollowOwner', `Failed to follow owner: ${err.message}`);
          }
        }
      }
    }

    // 3. 24/7 Mode: No auto-disconnect when human listeners leave
    const queue = queueManager.getQueue(guildId);
    if (queue && queue.channel) {
      const channel = queue.channel;
      const humanMembers = channel.members.filter(m => !m.user.bot);
      if (humanMembers.size === 0) {
        logger.debug('Voice', `Voice channel empty in guild ${guildId}. Staying connected (24/7 mode active).`);
      }
    }
  }
};
