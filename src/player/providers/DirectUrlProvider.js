/**
 * DeepXis Music Bot - Direct Audio URL Provider
 * Streams audio directly from HTTP/HTTPS audio file links (.mp3, .ogg, .flac, .wav, .m4a).
 */

const BaseProvider = require('./BaseProvider');
const { formatDuration } = require('../../utils/formatTime');

class DirectUrlProvider extends BaseProvider {
  constructor() {
    super('direct');
  }

  canHandle(input) {
    if (!input || typeof input !== 'string') return false;
    const str = input.trim().toLowerCase();
    if (!str.startsWith('http://') && !str.startsWith('https://')) return false;

    return (
      str.endsWith('.mp3') ||
      str.endsWith('.ogg') ||
      str.endsWith('.flac') ||
      str.endsWith('.wav') ||
      str.endsWith('.m4a') ||
      str.endsWith('.aac') ||
      str.includes('/audio/')
    );
  }

  validate(input) {
    return this.canHandle(input);
  }

  async resolve(ref, options = {}) {
    const meta = await this.getMetadata(ref, options.requester);
    return meta.tracks[0] || null;
  }

  async search(query, limit = 5, requester = null) {
    if (this.canHandle(query)) {
      return (await this.getMetadata(query, requester)).tracks;
    }
    return [];
  }

  async getMetadata(ref, requester = null) {
    const cleanUrl = ref.trim();
    const urlParts = cleanUrl.split('?')[0].split('/');
    const filename = decodeURIComponent(urlParts[urlParts.length - 1] || 'Direct Audio Stream');

    const track = {
      id: `direct_${Buffer.from(cleanUrl).toString('base64').slice(0, 16)}`,
      title: filename,
      artist: 'Direct Stream',
      artists: 'Direct Stream',
      durationMs: 0,
      duration_ms: 0,
      durationFormatted: 'Live / Stream',
      thumbnail: null,
      artworkUrl: null,
      originSource: 'direct',
      origin_source: 'direct',
      originRef: cleanUrl,
      origin_ref: cleanUrl,
      webpageUrl: cleanUrl,
      webpage_url: cleanUrl,
      isrc: null,
      requester,
      resolvedSource: {
        source: 'direct',
        url: cleanUrl
      }
    };

    return {
      isPlaylist: false,
      tracks: [track]
    };
  }

  getPlayableArgs(track, options = {}) {
    return [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', track.originRef || track.url
    ];
  }
}

module.exports = DirectUrlProvider;
