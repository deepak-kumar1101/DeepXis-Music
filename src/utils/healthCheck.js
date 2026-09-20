/**
 * DeepXis Music Bot - Startup Health Check & Environment Verification
 * Performs strict pre-flight checks and provides exact copy-paste remediation commands.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { resolveYtDlpPath, getYtDlpVersion, resolveFFmpegPath, checkJsRuntime } = require('./binaryManager');

/**
 * Runs comprehensive system health check on startup
 * @returns {Promise<{ healthy: boolean, issues: string[] }>}
 */
async function runHealthCheck() {
  logger.info('HealthCheck', '=== Starting DeepXis Music Bot Pre-Flight Health Check ===');
  const issues = [];

  // 1. Check Node.js runtime
  const jsRuntime = checkJsRuntime();
  if (!jsRuntime.valid) {
    const msg = `Node.js version is ${jsRuntime.version}. DeepXis and yt-dlp require Node.js v18.0.0 or higher.`;
    logger.error('HealthCheck', msg);
    issues.push(msg);
  } else {
    logger.info('HealthCheck', `[PASS] Node.js Runtime: ${jsRuntime.version}`);
  }

  // 2. Check FFmpeg binary
  const ffmpegPath = resolveFFmpegPath();
  if (!ffmpegPath) {
    const msg = 'FFmpeg binary could not be resolved. Install ffmpeg-static or ensure ffmpeg is in your system PATH.';
    logger.error('HealthCheck', msg);
    issues.push(msg);
  } else {
    logger.info('HealthCheck', `[PASS] FFmpeg Binary: ${ffmpegPath}`);
  }

  // 3. Check yt-dlp binary
  const ytdlpPath = resolveYtDlpPath();
  const ytdlpVer = getYtDlpVersion();
  if (!ytdlpPath || !ytdlpVer) {
    const msg = 'yt-dlp executable could not be resolved or executed. Run: npm run dev or check bin/yt-dlp.';
    logger.error('HealthCheck', msg);
    issues.push(msg);
  } else {
    logger.info('HealthCheck', `[PASS] yt-dlp Binary: ${ytdlpPath} (version ${ytdlpVer})`);
  }

  // 4. Check @discordjs/voice
  try {
    require('@discordjs/voice');
    let voiceVersion = '0.19.x';
    try {
      const voiceMain = require.resolve('@discordjs/voice');
      const pkgPath = path.join(path.dirname(voiceMain), '..', 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        voiceVersion = pkg.version || voiceVersion;
      }
    } catch {}
    logger.info('HealthCheck', `[PASS] @discordjs/voice: v${voiceVersion}`);
  } catch (err) {
    const msg = `@discordjs/voice failed to load: ${err.message}. Run: npm install @discordjs/voice@^0.19.2`;
    logger.error('HealthCheck', msg);
    issues.push(msg);
  }

  // 5. Check DAVE Protocol (E2EE Voice)
  try {
    const davey = require('@snazzah/davey');
    if (davey && davey.DAVE_PROTOCOL_VERSION !== undefined) {
      logger.info('HealthCheck', `[PASS] DAVE Voice E2EE (@snazzah/davey): Protocol v${davey.DAVE_PROTOCOL_VERSION}`);
    } else {
      logger.warn('HealthCheck', '[WARN] @snazzah/davey loaded but DAVE_PROTOCOL_VERSION undefined.');
    }
  } catch (err) {
    const msg = `@snazzah/davey native binding failed: ${err.message}. Discord requires @snazzah/davey for modern encrypted voice channels.`;
    logger.error('HealthCheck', msg);
    issues.push(msg);
  }

  // 6. Check Encryption (Sodium / Aes)
  try {
    require('libsodium-wrappers');
    logger.info('HealthCheck', '[PASS] Encryption: libsodium-wrappers verified');
  } catch (err) {
    logger.warn('HealthCheck', `libsodium-wrappers not found: ${err.message}`);
  }

  if (issues.length > 0) {
    logger.error('HealthCheck', '========================================================');
    logger.error('HealthCheck', 'CRITICAL PRE-FLIGHT ISSUES DETECTED:');
    issues.forEach((iss, idx) => logger.error('HealthCheck', `  ${idx + 1}. ${iss}`));
    logger.error('HealthCheck', 'If hosted on Pterodactyl, ensure Startup Additional Node Packages is set to:');
    logger.error('HealthCheck', '  @discordjs/voice@^0.19.2 @snazzah/davey ffmpeg-static');
    logger.error('HealthCheck', '========================================================');
    return { healthy: false, issues };
  }

  logger.info('HealthCheck', '[ALL PASS] All pre-flight runtime and binary checks completed successfully.');
  return { healthy: true, issues: [] };
}

module.exports = {
  runHealthCheck
};
