/**
 * DeepXis Music Bot - /shuffle Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');
const { MusicError } = require('../../utils/errors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Randomly shuffle all tracks in the queue'),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));
    const trackCount = Array.isArray(queue.tracks) ? queue.tracks.length : (queue.tracks?.size || 0);

    if (trackCount < 2) {
      throw new MusicError('You need at least 2 tracks in the queue to shuffle.');
    }

    queue.shuffle();

    return interaction.reply({
      embeds: [createSuccessEmbed(`Shuffled ${trackCount} tracks in the queue.`)]
    });
  }
};
