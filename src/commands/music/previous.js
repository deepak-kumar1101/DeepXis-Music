/**
 * DeepXis Music Bot - /previous Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');
const { MusicError } = require('../../utils/errors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('previous')
    .setDescription('Play the previous track from history'),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));

    const historyLen = Array.isArray(queue.history) ? queue.history.length : (queue.history?.tracks?.size || 0);
    if (historyLen === 0) {
      throw new MusicError('There are no previous tracks in history to play.');
    }

    const success = await queue.previous();
    if (!success) {
      throw new MusicError('There are no previous tracks in history to play.');
    }

    return interaction.reply({
      embeds: [createSuccessEmbed('Replaying previous track from history.')]
    });
  }
};
