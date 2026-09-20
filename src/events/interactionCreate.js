/**
 * DeepXis Music Bot - InteractionCreate Event Handler
 * Routes slash commands, player control buttons, and select menus.
 */

const queueManager = require('../player/queue');
const { validateVoice, validatePlayer } = require('../utils/validators');
const { enforceDJ } = require('../config/permissions');
const { createErrorEmbed, createSuccessEmbed, createQueueEmbed } = require('../ui/embeds');
const { createPlayerPanel } = require('../ui/playerPanel');
const { createQueueControls } = require('../ui/buttons');
const { MusicError, ERROR_MESSAGES } = require('../utils/errors');
const logger = require('../utils/logger');

const LoopMode = Object.freeze({
  OFF: 0,
  TRACK: 1,
  QUEUE: 2,
  AUTOPLAY: 3
});

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn('Interaction', `Unknown command attempted: /${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (err) {
        if (err instanceof MusicError) {
          const embed = createErrorEmbed(err.userMessage);
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed], components: [] }).catch(e => {
              logger.error('Interaction', 'Failed to edit reply for MusicError', e);
            });
          } else {
            await interaction.reply({ embeds: [embed], ephemeral: true }).catch(e => {
              logger.error('Interaction', 'Failed to reply for MusicError', e);
            });
          }
        } else {
          logger.error('Interaction', `Command execution error: /${interaction.commandName}`, err);
          const embed = createErrorEmbed('An unexpected error occurred while processing this command.');
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed], components: [] }).catch(e => {
              logger.error('Interaction', 'Failed to edit reply after command error', e);
            });
          } else {
            await interaction.reply({ embeds: [embed], ephemeral: true }).catch(e => {
              logger.error('Interaction', 'Failed to reply after command error', e);
            });
          }
        }
      }
      return;
    }

    // 2. Handle Button Interactions
    if (interaction.isButton()) {
      try {
        await handleButtonInteraction(interaction);
      } catch (err) {
        if (err instanceof MusicError) {
          await interaction.reply({
            embeds: [createErrorEmbed(err.userMessage)],
            ephemeral: true
          }).catch(() => {});
        } else {
          logger.error('Interaction', `Button interaction error: ${interaction.customId}`, err);
          await interaction.reply({
            embeds: [createErrorEmbed('An error occurred executing this button action.')],
            ephemeral: true
          }).catch(() => {});
        }
      }
      return;
    }

    // 3. Handle Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
      try {
        await handleSelectMenuInteraction(interaction);
      } catch (err) {
        if (err instanceof MusicError) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [createErrorEmbed(err.userMessage)], components: [] }).catch(() => {});
          } else {
            await interaction.reply({ embeds: [createErrorEmbed(err.userMessage)], ephemeral: true }).catch(() => {});
          }
        } else {
          logger.error('Interaction', `Select menu error: ${interaction.customId}`, err);
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [createErrorEmbed('An error occurred executing this action.')], components: [] }).catch(() => {});
          } else {
            await interaction.reply({ embeds: [createErrorEmbed('An error occurred executing this action.')], ephemeral: true }).catch(() => {});
          }
        }
      }
      return;
    }
  }
};

/**
 * Handle player dashboard and queue button clicks
 * @param {import('discord.js').ButtonInteraction} interaction 
 */
async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;

  // Let local play command component collector handle search selection buttons
  if (customId === 'btn_play_top' || customId === 'btn_cancel_search') {
    return;
  }

  const queue = queueManager.getQueue(interaction.guildId);
  const trackCount = Array.isArray(queue?.tracks) ? queue.tracks.length : (queue?.tracks?.size || 0);

  // Queue Pagination Buttons
  if (customId.startsWith('btn_queue_prev_') || customId.startsWith('btn_queue_next_')) {
    const page = parseInt(customId.split('_')[3], 10);
    const embed = createQueueEmbed(queue, page);
    const totalPages = Math.max(1, Math.ceil(trackCount / 10));
    const components = createQueueControls(page, totalPages);

    return interaction.update({
      embeds: [embed],
      components: trackCount > 0 ? components : []
    });
  }

  if (customId === 'btn_queue_refresh') {
    const embed = createQueueEmbed(queue, 1);
    const totalPages = Math.max(1, Math.ceil(trackCount / 10));
    const components = createQueueControls(1, totalPages);

    return interaction.update({
      embeds: [embed],
      components: trackCount > 0 ? components : []
    });
  }

  if (customId === 'btn_queue_close') {
    return interaction.message.delete().catch(() => {});
  }

  // Quick volume selection buttons
  if (customId.startsWith('btn_vol_')) {
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);
    validatePlayer(queue);
    const vol = parseInt(customId.replace('btn_vol_', ''), 10);
    queue.setVolume(vol);
    const guildService = require('../services/guildService');
    await guildService.setVolume(interaction.guildId, vol);

    return interaction.update({
      embeds: [createSuccessEmbed(`Playback volume adjusted to **${vol}%**`)],
      components: []
    });
  }

  // Player Dashboard Controls: Require user in same voice channel & DJ permissions
  validateVoice(interaction, true);
  await enforceDJ(interaction.member, interaction.guildId);
  validatePlayer(queue);

  switch (customId) {
    case 'btn_player_toggle': {
      if (queue.state === 'Paused') {
        queue.resume();
      } else {
        queue.pause();
      }
      const panel = await createPlayerPanel(queue.currentTrack, queue, queue.isPlaying());
      return interaction.update(panel);
    }

    case 'btn_player_skip': {
      const skippedTitle = queue.currentTrack?.title;
      await queue.skip();
      return interaction.reply({
        embeds: [createSuccessEmbed(`Skipped: **${skippedTitle || 'Current track'}**`)],
        ephemeral: true
      });
    }

    case 'btn_player_previous': {
      const historyLen = Array.isArray(queue.history) ? queue.history.length : (queue.history?.tracks?.size || 0);
      if (historyLen === 0) {
        throw new MusicError('There are no previous tracks in history to play.');
      }
      await queue.previous();
      return interaction.reply({
        embeds: [createSuccessEmbed('Replaying previous track.')],
        ephemeral: true
      });
    }

    case 'btn_player_shuffle': {
      if (trackCount < 2) {
        throw new MusicError('At least 2 tracks are required to shuffle.');
      }
      queue.shuffle();
      return interaction.reply({
        embeds: [createSuccessEmbed(`Shuffled ${trackCount} tracks in the queue.`)],
        ephemeral: true
      });
    }

    case 'btn_player_loop': {
      let nextMode;
      let modeText;
      switch (queue.loopMode) {
        case LoopMode.OFF:
          nextMode = LoopMode.TRACK;
          modeText = 'Track';
          break;
        case LoopMode.TRACK:
          nextMode = LoopMode.QUEUE;
          modeText = 'Queue';
          break;
        case LoopMode.QUEUE:
          nextMode = LoopMode.AUTOPLAY;
          modeText = 'Autoplay';
          break;
        default:
          nextMode = LoopMode.OFF;
          modeText = 'Off';
          break;
      }
      queue.setLoopMode(nextMode);
      const panel = await createPlayerPanel(queue.currentTrack, queue, queue.isPlaying());
      await interaction.update(panel);
      return interaction.followUp({
        embeds: [createSuccessEmbed(`Loop mode set to: **${modeText}**`)],
        ephemeral: true
      });
    }

    case 'btn_player_queue': {
      const embed = createQueueEmbed(queue, 1);
      const totalPages = Math.max(1, Math.ceil(trackCount / 10));
      const components = createQueueControls(1, totalPages);
      return interaction.reply({
        embeds: [embed],
        components: trackCount > 0 ? components : [],
        ephemeral: true
      });
    }

    case 'btn_player_volume': {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const volRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_vol_25').setLabel('25%').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_vol_50').setLabel('50%').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_vol_75').setLabel('75%').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_vol_100').setLabel('100%').setStyle(ButtonStyle.Primary)
      );
      return interaction.reply({
        embeds: [createSuccessEmbed(`Current volume is **${queue.volume || 80}%**. Choose a volume level:`)],
        components: [volRow],
        ephemeral: true
      });
    }

    case 'btn_vol_25':
    case 'btn_vol_50':
    case 'btn_vol_75':
    case 'btn_vol_100': {
      const vol = parseInt(customId.replace('btn_vol_', ''), 10);
      queue.setVolume(vol);
      const guildService = require('../services/guildService');
      await guildService.setVolume(interaction.guildId, vol);

      if (queue.lastPanelMessage && queue.currentTrack) {
        try {
          const panel = await createPlayerPanel(queue.currentTrack, queue, queue.isPlaying());
          await queue.lastPanelMessage.edit(panel);
        } catch (e) {
          // Ignored if message deleted
        }
      }

      return interaction.reply({
        embeds: [createSuccessEmbed(`Volume set to **${vol}%** and player card updated.`)],
        ephemeral: true
      });
    }

    case 'btn_player_stop': {
      await queue.stop();
      return interaction.reply({
        embeds: [createSuccessEmbed('Playback stopped and queue cleared.')],
        ephemeral: true
      });
    }

    default:
      return interaction.reply({
        embeds: [createErrorEmbed('Unknown button interaction.')],
        ephemeral: true
      });
  }
}

/**
 * Handle select menu choices (e.g. Spotify playlist selection)
 * @param {import('discord.js').StringSelectMenuInteraction} interaction 
 */
async function handleSelectMenuInteraction(interaction) {
  const customId = interaction.customId;

  // Let local play command component collector handle track search menu
  if (customId === 'select_play_track') {
    return;
  }

  if (customId === 'select_spotify_playlist') {
    const voiceChannel = validateVoice(interaction, false);
    const playlistId = interaction.values[0];
    const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;

    const { createLoadingEmbed, createPlaylistAddedEmbed, createErrorEmbed } = require('../ui/embeds');
    const { resolveQuery } = require('../player/resolver');

    await interaction.update({
      embeds: [createLoadingEmbed('Resolving Spotify playlist tracks...')],
      components: []
    });

    const resolved = await resolveQuery(playlistUrl, interaction.user);
    if (!resolved || !resolved.tracks || resolved.tracks.length === 0) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Could not resolve playable audio tracks for the selected playlist.')]
      });
    }

    const queue = await queueManager.createOrGetQueue(
      interaction.guild,
      voiceChannel,
      interaction.channel
    );

    queue.addTrack(resolved.tracks);

    if (!queue.isPlaying()) {
      await queue.play().catch(e => {
        logger.error('Interaction', `Playback start failed for playlist ${playlistId}`, e);
      });
    }

    return await interaction.editReply({
      embeds: [createPlaylistAddedEmbed(resolved.playlist || { title: 'Spotify Playlist' }, resolved.tracks.length)]
    });
  }
}
