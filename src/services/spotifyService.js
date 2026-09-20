/**
 * DeepXis Music Bot - Spotify Web API Service
 * Handles metadata resolution for Spotify tracks, albums, and playlists.
 * Audio playback is bridged to Discord Player extractors.
 */

const SpotifyWebApi = require('spotify-web-api-node');
const config = require('../config/config');
const logger = require('../utils/logger');

let spotifyApi = null;
let tokenExpiresAt = 0;
let isInitialized = false;

if (config.spotify.clientId && config.spotify.clientSecret) {
  spotifyApi = new SpotifyWebApi({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret
  });
}

/**
 * Ensures a valid Spotify Client Credentials access token
 */
async function ensureToken() {
  if (!spotifyApi) return false;

  // If token is still valid (with 60s buffer), reuse it
  if (Date.now() < tokenExpiresAt - 60000) {
    return true;
  }

  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    tokenExpiresAt = Date.now() + (data.body['expires_in'] * 1000);
    isInitialized = true;
    logger.info('Spotify', 'Successfully refreshed Spotify client credentials access token.');
    return true;
  } catch (err) {
    logger.error('Spotify', 'Failed to authenticate with Spotify Web API', err);
    return false;
  }
}

/**
 * Parse a potential Spotify URL or URI
 * @param {string} input 
 * @returns {{ type: 'track'|'album'|'playlist'|'artist'|null, id: string|null }}
 */
function parseSpotifyUrl(input) {
  if (!input || typeof input !== 'string') {
    return { type: null, id: null };
  }

  // Handle open.spotify.com URLs
  // e.g., https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=...
  const webRegex = /https?:\/\/(?:open|play)\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i;
  const webMatch = input.match(webRegex);
  if (webMatch) {
    return { type: webMatch[1].toLowerCase(), id: webMatch[2] };
  }

  // Handle spotify: URI formats
  // e.g., spotify:track:4cOdK2wGLETKBW3PvgPWqT
  const uriRegex = /^spotify:(track|album|playlist|artist):([a-zA-Z0-9]+)$/i;
  const uriMatch = input.match(uriRegex);
  if (uriMatch) {
    return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
  }

  return { type: null, id: null };
}

const spotifyService = {
  isAvailable() {
    return spotifyApi !== null;
  },

  parseSpotifyUrl,

  /**
   * Fetch single track metadata
   * @param {string} trackId 
   */
  async getTrack(trackId) {
    if (!(await ensureToken())) return null;

    try {
      const res = await spotifyApi.getTrack(trackId);
      const t = res.body;
      return {
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        album: t.album.name,
        artworkUrl: t.album.images?.[0]?.url || null,
        durationMs: t.duration_ms,
        url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
        id: t.id,
        isrc: t.external_ids?.isrc || null,
        query: `${t.name} ${t.artists?.[0]?.name || ''}`.trim()
      };
    } catch (err) {
      logger.error('Spotify', `Failed to fetch track: ${trackId}`, err);
      return null;
    }
  },

  /**
   * Fetch album metadata and track list
   * @param {string} albumId 
   */
  async getAlbum(albumId) {
    if (!(await ensureToken())) return null;

    try {
      const res = await spotifyApi.getAlbum(albumId);
      const album = res.body;
      const artworkUrl = album.images?.[0]?.url || null;
      const artistName = album.artists.map(a => a.name).join(', ');

      const tracks = album.tracks.items.map(t => ({
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        album: album.name,
        artworkUrl,
        durationMs: t.duration_ms,
        url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
        id: t.id,
        query: `${t.name} ${t.artists?.[0]?.name || artistName}`.trim()
      }));

      return {
        name: album.name,
        artist: artistName,
        artworkUrl,
        totalTracks: album.total_tracks,
        tracks
      };
    } catch (err) {
      logger.error('Spotify', `Failed to fetch album: ${albumId}`, err);
      return null;
    }
  },

  /**
   * Fetch playlist metadata and track list (with async pagination)
   * @param {string} playlistId 
   * @param {number} maxTracks Limit to avoid overwhelming memory/rate-limits
   */
  async getPlaylist(playlistId, maxTracks = 500) {
    if (!(await ensureToken())) return null;

    try {
      const playlistRes = await spotifyApi.getPlaylist(playlistId, { fields: 'name,description,images,owner,tracks.total' });
      const meta = playlistRes.body;
      const artworkUrl = meta.images?.[0]?.url || null;

      const tracks = [];
      let offset = 0;
      const limit = 100;
      const total = Math.min(meta.tracks.total, maxTracks);

      while (offset < total) {
        const batchRes = await spotifyApi.getPlaylistTracks(playlistId, {
          offset,
          limit,
          fields: 'items(track(name,artists,album(name,images),duration_ms,external_urls,external_ids,id))'
        });

        const items = batchRes.body.items || [];
        for (const item of items) {
          const t = item.track;
          if (!t) continue; // Skip unavailable/local tracks
          tracks.push({
            title: t.name,
            artist: (t.artists || []).map(a => a.name).join(', '),
            album: t.album?.name || '',
            artworkUrl: t.album?.images?.[0]?.url || artworkUrl,
            durationMs: t.duration_ms,
            url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
            id: t.id,
            isrc: t.external_ids?.isrc || null,
            query: `${t.name} ${(t.artists || [])[0]?.name || ''}`.trim()
          });
        }

        offset += limit;
        if (items.length < limit) break;
      }

      return {
        name: meta.name,
        description: meta.description,
        owner: meta.owner?.display_name || 'Spotify',
        artworkUrl,
        totalTracks: tracks.length,
        tracks
      };
    } catch (err) {
      logger.error('Spotify', `Failed to fetch playlist: ${playlistId}`, err);
      return null;
    }
  },

  /**
   * Search Spotify for tracks
   * @param {string} query 
   * @param {number} limit 
   */
  async search(query, limit = 5) {
    if (!(await ensureToken())) return [];

    try {
      const res = await spotifyApi.searchTracks(query, { limit });
      const items = res.body.tracks?.items || [];
      return items.map(t => ({
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        album: t.album?.name || '',
        artworkUrl: t.album?.images?.[0]?.url || null,
        durationMs: t.duration_ms,
        url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
        id: t.id,
        isrc: t.external_ids?.isrc || null,
        query: `${t.name} ${t.artists?.[0]?.name || ''}`.trim()
      }));
    } catch (err) {
      logger.error('Spotify', `Failed to search Spotify: "${query}"`, err);
      return [];
    }
  }
};

module.exports = spotifyService;
