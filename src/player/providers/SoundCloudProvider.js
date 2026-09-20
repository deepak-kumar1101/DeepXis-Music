/**
 * DeepXis Music Bot - SoundCloud Provider (yt-dlp)
 * Resolves SoundCloud tracks and playlists using yt-dlp subprocess with scsearch.
 */

const { spawn } = require('child_process');
const BaseProvider = require('./BaseProvider');
const config = require('../../config/config');
const { resolveYtDlpPath, supportsJsRuntimes } = require('../../utils/binaryManager');
const { classifyYtDlpError, TimeoutError, MusicError } = require('../../utils/errors');
const { formatDuration } = require('../../utils/formatTime');
const logger = require('../../utils/logger');

class SoundCloudProvider extends BaseProvider {
  constructor() {
    super('soundcloud');
  }

  _buildArgs(extraArgs = []) {
    const args = ['--no-warnings', '--no-check-certificates', '--prefer-free-formats'];

    if (supportsJsRuntimes()) {
      args.push('--js-runtimes', config.ytdlp.jsRuntime || 'node');
    }

    if (config.ytdlp.cookiesFile) {
      args.push('--cookies', config.ytdlp.cookiesFile);
    }

    if (config.ytdlp.proxy) {
      args.push('--proxy', config.ytdlp.proxy);
    }

    return [...args, ...extraArgs];
  }

  async _execYtDlp(args, timeoutMs = 20000) {
    const bin = resolveYtDlpPath();

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      const timer = setTimeout(() => {
        killed = true;
        try { child.kill('SIGKILL'); } catch {}
        reject(new TimeoutError(`SoundCloud search timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      child.stdout.on('data', (d) => stdout += d.toString());
      child.stderr.on('data', (d) => stderr += d.toString());

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new MusicError(`Failed to spawn yt-dlp for SoundCloud: ${err.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) return;
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(classifyYtDlpError(stderr, code));
        }
      });
    });
  }

  canHandle(input) {
    if (!input || typeof input !== 'string') return false;
    return input.includes('soundcloud.com/');
  }

  _normalizeEntry(entry, requester = null) {
    const id = entry.id || entry.url || '';
    const title = entry.title || 'SoundCloud Track';
    const artist = entry.uploader || entry.artist || entry.channel || 'SoundCloud Artist';
    const durationSec = typeof entry.duration === 'number' ? entry.duration : 0;
    const durationMs = durationSec * 1000;
    const webpageUrl = entry.webpage_url || entry.url || (id.startsWith('http') ? id : `https://soundcloud.com/${id}`);

    let thumbnail = null;
    if (Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
      thumbnail = entry.thumbnails[entry.thumbnails.length - 1].url;
    } else if (entry.thumbnail) {
      thumbnail = entry.thumbnail;
    }

    return {
      id: `sc_${id}`,
      rawId: id,
      title,
      artist,
      author: artist,
      artists: artist,
      durationMs,
      duration_ms: durationMs,
      duration: formatDuration(durationMs),
      durationFormatted: formatDuration(durationMs),
      thumbnail,
      artworkUrl: thumbnail,
      originSource: 'soundcloud',
      origin_source: 'soundcloud',
      originRef: webpageUrl,
      origin_ref: webpageUrl,
      url: webpageUrl,
      webpageUrl,
      webpage_url: webpageUrl,
      isrc: null,
      requester,
      resolvedSource: null
    };
  }

  async search(query, limitOrOptions = 5, maybeRequester = null) {
    let limit = 5;
    let requester = maybeRequester;

    if (typeof limitOrOptions === 'number') {
      limit = limitOrOptions;
    } else if (typeof limitOrOptions === 'object' && limitOrOptions !== null) {
      if (typeof limitOrOptions.limit === 'number') limit = limitOrOptions.limit;
      if (limitOrOptions.requester) requester = limitOrOptions.requester;
    }

    const cleanQuery = query.trim();
    const args = this._buildArgs([
      '--dump-json',
      '--flat-playlist',
      `scsearch${limit}:${cleanQuery}`
    ]);

    try {
      const { stdout } = await this._execYtDlp(args, 15000);
      const lines = stdout.split(/\r?\n/).filter(line => line.trim().startsWith('{'));
      const tracks = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          tracks.push(this._normalizeEntry(entry, requester));
        } catch {}
      }

      return tracks;
    } catch (err) {
      logger.warn('SoundCloudProvider', `Search failed for "${query}": ${err.message}`);
      throw err;
    }
  }

  async getMetadata(ref, requester = null) {
    const cleanUrl = ref.trim();
    const args = this._buildArgs([
      '--dump-json',
      '--flat-playlist',
      cleanUrl
    ]);

    try {
      const { stdout } = await this._execYtDlp(args, 20000);
      const lines = stdout.split(/\r?\n/).filter(line => line.trim().startsWith('{'));

      if (lines.length === 0) {
        throw new MusicError('No audio information returned by SoundCloud.');
      }

      const entries = [];
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {}
      }

      const isPlaylist = entries.length > 1 || cleanUrl.includes('/sets/');
      const tracks = entries.map(e => this._normalizeEntry(e, requester));

      let playlistInfo = null;
      if (isPlaylist) {
        playlistInfo = {
          title: entries[0].playlist_title || entries[0].playlist || 'SoundCloud Set',
          author: entries[0].playlist_uploader || 'SoundCloud',
          thumbnail: tracks[0]?.thumbnail || null,
          trackCount: tracks.length
        };
      }

      return {
        isPlaylist,
        tracks,
        playlistInfo
      };
    } catch (err) {
      logger.warn('SoundCloudProvider', `Failed to get metadata for "${ref}": ${err.message}`);
      throw err;
    }
  }

  getPlayableArgs(track, options = {}) {
    const targetUrl = track.originRef || track.webpageUrl || track.url;
    const args = this._buildArgs([
      '-f', 'bestaudio/best',
      '--no-playlist',
      '-o', '-',
      targetUrl
    ]);
    return args;
  }

  async healthCheck() {
    try {
      const res = await this.search('test ping', 1);
      return { healthy: res.length > 0 };
    } catch (err) {
      return { healthy: false, message: err.message };
    }
  }
}

module.exports = SoundCloudProvider;
