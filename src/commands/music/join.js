/**
 * DeepXis Music Bot - /join Command
 * Connects the bot to the user's voice channel.
 */

const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../../player/queue');
const { validateVoice } = require('../../utils/validators');
const { enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Connect the bot to your current voice channel'),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    const voiceChannel = validateVoice(interaction, false);

    await queueManager.createOrGetQueue(
      interaction.guild,
      voiceChannel,
      interaction.channel
    );

    return await interaction.reply({
      embeds: [createSuccessEmbed(`Connected to voice channel **${voiceChannel.name}**.`)]
    });
  }
};
