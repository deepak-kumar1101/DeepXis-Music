/**
 * DeepXis Music Bot - /clear Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all upcoming tracks from the queue'),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));
    const count = Array.isArray(queue.tracks) ? queue.tracks.length : (queue.tracks?.size || 0);

    queue.clear();

    return interaction.reply({
      embeds: [createSuccessEmbed(`Cleared ${count} tracks from the queue.`)]
    });
  }
};
