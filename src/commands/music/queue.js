/**
 * DeepXis Music Bot - /queue Command
 */

const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../../player/queue');
const { createQueueEmbed } = require('../../ui/embeds');
const { createQueueControls } = require('../../ui/buttons');
const { enforceMusicChannel } = require('../../config/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Display the current music queue')
    .addIntegerOption(opt =>
      opt.setName('page')
        .setDescription('Page number')
        .setMinValue(1)
        .setRequired(false)
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    const queue = queueManager.getQueue(interaction.guildId);
    const page = interaction.options.getInteger('page') || 1;

    const trackCount = Array.isArray(queue?.tracks) ? queue.tracks.length : (queue?.tracks?.size || 0);
    const embed = createQueueEmbed(queue, page);
    const totalPages = Math.max(1, Math.ceil(trackCount / 10));
    const components = createQueueControls(page, totalPages);

    return interaction.reply({
      embeds: [embed],
      components: trackCount > 0 ? components : []
    });
  }
};
