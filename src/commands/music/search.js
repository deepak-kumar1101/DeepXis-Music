/**
 * DeepXis Music Bot - /search Command
 * Searches for 5 tracks and lets the user choose one via an interactive select menu.
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const { searchTracks } = require('../../player/resolver');
const queueManager = require('../../player/queue');
const { validateVoice } = require('../../utils/validators');
const { enforceMusicChannel } = require('../../config/permissions');
const { createTrackAddedEmbed, createErrorEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for music and select a track from interactive results')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Song title, artist, or keywords')
        .setRequired(true)
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    const voiceChannel = validateVoice(interaction, false);
    const query = interaction.options.getString('query', true);

    if (interaction.deferReply && !interaction.deferred) {
      await interaction.deferReply();
    }

    let results = [];
    try {
      results = await searchTracks(query, 5, 'youtube', interaction.user);
    } catch (err) {
      return await interaction.editReply({
        embeds: [createErrorEmbed(`Search failed: ${err.message}`)]
      });
    }

    if (!results || results.length === 0) {
      return await interaction.editReply({
        embeds: [createErrorEmbed(`No tracks found for "${query}".`)]
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('select_search_result')
      .setPlaceholder('Select a track to play (1-5)...')
      .addOptions(
        results.slice(0, 5).map((t, idx) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${idx + 1}. ${t.title.slice(0, 80)}`)
            .setDescription(`${t.artist.slice(0, 50)} (${t.durationFormatted})`)
            .setValue(String(idx))
        )
      );

    const row = new ActionRowBuilder().addComponents(menu);

    const response = await interaction.editReply({
      content: `Found **${results.length}** results for **${query}**:`,
      components: [row]
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId === 'select_search_result',
      time: 30000,
      max: 1
    });

    collector.on('collect', async (i) => {
      const selectedIndex = parseInt(i.values[0], 10);
      const chosenTrack = results[selectedIndex] || results[0];

      const queue = await queueManager.createOrGetQueue(
        interaction.guild,
        voiceChannel,
        interaction.channel
      );

      queue.addTracks(chosenTrack);

      await i.update({
        content: null,
        embeds: [createTrackAddedEmbed(chosenTrack, queue.tracks.length)],
        components: []
      });

      if (!queue.isPlaying()) {
        await queue.play();
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  }
};
