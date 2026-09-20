/**
 * DeepXis Music Bot - Apple Music / iOS Lockscreen Music Card Generator
 * Renders large vertical portrait Now Playing card matching iOS lockscreen specification.
 */

const { createCanvas, loadImage, Path2D } = require('@napi-rs/canvas');
const { formatDuration } = require('../utils/formatTime');
const logger = require('../utils/logger');

// Discord Clyde Logo SVG Path
const DISCORD_PATH_SVG = 'M19.73 4.87a18.2 18.2 0 0 0-4.6-1.44c-.2.35-.4.8-.56 1.19a16.8 16.8 0 0 0-5.14 0 12.3 12.3 0 0 0-.57-1.19 18.1 18.1 0 0 0-4.6 1.44A19.3 19.3 0 0 0 .96 17.7a18.4 18.4 0 0 0 5.63 2.87c.46-.62.86-1.28 1.2-1.98a12 12 0 0 1-1.9-.91c.16-.12.31-.24.46-.37a13.1 13.1 0 0 0 11.3 0c.15.13.3.25.46.37-.6.35-1.24.66-1.9.91.34.7.74 1.36 1.2 1.98a18.4 18.4 0 0 0 5.63-2.87c.9-7.3-1.5-12.8-3.3-12.83ZM8.02 15.33c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.94 2.42-2.15 2.42Z';

/**
 * Draws a rounded rectangle path on canvas
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw Discord Clyde icon
 */
function drawDiscordIcon(ctx, x, y, size = 24, color = '#9ca3af') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x, y);
  const scale = size / 24;
  ctx.scale(scale, scale);
  const path = new Path2D(DISCORD_PATH_SVG);
  ctx.fill(path);
  ctx.restore();
}

/**
 * Generates an Apple Music / iOS Lockscreen vertical music card buffer
 * @param {object} track 
 * @param {import('discord-player').GuildQueue} queue 
 * @param {boolean} isPlaying 
 * @returns {Promise<Buffer>}
 */
async function generateMusicCard(track, queue, isPlaying = true) {
  const width = 800;
  const height = 980;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Outer Container - Dark Frosted Titanium Card
  const cardRadius = 48;
  ctx.save();
  roundRect(ctx, 6, 6, width - 12, height - 12, cardRadius);
  ctx.clip();

  // Vertical smoky gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#2b2b32');
  bgGrad.addColorStop(0.35, '#1e1e24');
  bgGrad.addColorStop(1, '#131316');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle glassy outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 7, 7, width - 14, height - 14, cardRadius);
  ctx.stroke();
  ctx.restore();

  // 2. Large Album Artwork (Centered)
  const artSize = 640;
  const artX = (width - artSize) / 2; // 80
  const artY = 48;
  const artRadius = 32;

  let artImage = null;
  if (track.thumbnail) {
    try {
      artImage = await loadImage(track.thumbnail);
    } catch (e) {
      logger.debug('MusicCard', `Failed to load artwork from ${track.thumbnail}: ${e.message}`);
    }
  }

  ctx.save();
  roundRect(ctx, artX, artY, artSize, artSize, artRadius);
  ctx.clip();

  if (artImage) {
    ctx.drawImage(artImage, artX, artY, artSize, artSize);
  } else {
    // Fallback gradient cover if artwork is not accessible
    const grad = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
    grad.addColorStop(0, '#7C3AED');
    grad.addColorStop(1, '#3B82F6');
    ctx.fillStyle = grad;
    ctx.fillRect(artX, artY, artSize, artSize);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DXM', artX + artSize / 2, artY + artSize / 2);
  }
  ctx.restore();

  // Subtle inner border around album art
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  roundRect(ctx, artX, artY, artSize, artSize, artRadius);
  ctx.stroke();
  ctx.restore();

  // 3. Track Details & Requestor Row
  const detailsY = artY + artSize + 34; // 722
  const maxTitleWidth = 430;

  // Left: Track Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let title = track.title || 'Unknown Track';
  if (ctx.measureText(title).width > maxTitleWidth) {
    while (ctx.measureText(title + '...').width > maxTitleWidth && title.length > 0) {
      title = title.substring(0, title.length - 1);
    }
    title += '...';
  }
  ctx.fillText(title, artX, detailsY);

  // Left: Artist Name
  ctx.fillStyle = '#9ca3af';
  ctx.font = '500 26px sans-serif';
  let artist = track.author || track.artist || 'Unknown Artist';
  if (ctx.measureText(artist).width > maxTitleWidth) {
    while (ctx.measureText(artist + '...').width > maxTitleWidth && artist.length > 0) {
      artist = artist.substring(0, artist.length - 1);
    }
    artist += '...';
  }
  ctx.fillText(artist, artX, detailsY + 48);

  // Right: Requestor Info
  const reqRightX = artX + artSize;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('REQUESTOR', reqRightX, detailsY + 4);

  // Requester username & Discord icon
  const requesterName = track.requestedBy?.username || track.requestedBy?.tag || 'User';
  ctx.font = '600 23px sans-serif';
  ctx.fillStyle = '#d4d4d8';
  let cleanName = requesterName;
  const maxNameWidth = 180;
  if (ctx.measureText(cleanName).width > maxNameWidth) {
    while (ctx.measureText(cleanName + '...').width > maxNameWidth && cleanName.length > 0) {
      cleanName = cleanName.substring(0, cleanName.length - 1);
    }
    cleanName += '...';
  }
  ctx.fillText(cleanName, reqRightX, detailsY + 36);

  const nameW = ctx.measureText(cleanName).width;
  drawDiscordIcon(ctx, reqRightX - nameW - 32, detailsY + 38, 24, '#9ca3af');

  // 4. Progress Bar & Timestamps
  const currentMs = typeof queue?.getPlaybackDuration === 'function'
    ? queue.getPlaybackDuration()
    : (queue?.node?.getTimestamp?.()?.current?.value || 0);
  const totalMs = track.durationMS || parseDuration(track.duration) || 0;
  const progressRatio = totalMs > 0 ? Math.min(1, Math.max(0, currentMs / totalMs)) : 0;

  const barX = artX;
  const barY = detailsY + 104; // 826
  const barW = artSize;
  const barH = 8;

  // Background track
  ctx.fillStyle = '#38383f';
  roundRect(ctx, barX, barY, barW, barH, 4);
  ctx.fill();

  // Progress Fill
  const filledW = Math.max(0, Math.min(barW, barW * progressRatio));
  if (filledW > 0) {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, barX, barY, filledW, barH, 4);
    ctx.fill();
  }

  // Progress Knob (Thumb)
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(barX + filledW, barY + barH / 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Time labels below progress bar
  ctx.fillStyle = '#9ca3af';
  ctx.font = '500 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatDuration(currentMs), barX, barY + 30);

  ctx.textAlign = 'right';
  const remainingMs = Math.max(0, totalMs - currentMs);
  const remainingText = totalMs > 0 ? `-${formatDuration(remainingMs)}` : 'LIVE';
  ctx.fillText(remainingText, barX + barW, barY + 30);

  // 5. Playback Controls Row (Icons centered)
  const controlY = barY + 84; // 910
  const centerX = width / 2;

  // Center: Play / Pause Icon
  ctx.fillStyle = '#ffffff';
  if (isPlaying) {
    // Pause icon: two vertical pills
    roundRect(ctx, centerX - 16, controlY - 18, 9, 36, 4.5);
    ctx.fill();
    roundRect(ctx, centerX + 7, controlY - 18, 9, 36, 4.5);
    ctx.fill();
  } else {
    // Play triangle
    ctx.beginPath();
    ctx.moveTo(centerX - 14, controlY - 20);
    ctx.lineTo(centerX + 20, controlY);
    ctx.lineTo(centerX - 14, controlY + 20);
    ctx.closePath();
    ctx.fill();
  }

  // Left: Previous double chevron
  ctx.beginPath();
  ctx.moveTo(centerX - 115, controlY);
  ctx.lineTo(centerX - 88, controlY - 18);
  ctx.lineTo(centerX - 88, controlY + 18);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(centerX - 142, controlY);
  ctx.lineTo(centerX - 115, controlY - 18);
  ctx.lineTo(centerX - 115, controlY + 18);
  ctx.closePath();
  ctx.fill();

  // Right: Next double chevron
  ctx.beginPath();
  ctx.moveTo(centerX + 115, controlY);
  ctx.lineTo(centerX + 88, controlY - 18);
  ctx.lineTo(centerX + 88, controlY + 18);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(centerX + 142, controlY);
  ctx.lineTo(centerX + 115, controlY - 18);
  ctx.lineTo(centerX + 115, controlY + 18);
  ctx.closePath();
  ctx.fill();

  return canvas.toBuffer('image/png');
}

function parseDuration(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}

module.exports = {
  generateMusicCard
};
