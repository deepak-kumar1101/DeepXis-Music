/**
 * DeepXis Music Bot - /setchannel Command
 * Restrict bot commands to a specific text channel.
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const guildService = require('../../services/guildService');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Designate a text channel for music bot commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Text channel for music commands (leave blank to allow everywhere)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  category: 'admin',

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    if (!channel) {
      await guildService.setMusicChannel(interaction.guildId, null);
      return interaction.reply({
        embeds: [createSuccessEmbed('Music channel restriction removed. Commands can now be used in any channel.')]
      });
    }

    await guildService.setMusicChannel(interaction.guildId, channel.id);
    return interaction.reply({
      embeds: [createSuccessEmbed(`Music commands are now restricted to <#${channel.id}>.`)]
    });
  }
};
