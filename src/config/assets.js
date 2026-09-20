/**
 * DeepXis Music Bot - Centralized Custom Asset Registry
 * Strictly enforces NO Unicode emojis.
 * Supports Discord custom emojis (<:name:id>, <a:name:id>)
 * and HTML embed codes (<a href="..."><img src="..." /></a>).
 */

const logger = require('../utils/logger');

// Clean text fallback labels for UI buttons & displays (ZERO Unicode emojis)
const DEFAULT_LABELS = {
  play: 'Play',
  pause: 'Pause',
  resume: 'Resume',
  previous: 'Previous',
  next: 'Skip',
  stop: 'Stop',
  disconnect: 'Disconnect',
  shuffle: 'Shuffle',
  loop: 'Loop',
  queue: 'Queue',
  volume: 'Volume',
  mute: 'Mute',
  lyrics: 'Lyrics',
  loading: 'Loading...',
  playing: 'Playing',
  paused: 'Paused',
  success: 'Success',
  error: 'Error',
  premium: 'Premium',
  dj: 'DJ',
  search: 'Search',
  settings: 'Settings',
  song: 'Song',
  author: 'Author',
  duration: 'Duration',
  requester: 'Requester',
  title: 'Now Playing',
  divider: '',
  spotify: 'Spotify',
  spotify_banner: 'Spotify',
  spotify_gif: 'Spotify'
};

/**
 * Registry holding user-supplied assets.
 * Values are either Discord emoji strings (<:name:id> / <a:name:id>)
 * or direct image/GIF CDN URLs.
 */
const assets = {
  play: null,
  pause: null,
  resume: null,
  previous: null,
  next: null,
  stop: null,
  disconnect: null,
  shuffle: null,
  loop: null,
  queue: null,
  volume: null,
  mute: null,
  lyrics: null,
  loading: null,
  playing: null,
  paused: null,
  success: null,
  error: null,
  premium: null,
  dj: null,
  search: null,
  settings: null,
  song: null,
  author: null,
  duration: null,
  requester: null,
  title: null,
  divider: null,
  spotify: null,
  spotify_banner: null,
  spotify_gif: null
};

/**
 * Extracts clean asset URL or Discord custom emoji from raw user input.
 * Handles HTML <a><img src="..."></a>, direct URLs, or <:name:id> / <a:name:id>.
 * @param {string} rawInput 
 * @returns {string|null}
 */
function parseAssetInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // 1. Check for Discord Custom Emoji syntax: <:name:123456789> or <a:name:123456789>
  const discordEmojiMatch = trimmed.match(/^<(a)?:([a-zA-Z0-9_~]+):(\d+)>$/);
  if (discordEmojiMatch) {
    return trimmed;
  }

  // Check for repeated custom emojis (common for divider lines <:line:123><:line:123>)
  if (/^(<(a)?:[a-zA-Z0-9_~]+:\d+>\s*)+$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Check for HTML embed code: <img ... src="url" ...> or <a ...><img ... src="url"></a>
  const htmlImgMatch = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlImgMatch && htmlImgMatch[1]) {
    return htmlImgMatch[1];
  }

  // 3. Direct HTTP(S) URL
  if (/^https?:\/\/.+/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Register or update an asset
 * @param {string} key 
 * @param {string} rawInput 
 */
function registerAsset(key, rawInput) {
  if (!Object.prototype.hasOwnProperty.call(assets, key)) {
    logger.warn('Assets', `Attempted to register unknown asset key: "${key}"`);
    return false;
  }

  const parsed = parseAssetInput(rawInput);
  assets[key] = parsed;
  if (parsed) {
    logger.info('Assets', `Registered custom asset for "${key}": ${parsed}`);
  }
  return true;
}

/**
 * Load any assets preconfigured in environment variables
 */
function loadFromEnv() {
  const envMap = {
    play: process.env.ASSET_PLAY,
    pause: process.env.ASSET_PAUSE,
    resume: process.env.ASSET_RESUME,
    previous: process.env.ASSET_PREVIOUS,
    next: process.env.ASSET_NEXT,
    stop: process.env.ASSET_STOP,
    disconnect: process.env.ASSET_DISCONNECT,
    shuffle: process.env.ASSET_SHUFFLE,
    loop: process.env.ASSET_LOOP,
    queue: process.env.ASSET_QUEUE,
    volume: process.env.ASSET_VOLUME,
    mute: process.env.ASSET_MUTE,
    lyrics: process.env.ASSET_LYRICS,
    loading: process.env.ASSET_LOADING_GIF,
    playing: process.env.ASSET_PLAYING_BANNER,
    paused: process.env.ASSET_PAUSED,
    success: process.env.ASSET_SUCCESS,
    error: process.env.ASSET_ERROR,
    premium: process.env.ASSET_PREMIUM,
    dj: process.env.ASSET_DJ,
    search: process.env.ASSET_SEARCH,
    settings: process.env.ASSET_SETTINGS,
    song: process.env.EMOJI_SONG,
    author: process.env.EMOJI_AUTHOR,
    duration: process.env.EMOJI_DURATION,
    requester: process.env.EMOJI_REQUESTER,
    title: process.env.EMOJI_TITLE || process.env.EMOJI_NOW_PLAYING || process.env.EMOJI_SONG,
    divider: process.env.EMOJI_DIVIDER,
    spotify: process.env.EMOJI_SPOTIFY || process.env.ASSET_SHUFFLE,
    spotify_banner: process.env.ASSET_SPOTIFY_BANNER,
    spotify_gif: process.env.ASSET_SPOTIFY_GIF
  };

  for (const [key, val] of Object.entries(envMap)) {
    if (val) {
      registerAsset(key, val);
    }
  }
}

/**
 * Retrieve asset details with guaranteed fallback to clean text
 * @param {string} key 
 */
function getAsset(key) {
  const val = assets[key] || null;
  const defaultLabel = DEFAULT_LABELS[key] || key;

  if (!val) {
    return {
      key,
      hasCustom: false,
      type: 'text_only',
      value: null,
      cdnUrl: null,
      label: defaultLabel,
      // String representation in embeds: label in brackets, NO Unicode emojis
      displayText: defaultLabel ? `[${defaultLabel}]` : ''
    };
  }

  const emojiMatch = val.match(/^<(a)?:([a-zA-Z0-9_~]+):(\d+)>$/);
  if (emojiMatch) {
    const isAnimated = !!emojiMatch[1];
    const name = emojiMatch[2];
    const id = emojiMatch[3];
    const cdnUrl = `https://cdn.discordapp.com/emojis/${id}.${isAnimated ? 'gif' : 'png'}`;

    return {
      key,
      hasCustom: true,
      type: 'discord_emoji',
      value: val,
      name,
      id,
      isAnimated,
      cdnUrl,
      label: defaultLabel,
      displayText: val
    };
  }

  if (/^(<(a)?:[a-zA-Z0-9_~]+:\d+>\s*)+$/.test(val)) {
    return {
      key,
      hasCustom: true,
      type: 'discord_emoji',
      value: val,
      name: 'custom_sequence',
      id: null,
      isAnimated: val.includes('<a:'),
      cdnUrl: null,
      label: defaultLabel,
      displayText: val
    };
  }

  return {
    key,
    hasCustom: true,
    type: 'image_url',
    value: val,
    cdnUrl: val,
    label: defaultLabel,
    displayText: `[${defaultLabel}]`
  };
}

module.exports = {
  assets,
  DEFAULT_LABELS,
  parseAssetInput,
  registerAsset,
  loadFromEnv,
  getAsset
};
