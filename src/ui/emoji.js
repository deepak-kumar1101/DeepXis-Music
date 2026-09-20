/**
 * DeepXis Music Bot - Emoji & Visual Asset Formatter
 * Strictly enforces ZERO Unicode emojis.
 * Retrieves custom Discord emojis or text-based fallbacks.
 */

const { getAsset } = require('../config/assets');

/**
 * Returns formatted text representation of an asset
 * @param {string} key Asset key (play, pause, skip, error, etc.)
 * @returns {string} <:name:id> or "[Label]"
 */
function getIcon(key) {
  const asset = getAsset(key);
  return asset.displayText;
}

/**
 * Returns button configuration object for Discord.js ButtonBuilder
 * If a custom Discord emoji is available, sets emoji.
 * Otherwise sets a clean text label.
 * @param {string} key 
 * @param {string} [customLabel]
 */
function getButtonAsset(key, customLabel = null) {
  const asset = getAsset(key);
  const label = customLabel || asset.label;

  if (asset.type === 'discord_emoji') {
    return {
      emoji: asset.value,
      label: null // Only emoji, no text label
    };
  }

  return {
    emoji: null,
    label: label // Clean text fallback (ZERO Unicode emojis)
  };
}

module.exports = {
  getIcon,
  getButtonAsset
};
