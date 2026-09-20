/**
 * DeepXis Music Bot - Verification and Sanity Test Suite
 * Validates module imports, asset parser, command structures, and zero-emoji compliance.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(err);
  }
}

async function runTests() {
  console.log('=== Starting DeepXis Music Bot Verification Suite ===\n');

  // Test 1: Configuration & Logger
  it('Config loads default parameters cleanly', () => {
    const config = require('../src/config/config');
    assert.strictEqual(config.ui.brandName, 'DeepXis Music');
    assert.strictEqual(typeof config.player.defaultVolume, 'number');
    assert.strictEqual(typeof config.validate, 'function');
  });

  // Test 2: Asset Parser with HTML embed code
  it('Asset parser extracts CDN URL from HTML <a><img> embed code', () => {
    const { parseAssetInput, registerAsset, getAsset } = require('../src/config/assets');
    const htmlCode = '<a href="https://emoji.gg/emoji/45625-vinylrecord"><img src="https://cdn3.emoji.gg/emojis/45625-vinylrecord.gif" width="64px" height="64px" alt="VinylRecord"></a>';
    
    const parsedUrl = parseAssetInput(htmlCode);
    assert.strictEqual(parsedUrl, 'https://cdn3.emoji.gg/emojis/45625-vinylrecord.gif');

    registerAsset('loading', htmlCode);
    const asset = getAsset('loading');
    assert.strictEqual(asset.hasCustom, true);
    assert.strictEqual(asset.type, 'image_url');
    assert.strictEqual(asset.value, 'https://cdn3.emoji.gg/emojis/45625-vinylrecord.gif');
  });

  // Test 3: Asset Parser with Discord custom emoji
  it('Asset parser recognizes Discord custom emoji (<:name:id> and <a:name:id>)', () => {
    const { parseAssetInput, registerAsset, getAsset } = require('../src/config/assets');
    const staticEmoji = '<:custom_play:123456789012345678>';
    const animatedEmoji = '<a:custom_spin:987654321098765432>';

    assert.strictEqual(parseAssetInput(staticEmoji), staticEmoji);
    assert.strictEqual(parseAssetInput(animatedEmoji), animatedEmoji);

    registerAsset('play', staticEmoji);
    const asset = getAsset('play');
    assert.strictEqual(asset.hasCustom, true);
    assert.strictEqual(asset.type, 'discord_emoji');
    assert.strictEqual(asset.displayText, staticEmoji);
  });

  // Test 4: Unset asset returns text label with NO Unicode emojis
  it('Unset asset returns clean text label with zero Unicode emoji', () => {
    const { getAsset } = require('../src/config/assets');
    const asset = getAsset('disconnect');
    assert.strictEqual(asset.hasCustom, false);
    assert.strictEqual(asset.type, 'text_only');
    assert.strictEqual(asset.label, 'Disconnect');
    assert.strictEqual(asset.displayText, '[Disconnect]');
  });

  // Test 5: Strict Unicode Emoji check in UI files
  it('UI templates do not contain prohibited Unicode music or indicator emojis', () => {
    const prohibitedEmojis = ['🎵', '🎧', '▶️', '⏸️', '⏭️', '🔊', '🔇', '❤️', '🔥', '⭐', '✨', '🎶', '💿', '❌', '⚠️', '🚫', '⏳', '🔄'];
    
    const uiDir = path.join(__dirname, '../src/ui');
    const uiFiles = fs.readdirSync(uiDir).filter(f => f.endsWith('.js'));

    for (const file of uiFiles) {
      const content = fs.readFileSync(path.join(uiDir, file), 'utf8');
      for (const emoji of prohibitedEmojis) {
        assert.ok(
          !content.includes(emoji),
          `File ${file} contains prohibited Unicode emoji: ${emoji}`
        );
      }
    }
  });

  // Test 6: Embed builders instantiate properly
  it('Embed builders produce valid Discord Embeds with DeepXis branding', () => {
    const embeds = require('../src/ui/embeds');
    const errorEmbed = embeds.createErrorEmbed('Test error message');
    assert.ok(errorEmbed.data.description.includes('Test error message'));
    assert.ok(errorEmbed.data.author.name.includes('DeepXis Music'));

    const infoEmbed = embeds.createInfoEmbed('Test info message');
    assert.ok(infoEmbed.data.description.includes('Test info message'));
    assert.ok(infoEmbed.data.author.name.includes('DeepXis Music'));

    const successEmbed = embeds.createSuccessEmbed('Test success');
    assert.ok(successEmbed.data.description.includes('Test success'));

    const mockTrack = {
      title: 'DeepXis Track',
      author: 'Test Artist',
      album: 'Test Album',
      duration: '03:45',
      durationMS: 225000,
      url: 'https://spotify.com/track/123'
    };
    const playerEmbed = embeds.createPlayerEmbed(mockTrack, null, true);
    assert.ok(playerEmbed.data.description.includes('**__Song__ :** DeepXis Track'));
    assert.ok(playerEmbed.data.title.includes('Now Playing.........'));

    const cardEmbeds = embeds.createPlayerEmbed(mockTrack, null, true, 'music-card.png');
    assert.strictEqual(cardEmbeds.length, 1);
    assert.ok(cardEmbeds[0].data.title.includes('Now Playing.........'));
    assert.strictEqual(cardEmbeds[0].data.image.url, 'attachment://music-card.png');
  });

  // Test 7: Button builders instantiate properly
  it('Button builders produce valid Discord ActionRows without Unicode emojis', () => {
    const { createPlayerControls, createQueueControls } = require('../src/ui/buttons');
    const rows = createPlayerControls(null, false);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].components.length, 4); // Previous, Pause, Skip, Volume
    assert.strictEqual(rows[1].components.length, 4); // Shuffle, Loop, Stop, Queue

    const queueRow = createQueueControls(1, 5);
    assert.strictEqual(queueRow.length, 1);
    assert.strictEqual(queueRow[0].components.length, 4);
  });

  // Test 8: Progress bar generates clean characters
  it('Progress bar generator creates clean ASCII/typography bar', () => {
    const { createProgressBar } = require('../src/utils/progressBar');
    const bar = createProgressBar(30000, 60000, 10);
    assert.ok(bar.includes('00:30'));
    assert.ok(bar.includes('01:00'));
    assert.ok(bar.includes('o')); // slider knob
  });

  // Test 9: Time formatting and parsing
  it('Time formatter and parser handle MM:SS, HH:MM:SS, and duration inputs', () => {
    const { formatDuration, parseTimeString } = require('../src/utils/formatTime');
    assert.strictEqual(formatDuration(90000), '01:30');
    assert.strictEqual(formatDuration(3665000), '01:01:05');
    assert.strictEqual(parseTimeString('1:30'), 90000);
    assert.strictEqual(parseTimeString('90s'), 90000);
    assert.strictEqual(parseTimeString('2m'), 120000);
  });

  // Test 10: All slash commands export valid SlashCommandBuilder and execute
  it('All command modules export valid SlashCommandBuilder and execute handler', () => {
    const commandsDir = path.join(__dirname, '../src/commands');
    let commandCount = 0;

    function checkDir(dir) {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          checkDir(full);
        } else if (item.isFile() && item.name.endsWith('.js')) {
          const cmd = require(full);
          assert.ok(cmd.data, `Command ${item.name} is missing data`);
          assert.ok(typeof cmd.data.name === 'string', `Command ${item.name} data.name is not a string`);
          assert.ok(typeof cmd.execute === 'function', `Command ${item.name} execute is not a function`);
          commandCount++;
        }
      }
    }

    checkDir(commandsDir);
    assert.ok(commandCount >= 18, `Expected at least 18 commands, found ${commandCount}`);
    console.log(`    (Verified ${commandCount} slash commands)`);
  });

  // Test 11: Spotify Service URL Parser
  it('Spotify service correctly identifies track, album, and playlist URLs', () => {
    const spotifyService = require('../src/services/spotifyService');
    const trackParsed = spotifyService.parseSpotifyUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc');
    assert.strictEqual(trackParsed.type, 'track');
    assert.strictEqual(trackParsed.id, '4cOdK2wGLETKBW3PvgPWqT');

    const albumParsed = spotifyService.parseSpotifyUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3');
    assert.strictEqual(albumParsed.type, 'album');
    assert.strictEqual(albumParsed.id, '1DFixLWuPkv3KT3TnV35m3');

    const playlistParsed = spotifyService.parseSpotifyUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    assert.strictEqual(playlistParsed.type, 'playlist');
    assert.strictEqual(playlistParsed.id, '37i9dQZF1DXcBWIGoYBM5M');

    const nonSpotify = spotifyService.parseSpotifyUrl('https://youtube.com/watch?v=123');
    assert.strictEqual(nonSpotify.type, null);
  });

  // Test 12: Spotify OAuth2 & Auth Service
  it('Spotify Auth Service correctly generates authorization URL and tracks state', () => {
    const spotifyAuthService = require('../src/services/spotifyAuthService');
    assert.strictEqual(spotifyAuthService.isConfigured(), true);
    const authUrl = spotifyAuthService.generateAuthUrl('test-discord-user-123');
    assert.ok(authUrl.startsWith('https://accounts.spotify.com/authorize'));
    assert.ok(authUrl.includes('client_id='));
    assert.ok(authUrl.includes('response_type=code'));
    assert.ok(authUrl.includes('playlist-read-private'));
    assert.ok(authUrl.includes('state='));
  });

  // Test 13: Spotify Queries in-memory fallback
  it('Spotify account persistence works seamlessly with in-memory fallback', async () => {
    const spotifyQueries = require('../src/database/queries/spotifyQueries');
    await spotifyQueries.saveAccount({
      discordId: 'test-discord-user-456',
      spotifyId: 'spotify_user_789',
      displayName: 'Test Spotify User',
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      expiresAt: Date.now() + 3600000,
      scope: 'playlist-read-private'
    });

    const account = await spotifyQueries.getAccount('test-discord-user-456');
    assert.ok(account);
    assert.strictEqual(account.spotify_id, 'spotify_user_789');
    assert.strictEqual(account.display_name, 'Test Spotify User');

    await spotifyQueries.deleteAccount('test-discord-user-456');
    const deleted = await spotifyQueries.getAccount('test-discord-user-456');
    assert.strictEqual(deleted, null);
  });

  // Test 14: Spotify Command Structure
  it('/spotify command registers all required subcommands', () => {
    const spotifyCmd = require('../src/commands/music/spotify');
    assert.strictEqual(spotifyCmd.data.name, 'spotify');
    const subcommands = spotifyCmd.data.options.map(o => o.name);
    assert.ok(subcommands.includes('login'), 'Missing login subcommand');
    assert.ok(subcommands.includes('playlists'), 'Missing playlists subcommand');
    assert.ok(subcommands.includes('status'), 'Missing status subcommand');
    assert.ok(subcommands.includes('logout'), 'Missing logout subcommand');
    assert.ok(subcommands.includes('code'), 'Missing code subcommand');
  });

  // Test 15: Spotify Code & State Extraction
  it('Spotify Auth Service extracts code, state, and detects authorize URLs', () => {
    const spotifyAuthService = require('../src/services/spotifyAuthService');
    
    // Full callback URL with hash
    const res1 = spotifyAuthService.extractCodeAndState('http://127.0.0.1:3000/api/spotify/callback?code=AQD12345&state=state6789#_=_');
    assert.strictEqual(res1.code, 'AQD12345');
    assert.strictEqual(res1.state, 'state6789');
    assert.strictEqual(res1.isAuthorizeUrl, false);

    // URL without protocol
    const res2 = spotifyAuthService.extractCodeAndState('127.0.0.1:3000/api/spotify/callback?code=AQDABC');
    assert.strictEqual(res2.code, 'AQDABC');
    assert.strictEqual(res2.isAuthorizeUrl, false);

    // Raw code token
    const res3 = spotifyAuthService.extractCodeAndState('AQDTOKEN999#_=_');
    assert.strictEqual(res3.code, 'AQDTOKEN999');
    assert.strictEqual(res3.isAuthorizeUrl, false);

    // Accidental authorize URL
    const res4 = spotifyAuthService.extractCodeAndState('https://accounts.spotify.com/authorize?client_id=123&response_type=code');
    assert.strictEqual(res4.isAuthorizeUrl, true);
    assert.strictEqual(res4.code, null);
  });

  // Test 16: Spotify Web API Error Formatting
  it('Spotify Auth Service unpacks WebapiError and provides human-readable guidance', () => {
    const spotifyAuthService = require('../src/services/spotifyAuthService');

    // 403 Forbidden
    const err403 = { statusCode: 403, body: { message: 'Forbidden' }, message: '[object Object]' };
    const msg403 = spotifyAuthService.formatSpotifyError(err403);
    assert.ok(msg403.includes('403 Forbidden'));
    assert.ok(msg403.includes('Development Mode'));
    assert.ok(msg403.includes('/play'));
    assert.ok(!msg403.includes('[object Object]'));

    // 401 Unauthorized
    const err401 = { statusCode: 401, body: { error: { message: 'The access token expired' } } };
    const msg401 = spotifyAuthService.formatSpotifyError(err401);
    assert.ok(msg401.includes('expired'));
    assert.ok(msg401.includes('/spotify login'));

    // 400 invalid_grant
    const err400 = { statusCode: 400, body: { error: 'invalid_grant', error_description: 'Invalid authorization code' } };
    const msg400 = spotifyAuthService.formatSpotifyError(err400);
    assert.ok(msg400.includes('Expired or Already Used'));

    // Unknown error with object message
    const errGeneric = { message: '[object Object]' };
    const msgGeneric = spotifyAuthService.formatSpotifyError(errGeneric);
    assert.ok(!msgGeneric.includes('[object Object]'));
  });

  console.log(`\n=== Verification Results: ${passedTests}/${totalTests} Tests Passed ===\n`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
