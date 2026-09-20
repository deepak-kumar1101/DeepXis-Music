/**
 * DeepXis Music Bot - /seek Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');
const { MusicError } = require('../../utils/errors');
const { parseTimeString, formatDuration } = require('../../utils/formatTime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek to a timestamp in the current track')
    .addStringOption(opt =>
      opt.setName('time')
        .setDescription('Timestamp (e.g. 1:30, 90s, 2m)')
        .setRequired(true)
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));
    const timeInput = interaction.options.getString('time', true);

    const seekMs = parseTimeString(timeInput);
    if (seekMs === null) {
      throw new MusicError('Invalid time format. Please use format such as `1:30` or `90s`.');
    }

    const currentTrack = queue.currentTrack;
    if (currentTrack?.durationMS && seekMs > currentTrack.durationMS) {
      throw new MusicError(`Cannot seek beyond track length (${currentTrack.duration || 'unknown'}).`);
    }

    if (interaction.deferReply && !interaction.deferred) {
      await interaction.deferReply();
    }

    const seekSec = Math.floor(seekMs / 1000);
    await queue.seek(seekSec);

    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply({
        embeds: [createSuccessEmbed(`Seeked to **${formatDuration(seekMs)}**.`)]
      });
    } else {
      return await interaction.reply({
        embeds: [createSuccessEmbed(`Seeked to **${formatDuration(seekMs)}**.`)]
      });
    }
  }
};
