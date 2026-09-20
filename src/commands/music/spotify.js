/**
 * DeepXis Music Bot - /spotify Command
 * Allows users to link their personal Spotify accounts, browse their playlists,
 * and stream them directly in voice channels with branded Spotify assets.
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const spotifyAuthService = require('../../services/spotifyAuthService');
const {
  createSpotifyConnectEmbed,
  createSpotifyPlaylistsEmbed,
  createSpotifyStatusEmbed,
  createErrorEmbed,
  createSuccessEmbed
} = require('../../ui/embeds');
const { enforceMusicChannel } = require('../../config/permissions');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spotify')
    .setDescription('Connect your Spotify account and stream your personal playlists')
    .addSubcommand(sub =>
      sub.setName('login')
        .setDescription('Connect your personal Spotify account')
    )
    .addSubcommand(sub =>
      sub.setName('playlists')
        .setDescription('Browse and play your personal Spotify playlists')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Check your Spotify connection status')
    )
    .addSubcommand(sub =>
      sub.setName('logout')
        .setDescription('Disconnect your Spotify account')
    )
    .addSubcommand(sub =>
      sub.setName('code')
        .setDescription('Paste the redirect URL or code from your browser to complete connection')
        .addStringOption(opt =>
          opt.setName('input')
            .setDescription('The URL from your browser address bar after authorizing (contains ?code=...)')
            .setRequired(true)
        )
    ),

  category: 'music',

  async execute(interaction) {
    let subcommand = 'playlists';
    try {
      subcommand = interaction.options.getSubcommand(false) || 'playlists';
    } catch {
      subcommand = 'playlists';
    }

    // 1. /spotify login
    if (subcommand === 'login') {
      if (!spotifyAuthService.isConfigured()) {
        return await interaction.reply({
          embeds: [createErrorEmbed('Spotify credentials are not configured by the bot administrator.')],
          ephemeral: true
        });
      }

      try {
        const authUrl = spotifyAuthService.generateAuthUrl(interaction.user.id);
        const embed = createSpotifyConnectEmbed(authUrl);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Connect Spotify')
            .setStyle(ButtonStyle.Link)
            .setURL(authUrl)
        );

        return await interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: true
        });
      } catch (err) {
        logger.error('SpotifyCommand', 'Failed to generate auth URL', err);
        return await interaction.reply({
          embeds: [createErrorEmbed('Could not generate Spotify authorization link. Please try again later.')],
          ephemeral: true
        });
      }
    }

    // 2. /spotify status
    if (subcommand === 'status') {
      try {
        const status = await spotifyAuthService.getStatus(interaction.user.id);
        const embed = createSpotifyStatusEmbed(status);

        if (!status.connected && spotifyAuthService.isConfigured()) {
          const authUrl = spotifyAuthService.generateAuthUrl(interaction.user.id);
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Connect Spotify')
              .setStyle(ButtonStyle.Link)
              .setURL(authUrl)
          );
          return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        logger.error('SpotifyCommand', 'Error getting status', err);
        return await interaction.reply({
          embeds: [createErrorEmbed('Could not retrieve Spotify connection status.')],
          ephemeral: true
        });
      }
    }

    // 3. /spotify logout
    if (subcommand === 'logout') {
      try {
        await spotifyAuthService.disconnect(interaction.user.id);
        return await interaction.reply({
          embeds: [createSuccessEmbed('Your Spotify account has been disconnected.')],
          ephemeral: true
        });
      } catch (err) {
        logger.error('SpotifyCommand', 'Error during logout', err);
        return await interaction.reply({
          embeds: [createErrorEmbed('Failed to disconnect your Spotify account.')],
          ephemeral: true
        });
      }
    }

    // 4. /spotify code <url_or_code>
    if (subcommand === 'code') {
      let rawInput = '';
      try {
        rawInput = (interaction.options.getString('input', false) || '').trim();
      } catch {
        rawInput = '';
      }

      if (!rawInput) {
        return await interaction.reply({
          embeds: [createErrorEmbed(
            '**Please provide the redirect URL or code from your browser address bar.**\n\n' +
            'Usage: `/spotify code input: http://127.0.0.1:3000/api/spotify/callback?code=...`'
          )],
          ephemeral: true
        });
      }

      const { code, state, isAuthorizeUrl } = spotifyAuthService.extractCodeAndState(rawInput);

      if (isAuthorizeUrl) {
        return await interaction.reply({
          embeds: [createErrorEmbed(
            '**You pasted the Spotify login link, not the redirect result!**\n\n' +
            '1. Click the authorization button generated by `/spotify login`.\n' +
            '2. Log in and authorize the application on Spotify.\n' +
            '3. When your browser is redirected to the result URL (even if it says "site can\'t be reached"), **copy the full URL from your browser address bar**.\n' +
            '4. Paste that full URL (which contains `?code=...`) into `/spotify code`.'
          )],
          ephemeral: true
        });
      }

      if (!code) {
        return await interaction.reply({
          embeds: [createErrorEmbed(
            'Could not find a valid authorization code in your input.\n\n' +
            'Please copy the entire URL from your browser address bar after authorizing (contains `?code=...`).'
          )],
          ephemeral: true
        });
      }

      if (interaction.deferReply && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      try {
        const result = await spotifyAuthService.handleOAuthCallback(code, state, interaction.user.id);
        const successEmbed = createSuccessEmbed(
          `Spotify account **${result.displayName}** successfully connected!\n\n` +
          `You can now use \`/spotify playlists\` to select and play your playlists in voice.`
        );

        if (interaction.deferred || interaction.replied) {
          return await interaction.editReply({ embeds: [successEmbed] });
        } else {
          return await interaction.reply({ embeds: [successEmbed], ephemeral: true });
        }
      } catch (err) {
        logger.error('SpotifyCommand', 'Failed to complete code login', err);
        const errorMsg = spotifyAuthService.formatSpotifyError(err);
        const errEmbed = createErrorEmbed(errorMsg);

        if (interaction.deferred || interaction.replied) {
          return await interaction.editReply({ embeds: [errEmbed] });
        } else {
          return await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
      }
    }

    // 5. /spotify playlists
    if (subcommand === 'playlists') {
      await enforceMusicChannel(interaction);

      if (interaction.deferReply && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      let result;
      try {
        result = await spotifyAuthService.getUserPlaylists(interaction.user.id, 25);
      } catch (err) {
        logger.error('SpotifyCommand', `Failed to get playlists for user ${interaction.user.id}`, err);
        const errorMsg = err.message || spotifyAuthService.formatSpotifyError(err);
        return await interaction.editReply({
          embeds: [createErrorEmbed(errorMsg)],
          components: []
        });
      }

      if (!result.connected) {
        if (!spotifyAuthService.isConfigured()) {
          return await interaction.editReply({
            embeds: [createErrorEmbed('Spotify integration is not configured by the bot administrator.')]
          });
        }

        const authUrl = spotifyAuthService.generateAuthUrl(interaction.user.id);
        const embed = createSpotifyConnectEmbed(authUrl);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Connect Spotify')
            .setStyle(ButtonStyle.Link)
            .setURL(authUrl)
        );

        return await interaction.editReply({
          embeds: [embed],
          components: [row]
        });
      }

      if (!result.playlists || result.playlists.length === 0) {
        return await interaction.editReply({
          embeds: [createErrorEmbed(
            'No playlists found in your connected Spotify library.\n\n' +
            '**Tip:** You can also play any public Spotify playlist directly anytime with `/play <playlist_url>` without needing an account connection!'
          )]
        });
      }

      // Build select menu for top 25 playlists
      const menuOptions = result.playlists.slice(0, 25).map(p => {
        const title = p.name.length > 95 ? p.name.substring(0, 92) + '...' : p.name;
        const desc = `${p.trackCount} tracks | By ${p.owner}`.substring(0, 95);

        return new StringSelectMenuOptionBuilder()
          .setLabel(title)
          .setDescription(desc)
          .setValue(p.id);
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_spotify_playlist')
        .setPlaceholder('Choose a Spotify playlist to play in voice...')
        .addOptions(menuOptions);

      const menuRow = new ActionRowBuilder().addComponents(selectMenu);
      const playlistEmbed = createSpotifyPlaylistsEmbed(result.displayName, result.playlists);

      return await interaction.editReply({
        embeds: [playlistEmbed],
        components: [menuRow]
      });
    }
  }
};
