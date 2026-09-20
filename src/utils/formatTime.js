/**
 * DeepXis Music Bot - Time Formatting Utilities
 */

/**
 * Format milliseconds into MM:SS or HH:MM:SS
 * @param {number} ms 
 * @returns {string}
 */
function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Parse time string (e.g., "1:30", "01:30", "90s", "2m", "1h30m") to milliseconds
 * @param {string} input 
 * @returns {number|null} milliseconds or null if invalid
 */
function parseTimeString(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim().toLowerCase();

  // Format mm:ss or hh:mm:ss
  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    if (parts.some(isNaN)) return null;

    if (parts.length === 2) {
      const [mins, secs] = parts;
      return (mins * 60 + secs) * 1000;
    } else if (parts.length === 3) {
      const [hrs, mins, secs] = parts;
      return (hrs * 3600 + mins * 60 + secs) * 1000;
    }
    return null;
  }

  // Format: 1h30m, 90s, 2m, etc.
  const regex = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/;
  const match = str.match(regex);
  if (match && (match[1] || match[2] || match[3])) {
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  // Raw seconds number
  const rawNum = Number(str);
  if (!isNaN(rawNum) && rawNum >= 0) {
    return rawNum * 1000;
  }

  return null;
}

module.exports = {
  formatDuration,
  parseTimeString
};
