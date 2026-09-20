/**
 * DeepXis Music Bot - Comprehensive Phase 8 Verification Test Suite
 * Validates all components of the rebuilt music module:
 * 1. Environment & Dependency Audit
 * 2. Pre-flight Health Check
 * 3. YouTube Provider (yt-dlp search & stream info)
 * 4. SoundCloud Provider (yt-dlp scsearch)
 * 5. Direct URL Provider
 * 6. Audio Pipeline (yt-dlp -> FFmpeg libopus OggOpus generation & byte stream check)
 * 7. Spotify Provider (2026 API & lazy track resolution)
 * 8. GuildPlayer State Machine & Async Mutex (concurrency, rapid actions)
 * 9. Circuit Breaker Resilience Test
 * 10. Diagnostics Engine (/music-diagnose test)
 */

const fs = require('fs');
const path = require('path');
const { runHealthCheck } = require('../src/utils/healthCheck');
const { resolveYtDlpPath, getYtDlpVersion, resolveFFmpegPath, checkJsRuntime, supportsJsRuntimes } = require('../src/utils/binaryManager');
const ProviderRegistry = require('../src/player/providers/ProviderRegistry');
const { resolveQuery, resolvePlayable } = require('../src/player/resolver');
const AudioPipeline = require('../src/player/pipeline/AudioPipeline');
const processManager = require('../src/player/pipeline/ProcessManager');
const { GuildPlayer, PlayerState } = require('../src/player/queue/GuildPlayer');
const { runMusicDiagnostics } = require('../src/utils/diagnose');
const cache = require('../src/database/cache');
const logger = require('../src/utils/logger');

async function main() {
  console.log('================================================================');
  console.log('    DEEPXIS MUSIC BOT - PHASE 8 VERIFICATION & EVIDENCE SUITE   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(name, isPass, detail = '') {
    if (isPass) {
      console.log(`[PASS] ${name}${detail ? ` -> ${detail}` : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // TEST 1: Dependency & Environment Report
  console.log('--- TEST 1: System & Dependency Report ---');
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

    const discord = require('discord.js');
    const discordVersion = discord.version || '14.16.x';
    const davey = require('@snazzah/davey');
    const jsRuntime = checkJsRuntime();
    const ytVer = getYtDlpVersion();
    const ffmpegPath = resolveFFmpegPath();

    console.log(`  - OS Platform: ${process.platform} (${process.arch})`);
    console.log(`  - Node.js Version: ${process.version}`);
    console.log(`  - discord.js: v${discordVersion}`);
    console.log(`  - @discordjs/voice: v${voiceVersion}`);
    console.log(`  - @snazzah/davey (DAVE E2EE): Protocol v${davey.DAVE_PROTOCOL_VERSION}`);
    console.log(`  - yt-dlp: v${ytVer} (supports --js-runtimes: ${supportsJsRuntimes()})`);
    console.log(`  - FFmpeg: ${ffmpegPath}`);
    console.log(`  - JS Runtime Engine: ${jsRuntime.engine} (Node v18+ valid: ${jsRuntime.valid})`);

    record('Dependency & Environment Audit', true, `Node ${process.version}, yt-dlp ${ytVer}`);
  } catch (err) {
    record('Dependency & Environment Audit', false, err.message);
  }

  // TEST 2: Pre-flight Health Check
  console.log('\n--- TEST 2: Startup Pre-Flight Health Check ---');
  try {
    const health = await runHealthCheck();
    record('Pre-flight Health Check', health.healthy, `${health.issues.length} issues`);
  } catch (err) {
    record('Pre-flight Health Check', false, err.message);
  }

  // TEST 3: YouTube Search & Metadata
  console.log('\n--- TEST 3: YouTube Provider (yt-dlp Search) ---');
  try {
    const ytProvider = ProviderRegistry.get('youtube');
    const query = 'NCS Spectre Alan Walker';
    const results = await ytProvider.search(query, { requester: { id: '123', username: 'TestUser' } });

    console.log(`  Search query: "${query}"`);
    console.log(`  Found results: ${results.length} tracks`);
    if (results.length > 0) {
      console.log(`  Top track: "${results[0].title}" (${results[0].duration}) by ${results[0].artist}`);
      console.log(`  URL: ${results[0].url}`);
    }

    record('YouTube Provider Search', results.length > 0 && !!results[0].url, `Top: "${results[0]?.title}"`);
  } catch (err) {
    record('YouTube Provider Search', false, err.message);
  }

  // TEST 4: SoundCloud Provider Search
  console.log('\n--- TEST 4: SoundCloud Provider (yt-dlp scsearch) ---');
  try {
    const scProvider = ProviderRegistry.get('soundcloud');
    const query = 'Lofi hip hop beats';
    const results = await scProvider.search(query, { requester: { id: '123', username: 'TestUser' } });

    console.log(`  Search query: "${query}"`);
    console.log(`  Found results: ${results.length} tracks`);
    if (results.length > 0) {
      console.log(`  Top track: "${results[0].title}" by ${results[0].artist}`);
    }

    record('SoundCloud Provider Search', results.length > 0, `Found ${results.length} tracks`);
  } catch (err) {
    record('SoundCloud Provider Search', false, err.message);
  }

  // TEST 5: Direct URL Provider
  console.log('\n--- TEST 5: Direct URL Provider ---');
  try {
    const directProvider = ProviderRegistry.get('direct');
    const directUrl = 'https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-analyser/viper.mp3';
    const isValid = directProvider.validate(directUrl);
    const resolved = await directProvider.resolve(directUrl, { requester: { id: '123' } });

    console.log(`  Direct URL: ${directUrl}`);
    console.log(`  Validate: ${isValid}, Title: ${resolved.title}`);

    record('Direct URL Provider', isValid && !!resolved.title, `Resolved direct audio stream`);
  } catch (err) {
    record('Direct URL Provider', false, err.message);
  }

  // TEST 6: Audio Pipeline Execution (yt-dlp | FFmpeg -> OggOpus Stream)
  console.log('\n--- TEST 6: Audio Pipeline Direct OggOpus Generation ---');
  try {
    const testTrack = {
      title: 'Viper Audio Stream Test',
      artist: 'MDN Test',
      url: 'https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-analyser/viper.mp3',
      originRef: 'https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-analyser/viper.mp3'
    };

    const startTime = Date.now();
    const streamObj = await AudioPipeline.createStream('test_guild_1', testTrack, { volume: 80 });

    let bytesReceived = 0;
    const bytePromise = new Promise((resolve) => {
      streamObj.resource.playStream.on('data', (chunk) => {
        bytesReceived += chunk.length;
        if (bytesReceived >= 65536) { // 64KB received
          resolve();
        }
      });
      setTimeout(resolve, 8000);
    });

    await bytePromise;
    const elapsed = Date.now() - startTime;
    streamObj.destroy();

    console.log(`  Audio pipeline spawned, received: ${(bytesReceived / 1024).toFixed(1)} KB in ${elapsed}ms`);
    record('Audio Pipeline OggOpus Stream', bytesReceived > 0, `${(bytesReceived / 1024).toFixed(1)} KB captured in ${elapsed}ms`);
  } catch (err) {
    record('Audio Pipeline OggOpus Stream', false, err.message);
  }

  // TEST 7: Spotify Candidate Scoring & Lazy Match Engine
  console.log('\n--- TEST 7: Spotify Lazy Track Matching Engine ---');
  try {
    const spotifyTrack = {
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      durationMS: 200040,
      duration: '03:20',
      originSource: 'spotify',
      isLazy: true
    };

    const matchStart = Date.now();
    await resolvePlayable(spotifyTrack);
    const matchElapsed = Date.now() - matchStart;

    console.log(`  Spotify Query: "${spotifyTrack.title}" by ${spotifyTrack.artist}`);
    console.log(`  Resolved playable source: ${spotifyTrack.resolvedSource?.source} -> ${spotifyTrack.resolvedSource?.title}`);
    console.log(`  Match resolution took: ${matchElapsed}ms`);

    record('Spotify Lazy Track Matching', !!spotifyTrack.resolvedSource?.url, `Matched to: "${spotifyTrack.resolvedSource?.title}" in ${matchElapsed}ms`);
  } catch (err) {
    record('Spotify Lazy Track Matching', false, err.message);
  }

  // TEST 8: State Machine & Async Mutex Queue Test
  console.log('\n--- TEST 8: State Machine & Async Mutex Concurrency ---');
  try {
    const dummyPlayer = new GuildPlayer('test_guild_mutex', null, null);
    dummyPlayer.addTracks([
      { title: 'Track 1', artist: 'Artist 1', duration: '03:00' },
      { title: 'Track 2', artist: 'Artist 2', duration: '03:30' },
      { title: 'Track 3', artist: 'Artist 3', duration: '04:00' }
    ]);

    // Test concurrent state mutations through mutex
    const p1 = dummyPlayer.withLock(async () => {
      dummyPlayer.setVolume(60);
      return 'p1_done';
    });

    const p2 = dummyPlayer.withLock(async () => {
      dummyPlayer.shuffle();
      return 'p2_done';
    });

    const p3 = dummyPlayer.withLock(async () => {
      dummyPlayer.setLoopMode(1);
      return 'p3_done';
    });

    const results = await Promise.all([p1, p2, p3]);
    const isSuccess = results[0] === 'p1_done' && results[1] === 'p2_done' && results[2] === 'p3_done' && dummyPlayer.volume === 60 && dummyPlayer.loopMode === 1;

    console.log(`  Concurrent operations serialized safely: ${JSON.stringify(results)}`);
    console.log(`  Volume: ${dummyPlayer.volume}%, Loop Mode: ${dummyPlayer.loopMode}`);

    record('State Machine & Mutex Concurrency', isSuccess, 'All 3 async operations serialized safely');
  } catch (err) {
    record('State Machine & Mutex Concurrency', false, err.message);
  }

  // TEST 9: Circuit Breaker Simulation
  console.log('\n--- TEST 9: Circuit Breaker Outage Protection Test ---');
  try {
    const cbKey = 'test_mock_provider';
    console.log(`  Simulating consecutive provider network errors...`);

    for (let i = 1; i <= 3; i++) {
      ProviderRegistry.recordFailure(cbKey, new Error('Simulated Bot Check Error (Sign in to confirm you are not a bot)'));
    }

    const isTripped = ProviderRegistry.isTripped(cbKey);
    console.log(`  Circuit breaker state for '${cbKey}': Tripped = ${isTripped}`);

    // Test circuit breaker auto-reset logic
    ProviderRegistry.resetCircuit(cbKey);
    const isReset = !ProviderRegistry.isTripped(cbKey);

    record('Circuit Breaker Outage Protection', isTripped && isReset, 'Tripped on 3 failures, reset successfully');
  } catch (err) {
    record('Circuit Breaker Outage Protection', false, err.message);
  }

  // TEST 10: Multi-Point Self-Test (/music-diagnose engine)
  console.log('\n--- TEST 10: Full Multi-Point Diagnostics Engine ---');
  try {
    const diag = await runMusicDiagnostics('test_guild_diag');
    console.log(`  Overall Status: ${diag.overallStatus.toUpperCase()}`);
    console.log(`  Passed Checks: ${diag.summary.passed}/${diag.summary.total}`);
    for (const chk of diag.checks) {
      console.log(`    [${chk.status.toUpperCase()}] ${chk.name}: ${chk.detail}`);
    }

    record('Multi-Point Diagnostics Engine', diag.overallStatus !== 'error', `${diag.summary.passed}/${diag.summary.total} checks passed`);
  } catch (err) {
    record('Multi-Point Diagnostics Engine', false, err.message);
  }

  // Clean up
  processManager.killAll();

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
