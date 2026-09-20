/**
 * DeepXis Music Bot - /disconnect Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnect the bot from the voice channel'),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    queueManager.deleteQueue(interaction.guildId);

    return interaction.reply({
      embeds: [createSuccessEmbed('Disconnected from voice channel.')]
    });
  }
};
