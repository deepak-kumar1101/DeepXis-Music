/**
 * DeepXis Music Bot - Spotify Provider (2026 Web API + Intelligent Track Matching)
 * Fetches metadata using GET /playlists/{id}/items (parsing items[].item) and scores candidates.
 */

const https = require('https');
const BaseProvider = require('./BaseProvider');
const config = require('../../config/config');
const cache = require('../../database/cache');
const { SpotifyAuthError, NoMatchError, MusicError } = require('../../utils/errors');
const { formatDuration } = require('../../utils/formatTime');
const logger = require('../../utils/logger');

let currentAccessToken = null;
let tokenExpiresAt = 0;

class SpotifyProvider extends BaseProvider {
  constructor() {
    super('spotify');
  }

  canHandle(input) {
    if (!input || typeof input !== 'string') return false;
    const str = input.trim();
    return (
      str.includes('open.spotify.com/') ||
      str.includes('play.spotify.com/') ||
      str.startsWith('spotify:')
    );
  }

  /**
   * Parses Spotify URLs or URIs including locale prefixes (e.g. /intl-de/)
   * @param {string} input 
   * @returns {{ type: 'track'|'album'|'playlist'|'artist'|null, id: string|null }}
   */
  parseUrl(input) {
    if (!input || typeof input !== 'string') return { type: null, id: null };
    const str = input.trim();

    // Match https://open.spotify.com/[intl-xx/]track/ID?si=...
    const webMatch = str.match(/https?:\/\/(?:open|play)\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i);
    if (webMatch) {
      return { type: webMatch[1].toLowerCase(), id: webMatch[2] };
    }

    // Match spotify:track:ID
    const uriMatch = str.match(/^spotify:(track|album|playlist|artist):([a-zA-Z0-9]+)$/i);
    if (uriMatch) {
      return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
    }

    return { type: null, id: null };
  }

  /**
   * Ensures a valid Spotify Access Token using Authorization Code refresh token or Client Credentials
   * @returns {Promise<string>}
   */
  async _getAccessToken() {
    if (currentAccessToken && Date.now() < tokenExpiresAt - 60000) {
      return currentAccessToken;
    }

    const clientId = config.spotify.clientId;
    const clientSecret = config.spotify.clientSecret;
    const refreshToken = config.spotify.refreshToken;

    if (!clientId || !clientSecret) {
      throw new SpotifyAuthError('Spotify credentials (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET) are missing.');
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // 1. Try Refresh Token (Authorization Code Flow) if configured
    if (refreshToken) {
      try {
        const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;
        const res = await this._httpPost('accounts.spotify.com', '/api/token', body, {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        });

        if (res.access_token) {
          currentAccessToken = res.access_token;
          tokenExpiresAt = Date.now() + ((res.expires_in || 3600) * 1000);
          logger.info('SpotifyProvider', 'Refreshed Spotify access token via owner refresh token.');
          return currentAccessToken;
        }
      } catch (err) {
        logger.warn('SpotifyProvider', `Refresh token grant failed (${err.message}). Falling back to client credentials.`);
      }
    }

    // 2. Client Credentials Fallback
    const body = 'grant_type=client_credentials';
    const res = await this._httpPost('accounts.spotify.com', '/api/token', body, {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    if (!res.access_token) {
      throw new SpotifyAuthError(`Spotify token request failed: ${JSON.stringify(res)}`);
    }

    currentAccessToken = res.access_token;
    tokenExpiresAt = Date.now() + ((res.expires_in || 3600) * 1000);
    logger.info('SpotifyProvider', 'Obtained Spotify client credentials token.');
    return currentAccessToken;
  }

  _httpPost(hostname, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname,
        path,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', (d) => data += d.toString());
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${parsed.error_description || parsed.error || data}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse JSON response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async _httpGet(path) {
    const token = await this._getAccessToken();

    return new Promise((resolve, reject) => {
      const executeRequest = (retryCount = 0) => {
        const req = https.request({
          hostname: 'api.spotify.com',
          path,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }, (res) => {
          let data = '';
          res.on('data', (d) => data += d.toString());
          res.on('end', () => {
            // Handle 429 Rate Limiting
            if (res.statusCode === 429) {
              const retryAfter = parseInt(res.headers['retry-after'] || '3', 10);
              if (retryCount < 2) {
                logger.warn('SpotifyProvider', `429 Rate Limit encountered. Retrying in ${retryAfter}s...`);
                setTimeout(() => executeRequest(retryCount + 1), retryAfter * 1000);
                return;
              }
              return reject(new MusicError('Spotify API rate limit reached. Please try again later.'));
            }

            // Handle 401 Unauthorized (Force Token Refresh)
            if (res.statusCode === 401 && retryCount < 1) {
              currentAccessToken = null;
              tokenExpiresAt = 0;
              return this._getAccessToken().then(() => executeRequest(retryCount + 1)).catch(reject);
            }

            try {
              const parsed = JSON.parse(data);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(parsed);
              } else {
                reject(new Error(`Spotify Web API Error ${res.statusCode}: ${parsed.error?.message || data}`));
              }
            } catch {
              reject(new Error(`Invalid JSON returned: ${data}`));
            }
          });
        });

        req.on('error', reject);
        req.end();
      };

      executeRequest(0);
    });
  }

  /**
   * Search Spotify tracks (max limit 10 per 2026 API spec)
   */
  async search(query, limit = 5, requester = null) {
    const safeLimit = Math.min(10, Math.max(1, limit));
    const cached = cache.getSearch(query, 'spotify');
    if (cached) return cached;

    try {
      const encoded = encodeURIComponent(query.trim());
      const res = await this._httpGet(`/v1/search?q=${encoded}&type=track&limit=${safeLimit}`);
      const items = res.tracks?.items || [];

      const tracks = items.map(t => this._normalizeSpotifyTrack(t, requester));
      cache.setSearch(query, 'spotify', tracks, 1800);
      return tracks;
    } catch (err) {
      logger.warn('SpotifyProvider', `Spotify search failed for "${query}": ${err.message}`);
      throw err;
    }
  }

  _normalizeSpotifyTrack(t, requester = null) {
    const artistName = (t.artists || []).map(a => a.name).join(', ') || 'Unknown Artist';
    const durationMs = t.duration_ms || 0;
    const thumbnail = t.album?.images?.[0]?.url || null;
    const spotifyUrl = t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`;

    return {
      id: `sp_${t.id}`,
      spotifyId: t.id,
      title: t.name,
      artist: artistName,
      artists: artistName,
      album: t.album?.name || '',
      durationMs,
      duration_ms: durationMs,
      durationFormatted: formatDuration(durationMs),
      thumbnail,
      artworkUrl: thumbnail,
      originSource: 'spotify',
      origin_source: 'spotify',
      originRef: spotifyUrl,
      origin_ref: spotifyUrl,
      webpageUrl: spotifyUrl,
      webpage_url: spotifyUrl,
      isrc: t.external_ids?.isrc || null,
      requester,
      resolvedSource: null // Lazy resolved at playback time
    };
  }

  async getMetadata(ref, requester = null) {
    const { type, id } = this.parseUrl(ref);
    if (!type || !id) {
      throw new MusicError('Invalid Spotify link or URI provided.');
    }

    if (type === 'track') {
      const cached = cache.getMetadata(id, 'spotify_track');
      if (cached) return { isPlaylist: false, tracks: [cached] };

      const res = await this._httpGet(`/v1/tracks/${id}`);
      const track = this._normalizeSpotifyTrack(res, requester);
      cache.setMetadata(id, 'spotify_track', track, 86400);
      return { isPlaylist: false, tracks: [track] };
    }

    if (type === 'album') {
      const res = await this._httpGet(`/v1/albums/${id}`);
      const albumName = res.name || 'Spotify Album';
      const artworkUrl = res.images?.[0]?.url || null;
      const artistName = (res.artists || []).map(a => a.name).join(', ');

      const tracks = (res.tracks?.items || []).map(t => {
        t.album = { name: albumName, images: res.images };
        return this._normalizeSpotifyTrack(t, requester);
      });

      return {
        isPlaylist: true,
        tracks,
        playlistInfo: {
          title: albumName,
          author: artistName,
          thumbnail: artworkUrl,
          trackCount: tracks.length
        }
      };
    }

    if (type === 'playlist') {
      // Fetch playlist details
      const playlistMeta = await this._httpGet(`/v1/playlists/${id}?fields=name,description,images,owner,items.total`);
      const artworkUrl = playlistMeta.images?.[0]?.url || null;
      const playlistTitle = playlistMeta.name || 'Spotify Playlist';
      const playlistOwner = playlistMeta.owner?.display_name || 'Spotify';

      const tracks = [];
      let offset = 0;
      const limit = 50; // Page size for items endpoint

      while (offset < 500) {
        // 2026 Web API: GET /v1/playlists/{id}/items
        const itemsRes = await this._httpGet(`/v1/playlists/${id}/items?offset=${offset}&limit=${limit}`);
        const items = itemsRes.items || [];

        for (const container of items) {
          // 2026 schema: items[].item
          const t = container.item || container.track;
          if (!t || t.type !== 'track' || t.is_local) continue; // Skip podcast episodes, local tracks, nulls
          tracks.push(this._normalizeSpotifyTrack(t, requester));
        }

        if (!itemsRes.next || items.length < limit) break;
        offset += limit;
      }

      return {
        isPlaylist: true,
        tracks,
        playlistInfo: {
          title: playlistTitle,
          author: playlistOwner,
          thumbnail: artworkUrl,
          trackCount: tracks.length
        }
      };
    }

    throw new MusicError(`Unsupported Spotify entity type: ${type}`);
  }

  /**
   * Intelligent Track-Matching Engine
   * Scores candidates on duration delta, title/artist token overlap, Topic channels, and cover/remix penalties.
   */
  async matchTrack(spotifyTrack, youtubeProvider, soundcloudProvider) {
    const spotifyId = spotifyTrack.spotifyId || spotifyTrack.rawId;

    // 1. Check persistent SQLite cache (30-day TTL)
    if (spotifyId) {
      const cached = cache.getSpotifyMapping(spotifyId);
      if (cached && cached.matchedUrl) {
        return {
          source: cached.matchedSource,
          url: cached.matchedUrl,
          score: cached.score
        };
      }
    }

    const title = (spotifyTrack.title || '').trim();
    const artist = (spotifyTrack.artist || '').split(',')[0].trim();
    const durationMs = spotifyTrack.durationMs || spotifyTrack.duration_ms || 0;

    // Clean decorator tokens
    const cleanTitle = title
      .replace(/\(feat\..*?\)/gi, '')
      .replace(/\[feat\..*?\]/gi, '')
      .replace(/- feat\..*?$/gi, '')
      .trim();

    // Query variants
    const variants = [
      `"${artist}" "${cleanTitle}"`,
      `${artist} - ${cleanTitle} official audio`,
      `${cleanTitle} ${artist} topic`
    ];

    let bestCandidate = null;
    let highestScore = -1;

    // A. Query YouTube candidates
    if (youtubeProvider) {
      for (const variant of variants) {
        try {
          const candidates = await youtubeProvider.search(variant, 4);
          for (const cand of candidates) {
            const score = this._calculateMatchScore(spotifyTrack, cand);
            if (score > highestScore) {
              highestScore = score;
              bestCandidate = { source: 'youtube', track: cand, score };
            }
          }
          if (highestScore >= 70) break; // High confidence match
        } catch {}
      }
    }

    // B. Acceptable threshold is 35 points
    if (bestCandidate && highestScore >= 35) {
      const chosenUrl = bestCandidate.track.webpageUrl || bestCandidate.track.originRef;
      if (spotifyId) {
        cache.setSpotifyMapping(spotifyId, bestCandidate.source, chosenUrl, highestScore);
      }
      return {
        source: bestCandidate.source,
        url: chosenUrl,
        score: highestScore,
        matchedTrack: bestCandidate.track
      };
    }

    // C. Fallback to SoundCloud if YouTube candidate scoring failed
    if (soundcloudProvider) {
      try {
        const scCandidates = await soundcloudProvider.search(`${cleanTitle} ${artist}`, 3);
        if (scCandidates.length > 0) {
          const scTrack = scCandidates[0];
          const scUrl = scTrack.webpageUrl || scTrack.originRef;
          if (spotifyId) {
            cache.setSpotifyMapping(spotifyId, 'soundcloud', scUrl, 40);
          }
          return {
            source: 'soundcloud',
            url: scUrl,
            score: 40,
            matchedTrack: scTrack
          };
        }
      } catch {}
    }

    throw new NoMatchError(spotifyTrack.title);
  }

  _calculateMatchScore(spotifyTrack, candidate) {
    let score = 0;
    const sTitle = (spotifyTrack.title || '').toLowerCase();
    const sArtist = (spotifyTrack.artist || '').toLowerCase();
    const sDurationMs = spotifyTrack.durationMs || spotifyTrack.duration_ms || 0;

    const cTitle = (candidate.title || '').toLowerCase();
    const cAuthor = (candidate.artist || candidate.channel || '').toLowerCase();
    const cDurationMs = candidate.durationMs || candidate.duration_ms || 0;

    // 1. Duration Closeness Scoring
    if (sDurationMs > 0 && cDurationMs > 0) {
      const deltaSec = Math.abs(sDurationMs - cDurationMs) / 1000;
      if (deltaSec <= 4) {
        score += 40;
      } else if (deltaSec <= 10) {
        score += 20;
      } else if (deltaSec > 30) {
        score -= 50; // Reject extended versions / jukeboxes
      } else {
        score -= 20;
      }
    }

    // 2. Token Overlap
    const titleWords = sTitle.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    let matchedWords = 0;
    for (const word of titleWords) {
      if (cTitle.includes(word)) matchedWords++;
    }
    if (titleWords.length > 0) {
      score += (matchedWords / titleWords.length) * 30;
    }

    // 3. Artist match
    const primaryArtist = sArtist.split(',')[0].trim();
    if (primaryArtist && (cTitle.includes(primaryArtist) || cAuthor.includes(primaryArtist))) {
      score += 20;
    }

    // 4. Boost Official / Topic Channel
    if (cAuthor.includes('topic') || cTitle.includes('topic') || cAuthor.includes('vevo')) {
      score += 25;
    }
    if (cTitle.includes('official audio') || cTitle.includes('official music video')) {
      score += 15;
    }

    // 5. Penalties for non-official variants (unless in Spotify title)
    const penaltyKeywords = ['live', 'cover', 'remix', 'karaoke', '8d', 'slowed', 'reverb', 'sped up', 'nightcore', 'instrumental'];
    for (const kw of penaltyKeywords) {
      if (cTitle.includes(kw) && !sTitle.includes(kw)) {
        score -= 40;
      }
    }

    return score;
  }

  async healthCheck() {
    try {
      const token = await this._getAccessToken();
      return { healthy: Boolean(token) };
    } catch (err) {
      return { healthy: false, message: err.message };
    }
  }
}

module.exports = SpotifyProvider;
