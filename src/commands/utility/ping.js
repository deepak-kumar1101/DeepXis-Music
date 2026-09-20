/**
 * DeepXis Music Bot - /ping Command
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot websocket latency and responsiveness'),

  category: 'utility',

  async execute(interaction, client) {
    const sent = await interaction.reply({
      content: 'Measuring latency...',
      fetchReply: true
    });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Network Diagnostics` })
      .setDescription(
        `**Roundtrip Latency:** \`${roundtrip}ms\`\n` +
        `**Websocket Heartbeat:** \`${wsPing}ms\``
      )
      .setFooter({ text: config.ui.brandName })
      .setTimestamp();

    return interaction.editReply({
      content: null,
      embeds: [embed]
    });
  }
};
