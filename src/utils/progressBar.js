/**
 * DeepXis Music Bot - Clean Progress Bar Generator
 * Uses standard typographical / box characters (no Unicode emojis).
 */

const { formatDuration } = require('./formatTime');

/**
 * Generate a clean progress bar string
 * @param {number} currentMs Current playback time in ms
 * @param {number} totalMs Total duration in ms
 * @param {number} barLength Total characters for the bar (default 16)
 * @returns {string} e.g. "01:24 ━━━━━━━━━━━o━━━━ 03:48"
 */
function createProgressBar(currentMs, totalMs, barLength = 16) {
  const currentFormatted = formatDuration(currentMs);
  const totalFormatted = formatDuration(totalMs);

  if (!totalMs || totalMs <= 0) {
    return `${currentFormatted} [ LIVE STREAM ]`;
  }

  const progress = Math.min(1, Math.max(0, currentMs / totalMs));
  const progressIndex = Math.floor(progress * barLength);

  let bar = '';
  for (let i = 0; i < barLength; i++) {
    if (i === progressIndex) {
      bar += 'o'; // Clean slider point (no emoji)
    } else if (i < progressIndex) {
      bar += '=';
    } else {
      bar += '-';
    }
  }

  return `${currentFormatted} [${bar}] ${totalFormatted}`;
}

module.exports = {
  createProgressBar
};
