/**
 * DeepXis Music Bot - Permission Management & DJ System
 */

const { PermissionsBitField } = require('discord.js');
const { MusicError, ERROR_MESSAGES } = require('../utils/errors');
const guildService = require('../services/guildService');

/**
 * Checks if a member has DJ authority or administrative override
 * @param {import('discord.js').GuildMember} member 
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
async function hasDJPermissions(member, guildId) {
  // Server Administrators always have DJ authority
  if (member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return true;
  }

  // Check if server has configured a DJ role
  const guildSettings = await guildService.getSettings(guildId);
  if (!guildSettings || !guildSettings.dj_role_id) {
    // If no DJ role is set, normal users in voice channel can control the bot
    return true;
  }

  // Check if member possesses the DJ role
  if (member.roles.cache.has(guildSettings.dj_role_id)) {
    return true;
  }

  // If user is alone in the voice channel with the bot, allow control
  const voiceChannel = member.voice.channel;
  if (voiceChannel) {
    const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);
    if (nonBotMembers.size === 1 && nonBotMembers.first().id === member.id) {
      return true;
    }
  }

  return false;
}

/**
 * Asserts DJ permission or throws MusicError
 * @param {import('discord.js').GuildMember} member 
 * @param {string} guildId 
 */
async function enforceDJ(member, guildId) {
  const allowed = await hasDJPermissions(member, guildId);
  if (!allowed) {
    throw new MusicError(ERROR_MESSAGES.DJ_ONLY);
  }
}

/**
 * Validates that an interaction was sent in the designated music channel (if configured)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
async function enforceMusicChannel(interaction) {
  // Admins can use commands anywhere
  if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return;
  }

  const guildSettings = await guildService.getSettings(interaction.guildId);
  if (guildSettings && guildSettings.music_channel_id) {
    if (interaction.channelId !== guildSettings.music_channel_id) {
      throw new MusicError(
        `${ERROR_MESSAGES.MUSIC_CHANNEL_ONLY} Please use <#${guildSettings.music_channel_id}>.`
      );
    }
  }
}

module.exports = {
  hasDJPermissions,
  enforceDJ,
  enforceMusicChannel
};
