/**
 * DeepXis Music Bot - Unified Player Dashboard Panel
 * Combines player embed, dynamic music card canvas, and action buttons.
 */

const { AttachmentBuilder } = require('discord.js');
const { createPlayerEmbed } = require('./embeds');
const { createPlayerControls } = require('./buttons');
const { generateMusicCard } = require('./musicCard');
const logger = require('../utils/logger');

/**
 * Generate full player panel payload with dynamic music card
 * @param {object} track 
 * @param {import('discord-player').GuildQueue} queue 
 * @param {boolean} isPlaying 
 * @returns {Promise<{ embeds: any[], components: any[], files: any[] }>}
 */
async function createPlayerPanel(track, queue, isPlaying = true) {
  let attachment = null;
  try {
    const cardBuffer = await generateMusicCard(track, queue, isPlaying);
    attachment = new AttachmentBuilder(cardBuffer, { name: 'music-card.png' });
  } catch (err) {
    logger.error('PlayerPanel', 'Failed to render music card canvas', err);
  }

  const embedResult = createPlayerEmbed(track, queue, isPlaying, attachment ? 'music-card.png' : null);
  const embedsList = Array.isArray(embedResult) ? embedResult : [embedResult];
  const components = createPlayerControls(queue, !isPlaying);

  return {
    embeds: embedsList,
    components: components,
    files: attachment ? [attachment] : []
  };
}

module.exports = {
  createPlayerPanel
};
