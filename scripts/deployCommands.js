/**
 * DeepXis Music Bot - Slash Command Deployment Script
 * Deploys all slash commands globally and directly to active guilds for instant availability.
 */

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('../src/config/config');
const logger = require('../src/utils/logger');

async function deploy() {
  const token = config.discord.token;
  const clientId = config.discord.clientId;

  if (!token || !clientId) {
    logger.error('Deploy', 'Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in configuration.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  // 1. Collect all command data from src/commands
  const commands = [];
  const commandsPath = path.join(__dirname, '../src/commands');

  function collect(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collect(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          const cmd = require(fullPath);
          if (cmd.data && typeof cmd.execute === 'function') {
            commands.push(cmd.data.toJSON());
          }
        } catch (err) {
          logger.error('Deploy', `Failed to read command at ${fullPath}:`, err);
        }
      }
    }
  }

  collect(commandsPath);
  logger.info('Deploy', `Discovered ${commands.length} slash commands.`);

  try {
    // 2. Register globally
    logger.info('Deploy', `Registering ${commands.length} commands globally...`);
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    logger.info('Deploy', 'Successfully registered commands globally.');

    // 3. Clear any legacy guild-specific commands to prevent duplicates
    try {
      const guilds = await rest.get(Routes.userGuilds());
      for (const guild of guilds) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(clientId, guild.id),
            { body: [] }
          );
        } catch (gErr) {
          logger.warn('Deploy', `Could not clear guild commands for ${guild.name}: ${gErr.message}`);
        }
      }
      logger.info('Deploy', 'Cleared any guild-level duplicates.');
    } catch (gListErr) {
      logger.warn('Deploy', `Could not fetch guild list: ${gListErr.message}`);
    }

    logger.info('Deploy', 'Command deployment completed successfully!');
  } catch (err) {
    logger.error('Deploy', 'Command deployment failed:', err);
    process.exit(1);
  }
}

deploy();
