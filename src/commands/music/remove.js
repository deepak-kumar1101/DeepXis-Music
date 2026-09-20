/**
 * DeepXis Music Bot - /remove Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');
const { MusicError, ERROR_MESSAGES } = require('../../utils/errors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track at a specific position from the queue')
    .addIntegerOption(opt =>
      opt.setName('position')
        .setDescription('Track position number in /queue')
        .setMinValue(1)
        .setRequired(true)
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));
    const position = interaction.options.getInteger('position', true);
    const queueLen = Array.isArray(queue.tracks) ? queue.tracks.length : (queue.tracks?.size || 0);

    if (position > queueLen) {
      throw new MusicError(`${ERROR_MESSAGES.INVALID_POSITION} (Queue size: ${queueLen})`);
    }

    const removedTrack = queue.remove(position - 1);
    if (!removedTrack) {
      throw new MusicError(ERROR_MESSAGES.INVALID_POSITION);
    }

    return interaction.reply({
      embeds: [createSuccessEmbed(`Removed track #${position}: **${removedTrack.title}**`)]
    });
  }
};
