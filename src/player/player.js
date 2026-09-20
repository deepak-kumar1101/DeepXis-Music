/**
 * DeepXis Music Bot - Audio Engine Initializer
 * Boots binary management, pre-flight checks, and PlayerManager.
 */

const playerManager = require('./queue/PlayerManager');
const { initBinaryManager } = require('../utils/binaryManager');
const logger = require('../utils/logger');

let initialized = false;

/**
 * Initialize audio subsystem on the Discord client
 * @param {import('discord.js').Client} client 
 */
async function initPlayer(client) {
  if (initialized) return playerManager;

  logger.info('Player', 'Initializing DeepXis Audio Engine (yt-dlp + FFmpeg)...');
  await initBinaryManager();
  initialized = true;

  return playerManager;
}

function getPlayer() {
  return playerManager;
}

module.exports = {
  initPlayer,
  getPlayer
};
