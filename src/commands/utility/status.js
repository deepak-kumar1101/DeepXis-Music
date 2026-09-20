/**
 * DeepXis Music Bot - /status Command
 * Displays live health and status metrics for Discord, Spotify, Database, and Player.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const db = require('../../database/connection');
const spotifyService = require('../../services/spotifyService');
const { getPlayer } = require('../../player/player');
const { formatDuration } = require('../../utils/formatTime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('View platform health, connection status, and player metrics'),

  category: 'utility',

  async execute(interaction, client) {
    const player = getPlayer();
    const activeQueues = player ? player.nodes.cache.size : 0;
    const uptime = formatDuration(client.uptime);
    const dbStatus = db.isAvailable() ? 'Connected (PostgreSQL)' : 'Fallback (In-Memory)';
    const spotifyStatus = spotifyService.isAvailable() ? 'Active (Spotify Web API)' : 'Disabled';
    const memoryUsedMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - System Status` })
      .setDescription(
        `**[Infrastructure Status]**\n` +
        `• **Bot State:** Online\n` +
        `• **Uptime:** \`${uptime}\`\n` +
        `• **Guilds Count:** \`${client.guilds.cache.size}\`\n` +
        `• **Active Players:** \`${activeQueues}\`\n` +
        `• **Memory Heap:** \`${memoryUsedMb} MB\`\n\n` +
        `**[Services]**\n` +
        `• **Database:** \`${dbStatus}\`\n` +
        `• **Spotify API:** \`${spotifyStatus}\`\n` +
        `• **Discord WebSocket:** \`${client.ws.ping}ms\``
      )
      .setFooter({ text: config.ui.brandName })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
