/**
 * DeepXis Music Bot - /pause Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current playback'),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));

    if (queue.state === 'Paused' || (typeof queue.node?.isPaused === 'function' && queue.node.isPaused())) {
      return interaction.reply({
        embeds: [createSuccessEmbed('Playback is already paused.')],
        ephemeral: true
      });
    }

    queue.pause();
    return interaction.reply({
      embeds: [createSuccessEmbed('Playback paused.')]
    });
  }
};
