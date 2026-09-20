/**
 * DeepXis Music Bot - /volume Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');
const { MusicError, ERROR_MESSAGES } = require('../../utils/errors');
const guildService = require('../../services/guildService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set or check playback volume')
    .addIntegerOption(opt =>
      opt.setName('level')
        .setDescription('Volume level (0-100)')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(false)
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));

    const level = interaction.options.getInteger('level');

    // If level is not specified, return current volume
    if (level === null) {
      return interaction.reply({
        embeds: [createSuccessEmbed(`Current volume is **${queue.volume || 80}%**.`)]
      });
    }

    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    if (level < 0 || level > 100) {
      throw new MusicError(ERROR_MESSAGES.INVALID_VOLUME);
    }

    queue.setVolume(level);
    await guildService.setVolume(interaction.guildId, level);

    // Edit the active player dashboard instantly so the volume slider updates immediately
    if (queue.lastPanelMessage && queue.currentTrack) {
      try {
        const { createPlayerPanel } = require('../../ui/playerPanel');
        const panel = await createPlayerPanel(queue.currentTrack, queue, queue.isPlaying());
        await queue.lastPanelMessage.edit(panel);
      } catch (e) {
        // Ignored if message deleted
      }
    }

    return interaction.reply({
      embeds: [createSuccessEmbed(`Volume set to **${level}%**.`)]
    });
  }
};
