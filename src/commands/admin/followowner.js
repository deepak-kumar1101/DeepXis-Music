/**
 * DeepXis Music Bot - /followowner Command
 * Toggles the Follow Owner automation feature.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guildService = require('../../services/guildService');
const config = require('../../config/config');
const { createSuccessEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('followowner')
    .setDescription('Toggle automatic voice channel following for the bot owner')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(opt =>
      opt.setName('enabled')
        .setDescription('Enable or disable follow owner')
        .setRequired(false)
    ),

  category: 'admin',

  async execute(interaction) {
    let enabled = interaction.options.getBoolean('enabled');

    if (enabled === null) {
      const settings = await guildService.getSettings(interaction.guildId);
      enabled = !(settings?.follow_owner ?? true);
    }

    await guildService.setFollowOwner(interaction.guildId, enabled);
    const ownerId = config.bot.ownerId;

    return interaction.reply({
      embeds: [createSuccessEmbed(
        `Follow Owner feature is now **${enabled ? 'ENABLED' : 'DISABLED'}** for owner <@${ownerId}>.\n` +
        (enabled ? 'The bot will automatically move between voice channels to follow the owner.' : 'The bot will stay in its assigned voice channel.')
      )]
    });
  }
};
