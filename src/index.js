/**
 * DeepXis Music Bot - Application Entry Point
 * Starts HTTP healthcheck server and boots the Discord bot.
 */

const express = require('express');
const { initBot, client } = require('./bot');
const config = require('./config/config');
const db = require('./database/connection');
const spotifyService = require('./services/spotifyService');
const spotifyAuthService = require('./services/spotifyAuthService');
const playerManager = require('./player/queue/PlayerManager');
const processManager = require('./player/pipeline/ProcessManager');
const { runHealthCheck } = require('./utils/healthCheck');
const logger = require('./utils/logger');

const app = express();
const PORT = config.server.port;

// Healthcheck & status endpoint
app.get('/', (req, res) => {
  const statusPayload = {
    app: config.ui.brandName,
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    discord: {
      connected: client.isReady(),
      wsPing: client.ws?.ping ?? -1,
      guildCount: client.guilds?.cache?.size ?? 0
    },
    database: {
      connected: db.isAvailable()
    },
    spotify: {
      available: spotifyService.isAvailable()
    },
    player: {
      activePlayers: playerManager.players ? playerManager.players.size : 0
    }
  };

  res.status(200).json(statusPayload);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Spotify OAuth2 Callback
app.get('/api/spotify/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.warn('SpotifyOAuth', `User denied Spotify authorization or error occurred: ${error}`);
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Spotify Connection Cancelled</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #121212; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: #181818; border: 1px solid #282828; border-radius: 16px; padding: 40px 32px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .icon { width: 64px; height: 64px; margin-bottom: 20px; fill: #ef4444; }
          h1 { margin: 0 0 12px; font-size: 24px; font-weight: 700; }
          p { color: #a1a1aa; line-height: 1.6; margin: 0 0 24px; font-size: 15px; }
          .hint { font-size: 13px; color: #71717a; border-top: 1px solid #282828; padding-top: 18px; }
        </style>
      </head>
      <body>
        <div class="card">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          <h1>Connection Cancelled</h1>
          <p>Spotify authorization was not completed (${escapeHtml(String(error))}). You can safely close this window and try again from Discord.</p>
          <div class="hint">DeepXis Music Bot &bull; You may close this tab.</div>
        </div>
      </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Missing Authorization Parameters</title>
        <style>
          body { font-family: sans-serif; background: #121212; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #181818; border: 1px solid #282828; border-radius: 16px; padding: 36px; max-width: 440px; text-align: center; }
          p { color: #a1a1aa; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Missing Parameters</h2>
          <p>Required authorization parameters were not provided. Please initiate login via Discord with <code>/spotify login</code>.</p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const result = await spotifyAuthService.handleOAuthCallback(code, state);
    const safeName = escapeHtml(result.displayName);

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Spotify Account Connected - DeepXis Music</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #121212; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: #181818; border: 1px solid #282828; border-radius: 20px; padding: 44px 36px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 14px 40px rgba(0,0,0,0.6); }
          .logo { width: 68px; height: 68px; margin-bottom: 20px; fill: #1DB954; }
          .badge { display: inline-block; background: rgba(29, 185, 84, 0.15); color: #1DB954; font-weight: 600; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; margin-bottom: 16px; border: 1px solid rgba(29, 185, 84, 0.3); }
          h1 { margin: 0 0 10px; font-size: 26px; font-weight: 700; color: #ffffff; }
          .user-name { color: #1DB954; }
          p { color: #a1a1aa; line-height: 1.6; margin: 0 0 24px; font-size: 15px; }
          .instructions { background: #222226; border-radius: 12px; padding: 14px 18px; text-align: left; font-size: 13.5px; color: #d4d4d8; margin-bottom: 24px; }
          .instructions strong { color: #ffffff; }
          .instructions code { background: #18181b; padding: 2px 6px; border-radius: 4px; color: #a78bfa; font-family: monospace; font-size: 13px; }
          .hint { font-size: 13px; color: #71717a; border-top: 1px solid #282828; padding-top: 18px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Connection Successful</div>
          <svg class="logo" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          <h1>Welcome, <span class="user-name">${safeName}</span>!</h1>
          <p>Your Spotify account is now securely linked with <strong>DeepXis Music</strong>.</p>
          <div class="instructions">
            <div>&bull; Use <code>/spotify playlists</code> to browse & queue your playlists.</div>
            <div style="margin-top: 6px;">&bull; Use <code>/spotify status</code> to check your connected account.</div>
          </div>
          <div class="hint">You can safely close this window now.</div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    logger.error('SpotifyOAuth', 'Callback error handling Spotify code', err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Spotify Connection Error</title>
        <style>
          body { font-family: sans-serif; background: #121212; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #181818; border: 1px solid #282828; border-radius: 16px; padding: 36px; max-width: 440px; text-align: center; }
          h2 { color: #ef4444; }
          p { color: #a1a1aa; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Connection Failed</h2>
          <p>${escapeHtml(err.message || 'An unexpected error occurred.')}</p>
          <p>Please try running <code>/spotify login</code> again in Discord.</p>
        </div>
      </body>
      </html>
    `);
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start HTTP Server
const server = app.listen(PORT, () => {
  logger.info('Server', `HTTP server running on port ${PORT}`);
  logger.info('Server', `Port source: ${process.env.SERVER_PORT ? 'SERVER_PORT env' : process.env.PORT ? 'PORT env' : 'default (3000)'}`);
  logger.info('Server', `Spotify OAuth redirect URI: ${config.spotify.redirectUri}`);
});

// Run Pre-Flight System Health Check
runHealthCheck().catch((err) => {
  logger.error('Index', `Pre-flight health check error: ${err.message}`);
});

// Start the Discord Bot
initBot().catch((err) => {
  logger.error('Index', 'Fatal error during bot startup', err);
});

// Graceful Shutdown
async function handleShutdown(signal) {
  logger.info('Shutdown', `Received ${signal}. Shutting down gracefully...`);

  // Stop HTTP server
  server.close(() => {
    logger.info('Shutdown', 'HTTP server stopped.');
  });

  // Disconnect all players
  try {
    for (const [guildId] of playerManager.players.entries()) {
      playerManager.deletePlayer(guildId);
    }
  } catch {}

  // Kill all subprocesses
  processManager.killAll();

  // Close database pool
  await db.close();

  // Destroy Discord client
  client.destroy();

  logger.info('Shutdown', 'DeepXis Music Bot shut down complete.');
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Process', 'Unhandled Promise Rejection at:', promise);
  logger.error('Process', 'Reason:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Process', 'Uncaught Exception thrown:', err);
});
