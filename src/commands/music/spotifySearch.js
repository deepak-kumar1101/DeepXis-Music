/**
 * DeepXis Music Bot - /spotifysearch Command
 * Searches Spotify for up to 10 tracks and enqueues selected item as a metadata-only track.
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const providerRegistry = require('../../player/providers/ProviderRegistry');
const queueManager = require('../../player/queue');
const { validateVoice } = require('../../utils/validators');
const { enforceMusicChannel } = require('../../config/permissions');
const { createTrackAddedEmbed, createErrorEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spotifysearch')
    .setDescription('Search Spotify directly and queue a track')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Track title or artist to search on Spotify')
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

    const spotifyProvider = providerRegistry.get('spotify');
    let results = [];
    try {
      results = await spotifyProvider.search(query, 10, interaction.user);
    } catch (err) {
      return await interaction.editReply({
        embeds: [createErrorEmbed(`Spotify search failed: ${err.message}`)]
      });
    }

    if (!results || results.length === 0) {
      return await interaction.editReply({
        embeds: [createErrorEmbed(`No Spotify results found for "${query}".`)]
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('select_spotify_search')
      .setPlaceholder('Choose a Spotify track to queue (1-10)...')
      .addOptions(
        results.slice(0, 10).map((t, idx) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${idx + 1}. ${t.title.slice(0, 80)}`)
            .setDescription(`${t.artist.slice(0, 50)} (${t.durationFormatted})`)
            .setValue(t.spotifyId || t.rawId || String(idx))
        )
      );

    const row = new ActionRowBuilder().addComponents(menu);

    const response = await interaction.editReply({
      content: `Found **${results.length}** Spotify tracks for **${query}**:`,
      components: [row]
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId === 'select_spotify_search',
      time: 30000,
      max: 1
    });

    collector.on('collect', async (i) => {
      const chosenId = i.values[0];
      const chosenTrack = results.find(t => (t.spotifyId === chosenId || t.rawId === chosenId)) || results[0];

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
