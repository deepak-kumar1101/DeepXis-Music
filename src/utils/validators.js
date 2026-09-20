/**
 * DeepXis Music Bot - Voice and Interaction Validators
 */

const { PermissionsBitField } = require('discord.js');
const { MusicError, ERROR_MESSAGES } = require('./errors');

/**
 * Validate that the user and bot meet voice channel criteria
 * @param {import('discord.js').ChatInputCommandInteraction|import('discord.js').ButtonInteraction} interaction 
 * @param {boolean} requireSameChannel Whether user must be in the bot's current voice channel
 * @returns {import('discord.js').VoiceBasedChannel} The voice channel
 */
function validateVoice(interaction, requireSameChannel = true) {
  const member = interaction.member;
  if (!member || !member.voice || !member.voice.channel) {
    throw new MusicError(ERROR_MESSAGES.NOT_IN_VOICE);
  }

  const voiceChannel = member.voice.channel;
  const botMember = interaction.guild.members.me;

  // Verify Bot Permissions in the target channel
  const permissions = voiceChannel.permissionsFor(botMember);
  if (!permissions.has(PermissionsBitField.Flags.Connect)) {
    throw new MusicError(ERROR_MESSAGES.CANNOT_JOIN);
  }
  if (!permissions.has(PermissionsBitField.Flags.Speak)) {
    throw new MusicError(ERROR_MESSAGES.CANNOT_SPEAK);
  }

  // If bot is already in a channel in this guild, verify they are together
  if (requireSameChannel && botMember.voice.channelId && botMember.voice.channelId !== voiceChannel.id) {
    throw new MusicError(ERROR_MESSAGES.DIFFERENT_VOICE);
  }

  return voiceChannel;
}

/**
 * Validate that an active queue and currently playing track exist
 * @param {import('discord-player').GuildQueue} queue 
 * @returns {import('discord-player').GuildQueue}
 */
function validatePlayer(queue) {
  if (!queue) {
    throw new MusicError(ERROR_MESSAGES.NO_PLAYER);
  }
  if (!queue.isPlaying() || !queue.currentTrack) {
    throw new MusicError(ERROR_MESSAGES.NOT_PLAYING);
  }
  return queue;
}

module.exports = {
  validateVoice,
  validatePlayer
};
