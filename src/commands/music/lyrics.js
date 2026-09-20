/**
 * DeepXis Music Bot - /lyrics Command
 * Fetches lyrics for the current track or a specified query.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const config = require('../../config/config');
const { enforceMusicChannel } = require('../../config/permissions');
const { createErrorEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Display lyrics for the current or specified song')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Song title to search lyrics for')
        .setRequired(false)
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    const query = interaction.options.getString('query');

    let songTitle = query;
    if (!songTitle) {
      const queue = validatePlayer(queueManager.getQueue(interaction.guildId));
      songTitle = queue.currentTrack?.title;
    }

    await interaction.deferReply();

    // Clean up extraneous tags in song title (e.g. Official Video, feat, etc.)
    const cleanTitle = songTitle
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/ft\..*|feat\..*/i, '')
      .trim();

    try {
      // Use public lyrics API endpoint
      const response = await fetch(`https://some-random-api.com/lyrics?title=${encodeURIComponent(cleanTitle)}`);
      if (!response.ok) {
        return interaction.editReply({
          embeds: [createErrorEmbed(`No lyrics found for: **${cleanTitle}**`)]
        });
      }

      const data = await response.json();
      if (!data || !data.lyrics) {
        return interaction.editReply({
          embeds: [createErrorEmbed(`No lyrics found for: **${cleanTitle}**`)]
        });
      }

      const lyrics = data.lyrics.length > 4000 
        ? data.lyrics.substring(0, 3990) + '...'
        : data.lyrics;

      const embed = new EmbedBuilder()
        .setColor(config.ui.embedColor)
        .setAuthor({ name: `${config.ui.brandName} - Lyrics` })
        .setTitle(`${data.title} - ${data.author}`)
        .setDescription(lyrics)
        .setThumbnail(data.thumbnail?.genius || null)
        .setFooter({ text: `${config.ui.brandName} | Lyrics via Genius` });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({
        embeds: [createErrorEmbed(`Could not retrieve lyrics for: **${cleanTitle}**`)]
      });
    }
  }
};
