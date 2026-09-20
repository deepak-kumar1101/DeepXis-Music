/**
 * DeepXis Music Bot - /play Command
 * Supports track names, artist names, Spotify URLs (track, album, playlist), and web URLs.
 * Implements interactive search dropdown for multiple results (Option 1).
 */

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { validateVoice } = require('../../utils/validators');
const { resolveQuery } = require('../../player/resolver');
const queueManager = require('../../player/queue');
const { createLoadingEmbed, createTrackAddedEmbed, createPlaylistAddedEmbed, createErrorEmbed } = require('../../ui/embeds');
const { enforceMusicChannel } = require('../../config/permissions');
const config = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a track, album, playlist, or Spotify URL')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Track title, artist, or URL (Spotify supported)')
        .setRequired(true)
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    const voiceChannel = validateVoice(interaction, false);

    const query = interaction.options.getString('query', true);
    await interaction.deferReply();

    await interaction.editReply({
      embeds: [createLoadingEmbed(`Searching for: \`${query}\`...`)]
    });

    try {
      // 1. Resolve query via multi-source resolver (Spotify / Search)
      const resolved = await resolveQuery(query, interaction.user);

      // 2. Connect or retrieve voice queue
      const queue = await queueManager.createOrGetQueue(
        interaction.guild,
        voiceChannel,
        interaction.channel
      );

      // Case A: Playlist or Album (explicitly requested collection)
      if (resolved.playlist && resolved.tracks.length > 0) {
        queue.addTrack(resolved.tracks);
        if (!queue.isPlaying()) {
          await queue.node.play().catch(err => {
            logger.error('PlayCommand', `Failed to start playlist playback: ${err.message}`);
          });
        }

        return interaction.editReply({
          embeds: [createPlaylistAddedEmbed(resolved.playlist, resolved.tracks.length)],
          components: []
        });
      }

      // Case B: Single track URL or exactly 1 track returned
      if (resolved.type === 'spotify_track' || resolved.tracks.length === 1) {
        const track = resolved.tracks[0];
        queue.addTrack(track);

        if (!queue.isPlaying()) {
          await interaction.editReply({
            embeds: [createLoadingEmbed(`Loading **${track.title}** into voice...`)],
            components: []
          }).catch(() => {});

          await queue.node.play().catch(err => {
            logger.error('PlayCommand', `Failed to start track playback: ${err.message}`);
          });
          return;
        } else {
          return interaction.editReply({
            embeds: [createTrackAddedEmbed(track, queue.tracks.size)],
            components: []
          });
        }
      }

      // Case C: Multiple search results -> Option 1 (Interactive Dropdown Selection)
      const topTracks = resolved.tracks.slice(0, 10);

      const menuOptions = topTracks.map((t, idx) => {
        const title = t.title.length > 70 ? t.title.substring(0, 67) + '...' : t.title;
        const artist = (t.author || t.artist || 'Unknown').substring(0, 40);
        const duration = t.duration || '00:00';

        return new StringSelectMenuOptionBuilder()
          .setLabel(`${idx + 1}. ${title}`)
          .setDescription(`Artist: ${artist} | Duration: ${duration}`)
          .setValue(String(idx));
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_play_track')
        .setPlaceholder('Select which track you want to play...')
        .addOptions(menuOptions);

      const menuRow = new ActionRowBuilder().addComponents(selectMenu);

      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_play_top')
          .setLabel('Play Top Result (#1)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('btn_cancel_search')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      const searchEmbed = new EmbedBuilder()
        .setColor(config.ui.embedColor)
        .setAuthor({ name: `${config.ui.brandName} - Search Results` })
        .setDescription(`Found **${topTracks.length}** tracks for **"${query}"**.\nPlease select a track from the dropdown below:`)
        .setFooter({ text: `${config.ui.brandName} | Auto-plays #1 if no selection in 45s` });

      const response = await interaction.editReply({
        embeds: [searchEmbed],
        components: [menuRow, buttonRow]
      });

      try {
        const confirmation = await response.awaitMessageComponent({
          filter: i => i.user.id === interaction.user.id,
          time: 45000
        });

        if (confirmation.customId === 'btn_cancel_search') {
          return confirmation.update({
            embeds: [createErrorEmbed('Track selection was cancelled.')],
            components: []
          });
        }

        let selectedIndex = 0;
        if (confirmation.customId === 'select_play_track') {
          selectedIndex = parseInt(confirmation.values[0], 10);
        }

        const selectedTrack = topTracks[selectedIndex] || topTracks[0];

        // Immediately update the message with visual loading status and clear interactive buttons
        await confirmation.update({
          embeds: [createLoadingEmbed(`Queued **${selectedTrack.title}**\nConnecting and loading audio stream...`)],
          components: []
        }).catch(() => {});

        queue.addTrack(selectedTrack);

        if (!queue.isPlaying()) {
          await queue.node.play().catch(err => {
            logger.error('PlayCommand', `Playback start error: ${err.message}`);
          });
          return;
        } else {
          return interaction.editReply({
            embeds: [createTrackAddedEmbed(selectedTrack, queue.tracks.size)],
            components: []
          }).catch(() => {});
        }
      } catch {
        // Timeout (45 seconds without selection) -> Automatically play Top Result #1
        const defaultTrack = topTracks[0];
        queue.addTrack(defaultTrack);

        await interaction.editReply({
          embeds: [createLoadingEmbed(`Selection timed out. Auto-playing top result: **${defaultTrack.title}**...`)],
          components: []
        }).catch(() => {});

        if (!queue.isPlaying()) {
          await queue.node.play().catch(err => {
            logger.error('PlayCommand', `Auto-play top track error: ${err.message}`);
          });
          return;
        } else {
          return interaction.editReply({
            embeds: [createTrackAddedEmbed(defaultTrack, queue.tracks.size)],
            components: []
          }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error('Command:Play', `Failed to play query "${query}"`, err);
      throw err;
    }
  }
};
