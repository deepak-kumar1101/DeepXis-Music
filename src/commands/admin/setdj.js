/**
 * DeepXis Music Bot - /setdj Command
 * Configure or clear the server's DJ role.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guildService = require('../../services/guildService');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setdj')
    .setDescription('Configure or remove the server DJ role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('The role to assign as DJ (leave blank to remove)')
        .setRequired(false)
    ),

  category: 'admin',

  async execute(interaction) {
    const role = interaction.options.getRole('role');

    if (!role) {
      await guildService.setDJRole(interaction.guildId, null);
      return interaction.reply({
        embeds: [createSuccessEmbed('DJ role removed. All voice channel members can now use playback controls.')]
      });
    }

    await guildService.setDJRole(interaction.guildId, role.id);
    return interaction.reply({
      embeds: [createSuccessEmbed(`DJ role successfully set to <@&${role.id}>.`)]
    });
  }
};
