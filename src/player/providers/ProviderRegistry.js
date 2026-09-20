/**
 * DeepXis Music Bot - Multi-Source Provider Registry & Circuit Breaker
 * Dispatches queries to providers with 5-minute circuit-breaker protection on provider-level outages.
 */

const YouTubeProvider = require('./YouTubeProvider');
const SoundCloudProvider = require('./SoundCloudProvider');
const SpotifyProvider = require('./SpotifyProvider');
const DirectUrlProvider = require('./DirectUrlProvider');
const logger = require('../../utils/logger');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.circuitBreakers = new Map(); // name -> { consecutiveFailures, cooldownUntil }

    this.register(new YouTubeProvider());
    this.register(new SoundCloudProvider());
    this.register(new SpotifyProvider());
    this.register(new DirectUrlProvider());
  }

  register(provider) {
    this.providers.set(provider.name, provider);
    this.circuitBreakers.set(provider.name, {
      consecutiveFailures: 0,
      cooldownUntil: 0
    });
  }

  get(name) {
    return this.providers.get(name) || null;
  }

  getProvider(name) {
    return this.get(name);
  }

  /**
   * Check if a provider is currently open / available (not on cooldown)
   * @param {string} name 
   * @returns {boolean}
   */
  isAvailable(name) {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return true;
    if (cb.cooldownUntil > 0 && Date.now() < cb.cooldownUntil) {
      return false; // Still in cooldown
    }
    if (cb.cooldownUntil > 0 && Date.now() >= cb.cooldownUntil) {
      // Cooldown expired, half-open state
      cb.cooldownUntil = 0;
      cb.consecutiveFailures = 0;
    }
    return true;
  }

  isTripped(name) {
    return !this.isAvailable(name);
  }

  resetCircuit(name) {
    const cb = this.circuitBreakers.get(name);
    if (cb) {
      cb.consecutiveFailures = 0;
      cb.cooldownUntil = 0;
    }
  }

  /**
   * Record a provider operation outcome
   * Only provider-level failures (bot checks, JS runtime missing, timeouts, network, SABR) trip the breaker.
   * Per-video errors (age-restricted, private, removed, geoblocked) do NOT trip the breaker.
   * @param {string} name 
   * @param {Error} [err] 
   */
  recordOutcome(name, err = null) {
    let cb = this.circuitBreakers.get(name);
    if (!cb) {
      cb = { consecutiveFailures: 0, cooldownUntil: 0 };
      this.circuitBreakers.set(name, cb);
    }

    if (!err) {
      // Success: reset failure counter
      cb.consecutiveFailures = 0;
      cb.cooldownUntil = 0;
      return;
    }

    const code = err.code || '';
    const msg = (err.message || '').toLowerCase();
    const isProviderLevelError = (
      code === 'BOT_CHECK' ||
      code === 'JS_RUNTIME_MISSING' ||
      code === 'TIMEOUT' ||
      code === 'NETWORK_ERROR' ||
      code === 'FORMAT_MISSING' ||
      code === 'RATE_LIMITED' ||
      msg.includes('bot') ||
      msg.includes('network') ||
      msg.includes('timeout')
    );

    if (isProviderLevelError) {
      cb.consecutiveFailures++;
      logger.warn('CircuitBreaker', `Provider "${name}" recorded failure (${cb.consecutiveFailures}/3): ${err.message}`);

      if (cb.consecutiveFailures >= 3) {
        cb.cooldownUntil = Date.now() + (5 * 60 * 1000); // 5 minute cooldown
        logger.error('CircuitBreaker', `Circuit breaker TRIPPED for provider "${name}". Skipping provider for 5 minutes.`);
      }
    }
  }

  recordFailure(name, err) {
    return this.recordOutcome(name, err);
  }

  /**
   * Determine the appropriate provider for an input string or query
   * @param {string} input 
   * @param {string} defaultSource 
   * @returns {BaseProvider}
   */
  resolveProvider(input, defaultSource = 'youtube') {
    // 1. Direct URL check
    for (const [name, provider] of this.providers.entries()) {
      if (provider.canHandle(input)) {
        if (this.isAvailable(name)) {
          return provider;
        }
        logger.warn('CircuitBreaker', `Provider "${name}" matches URL but is on cooldown. Attempting fallback...`);
      }
    }

    // 2. Default search source check
    const preferred = this.get(defaultSource);
    if (preferred && this.isAvailable(defaultSource)) {
      return preferred;
    }

    // 3. Fallback chain: YouTube -> SoundCloud -> Spotify
    const fallbackOrder = ['youtube', 'soundcloud', 'spotify'];
    for (const name of fallbackOrder) {
      if (this.isAvailable(name)) {
        return this.get(name);
      }
    }

    // Default to YouTube as last resort
    return this.get('youtube');
  }

  /**
   * Health status map for /music-diagnose
   */
  async getHealthStatus() {
    const status = {};
    for (const [name, provider] of this.providers.entries()) {
      const cb = this.circuitBreakers.get(name) || { consecutiveFailures: 0, cooldownUntil: 0 };
      const isCooling = cb.cooldownUntil > 0 && Date.now() < cb.cooldownUntil;
      const check = await provider.healthCheck().catch(e => ({ healthy: false, message: e.message }));

      status[name] = {
        healthy: check.healthy && !isCooling,
        circuitBreaker: isCooling ? `Tripped (cooldown: ${Math.ceil((cb.cooldownUntil - Date.now()) / 1000)}s)` : 'Closed (Operational)',
        consecutiveFailures: cb.consecutiveFailures,
        detail: check.message || null
      };
    }
    return status;
  }
}

// Global Singleton
const registry = new ProviderRegistry();
module.exports = registry;
