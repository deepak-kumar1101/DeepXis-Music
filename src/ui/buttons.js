/**
 * DeepXis Music Bot - Interactive Discord Buttons
 * Employs custom Discord emojis when registered, clean text fallbacks otherwise.
 * Zero Unicode emojis.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getButtonAsset } = require('./emoji');

/**
 * Creates the primary 2-row player control buttons
 * Row 1: Previous | Pause/Resume | Skip
 * Row 2: Shuffle | Loop | Queue | Stop
 * @param {import('discord-player').GuildQueue} queue 
 * @param {boolean} isPaused 
 */
/**
 * Helper to safely build a button without passing undefined to setEmoji/setLabel
 */
function buildButton(customId, style, asset) {
  const btn = new ButtonBuilder()
    .setCustomId(customId)
    .setStyle(style);

  if (asset.emoji) {
    btn.setEmoji(asset.emoji);
  }
  if (asset.label) {
    btn.setLabel(asset.label);
  }
  return btn;
}

/**
 * Creates the primary 2-row player control buttons
 * Row 1: Previous | Pause/Resume | Skip
 * Row 2: Shuffle | Loop | Queue | Stop
 * @param {import('discord-player').GuildQueue} queue 
 * @param {boolean} isPaused 
 */
function createPlayerControls(queue, isPaused = false) {
  // Row 1: Previous, Pause/Resume, Skip, Volume
  const prevAsset = getButtonAsset('previous', 'Previous');
  const pauseAsset = isPaused 
    ? getButtonAsset('resume', 'Resume')
    : getButtonAsset('pause', 'Pause');
  const nextAsset = getButtonAsset('next', 'Skip');
  const volumeAsset = getButtonAsset('volume', 'Volume');

  const row1 = new ActionRowBuilder().addComponents(
    buildButton('btn_player_previous', ButtonStyle.Secondary, prevAsset),
    buildButton('btn_player_toggle', isPaused ? ButtonStyle.Success : ButtonStyle.Primary, pauseAsset),
    buildButton('btn_player_skip', ButtonStyle.Secondary, nextAsset),
    buildButton('btn_player_volume', ButtonStyle.Secondary, volumeAsset)
  );

  // Row 2: Shuffle, Loop, Stop, Queue
  const shuffleAsset = getButtonAsset('shuffle', 'Shuffle');
  const loopAsset = getButtonAsset('loop', 'Loop');
  const stopAsset = getButtonAsset('stop', 'Stop');
  const queueAsset = getButtonAsset('queue', 'Queue');

  const row2 = new ActionRowBuilder().addComponents(
    buildButton('btn_player_shuffle', ButtonStyle.Secondary, shuffleAsset),
    buildButton('btn_player_loop', queue?.repeatMode > 0 ? ButtonStyle.Success : ButtonStyle.Secondary, loopAsset),
    buildButton('btn_player_stop', ButtonStyle.Danger, stopAsset),
    buildButton('btn_player_queue', ButtonStyle.Secondary, queueAsset)
  );

  return [row1, row2];
}

/**
 * Creates pagination controls for queue navigation
 * @param {number} currentPage 
 * @param {number} totalPages 
 */
function createQueueControls(currentPage, totalPages) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_queue_prev_${currentPage - 1}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Previous Page')
      .setDisabled(currentPage <= 1),

    new ButtonBuilder()
      .setCustomId(`btn_queue_next_${currentPage + 1}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Next Page')
      .setDisabled(currentPage >= totalPages),

    new ButtonBuilder()
      .setCustomId('btn_queue_refresh')
      .setStyle(ButtonStyle.Primary)
      .setLabel('Refresh'),

    new ButtonBuilder()
      .setCustomId('btn_queue_close')
      .setStyle(ButtonStyle.Danger)
      .setLabel('Close')
  );

  return [row];
}

module.exports = {
  createPlayerControls,
  createQueueControls
};
