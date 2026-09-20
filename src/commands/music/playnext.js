/**
 * DeepXis Music Bot - /playnext Command
 * Enqueues a track directly at the front of the queue to play next.
 */

const { SlashCommandBuilder } = require('discord.js');
const { resolveQuery } = require('../../player/resolver');
const queueManager = require('../../player/queue');
const { validateVoice } = require('../../utils/validators');
const { enforceMusicChannel } = require('../../config/permissions');
const { createTrackAddedEmbed, createErrorEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playnext')
    .setDescription('Add a song to the very front of the queue to play next')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Song title or URL')
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

    let resolved;
    try {
      resolved = await resolveQuery(query, interaction.user);
    } catch (err) {
      return await interaction.editReply({
        embeds: [createErrorEmbed(`Could not resolve track: ${err.message}`)]
      });
    }

    if (!resolved || !resolved.tracks || resolved.tracks.length === 0) {
      return await interaction.editReply({
        embeds: [createErrorEmbed(`No playable tracks found for "${query}".`)]
      });
    }

    const queue = await queueManager.createOrGetQueue(
      interaction.guild,
      voiceChannel,
      interaction.channel
    );

    const firstTrack = resolved.tracks[0];
    queue.tracks.unshift(firstTrack);

    await interaction.editReply({
      embeds: [createTrackAddedEmbed(firstTrack, 1)]
    });

    if (!queue.isPlaying()) {
      await queue.play();
    }
  }
};
