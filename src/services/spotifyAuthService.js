/**
 * DeepXis Music Bot - Spotify OAuth2 Authentication Service
 * Manages user authorization, token exchange, auto-refresh, and user playlist retrieval.
 */

const crypto = require('crypto');
const SpotifyWebApi = require('spotify-web-api-node');
const config = require('../config/config');
const spotifyQueries = require('../database/queries/spotifyQueries');
const logger = require('../utils/logger');

// Scopes required to fetch personal and collaborative playlists and saved music
const OAUTH_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-private'
];

// Active OAuth state tracking with 15-minute expiration
const stateMap = new Map();
const STATE_TTL_MS = 15 * 60 * 1000;

// Periodic cleanup of expired states
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateMap.entries()) {
    if (now - data.createdAt > STATE_TTL_MS) {
      stateMap.delete(state);
    }
  }
}, 5 * 60 * 1000).unref();

const spotifyAuthService = {
  /**
   * Check whether Spotify OAuth is configured with credentials
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(config.spotify.clientId && config.spotify.clientSecret);
  },

  /**
   * Generates a Spotify OAuth2 authorization URL tied to a specific Discord user
   * @param {string} discordUserId 
   * @returns {string} Authorization URL
   */
  generateAuthUrl(discordUserId) {
    if (!this.isConfigured()) {
      throw new Error('Spotify credentials (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET) are not configured in .env');
    }

    const stateToken = crypto.randomBytes(24).toString('hex');
    stateMap.set(stateToken, {
      discordUserId,
      createdAt: Date.now()
    });

    const redirectUri = config.spotify.redirectUri || `http://127.0.0.1:${config.server.port}/api/spotify/callback`;

    const authApi = new SpotifyWebApi({
      clientId: config.spotify.clientId,
      clientSecret: config.spotify.clientSecret,
      redirectUri
    });

    return authApi.createAuthorizeURL(OAUTH_SCOPES, stateToken, true);
  },

  /**
   * Find any unexpired active state token for a Discord user
   * @param {string} discordUserId 
   * @returns {string|null}
   */
  findActiveState(discordUserId) {
    const now = Date.now();
    for (const [stateToken, data] of stateMap.entries()) {
      if (data.discordUserId === discordUserId && (now - data.createdAt <= STATE_TTL_MS)) {
        return stateToken;
      }
    }
    return null;
  },

  /**
   * Robust parser for redirect URLs, query strings, or raw code inputs
   * Strips URL fragments (#_=_), handles missing protocol, and detects authorize URLs
   * @param {string} input 
   * @returns {{ code: string|null, state: string|null, isAuthorizeUrl: boolean }}
   */
  extractCodeAndState(input) {
    if (!input || typeof input !== 'string') {
      return { code: null, state: null, isAuthorizeUrl: false };
    }

    let str = input.trim();

    // Check if user accidentally pasted the authorize URL instead of the callback URL
    if (str.includes('/authorize') || (str.includes('accounts.spotify.com') && !str.includes('code='))) {
      return { code: null, state: null, isAuthorizeUrl: true };
    }

    // Strip trailing hash fragments (like #_=_ commonly appended by OAuth providers)
    str = str.replace(/#.*$/, '').trim();

    let code = null;
    let state = null;

    // Try standard WHATWG URL parsing (prepend protocol if missing)
    const urlToTry = str.includes('://') ? str : `http://${str}`;
    try {
      const parsed = new URL(urlToTry);
      code = parsed.searchParams.get('code');
      state = parsed.searchParams.get('state');
    } catch {
      // Not a valid URL structure, will fall back to regex
    }

    // If not extracted via URL searchParams, try regex matching
    if (!code) {
      const cMatch = str.match(/[?&]code=([^&#\s]+)/) || str.match(/^code=([^&#\s]+)/);
      if (cMatch) {
        code = decodeURIComponent(cMatch[1]);
      }
    }

    if (!state) {
      const sMatch = str.match(/[?&]state=([^&#\s]+)/) || str.match(/^state=([^&#\s]+)/);
      if (sMatch) {
        state = decodeURIComponent(sMatch[1]);
      }
    }

    // If still no code and the input is a plain alphanumeric token without URL symbols
    if (!code && !str.includes('?') && !str.includes('/') && !str.includes('&')) {
      code = str;
    }

    if (code) {
      code = code.trim().replace(/#.*$/, '');
    }
    if (state) {
      state = state.trim().replace(/#.*$/, '');
    }

    return { code, state, isAuthorizeUrl: false };
  },

  /**
   * Translates Spotify Web API errors and objects into clear human-readable messages
   * Unpacks WebapiError: [object Object] into status codes and specific instructions
   * @param {any} err 
   * @returns {string}
   */
  formatSpotifyError(err) {
    if (!err) return 'An unknown Spotify error occurred.';
    if (typeof err === 'string') return err;

    const body = err.body || err.response?.body;
    const statusCode = err.statusCode || err.status || body?.error?.status || body?.status;

    let detailMessage = null;
    if (body) {
      if (typeof body === 'string') {
        detailMessage = body;
      } else if (typeof body.error === 'string') {
        detailMessage = body.error_description ? `${body.error}: ${body.error_description}` : body.error;
      } else if (body.error && typeof body.error === 'object' && body.error.message) {
        detailMessage = body.error.message;
      } else if (body.error_description) {
        detailMessage = body.error_description;
      } else if (body.message) {
        detailMessage = body.message;
      }
    }

    if (!detailMessage && err.message && err.message !== '[object Object]') {
      detailMessage = err.message;
    }

    // 401 Unauthorized - Session expired
    if (statusCode === 401) {
      return 'Your Spotify session has expired. Please run `/spotify login` to reconnect your account.';
    }

    // 403 Forbidden - Spotify Developer Mode restriction
    if (statusCode === 403) {
      return (
        '**Spotify API Access Denied (403 Forbidden)**\n\n' +
        'Spotify apps in **Development Mode** require the bot developer to manually add users to the **User Management** allowlist in the Spotify Developer Dashboard.\n\n' +
        '**Solutions:**\n' +
        '1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) -> Your App -> **Settings** -> **User Management**, and add your Spotify email.\n' +
        '2. **Stream directly without login:** You can play any public Spotify playlist anytime with `/play <playlist_url>` (e.g. `/play https://open.spotify.com/playlist/...`) without connecting an account!'
      );
    }

    // 400 Bad Request with invalid_grant (code expired or already used)
    if (statusCode === 400 && detailMessage && detailMessage.toLowerCase().includes('invalid_grant')) {
      return (
        '**Authorization Code Expired or Already Used (400)**\n\n' +
        'Spotify authorization codes expire quickly and can only be redeemed once.\n' +
        'Please run `/spotify login` again, open the link, and immediately paste the new redirected URL.'
      );
    }

    // 429 Rate Limit
    if (statusCode === 429) {
      return 'Spotify rate limit reached. Please wait a few seconds before trying again.';
    }

    if (detailMessage) {
      return `Spotify Error${statusCode ? ` (${statusCode})` : ''}: ${detailMessage}`;
    }

    if (statusCode) {
      return `Spotify Web API request failed with status code ${statusCode}.`;
    }

    return err.message && err.message !== '[object Object]' ? err.message : 'Could not complete Spotify operation. Please try again.';
  },

  /**
   * Handle OAuth2 callback: validate state, exchange code for tokens, fetch profile, and persist
   * @param {string} code Authorization code from Spotify
   * @param {string} state State token returned from Spotify
   * @param {string} [discordUserIdFallback] Optional Discord user ID if state was not provided in input
   * @returns {Promise<{ success: boolean, discordUserId: string, displayName: string, spotifyId: string }>}
   */
  async handleOAuthCallback(code, state, discordUserIdFallback = null) {
    // Sanitize code
    const cleanCode = (code || '').trim().replace(/#.*$/, '');
    if (!cleanCode) {
      throw new Error('Authorization code is missing or empty.');
    }

    let resolvedState = state ? state.trim().replace(/#.*$/, '') : null;
    if ((!resolvedState || !stateMap.has(resolvedState)) && discordUserIdFallback) {
      resolvedState = this.findActiveState(discordUserIdFallback);
    }

    let discordUserId = discordUserIdFallback;
    if (resolvedState && stateMap.has(resolvedState)) {
      const stateData = stateMap.get(resolvedState);
      stateMap.delete(resolvedState);
      discordUserId = stateData.discordUserId;
    }

    if (!discordUserId) {
      throw new Error('Invalid or expired login session. Please run `/spotify login` in Discord again.');
    }

    const redirectUri = config.spotify.redirectUri || `http://127.0.0.1:${config.server.port}/api/spotify/callback`;

    const userApi = new SpotifyWebApi({
      clientId: config.spotify.clientId,
      clientSecret: config.spotify.clientSecret,
      redirectUri
    });

    // 1. Exchange authorization code for access & refresh tokens
    let tokenRes;
    try {
      tokenRes = await userApi.authorizationCodeGrant(cleanCode);
    } catch (err) {
      logger.error('SpotifyAuth', `Failed to exchange authorization code for Discord user ${discordUserId}`, err);
      throw new Error(this.formatSpotifyError(err));
    }

    const accessToken = tokenRes.body['access_token'];
    const refreshToken = tokenRes.body['refresh_token'];
    const expiresIn = tokenRes.body['expires_in'] || 3600;
    const scope = tokenRes.body['scope'] || OAUTH_SCOPES.join(' ');

    userApi.setAccessToken(accessToken);
    userApi.setRefreshToken(refreshToken);

    // 2. Fetch user's Spotify profile
    let spotifyId = 'unknown';
    let displayName = 'Spotify User';
    try {
      const meRes = await userApi.getMe();
      spotifyId = meRes.body.id || spotifyId;
      displayName = meRes.body.display_name || meRes.body.id || displayName;
    } catch (err) {
      logger.warn('SpotifyAuth', `Could not fetch /me for Discord user ${discordUserId}: ${this.formatSpotifyError(err)}`);
    }

    // 3. Persist account to database & cache
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));
    await spotifyQueries.saveAccount({
      discordId: discordUserId,
      spotifyId,
      displayName,
      accessToken,
      refreshToken,
      expiresAt,
      scope
    });

    logger.info('SpotifyAuth', `Successfully connected Spotify account (${displayName}) for Discord user ${discordUserId}`);

    return {
      success: true,
      discordUserId,
      displayName,
      spotifyId
    };
  },

  /**
   * Get an authenticated SpotifyWebApi instance with auto token refresh
   * @param {string} discordUserId 
   * @returns {Promise<SpotifyWebApi|null>}
   */
  async getUserSpotifyApi(discordUserId) {
    const account = await spotifyQueries.getAccount(discordUserId);
    if (!account) return null;

    const redirectUri = config.spotify.redirectUri || `http://127.0.0.1:${config.server.port}/api/spotify/callback`;

    const userApi = new SpotifyWebApi({
      clientId: config.spotify.clientId,
      clientSecret: config.spotify.clientSecret,
      redirectUri
    });

    userApi.setAccessToken(account.access_token);
    userApi.setRefreshToken(account.refresh_token);

    // Check if access token is expired or expiring within 60 seconds
    const expiresAt = new Date(account.expires_at).getTime();
    if (Date.now() >= expiresAt - 60000) {
      try {
        const refreshRes = await userApi.refreshAccessToken();
        const newAccessToken = refreshRes.body['access_token'];
        const expiresIn = refreshRes.body['expires_in'] || 3600;
        const newExpiresAt = new Date(Date.now() + (expiresIn * 1000));

        userApi.setAccessToken(newAccessToken);
        await spotifyQueries.updateTokens(discordUserId, newAccessToken, newExpiresAt);
        logger.debug('SpotifyAuth', `Refreshed access token for Discord user ${discordUserId}`);
      } catch (err) {
        logger.error('SpotifyAuth', `Failed to refresh token for Discord user ${discordUserId}`, err);
        throw new Error('Your Spotify authorization has expired. Please run `/spotify login` to reconnect.');
      }
    }

    return userApi;
  },

  /**
   * Internal helper to fetch user playlists via SpotifyWebApi
   * @param {SpotifyWebApi} userApi 
   * @param {number} limit 
   * @returns {Promise<Array<object>>}
   */
  async _fetchPlaylistsFromApi(userApi, limit = 25) {
    const res = await userApi.getUserPlaylists({ limit: Math.min(50, limit), offset: 0 });
    const items = res.body?.items || [];

    return items.map(p => ({
      id: p.id,
      name: p.name || 'Untitled Playlist',
      description: p.description || '',
      trackCount: p.tracks?.total || 0,
      url: p.external_urls?.spotify || `https://open.spotify.com/playlist/${p.id}`,
      imageUrl: p.images?.[0]?.url || null,
      owner: p.owner?.display_name || p.owner?.id || 'Unknown',
      isPublic: Boolean(p.public),
      collaborative: Boolean(p.collaborative)
    }));
  },

  /**
   * Fetch playlists for a connected Discord user with automatic 401 retry & token refresh
   * @param {string} discordUserId 
   * @param {number} limit Max playlists to return (1-50, default 25)
   * @returns {Promise<{ connected: boolean, displayName?: string, playlists: Array<object>, total: number }>}
   */
  async getUserPlaylists(discordUserId, limit = 25) {
    const account = await spotifyQueries.getAccount(discordUserId);
    if (!account) {
      return { connected: false, playlists: [], total: 0 };
    }

    const userApi = await this.getUserSpotifyApi(discordUserId);
    if (!userApi) {
      return { connected: false, playlists: [], total: 0 };
    }

    try {
      const playlists = await this._fetchPlaylistsFromApi(userApi, limit);
      return {
        connected: true,
        displayName: account.display_name || 'User',
        spotifyId: account.spotify_id,
        playlists,
        total: playlists.length
      };
    } catch (err) {
      const statusCode = err.statusCode || err.status || err.body?.error?.status || err.body?.status;

      // If 401 Unauthorized (invalid or expired token), attempt one forced token refresh and retry
      if (statusCode === 401 && account.refresh_token) {
        logger.warn('SpotifyAuth', `Access token expired for user ${discordUserId}, attempting token refresh & retry`);
        try {
          const refreshRes = await userApi.refreshAccessToken();
          const newAccessToken = refreshRes.body['access_token'];
          const expiresIn = refreshRes.body['expires_in'] || 3600;
          const newExpiresAt = new Date(Date.now() + (expiresIn * 1000));

          userApi.setAccessToken(newAccessToken);
          await spotifyQueries.updateTokens(discordUserId, newAccessToken, newExpiresAt);

          const playlists = await this._fetchPlaylistsFromApi(userApi, limit);
          return {
            connected: true,
            displayName: account.display_name || 'User',
            spotifyId: account.spotify_id,
            playlists,
            total: playlists.length
          };
        } catch (refreshErr) {
          logger.error('SpotifyAuth', `Token refresh retry failed for Discord user ${discordUserId}`, refreshErr);
          throw new Error(this.formatSpotifyError(refreshErr));
        }
      }

      logger.error('SpotifyAuth', `Failed to retrieve playlists for Discord user ${discordUserId}: ${this.formatSpotifyError(err)}`);
      throw new Error(this.formatSpotifyError(err));
    }
  },

  /**
   * Get connected account status for a Discord user
   * @param {string} discordUserId 
   */
  async getStatus(discordUserId) {
    const account = await spotifyQueries.getAccount(discordUserId);
    if (!account) return { connected: false };

    return {
      connected: true,
      spotifyId: account.spotify_id,
      displayName: account.display_name,
      connectedAt: account.created_at,
      updatedAt: account.updated_at
    };
  },

  /**
   * Disconnect and clear user's Spotify connection
   * @param {string} discordUserId 
   */
  async disconnect(discordUserId) {
    return await spotifyQueries.deleteAccount(discordUserId);
  }
};

module.exports = spotifyAuthService;
