/**
 * DeepXis Music Bot - Base Provider Interface
 * Abstract contract for audio and metadata providers (YouTube, SoundCloud, Spotify, Direct URL).
 */

class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Check if this provider handles the given query/URL
   * @param {string} input 
   * @returns {boolean}
   */
  canHandle(input) {
    throw new Error('canHandle() must be implemented by provider');
  }

  /**
   * Search for tracks matching query
   * @param {string} query 
   * @param {number} limit 
   * @param {object} requester 
   * @returns {Promise<Array<object>>}
   */
  async search(query, limit = 5, requester = null) {
    throw new Error('search() must be implemented by provider');
  }

  /**
   * Get metadata for a specific URL or reference
   * @param {string} ref 
   * @param {object} requester 
   * @returns {Promise<{ isPlaylist: boolean, tracks: Array<object>, playlistInfo?: object }>}
   */
  async getMetadata(ref, requester = null) {
    throw new Error('getMetadata() must be implemented by provider');
  }

  /**
   * Get a playable stream configuration for a track
   * @param {object} track 
   * @param {object} options 
   * @returns {Promise<{ url?: string, stream?: any, headers?: object, isPiped: boolean }>}
   */
  async getPlayable(track, options = {}) {
    throw new Error('getPlayable() must be implemented by provider');
  }

  /**
   * Health check for circuit breaker monitoring
   * @returns {Promise<{ healthy: boolean, message?: string }>}
   */
  async healthCheck() {
    return { healthy: true };
  }
}

module.exports = BaseProvider;
