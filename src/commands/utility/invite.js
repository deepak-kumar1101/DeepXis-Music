/**
 * DeepXis Music Bot - /invite Command
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, OAuth2Scopes, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get an invite link to add DeepXis Music to your server'),

  category: 'utility',

  async execute(interaction, client) {
    const inviteUrl = client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });

    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Invite` })
      .setDescription(`Click below to invite **${config.ui.brandName}** to your Discord server with optimal voice and slash-command permissions.`)
      .setFooter({ text: config.ui.brandName });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite DeepXis Music')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};
