/**
 * DeepXis Music Bot - Audio Playback Pipeline (yt-dlp -> FFmpeg OggOpus)
 * Pipes yt-dlp into FFmpeg with libopus Ogg encoding, 10s stall detection, volume filters, and seek support.
 */

const { spawn } = require('child_process');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const processManager = require('./ProcessManager');
const { resolveYtDlpPath, resolveFFmpegPath, supportsJsRuntimes } = require('../../utils/binaryManager');
const config = require('../../config/config');
const { MusicError, classifyYtDlpError } = require('../../utils/errors');
const logger = require('../../utils/logger');

class AudioPipeline {
  /**
   * Create an AudioResource from a track
   * @param {string} guildId 
   * @param {object} track 
   * @param {object} [options] { volume: 80, seek: 0, playerClient: null, onStall: Function }
   * @returns {Promise<{ resource: import('@discordjs/voice').AudioResource, destroy: Function }>}
   */
  static async createStream(guildId, track, options = {}) {
    const volume = Math.min(100, Math.max(1, typeof options.volume === 'number' ? options.volume : 80));
    const seekSec = typeof options.seek === 'number' ? options.seek : 0;
    const targetUrl = track.resolvedSource?.url || track.originRef || track.webpageUrl || track.url;

    if (!targetUrl) {
      throw new MusicError('No playable URL resolved for track.');
    }

    // Kill any existing processes for this guild before starting new stream
    processManager.killGuild(guildId);

    const ytdlpBin = resolveYtDlpPath();
    const ffmpegBin = resolveFFmpegPath();

    // 1. Build yt-dlp arguments
    const ytdlpArgs = [
      '--no-warnings',
      '--no-check-certificates',
      '--prefer-free-formats',
      '-f', 'bestaudio/best',
      '--no-playlist',
      '-o', '-'
    ];

    if (supportsJsRuntimes()) {
      ytdlpArgs.push('--js-runtimes', config.ytdlp.jsRuntime || 'node');
    }

    if (config.ytdlp.cookiesFile) {
      ytdlpArgs.push('--cookies', config.ytdlp.cookiesFile);
    }

    if (config.ytdlp.proxy) {
      ytdlpArgs.push('--proxy', config.ytdlp.proxy);
    }

    if (options.playerClient) {
      ytdlpArgs.push('--extractor-args', `youtube:player_client=${options.playerClient}`);
    }

    ytdlpArgs.push(targetUrl);

    // 2. Build FFmpeg arguments (libopus Ogg stream)
    const ffmpegArgs = ['-loglevel', 'warning', '-nostdin', '-analyzeduration', '0'];

    if (seekSec > 0) {
      ffmpegArgs.push('-ss', String(seekSec));
    }

    ffmpegArgs.push('-i', 'pipe:0', '-vn');

    // Volume filter (0.0 to 1.0)
    const volumeFilter = `volume=${(volume / 100).toFixed(2)}`;
    ffmpegArgs.push('-af', volumeFilter);

    // Direct libopus encode to Ogg format for @discordjs/voice StreamType.OggOpus
    ffmpegArgs.push('-c:a', 'libopus', '-b:a', '128k', '-f', 'ogg', 'pipe:1');

    logger.debug('AudioPipeline', `Spawning pipeline for guild ${guildId}: yt-dlp | ffmpeg`);

    // 3. Spawn child processes
    const ytdlpProc = spawn(ytdlpBin, ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const ffmpegProc = spawn(ffmpegBin, ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

    processManager.register(guildId, ytdlpProc);
    processManager.register(guildId, ffmpegProc);

    let ytdlpStderr = '';
    let ffmpegStderr = '';

    ytdlpProc.stderr.on('data', (d) => ytdlpStderr += d.toString());
    ffmpegProc.stderr.on('data', (d) => ffmpegStderr += d.toString());

    // Pipe yt-dlp into FFmpeg with EPIPE handling
    ytdlpProc.stdout.pipe(ffmpegProc.stdin);

    ytdlpProc.stdout.on('error', (err) => {
      if (err.code !== 'EPIPE') {
        logger.debug('AudioPipeline', `yt-dlp stdout pipe error: ${err.message}`);
      }
    });

    ffmpegProc.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') {
        logger.debug('AudioPipeline', `ffmpeg stdin pipe error: ${err.message}`);
      }
    });

    // 4. 10-Second Stall Detector
    let lastDataTime = Date.now();
    let stallTimer = null;
    let streamDestroyed = false;

    ffmpegProc.stdout.on('data', () => {
      lastDataTime = Date.now();
    });

    stallTimer = setInterval(() => {
      if (streamDestroyed) return;
      if (Date.now() - lastDataTime > 10000) {
        logger.warn('AudioPipeline', `Audio stream stalled for 10s in guild ${guildId}`);
        clearInterval(stallTimer);
        if (typeof options.onStall === 'function') {
          options.onStall();
        }
      }
    }, 3000);

    const destroy = () => {
      if (streamDestroyed) return;
      streamDestroyed = true;
      clearInterval(stallTimer);
      try { ytdlpProc.stdout.unpipe(ffmpegProc.stdin); } catch {}
      processManager.killGuild(guildId);
    };

    ffmpegProc.on('close', () => {
      clearInterval(stallTimer);
    });

    ffmpegProc.on('error', (err) => {
      clearInterval(stallTimer);
      logger.error('AudioPipeline', `FFmpeg process error: ${err.message}`, ffmpegStderr);
    });

    // 5. Create AudioResource with StreamType.OggOpus
    const resource = createAudioResource(ffmpegProc.stdout, {
      inputType: StreamType.OggOpus,
      inlineVolume: false
    });

    return {
      resource,
      destroy
    };
  }
}

module.exports = AudioPipeline;
