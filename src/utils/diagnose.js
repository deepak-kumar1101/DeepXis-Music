/**
 * DeepXis Music Bot - Comprehensive Self-Test & Diagnostic Engine
 * Runs multi-point diagnostic checks for /music-diagnose and logs detailed status.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveYtDlpPath, getYtDlpVersion, resolveFFmpegPath, checkJsRuntime, supportsJsRuntimes } = require('./binaryManager');
const providerRegistry = require('../player/providers/ProviderRegistry');
const config = require('../config/config');

async function runFullDiagnostics() {
  const results = [];

  // 1. FFmpeg Check
  const ffmpegPath = resolveFFmpegPath();
  let ffmpegOk = false;
  let ffmpegDetails = 'Not resolved';
  try {
    const res = spawnSync(ffmpegPath, ['-version'], { encoding: 'utf8', timeout: 5000 });
    if (res.status === 0 && res.stdout) {
      ffmpegOk = true;
      const firstLine = res.stdout.split('\n')[0];
      const hasOpus = res.stdout.includes('libopus');
      ffmpegDetails = `${firstLine.slice(0, 40)} (libopus: ${hasOpus ? 'yes' : 'no'})`;
    }
  } catch (e) {
    ffmpegDetails = e.message;
  }
  results.push({
    name: 'FFmpeg Binary',
    pass: ffmpegOk,
    detail: ffmpegDetails
  });

  // 2. yt-dlp Check
  const ytdlpPath = resolveYtDlpPath();
  const ytdlpVer = getYtDlpVersion();
  const ytdlpOk = Boolean(ytdlpPath && ytdlpVer);
  results.push({
    name: 'yt-dlp Binary',
    pass: ytdlpOk,
    detail: ytdlpOk ? `v${ytdlpVer} at ${ytdlpPath}` : 'Missing or not executable'
  });

  // 3. JS Runtime EJS Support
  const jsRuntime = checkJsRuntime();
  const hasJsFlag = supportsJsRuntimes();
  results.push({
    name: 'JS Runtime (Node EJS)',
    pass: jsRuntime.valid,
    detail: `${jsRuntime.engine} ${jsRuntime.version} (yt-dlp --js-runtimes: ${hasJsFlag ? 'supported' : 'default'})`
  });

  // 4. Voice Engine & DAVE E2EE
  let voiceOk = false;
  let daveDetails = 'Not loaded';
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

    const davey = require('@snazzah/davey');
    voiceOk = true;
    daveDetails = `@discordjs/voice v${voiceVersion} | DAVE v${davey?.DAVE_PROTOCOL_VERSION ?? 'active'}`;
  } catch (e) {
    daveDetails = e.message;
  }
  results.push({
    name: 'Voice Engine & DAVE E2EE',
    pass: voiceOk,
    detail: daveDetails
  });

  // 5. Test YouTube Search
  let searchOk = false;
  let searchDetails = '';
  try {
    const ytProvider = providerRegistry.get('youtube');
    const searchRes = await ytProvider.search('test query', { limit: 1 });
    searchOk = searchRes && searchRes.length > 0;
    searchDetails = searchOk ? `Found: "${searchRes[0].title.slice(0, 30)}..."` : 'No results returned';
  } catch (e) {
    searchDetails = e.message;
  }
  results.push({
    name: 'YouTube Search (ytsearch1)',
    pass: searchOk,
    detail: searchDetails
  });

  // 6. Test Stream Resolve on Stable Public Video
  let resolveOk = false;
  let resolveDetails = '';
  try {
    const ytProvider = providerRegistry.get('youtube');
    const meta = await ytProvider.getMetadata('https://www.youtube.com/watch?v=gvyUuxdRdR4');
    resolveOk = meta && meta.tracks && meta.tracks.length > 0;
    resolveDetails = resolveOk ? `Resolved: "${meta.tracks[0].title.slice(0, 30)}"` : 'Metadata empty';
  } catch (e) {
    resolveDetails = e.message;
  }
  results.push({
    name: 'Public Stream Metadata',
    pass: resolveOk,
    detail: resolveDetails
  });

  // 7. 3-Second FFmpeg OggOpus Decode Test
  let decodeOk = false;
  let decodeDetails = '';
  try {
    const res = spawnSync(ffmpegPath, [
      '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=1',
      '-c:a', 'libopus', '-b:a', '128k', '-f', 'ogg', 'pipe:1'
    ], { timeout: 6000 });
    decodeOk = res.status === 0 && res.stdout && res.stdout.length > 1000;
    decodeDetails = decodeOk ? `Decoded ${res.stdout.length} bytes OggOpus` : `Exit code ${res.status}`;
  } catch (e) {
    decodeDetails = e.message;
  }
  results.push({
    name: 'FFmpeg libopus Stream Pipe',
    pass: decodeOk,
    detail: decodeDetails
  });

  // 8. Spotify Connectivity
  let spotifyOk = false;
  let spotifyDetails = '';
  try {
    const spProvider = providerRegistry.get('spotify');
    const check = await spProvider.healthCheck();
    spotifyOk = check.healthy;
    spotifyDetails = spotifyOk ? (config.spotify.refreshToken ? 'Auth Code + Refresh Token active' : 'Client Credentials active') : (check.message || 'Credentials unconfigured');
  } catch (e) {
    spotifyDetails = e.message;
  }
  results.push({
    name: 'Spotify 2026 Web API',
    pass: spotifyOk,
    detail: spotifyDetails
  });

  // 9. Provider Circuit Breakers
  const provHealth = await providerRegistry.getHealthStatus();
  const allProvidersHealthy = Object.values(provHealth).every(p => p.healthy);
  results.push({
    name: 'Provider Circuit Breakers',
    pass: allProvidersHealthy,
    detail: Object.entries(provHealth).map(([k, v]) => `${k}: ${v.circuitBreaker}`).join(' | ')
  });

  // 10. Environment Flags
  results.push({
    name: 'Environment Flags',
    pass: true,
    detail: `Cookies: ${config.ytdlp.cookiesFile ? 'configured' : 'none'} | Proxy: ${config.ytdlp.proxy ? 'configured' : 'none'} | Clients: ${config.ytdlp.ytClients.join(',')}`
  });

  return results;
}

/**
 * Structured diagnostics function for command and test runner
 */
async function runMusicDiagnostics(guildId = null) {
  const checks = await runFullDiagnostics();
  const passedCount = checks.filter(c => c.pass).length;
  const totalCount = checks.length;
  const hasCriticalFailure = checks.some(c => !c.pass && (c.name.includes('FFmpeg') || c.name.includes('yt-dlp')));

  return {
    overallStatus: hasCriticalFailure ? 'error' : passedCount === totalCount ? 'healthy' : 'warning',
    summary: {
      passed: passedCount,
      total: totalCount
    },
    checks: checks.map(c => ({
      name: c.name,
      status: c.pass ? 'pass' : 'fail',
      detail: c.detail
    }))
  };
}

module.exports = {
  runFullDiagnostics,
  runMusicDiagnostics
};
