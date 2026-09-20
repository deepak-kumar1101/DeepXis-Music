/**
 * DeepXis Music Bot - Discord Player Event Listeners
 * Handles playback lifecycle, UI updates, and history logging.
 */

const { createPlayerPanel } = require('../ui/playerPanel');
const { createTrackAddedEmbed, createPlaylistAddedEmbed, createErrorEmbed, createInfoEmbed } = require('../ui/embeds');
const historyQueries = require('../database/queries/historyQueries');
const logger = require('../utils/logger');

/**
 * Register all player event handlers
 * @param {import('discord-player').Player} player 
 */
function registerPlayerEvents(player) {
  // Track starts playing
  player.events.on('playerStart', async (queue, track) => {
    logger.info('Player', `Track started in guild ${queue.guild.id}: "${track.title}" by ${track.author}`);
    if (queue.metadata) {
      queue.metadata.lastTrackStartTime = Date.now();
    }

    // Log to PostgreSQL playback history
    if (track.requestedBy) {
      historyQueries.logPlayback(
        queue.guild.id,
        track.requestedBy.id,
        track.title,
        track.author || track.artist,
        track.raw?.source || 'web'
      ).catch(err => logger.error('History', 'Failed to record playback history', err));
    }

    // Send or update the player panel
    const channel = queue.metadata?.textChannel;
    if (!channel) return;

    try {
      const panel = await createPlayerPanel(track, queue, true);

      // Clean up previous panel message if possible
      if (queue.metadata.lastPanelMessage) {
        try {
          await queue.metadata.lastPanelMessage.delete();
        } catch {
          // Ignored if already deleted
        }
      }

      const msg = await channel.send(panel);
      queue.metadata.lastPanelMessage = msg;
    } catch (err) {
      logger.error('Player', 'Failed to send player panel', err);
    }
  });

  // Track finished
  player.events.on('playerFinish', (queue, track) => {
    const playedMs = Date.now() - (queue.metadata?.lastTrackStartTime || 0);
    logger.debug('Player', `Track finished: "${track.title}" in guild ${queue.guild.id} (played for ${(playedMs / 1000).toFixed(1)}s)`);
    if ((track.durationMS || 0) > 30000 && playedMs < 8000) {
      if (queue.metadata) {
        queue.metadata.lastPrematureEndTime = Date.now();
      }
      logger.warn('Player', `Track "${track.title}" ended prematurely in ${(playedMs / 1000).toFixed(1)}s`);
    }
  });

  // Single track added to an already active queue
  player.events.on('audioTrackAdd', (queue, track) => {
    if (queue.isPlaying()) {
      const channel = queue.metadata?.textChannel;
      if (channel) {
        const embed = createTrackAddedEmbed(track, queue.tracks.size);
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  });

  // Multiple tracks added (Playlist)
  player.events.on('audioTracksAdd', (queue, tracks) => {
    const channel = queue.metadata?.textChannel;
    if (channel) {
      const playlist = queue.currentTrack?.playlist || { name: 'Playlist' };
      const embed = createPlaylistAddedEmbed(playlist, tracks.length);
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  });

  // Voice channel becomes empty (stay connected 24/7 per configuration)
  player.events.on('emptyChannel', (queue) => {
    logger.debug('Player', `Voice channel empty in guild ${queue.guild.id}. Staying connected (24/7 mode active).`);
  });

  // Queue is exhausted
  player.events.on('emptyQueue', (queue) => {
    logger.info('Player', `Queue finished in guild ${queue.guild.id}.`);

    // Suppress emptyQueue notification if the queue ended immediately following an audio stream error or premature finish
    const timeSinceError = Date.now() - (queue.metadata?.lastStreamErrorTime || 0);
    const timeSincePremature = Date.now() - (queue.metadata?.lastPrematureEndTime || 0);
    if (timeSinceError < 5000 || timeSincePremature < 5000) {
      logger.debug('Player', 'Suppressed emptyQueue notification due to recent stream issue.');
      return;
    }

    const channel = queue.metadata?.textChannel;
    if (channel) {
      channel.send({
        embeds: [createInfoEmbed('Queue has finished. Use `/play` to start a new session.')]
      }).catch(() => {});
    }
  });

  // Queue-level error
  player.events.on('error', (queue, error) => {
    logger.error('Player', `Queue error in guild ${queue?.guild?.id}: ${error.message}`, error);
    const channel = queue?.metadata?.textChannel;
    if (channel) {
      channel.send({
        embeds: [createErrorEmbed('A playback queue error occurred. Please try your command again.')]
      }).catch(() => {});
    }
  });

  // Audio stream error
  player.events.on('playerError', (queue, error) => {
    logger.error('Player', `Audio player stream error in guild ${queue?.guild?.id}: ${error.message}`, error);
    if (queue?.metadata) {
      queue.metadata.lastStreamErrorTime = Date.now();
    }
    const channel = queue?.metadata?.textChannel;
    if (channel) {
      channel.send({
        embeds: [createErrorEmbed('The audio player encountered a streaming error while loading this track. Skipping to next...')]
      }).catch(() => {});
    }
  });
}

module.exports = {
  registerPlayerEvents
};
