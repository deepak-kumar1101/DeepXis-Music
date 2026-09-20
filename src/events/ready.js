/**
 * DeepXis Music Bot - Ready Event Handler
 * Sets bot presence and registers application slash commands with Discord API.
 */

const { ActivityType, REST, Routes } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info('Client', `DeepXis Music Bot logged in as ${client.user.tag} (ID: ${client.user.id})`);
    logger.info('Client', `Currently serving in ${client.guilds.cache.size} guilds.`);

    // Set custom activity presence
    client.user.setPresence({
      activities: [{
        name: 'DeepXis Music | /play',
        type: ActivityType.Listening
      }],
      status: 'online'
    });

    // Register Slash Commands via Discord REST API
    try {
      const rest = new REST({ version: '10' }).setToken(config.discord.token);
      const commandData = client.commands.map(cmd => cmd.data.toJSON());

      logger.info('Commands', `Registering ${commandData.length} application slash commands globally...`);

      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commandData }
      );
      logger.info('Commands', 'Successfully registered all application commands globally.');
    } catch (err) {
      logger.error('Commands', 'Failed to register application slash commands', err);
    }
  }
};
