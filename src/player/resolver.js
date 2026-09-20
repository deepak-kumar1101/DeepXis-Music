/**
 * DeepXis Music Bot - Unified Query & Stream Resolver
 * Handles input routing, multi-source search, and lazy Spotify track matching.
 */

const providerRegistry = require('./providers/ProviderRegistry');
const cache = require('../database/cache');
const { NoMatchError, MusicError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Resolves an input query or URL to normalized track objects
 * @param {string} query Search text or URL
 * @param {object} requester Discord user object
 * @param {string} [defaultSource='youtube']
 * @returns {Promise<{ isPlaylist: boolean, tracks: Array<object>, playlist: object|null }>}
 */
async function resolveQuery(query, requester = null, defaultSource = 'youtube') {
  if (!query || typeof query !== 'string') {
    throw new MusicError('Please provide a song title or URL.');
  }

  const cleanQuery = query.trim();

  // Strip YouTube mix/radio playlist params to avoid unintended 50-track mix loads
  let sanitizedQuery = cleanQuery;
  if (sanitizedQuery.includes('youtube.com/watch?') || sanitizedQuery.includes('youtu.be/')) {
    sanitizedQuery = sanitizedQuery.replace(/([?&])list=RD[^&]+/i, '$1').replace(/([?&])start_radio=1/i, '$1');
  }

  const isUrl = sanitizedQuery.startsWith('http://') || sanitizedQuery.startsWith('https://') || sanitizedQuery.startsWith('spotify:');
  const provider = providerRegistry.resolveProvider(sanitizedQuery, defaultSource);

  try {
    if (isUrl) {
      const metadata = await provider.getMetadata(sanitizedQuery, requester);
      providerRegistry.recordOutcome(provider.name, null);
      return {
        isPlaylist: metadata.isPlaylist,
        tracks: metadata.tracks,
        playlist: metadata.playlistInfo || null
      };
    } else {
      // Check search cache
      const cached = cache.getSearch(sanitizedQuery, provider.name);
      if (cached && cached.length > 0) {
        return {
          isPlaylist: false,
          tracks: cached.map(t => ({ ...t, requester })),
          playlist: null
        };
      }

      const results = await provider.search(sanitizedQuery, 5, requester);
      providerRegistry.recordOutcome(provider.name, null);

      if (results.length === 0) {
        throw new NoMatchError(cleanQuery);
      }

      cache.setSearch(sanitizedQuery, provider.name, results, 1800);

      return {
        isPlaylist: false,
        tracks: results,
        playlist: null
      };
    }
  } catch (err) {
    providerRegistry.recordOutcome(provider.name, err);

    // If search on primary provider failed and query was plain text, try fallback provider
    if (!isUrl && provider.name !== 'soundcloud') {
      const fallbackProvider = providerRegistry.get('soundcloud');
      if (fallbackProvider && providerRegistry.isAvailable('soundcloud')) {
        logger.info('Resolver', `Primary search on ${provider.name} failed (${err.message}). Trying SoundCloud fallback...`);
        try {
          const fallbackResults = await fallbackProvider.search(sanitizedQuery, 5, requester);
          if (fallbackResults.length > 0) {
            return {
              isPlaylist: false,
              tracks: fallbackResults,
              playlist: null
            };
          }
        } catch {}
      }
    }

    throw err;
  }
}

/**
 * Searches for tracks to display in interactive search menus
 * @param {string} query 
 * @param {number} limit 
 * @param {string} source 
 * @param {object} requester 
 * @returns {Promise<Array<object>>}
 */
async function searchTracks(query, limit = 5, source = 'youtube', requester = null) {
  const provider = providerRegistry.get(source) || providerRegistry.get('youtube');
  return await provider.search(query, limit, requester);
}

/**
 * Lazily resolves a playable audio source for a track (e.g. Spotify -> YouTube/SoundCloud match)
 * @param {object} track 
 * @returns {Promise<{ source: string, url: string }>}
 */
async function resolvePlayable(track) {
  if (track.resolvedSource && track.resolvedSource.url) {
    return track.resolvedSource;
  }

  // 1. YouTube, SoundCloud, Direct already have direct URL
  if (track.originSource === 'youtube' || track.originSource === 'soundcloud' || track.originSource === 'direct') {
    const url = track.originRef || track.webpageUrl || track.url;
    track.resolvedSource = { source: track.originSource, url };
    return track.resolvedSource;
  }

  // 2. Spotify metadata-only track: match to playable source
  if (track.originSource === 'spotify') {
    const spotifyProvider = providerRegistry.get('spotify');
    const youtubeProvider = providerRegistry.get('youtube');
    const soundcloudProvider = providerRegistry.get('soundcloud');

    const match = await spotifyProvider.matchTrack(track, youtubeProvider, soundcloudProvider);
    track.resolvedSource = {
      source: match.source,
      url: match.url
    };
    logger.info('Resolver', `Matched Spotify track "${track.title}" to ${match.source} (${match.url}) with score ${match.score}`);
    return track.resolvedSource;
  }

  throw new MusicError(`Unknown origin source for track: ${track.originSource}`);
}

module.exports = {
  resolveQuery,
  searchTracks,
  resolvePlayable
};
