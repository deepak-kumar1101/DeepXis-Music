/**
 * DeepXis Music Bot - /setvolume Command
 * Set the default initial volume for the guild.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guildService = require('../../services/guildService');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setvolume')
    .setDescription('Set the server default starting volume')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(opt =>
      opt.setName('volume')
        .setDescription('Default volume level (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  category: 'admin',

  async execute(interaction) {
    const volume = interaction.options.getInteger('volume', true);

    await guildService.setVolume(interaction.guildId, volume);
    return interaction.reply({
      embeds: [createSuccessEmbed(`Server default playback volume set to **${volume}%**.`)]
    });
  }
};
