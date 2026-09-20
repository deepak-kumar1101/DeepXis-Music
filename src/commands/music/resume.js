/**
 * DeepXis Music Bot - /resume Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume paused playback'),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));

    const isPaused = queue.state === 'Paused' || (typeof queue.node?.isPaused === 'function' && queue.node.isPaused());
    if (!isPaused) {
      return interaction.reply({
        embeds: [createSuccessEmbed('Playback is already active.')],
        ephemeral: true
      });
    }

    queue.resume();
    return interaction.reply({
      embeds: [createSuccessEmbed('Playback resumed.')]
    });
  }
};
