/**
 * DeepXis Music Bot - DeepXis Branded Embed Builders
 * Strictly NO Unicode emojis.
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');
const { getIcon } = require('./emoji');
const { getAsset } = require('../config/assets');
const { createProgressBar } = require('../utils/progressBar');
const { formatDuration } = require('../utils/formatTime');

/**
 * Loop mode numeric strings to clean text
 */
function getLoopModeText(mode) {
  switch (mode) {
    case 1: return 'Track';
    case 2: return 'Queue';
    case 3: return 'Autoplay';
    default: return 'Off';
  }
}

const embeds = {
  /**
   * Main DeepXis Player Panel Embed
   * @param {object} track 
   * @param {import('discord-player').GuildQueue} queue 
   * @param {boolean} isPlaying 
   */
  createPlayerEmbed(track, queue, isPlaying = true, cardImageName = null) {
    const artist = track.author || track.artist || 'Unknown Artist';
    const duration = track.duration || formatDuration(track.durationMS) || '00:00';

    const titleAsset = getAsset('title');
    const dividerAsset = getAsset('divider');
    const songAsset = getAsset('song');
    const authorAsset = getAsset('author');
    const durationAsset = getAsset('duration');
    const requesterAsset = getAsset('requester');

    // Title emoji: use dedicated title asset if configured, else fall back to song asset
    const titlePrefix = (titleAsset.type === 'discord_emoji' ? `${titleAsset.value} ` : '') ||
                        (songAsset.type === 'discord_emoji' ? `${songAsset.value} ` : '');

    const songPrefix = songAsset.type === 'discord_emoji' ? `${songAsset.value} ` : '';
    const authorPrefix = authorAsset.type === 'discord_emoji' ? `${authorAsset.value} ` : '';
    const durationPrefix = durationAsset.type === 'discord_emoji' ? `${durationAsset.value} ` : '';
    const requesterPrefix = requesterAsset.type === 'discord_emoji' ? `${requesterAsset.value} ` : '';

    const dividerText = dividerAsset.value ? `${dividerAsset.value}\n\n` : '';

    const requesterMention = track.requestedBy?.id ? `<@${track.requestedBy.id}>` : (track.requestedBy?.username || 'User');
    const nowPlayingTitle = `${titlePrefix}Now Playing.........`.trim();

    const infoDescription = 
      `${dividerText}` +
      `${songPrefix}**__Song__ :** ${track.title}\n` +
      `${authorPrefix}**__Author__ :** ${artist}\n` +
      `${durationPrefix}**__Duration__ :** ${duration}\n` +
      `${requesterPrefix}**__Requester__ :** ${requesterMention}\n\n` +
      `*Enjoy Your Music with DXM !!*`;

    // When card image is attached, return [cardEmbed] representing the full iOS lockscreen card!
    if (cardImageName) {
      const cardEmbed = new EmbedBuilder()
        .setColor(config.ui.embedColor)
        .setTitle(nowPlayingTitle)
        .setImage(`attachment://${cardImageName}`);

      return [cardEmbed];
    }

    // Fallback single embed when no card image attachment
    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setTitle(nowPlayingTitle)
      .setDescription(infoDescription);

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    return embed;
  },

  /**
   * Track Added Notification Embed
   * @param {object} track 
   * @param {number} position 
   */
  createTrackAddedEmbed(track, position = null) {
    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Track Queued` })
      .setTitle(track.title)
      .setURL(track.url || null)
      .setDescription(
        `**Artist:** ${track.author || track.artist || 'Unknown'}\n` +
        `**Duration:** ${track.duration || 'Unknown'}\n` +
        (position ? `**Position in Queue:** #${position}` : '')
      );

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    embed.setFooter({ text: config.ui.brandName });
    return embed;
  },

  /**
   * Playlist Added Notification Embed
   * @param {object} playlist 
   * @param {number} count 
   */
  createPlaylistAddedEmbed(playlist, count) {
    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Playlist Queued` })
      .setTitle(playlist.title || playlist.name || 'Playlist')
      .setURL(playlist.url || null)
      .setDescription(
        `**Tracks Added:** ${count}\n` +
        (playlist.author?.name ? `**Creator:** ${playlist.author.name}\n` : '')
      );

    if (playlist.thumbnail) {
      embed.setThumbnail(playlist.thumbnail);
    }

    embed.setFooter({ text: config.ui.brandName });
    return embed;
  },

  /**
   * Paginated Queue Embed
   * @param {import('discord-player').GuildQueue} queue 
   * @param {number} page 1-indexed
   * @param {number} perPage 
   */
  createQueueEmbed(queue, page = 1, perPage = 10) {
    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Server Queue` });

    const tracksArray = queue?.tracks
      ? (Array.isArray(queue.tracks) ? queue.tracks : (typeof queue.tracks.toArray === 'function' ? queue.tracks.toArray() : []))
      : [];
    const queueLength = tracksArray.length;

    if (!queue || (!queue.currentTrack && queueLength === 0)) {
      embed.setDescription('The queue is currently empty.');
      embed.setFooter({ text: config.ui.brandName });
      return embed;
    }

    const current = queue.currentTrack;
    let description = '';

    if (current) {
      const currentDuration = current.duration || '00:00';
      const requester = current.requestedBy ? ` [${current.requestedBy.username}]` : '';
      description += `**NOW PLAYING:**\n` +
        `**${current.title}** - \`${currentDuration}\`${requester}\n\n` +
        `**UPCOMING:**\n`;
    }

    const totalPages = Math.max(1, Math.ceil(tracksArray.length / perPage));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const startIndex = (currentPage - 1) * perPage;
    const pageTracks = tracksArray.slice(startIndex, startIndex + perPage);

    if (pageTracks.length === 0 && tracksArray.length === 0) {
      description += 'No upcoming tracks in queue.\n';
    } else {
      pageTracks.forEach((t, i) => {
        const index = startIndex + i + 1;
        const dur = t.duration || '00:00';
        const req = t.requestedBy ? ` | Req: ${t.requestedBy.username}` : '';
        description += `\`${index}.\` **${t.title}** - \`${dur}\`${req}\n`;
      });
    }

    const totalDurationMs = tracksArray.reduce((acc, t) => acc + (t.durationMS || 0), current?.durationMS || 0);

    embed.setDescription(description);
    embed.setFooter({
      text: `${config.ui.brandName} | Page ${currentPage}/${totalPages} | Total Duration: ${formatDuration(totalDurationMs)}`
    });

    return embed;
  },

  /**
   * User-Friendly Error Embed (Strictly NO Unicode emojis)
   * @param {string} message 
   */
  createErrorEmbed(message) {
    const errorIcon = getIcon('error');
    return new EmbedBuilder()
      .setColor(config.ui.errorColor)
      .setAuthor({ name: `${config.ui.brandName} - Action Notice` })
      .setDescription(`${errorIcon} ${message}`)
      .setFooter({ text: config.ui.brandName });
  },

  /**
   * Informational Notice Embed (Brand colored, non-error)
   * @param {string} message 
   */
  createInfoEmbed(message) {
    return new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Action Notice` })
      .setDescription(message)
      .setFooter({ text: config.ui.brandName });
  },

  /**
   * Success Message Embed
   * @param {string} message 
   */
  createSuccessEmbed(message) {
    const successIcon = getIcon('success');
    return new EmbedBuilder()
      .setColor(config.ui.successColor)
      .setAuthor({ name: `${config.ui.brandName} - Success` })
      .setDescription(`${successIcon} ${message}`)
      .setFooter({ text: config.ui.brandName });
  },

  /**
   * Loading/Resolving Embed
   * @param {string} message 
   */
  createLoadingEmbed(message = 'Processing request...') {
    const loadingAsset = getAsset('loading');
    const loadingIcon = loadingAsset.displayText;
    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Working` })
      .setDescription(`${loadingIcon} ${message}`);

    if (loadingAsset.cdnUrl) {
      embed.setThumbnail(loadingAsset.cdnUrl);
    }

    return embed;
  },

  /**
   * Spotify Account Connect Embed
   * @param {string} authUrl 
   */
  createSpotifyConnectEmbed(authUrl) {
    const spotifyAsset = getAsset('spotify');
    const spotifyBanner = getAsset('spotify_banner');
    const spotifyGif = getAsset('spotify_gif');

    const spotifyEmoji = spotifyAsset.type === 'discord_emoji' ? `${spotifyAsset.value} ` : '';

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setAuthor({ name: `${config.ui.brandName} - Spotify Integration` })
      .setTitle(`${spotifyEmoji}Connect Your Spotify Account`)
      .setDescription(
        `Link your personal Spotify account to stream your private, public, and collaborative playlists directly through **${config.ui.brandName}**!\n\n` +
        `**What you get:**\n` +
        `• Instant access to all your saved & created Spotify playlists\n` +
        `• Interactive in-Discord playlist selector\n` +
        `• One-click queuing into your voice channel\n\n` +
        `**Instructions:**\n` +
        `1. Click the **Connect Spotify** button below.\n` +
        `2. Log in and authorize Spotify access in your browser.\n` +
        `3. If your browser shows "refused to connect" on 127.0.0.1, simply copy the URL from your browser address bar and run:\n` +
        `   \`/spotify code <paste_url>\`\n` +
        `4. Run \`/spotify playlists\` to select and play your playlists!\n\n` +
        `*Your account tokens are encrypted and used solely for playlist playback.*`
      )
      .setFooter({ text: `${config.ui.brandName} • Spotify Integration` });

    if (spotifyGif.cdnUrl) {
      embed.setThumbnail(spotifyGif.cdnUrl);
    } else if (spotifyAsset.cdnUrl) {
      embed.setThumbnail(spotifyAsset.cdnUrl);
    }

    if (spotifyBanner.cdnUrl) {
      embed.setImage(spotifyBanner.cdnUrl);
    }

    return embed;
  },

  /**
   * Spotify Playlists Browser Embed
   * @param {string} displayName 
   * @param {Array} playlists 
   */
  createSpotifyPlaylistsEmbed(displayName, playlists) {
    const spotifyAsset = getAsset('spotify');
    const spotifyGif = getAsset('spotify_gif');
    const spotifyEmoji = spotifyAsset.type === 'discord_emoji' ? `${spotifyAsset.value} ` : '';

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setAuthor({ name: `${config.ui.brandName} - Spotify Playlists` })
      .setTitle(`${spotifyEmoji}${displayName}'s Spotify Playlists`)
      .setDescription(
        playlists.length > 0
          ? `Found **${playlists.length}** playlist(s) linked to your account.\nChoose a playlist from the dropdown below to queue and play it!`
          : `You don't have any playlists in your Spotify library yet.`
      )
      .setFooter({ text: `${config.ui.brandName} • Spotify Integration` });

    if (spotifyGif.cdnUrl) {
      embed.setThumbnail(spotifyGif.cdnUrl);
    } else if (spotifyAsset.cdnUrl) {
      embed.setThumbnail(spotifyAsset.cdnUrl);
    }

    return embed;
  },

  /**
   * Spotify Status Embed
   * @param {object} status 
   */
  createSpotifyStatusEmbed(status) {
    const spotifyAsset = getAsset('spotify');
    const spotifyGif = getAsset('spotify_gif');
    const spotifyEmoji = spotifyAsset.type === 'discord_emoji' ? `${spotifyAsset.value} ` : '';

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setAuthor({ name: `${config.ui.brandName} - Spotify Connection Status` });

    if (!status || !status.connected) {
      embed.setTitle(`${spotifyEmoji}Spotify: Not Connected`)
        .setDescription(
          `You have not connected a Spotify account yet.\nUse \`/spotify login\` or \`!spotify login\` to connect your account.`
        );
    } else {
      embed.setTitle(`${spotifyEmoji}Spotify: Connected`)
        .setDescription(
          `**Account:** ${status.displayName || 'Spotify User'}\n` +
          `**Spotify ID:** \`${status.spotifyId}\`\n` +
          `**Status:** Active & Authorized\n\n` +
          `• Use \`/spotify playlists\` to select and stream a playlist.\n` +
          `• Use \`/spotify logout\` if you wish to unlink your account.`
        );
    }

    if (spotifyGif.cdnUrl) {
      embed.setThumbnail(spotifyGif.cdnUrl);
    } else if (spotifyAsset.cdnUrl) {
      embed.setThumbnail(spotifyAsset.cdnUrl);
    }

    embed.setFooter({ text: `${config.ui.brandName} • Spotify Integration` });
    return embed;
  }
};

function parseDuration(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}

module.exports = embeds;
