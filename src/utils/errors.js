/**
 * DeepXis Music Bot - Typed Error Hierarchy & UX Handler
 * Maps subprocess/network failures to clean user-facing guidance.
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

class MusicError extends Error {
  constructor(message, userMessage, code = 'MUSIC_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.userMessage = userMessage || message;
    this.code = code;
  }
}

class BotCheckError extends MusicError {
  constructor(detail = '') {
    super(
      `YouTube Bot Check / Sign-in required: ${detail}`,
      'This track requires sign-in or triggered YouTube bot verification. Attempting automatic fallback source...',
      'BOT_CHECK'
    );
  }
}

class AgeRestrictedError extends MusicError {
  constructor(detail = '') {
    super(
      `Track is age-restricted: ${detail}`,
      'This track is age-restricted on YouTube. Attempting automatic fallback...',
      'AGE_RESTRICTED'
    );
  }
}

class PrivateVideoError extends MusicError {
  constructor(detail = '') {
    super(
      `Track is private or deleted: ${detail}`,
      'This track is private, unlisted, or has been removed by the creator.',
      'PRIVATE_VIDEO'
    );
  }
}

class UnavailableError extends MusicError {
  constructor(detail = '') {
    super(
      `Track is unavailable: ${detail}`,
      'This track is currently unavailable on the provider.',
      'UNAVAILABLE'
    );
  }
}

class GeoBlockedError extends MusicError {
  constructor(detail = '') {
    super(
      `Track is geoblocked: ${detail}`,
      'This track is not available in the server’s hosting region.',
      'GEO_BLOCKED'
    );
  }
}

class RateLimitedError extends MusicError {
  constructor(detail = '') {
    super(
      `Provider rate limited: ${detail}`,
      'Rate limit reached on the audio provider. Retrying with alternate client...',
      'RATE_LIMITED'
    );
  }
}

class JsRuntimeMissingError extends MusicError {
  constructor(detail = '') {
    super(
      `JavaScript runtime missing: ${detail}`,
      'yt-dlp required a JS runtime to solve video challenges.',
      'JS_RUNTIME_MISSING'
    );
  }
}

class FormatMissingError extends MusicError {
  constructor(detail = '') {
    super(
      `No compatible audio format found: ${detail}`,
      'Could not extract a compatible audio stream format for this track.',
      'FORMAT_MISSING'
    );
  }
}

class TimeoutError extends MusicError {
  constructor(detail = '') {
    super(
      `Operation timed out: ${detail}`,
      'The audio provider took too long to respond. Moving to next fallback...',
      'TIMEOUT'
    );
  }
}

class NetworkError extends MusicError {
  constructor(detail = '') {
    super(
      `Network connection error: ${detail}`,
      'Network error connecting to the audio provider. Retrying connection...',
      'NETWORK_ERROR'
    );
  }
}

class SpotifyAuthError extends MusicError {
  constructor(detail = '') {
    super(
      `Spotify Authentication error: ${detail}`,
      detail || 'Spotify authentication error occurred. Please reconnect with `/spotify login`.',
      'SPOTIFY_AUTH_ERROR'
    );
  }
}

class NoMatchError extends MusicError {
  constructor(trackName = 'this track') {
    super(
      `No matching playable audio found for "${trackName}"`,
      `Could not find an acceptable official audio match for **${trackName}** on YouTube or SoundCloud.`,
      'NO_MATCH'
    );
  }
}

/**
 * Classify raw subprocess stderr / error message into a typed MusicError
 * @param {string} stderr 
 * @param {number} [exitCode] 
 * @returns {MusicError}
 */
function classifyYtDlpError(stderr = '', exitCode = 1) {
  const str = String(stderr || '').toLowerCase();

  if (str.includes('sign in to confirm') || str.includes('bot') || str.includes('confirm you') || str.includes('botguard')) {
    return new BotCheckError(stderr);
  }
  if (str.includes('age-restricted') || str.includes('age restricted') || str.includes('requires login')) {
    return new AgeRestrictedError(stderr);
  }
  if (str.includes('private video') || str.includes('video is private') || str.includes('this video has been removed')) {
    return new PrivateVideoError(stderr);
  }
  if (str.includes('not available in your country') || str.includes('geo restricted') || str.includes('blocked in your country')) {
    return new GeoBlockedError(stderr);
  }
  if (str.includes('too many requests') || str.includes('429') || str.includes('http error 429')) {
    return new RateLimitedError(stderr);
  }
  if (str.includes('js runtime') || str.includes('--js-runtimes') || str.includes('deno') || str.includes('quickjs')) {
    return new JsRuntimeMissingError(stderr);
  }
  if (str.includes('no format') || str.includes('requested format is not available') || str.includes('sabr')) {
    return new FormatMissingError(stderr);
  }
  if (str.includes('timed out') || str.includes('timeout') || str.includes('operation timed out')) {
    return new TimeoutError(stderr);
  }
  if (str.includes('unable to download webpage') || str.includes('name or service not known') || str.includes('connection reset')) {
    return new NetworkError(stderr);
  }
  if (str.includes('is not a valid url') || str.includes('unsupported url') || str.includes('video unavailable')) {
    return new UnavailableError(stderr);
  }

  return new MusicError(`yt-dlp process failed (code ${exitCode}): ${stderr.slice(0, 150)}`, 'Failed to resolve audio stream for this track.');
}

/**
 * Create a user-facing Discord Embed describing the error clearly
 * @param {Error|MusicError} err 
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(err) {
  const userMsg = err instanceof MusicError ? err.userMessage : (err?.message || 'An unexpected playback error occurred.');
  const title = err instanceof MusicError ? `Playback Notice: ${err.code}` : 'Playback Notice';

  return new EmbedBuilder()
    .setColor(config.ui.errorColor || '#EF4444')
    .setAuthor({ name: `${config.ui.brandName || 'DeepXis Music'} - Notice` })
    .setTitle(title)
    .setDescription(userMsg)
    .setFooter({ text: `${config.ui.brandName || 'DeepXis Music'} • Audio Engine` })
    .setTimestamp();
}

module.exports = {
  MusicError,
  BotCheckError,
  AgeRestrictedError,
  PrivateVideoError,
  UnavailableError,
  GeoBlockedError,
  RateLimitedError,
  JsRuntimeMissingError,
  FormatMissingError,
  TimeoutError,
  NetworkError,
  SpotifyAuthError,
  NoMatchError,
  classifyYtDlpError,
  createErrorEmbed
};
