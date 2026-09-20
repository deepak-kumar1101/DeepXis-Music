/**
 * DeepXis Music Bot - /support Command
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Get links for documentation, updates, and community assistance'),

  category: 'utility',

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(config.ui.embedColor)
      .setAuthor({ name: `${config.ui.brandName} - Support & Resources` })
      .setDescription(
        `Need help setting up **${config.ui.brandName}** or configuring custom emojis and visual assets?\n\n` +
        `• **Documentation:** Consult the project README and setup guide.\n` +
        `• **Features:** Supports Spotify playlists, albums, and tracks with live playback.\n` +
        `• **Customization:** Customize all button icons with Discord custom emojis.`
      )
      .setFooter({ text: config.ui.brandName });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('GitHub / Documentation')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.js.org')
    );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};
