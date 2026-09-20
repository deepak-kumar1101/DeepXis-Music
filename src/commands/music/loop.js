/**
 * DeepXis Music Bot - /loop Command
 */

const { SlashCommandBuilder } = require('discord.js');
const { validateVoice, validatePlayer } = require('../../utils/validators');
const queueManager = require('../../player/queue');
const { enforceDJ, enforceMusicChannel } = require('../../config/permissions');
const { createSuccessEmbed } = require('../../ui/embeds');

const LoopMode = Object.freeze({
  OFF: 0,
  TRACK: 1,
  QUEUE: 2,
  AUTOPLAY: 3
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set playback loop mode')
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' },
          { name: 'Autoplay', value: 'autoplay' }
        )
    ),

  category: 'music',

  async execute(interaction) {
    await enforceMusicChannel(interaction);
    validateVoice(interaction, true);
    await enforceDJ(interaction.member, interaction.guildId);

    const queue = validatePlayer(queueManager.getQueue(interaction.guildId));
    const mode = interaction.options.getString('mode', true);

    let repeatMode = LoopMode.OFF;
    let modeText = 'Off';

    switch (mode) {
      case 'track':
        repeatMode = LoopMode.TRACK;
        modeText = 'Track (repeating current track)';
        break;
      case 'queue':
        repeatMode = LoopMode.QUEUE;
        modeText = 'Queue (repeating entire queue)';
        break;
      case 'autoplay':
        repeatMode = LoopMode.AUTOPLAY;
        modeText = 'Autoplay (continuous recommendations)';
        break;
      default:
        repeatMode = LoopMode.OFF;
        modeText = 'Off';
        break;
    }

    queue.setLoopMode(repeatMode);

    return interaction.reply({
      embeds: [createSuccessEmbed(`Loop mode set to: **${modeText}**`)]
    });
  }
};
