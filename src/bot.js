/**
 * DeepXis Music Bot - Discord Client Bootstrapper
 * Configures intents, loads commands recursively, attaches events, and initializes player.
 */

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { initPlayer } = require('./player/player');
const { runMigrations } = require('./database/migrate');
const db = require('./database/connection');
const logger = require('./utils/logger');
const config = require('./config/config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

/**
 * Recursively load all commands from a directory and its subdirectories
 * @param {string} dir 
 */
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        const command = require(fullPath);
        if (command.data && typeof command.execute === 'function') {
          client.commands.set(command.data.name, command);
          logger.debug('Loader', `Loaded command: /${command.data.name}`);
        } else {
          logger.warn('Loader', `Command at ${fullPath} is missing required "data" or "execute" properties.`);
        }
      } catch (err) {
        logger.error('Loader', `Failed to load command file: ${fullPath}`, err);
      }
    }
  }
}

/**
 * Load all event listener modules from src/events
 * @param {string} dir 
 */
function loadEvents(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const event = require(fullPath);
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      logger.debug('Loader', `Attached event: ${event.name}`);
    } catch (err) {
      logger.error('Loader', `Failed to load event file: ${fullPath}`, err);
    }
  }
}

/**
 * Initialize all bot components and login
 */
async function initBot() {
  logger.info('Init', 'Initializing DeepXis Music Bot...');

  // 1. Validate configuration
  config.validate();

  // 2. Initialize Database and run migrations
  try {
    const dbConnected = await db.testConnection();
    if (dbConnected) {
      await runMigrations();
    }
  } catch (err) {
    logger.warn('Init', `Database initialization encountered a non-fatal error: ${err.message}`);
  }

  // 3. Load Commands
  const commandsPath = path.join(__dirname, 'commands');
  loadCommands(commandsPath);
  logger.info('Init', `Loaded ${client.commands.size} total slash commands.`);

  // 4. Load Events
  const eventsPath = path.join(__dirname, 'events');
  loadEvents(eventsPath);

  // 5. Initialize Discord Player
  await initPlayer(client);

  // 6. Login to Discord Gateway
  if (config.discord.token) {
    try {
      await client.login(config.discord.token);
    } catch (err) {
      logger.error('Client', 'Failed to login to Discord Gateway', err);
      throw err;
    }
  } else {
    logger.warn('Client', 'No DISCORD_TOKEN provided in .env. Bot gateway connection skipped.');
  }

  return client;
}

module.exports = {
  client,
  initBot
};
