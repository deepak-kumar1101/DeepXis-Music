/**
 * DeepXis Music Bot - Voice & Player Manager
 * Single owner of Discord voice connections, reconnection handling, and idle lifecycle management.
 */

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const { GuildPlayer } = require('./GuildPlayer');
const guildQueries = require('../../database/queries/guildQueries');
const config = require('../../config/config');
const logger = require('../../utils/logger');

class PlayerManager {
  constructor() {
    this.players = new Map(); // guildId -> GuildPlayer
    this.idleTimers = new Map(); // guildId -> Timeout
  }

  get(guildId) {
    return this.players.get(guildId) || null;
  }

  has(guildId) {
    return this.players.has(guildId);
  }

  /**
   * Connect to voice channel and retrieve or create the GuildPlayer
   * @param {import('discord.js').Guild} guild 
   * @param {import('discord.js').VoiceBasedChannel} voiceChannel 
   * @param {import('discord.js').TextBasedChannel} textChannel 
   * @returns {Promise<GuildPlayer>}
   */
  async createOrGetPlayer(guild, voiceChannel, textChannel) {
    this.clearIdleTimer(guild.id);

    let player = this.players.get(guild.id);
    let connection = getVoiceConnection(guild.id);

    if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false
      });

      this._setupConnectionEvents(guild.id, connection);
    }

    if (!player) {
      player = new GuildPlayer(guild.id, connection, textChannel);

      // Fetch persistent volume setting if available
      try {
        const guildData = await guildQueries.getGuild(guild.id);
        if (guildData && typeof guildData.volume === 'number') {
          player.setVolume(guildData.volume);
        }
      } catch {}

      this.players.set(guild.id, player);
    } else {
      player.connection = connection;
      player.textChannel = textChannel;
      if (connection) {
        connection.subscribe(player.audioPlayer);
      }
    }

    return player;
  }

  _setupConnectionEvents(guildId, connection) {
    let reconnectAttempts = 0;

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      logger.warn('PlayerManager', `Voice connection disconnected in guild ${guildId}`);

      try {
        // Attempt quick state transition to Connecting/Signalling
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
        reconnectAttempts = 0;
      } catch (err) {
        reconnectAttempts++;
        logger.warn('PlayerManager', `Reconnect attempt ${reconnectAttempts}/3 failed for guild ${guildId}`);

        if (reconnectAttempts < 3) {
          try {
            connection.rejoin();
          } catch {}
        } else {
          logger.error('PlayerManager', `Max reconnection attempts exceeded in guild ${guildId}. Destroying connection.`);
          this.deletePlayer(guildId);
        }
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      logger.info('PlayerManager', `Voice connection destroyed in guild ${guildId}`);
      this.deletePlayer(guildId);
    });
  }

  /**
   * Disconnect voice and delete GuildPlayer
   * @param {string} guildId 
   */
  deletePlayer(guildId) {
    this.clearIdleTimer(guildId);

    const player = this.players.get(guildId);
    if (player) {
      player.stop().catch(() => {});
      this.players.delete(guildId);
    }

    const connection = getVoiceConnection(guildId);
    if (connection) {
      try { connection.destroy(); } catch {}
    }
  }

  /**
   * Set up auto-leave idle timer
   * @param {string} guildId 
   */
  startIdleTimer(guildId) {
    if (config.bot.voice247) return; // 24/7 in voice: never auto-disconnect

    this.clearIdleTimer(guildId);
    const leaveSec = config.player.idleLeaveSeconds || 180;

    const timer = setTimeout(() => {
      const player = this.players.get(guildId);
      if (player && !player.isPlaying()) {
        logger.info('PlayerManager', `Auto-leaving voice in guild ${guildId} after ${leaveSec}s of inactivity.`);
        this.deletePlayer(guildId);
      }
    }, leaveSec * 1000);

    this.idleTimers.set(guildId, timer);
  }

  clearIdleTimer(guildId) {
    if (this.idleTimers.has(guildId)) {
      clearTimeout(this.idleTimers.get(guildId));
      this.idleTimers.delete(guildId);
    }
  }
}

// Global Singleton
const playerManager = new PlayerManager();
module.exports = playerManager;
