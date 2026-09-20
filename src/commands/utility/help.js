/**
 * DeepXis Music Bot - /help Command
 * Categorized command list with ZERO Unicode emojis.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display available commands and guide'),

  category: 'utility',

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Command Guide` })
      .setTitle('DeepXis Music Bot Commands')
      .setDescription(
        `Welcome to **${config.ui.brandName}**, a high-fidelity Discord music platform with Spotify metadata integration and persistent guild settings.\n\n` +
        `**[Playback Commands]**\n` +
        `• \`/play <query>\` - Play a track, album, playlist, or Spotify URL\n` +
        `• \`/pause\` - Pause current playback\n` +
        `• \`/resume\` - Resume paused playback\n` +
        `• \`/skip\` - Skip to the next track\n` +
        `• \`/previous\` - Replay the previous track from history\n` +
        `• \`/stop\` - Stop playback and clear the queue\n` +
        `• \`/disconnect\` - Disconnect bot from the voice channel\n\n` +
        `**[Queue Commands]**\n` +
        `• \`/queue [page]\` - View server queue with pagination\n` +
        `• \`/clear\` - Clear all upcoming songs from queue\n` +
        `• \`/remove <position>\` - Remove a specific track\n` +
        `• \`/move <from> <to>\` - Reorder tracks in queue\n\n` +
        `**[Controls & Information]**\n` +
        `• \`/volume [0-100]\` - Set or view playback volume\n` +
        `• \`/seek <time>\` - Jump to a timestamp (e.g. 1:30)\n` +
        `• \`/loop <off|track|queue|autoplay>\` - Configure loop mode\n` +
        `• \`/shuffle\` - Randomize remaining queue\n` +
        `• \`/nowplaying\` - Show the interactive player dashboard\n` +
        `• \`/lyrics [song]\` - Retrieve synchronized lyrics\n\n` +
        `**[Server Administration]**\n` +
        `• \`/setdj [role]\` - Configure or clear the DJ role\n` +
        `• \`/setchannel [channel]\` - Restrict bot to a designated text channel\n` +
        `• \`/setvolume <1-100>\` - Set default guild starting volume\n\n` +
        `**[Utility]**\n` +
        `• \`/ping\` - Check latency\n` +
        `• \`/status\` - View bot runtime and system statistics\n` +
        `• \`/invite\` - Get the bot invite link\n` +
        `• \`/support\` - Support server & documentation link`
      )
      .setFooter({ text: `${config.ui.brandName} | Modern Music Streaming` });

    return interaction.reply({ embeds: [embed] });
  }
};
