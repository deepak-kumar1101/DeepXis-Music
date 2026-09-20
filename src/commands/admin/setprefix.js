/**
 * DeepXis Music Bot - /setprefix Command
 * Configure the server's text command prefix.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guildService = require('../../services/guildService');
const { createSuccessEmbed, createErrorEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setprefix')
    .setDescription('Set the server text command prefix (e.g. !, ?, .)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName('prefix')
        .setDescription('New prefix (max 5 characters)')
        .setRequired(true)
    ),

  category: 'admin',

  async execute(interaction) {
    const newPrefix = interaction.options.getString('prefix', true).trim();

    if (newPrefix.length > 5) {
      return interaction.reply({
        embeds: [createErrorEmbed('Prefix length cannot exceed 5 characters.')],
        ephemeral: true
      });
    }

    await guildService.setPrefix(interaction.guildId, newPrefix);
    return interaction.reply({
      embeds: [createSuccessEmbed(`Server command prefix has been set to: \`${newPrefix}\`\nYou can now use commands like \`${newPrefix}play\` or slash commands in parallel.`)]
    });
  }
};
