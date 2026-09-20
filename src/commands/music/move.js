/**
 * DeepXis Music Bot - /move Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');
const { MusicError, ERROR_MESSAGES } = require('../../utils/errors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track to a different position in the queue')
    .addIntegerOption(opt =>
      opt.setName('from')
        .setDescription('Current position of the track')
        .setMinValue(1)
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('to')
        .setDescription('Target position in the queue')
        .setMinValue(1)
        .setRequired(true)
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));
    const from = interaction.options.getInteger('from', true);
    const to = interaction.options.getInteger('to', true);
    const queueLen = Array.isArray(queue.tracks) ? queue.tracks.length : (queue.tracks?.size || 0);

    if (from > queueLen || to > queueLen) {
      throw new MusicError(`${ERROR_MESSAGES.INVALID_POSITION} (Queue size: ${queueLen})`);
    }

    if (from === to) {
      return interaction.reply({
        embeds: [createSuccessEmbed('Track is already at that position.')],
        ephemeral: true
      });
    }

    const trackToMove = queue.tracks[from - 1];
    queue.move(from - 1, to - 1);

    return interaction.reply({
      embeds: [createSuccessEmbed(`Moved **${trackToMove?.title || 'Track'}** from #${from} to #${to}.`)]
    });
  }
};
