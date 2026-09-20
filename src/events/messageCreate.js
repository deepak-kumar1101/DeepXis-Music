/**
 * DeepXis Music Bot - MessageCreate Event Handler
 * Provides parallel text prefix command support alongside Discord Slash commands.
 */

const guildService = require('../services/guildService');
const { createErrorEmbed } = require('../ui/embeds');
const { MusicError } = require('../utils/errors');
const logger = require('../utils/logger');

// Common prefix aliases
const ALIASES = {
  p: 'play',
  s: 'skip',
  dc: 'disconnect',
  leave: 'disconnect',
  q: 'queue',
  np: 'nowplaying',
  vol: 'volume',
  stop: 'stop',
  pause: 'pause',
  resume: 'resume',
  sh: 'shuffle',
  loop: 'loop',
  sp: 'setprefix',
  spot: 'spotify'
};

/**
 * Adapter that mimics ChatInputCommandInteraction for prefix commands
 */
class PrefixInteractionAdapter {
  constructor(message, args, commandName, client) {
    this.message = message;
    this.args = args;
    this.client = client;
    this.guild = message.guild;
    this.guildId = message.guild.id;
    this.channel = message.channel;
    this.channelId = message.channel.id;
    this.member = message.member;
    this.user = message.author;
    this.commandName = commandName;
    this.deferred = false;
    this.replied = false;
    this.replyMessage = null;

    this.options = {
      getString: (name, required = false) => {
        if (this.args.length === 0) return null;
        const knownSubcommands = ['login', 'playlists', 'status', 'logout', 'code'];
        if (this.args.length > 1 && knownSubcommands.includes(this.args[0].toLowerCase())) {
          return this.args.slice(1).join(' ');
        }
        if (this.args.length === 1 && knownSubcommands.includes(this.args[0].toLowerCase())) {
          return null;
        }
        return this.args.join(' ');
      },
      getInteger: (name, required = false) => {
        const num = parseInt(this.args[0], 10);
        return isNaN(num) ? null : num;
      },
      getBoolean: (name, required = false) => {
        if (!this.args[0]) return null;
        const val = this.args[0].toLowerCase();
        return val === 'true' || val === 'enable' || val === 'on' || val === 'yes' || val === '1';
      },
      getRole: (name, required = false) => {
        return this.message.mentions.roles.first() ||
               this.message.guild.roles.cache.get(this.args[0]) || null;
      },
      getChannel: (name, required = false) => {
        return this.message.mentions.channels.first() ||
               this.message.guild.channels.cache.get(this.args[0]) || null;
      },
      getSubcommand: (required = false) => {
        return this.args[0] ? this.args[0].toLowerCase() : null;
      },
      getSubcommandGroup: () => null
    };
  }

  isChatInputCommand() {
    return true;
  }

  isButton() {
    return false;
  }

  async deferReply() {
    this.deferred = true;
    await this.channel.sendTyping().catch(() => {});
  }

  async editReply(payload) {
    if (this.replyMessage) {
      return await this.replyMessage.edit(payload);
    } else {
      this.replyMessage = await this.channel.send(payload);
      this.replied = true;
      return this.replyMessage;
    }
  }

  async reply(payload) {
    this.replied = true;
    this.replyMessage = await this.channel.send(payload);
    return this.replyMessage;
  }

  async deleteReply() {
    if (this.replyMessage) {
      await this.replyMessage.delete().catch(() => {});
      this.replyMessage = null;
    }
  }

  async followUp(payload) {
    return await this.channel.send(payload);
  }
}

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // 1. Fetch guild custom prefix
    const prefix = await guildService.getPrefix(message.guild.id);

    // 2. Check if message starts with prefix or bot mention
    const botMention = `<@${client.user.id}>`;
    const botMentionNick = `<@!${client.user.id}>`;

    let content = message.content.trim();
    let isPrefixed = false;

    if (content.startsWith(prefix)) {
      content = content.slice(prefix.length).trim();
      isPrefixed = true;
    } else if (content.startsWith(botMention)) {
      content = content.slice(botMention.length).trim();
      isPrefixed = true;
    } else if (content.startsWith(botMentionNick)) {
      content = content.slice(botMentionNick.length).trim();
      isPrefixed = true;
    }

    if (!isPrefixed || !content) return;

    // 3. Extract command and arguments
    const args = content.split(/\s+/);
    const rawCmd = args.shift().toLowerCase();
    const commandName = ALIASES[rawCmd] || rawCmd;

    const command = client.commands.get(commandName);
    if (!command) return;

    logger.debug('PrefixCommand', `Executing ${prefix}${commandName} by ${message.author.tag}`);

    // 4. Wrap in prefix adapter and execute
    const adapter = new PrefixInteractionAdapter(message, args, commandName, client);

    try {
      await command.execute(adapter, client);
    } catch (err) {
      if (err instanceof MusicError) {
        await message.channel.send({
          embeds: [createErrorEmbed(err.userMessage)]
        }).catch(() => {});
      } else {
        logger.error('PrefixCommand', `Command execution failed: ${prefix}${commandName}`, err);
        await message.channel.send({
          embeds: [createErrorEmbed('An unexpected error occurred while executing this command.')]
        }).catch(() => {});
      }
    }
  }
};
