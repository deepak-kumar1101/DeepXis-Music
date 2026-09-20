/**
 * DeepXis Music Bot - Central Configuration
 * Validates and exposes environment settings.
 */

require('dotenv').config();
const { loadFromEnv } = require('./assets');
const logger = require('../utils/logger');

// Pre-load custom assets from environment
loadFromEnv();

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || ''
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${process.env.SERVER_PORT || process.env.PORT || 3000}/api/spotify/callback`
  },
  ytdlp: {
    path: process.env.YTDLP_PATH || '',
    jsRuntime: process.env.JS_RUNTIME || 'node',
    cookiesFile: process.env.YTDLP_COOKIES_FILE || '',
    proxy: process.env.YTDLP_PROXY || '',
    ytClients: (process.env.YTDLP_YT_CLIENTS || 'web_safari,android_vr,tv,ios,mweb').split(',').map(s => s.trim()).filter(Boolean)
  },
  ffmpeg: {
    path: process.env.FFMPEG_PATH || ''
  },
  database: {
    url: process.env.DATABASE_URL || ''
  },
  server: {
    port: parseInt(process.env.SERVER_PORT || process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  player: {
    defaultVolume: Math.min(100, Math.max(1, parseInt(process.env.MUSIC_DEFAULT_VOLUME || process.env.DEFAULT_VOLUME || '80', 10))),
    maxVolume: 100,
    maxQueue: parseInt(process.env.MUSIC_MAX_QUEUE || '500', 10),
    idleLeaveSeconds: parseInt(process.env.MUSIC_IDLE_LEAVE_SECONDS || '180', 10),
    leaveOnEmpty: process.env.LEAVE_ON_EMPTY === 'true',
    leaveOnEnd: process.env.LEAVE_ON_END === 'true'
  },
  bot: {
    defaultPrefix: process.env.DEFAULT_PREFIX || '!',
    ownerId: process.env.OWNER_ID || '1434050490282410079',
    voice247: process.env.VOICE_247 !== 'false',
    followOwner: process.env.FOLLOW_OWNER !== 'false'
  },
  ui: {
    brandName: 'DeepXis Music',
    embedColor: process.env.EMBED_COLOR || '#7C3AED',
    errorColor: '#EF4444',
    successColor: '#10B981',
    warningColor: '#F59E0B'
  },

  /**
   * Check essential runtime settings and log any warnings
   */
  validate() {
    const missing = [];
    if (!this.discord.token) missing.push('DISCORD_TOKEN');
    if (!this.discord.clientId) missing.push('DISCORD_CLIENT_ID');

    if (missing.length > 0) {
      logger.warn('Config', `Missing essential Discord configuration: ${missing.join(', ')}. Please update .env`);
    }

    if (!this.spotify.clientId || !this.spotify.clientSecret) {
      logger.warn('Config', 'Spotify API credentials not fully configured in .env. Spotify metadata resolution will be limited.');
    }

    if (!this.database.url) {
      logger.warn('Config', 'DATABASE_URL not set in .env. Bot will operate with in-memory persistence only.');
    }

    return missing.length === 0;
  }
};

module.exports = config;
