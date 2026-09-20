/**
 * DeepXis Music Bot - /music-diagnose Command (Owner Only)
 * Executes full system self-tests across binaries, streams, and providers.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { runFullDiagnostics } = require('../../utils/diagnose');
const { createErrorEmbed } = require('../../ui/embeds');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music-diagnose')
    .setDescription('Run complete music engine self-tests (Owner Only)'),

  category: 'music',

  async execute(interaction) {
    if (interaction.user.id !== config.bot.ownerId) {
      return await interaction.reply({
        embeds: [createErrorEmbed('This diagnostic tool is restricted to the bot owner.')],
        ephemeral: true
      });
    }

    if (interaction.deferReply && !interaction.deferred) {
      await interaction.deferReply({ ephemeral: true });
    }

    const results = await runFullDiagnostics();
    const allPass = results.every(r => r.pass);

    const embed = new EmbedBuilder()
      .setColor(allPass ? config.ui.successColor : config.ui.errorColor)
      .setAuthor({ name: `${config.ui.brandName} - System Diagnostic Report` })
      .setTitle(allPass ? 'All Systems Operational (PASS)' : 'System Diagnostics Detected Issues (WARN/FAIL)')
      .setDescription(
        results.map(r => {
          const badge = r.pass ? '[PASS]' : '[FAIL]';
          return `**${badge} ${r.name}**\n\`${r.detail}\``;
        }).join('\n\n')
      )
      .setFooter({ text: `${config.ui.brandName} • Diagnostic Self-Test` })
      .setTimestamp();

    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply({ embeds: [embed] });
    } else {
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
