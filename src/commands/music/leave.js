/**
 * DeepXis Music Bot - /leave Command
 * Disconnects the bot from the voice channel and clears queue.
 */

const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../../player/queue');
const { validateVoice } = require('../../utils/validators');
const { enforceDJ } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Disconnect the bot from voice and clear queue'),

  category: 'music',

  async execute(interaction) {
    await enforceDJ(interaction);
    validateVoice(interaction, false);

    queueManager.deleteQueue(interaction.guildId);

    return await interaction.reply({
      embeds: [createSuccessEmbed('Disconnected from voice channel.')]
    });
  }
};
