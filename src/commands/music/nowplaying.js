/**
 * DeepXis Music Bot - /nowplaying Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { createPlayerPanel } = require('../../ui/playerPanel');
const { enforceMusicChannel } = require('../../config/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Display the currently playing track dashboard'),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));

    const panel = await createPlayerPanel(queue.currentTrack, queue, queue.isPlaying());
    return interaction.reply(panel);
  }
};
