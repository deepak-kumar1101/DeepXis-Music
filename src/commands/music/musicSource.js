/**
 * DeepXis Music Bot - /music-source Command
 * Sets the default search provider for this server (YouTube / SoundCloud / Spotify).
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guildQueries = require('../../database/queries/guildQueries');
const { createSuccessEmbed, createErrorEmbed } = require('../../ui/embeds');
const { enforceDJ } = require('../../config/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music-source')
    .setDescription('Set the default audio search source for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName('source')
        .setDescription('Default search engine')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube (Default)', value: 'youtube' },
          { name: 'SoundCloud', value: 'soundcloud' },
          { name: 'Spotify (Search & Match)', value: 'spotify' }
        )
    ),

  category: 'music',

  async execute(interaction) {
    await enforceDJ(interaction);

    const source = interaction.options.getString('source', true);
    await guildQueries.setDefaultSource(interaction.guildId, source);

    const sourceNames = {
      youtube: 'YouTube',
      soundcloud: 'SoundCloud',
      spotify: 'Spotify'
    };

    return await interaction.reply({
      embeds: [createSuccessEmbed(`Default music search source set to **${sourceNames[source] || source}** for this server.`)]
    });
  }
};
