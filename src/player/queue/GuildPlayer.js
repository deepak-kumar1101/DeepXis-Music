/**
 * DeepXis Music Bot - Guild Player State Machine & Queue Manager
 * Explicit state enum with per-guild Async Mutex locking and mixed-origin track support.
 */

const {
  createAudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const AudioPipeline = require('../pipeline/AudioPipeline');
const { resolvePlayable } = require('../resolver');
const { createPlayerPanel } = require('../../ui/playerPanel');
const historyQueries = require('../../database/queries/historyQueries');
const logger = require('../../utils/logger');
const config = require('../../config/config');

const PlayerState = Object.freeze({
  IDLE: 'Idle',
  RESOLVING: 'Resolving',
  BUFFERING: 'Buffering',
  PLAYING: 'Playing',
  PAUSED: 'Paused',
  STOPPING: 'Stopping',
  ERROR: 'Error'
});

class GuildPlayer {
  constructor(guildId, voiceConnection, textChannel) {
    this.guildId = guildId;
    this.connection = voiceConnection;
    this.textChannel = textChannel;

    this.state = PlayerState.IDLE;
    this.tracks = this._initTracksArray([]);
    this.history = this._initHistoryArray([]);
    this.currentTrack = null;
    this.loopMode = 0; // 0 = off, 1 = track, 2 = queue, 3 = autoplay
    this.volume = config.player.defaultVolume || 80;

    this.trackStartTime = 0;
    this.pauseStartTime = 0;
    this.totalPausedMs = 0;
    this.lastPanelMessage = null;
    this.activeStream = null;

    // Per-guild Async Mutex queue
    this._lockQueue = Promise.resolve();

    // Create @discordjs/voice AudioPlayer
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });

    if (this.connection) {
      this.connection.subscribe(this.audioPlayer);
    }

    this._setupPlayerEvents();
  }

  _initTracksArray(arr) {
    const self = this;
    if (!Object.prototype.hasOwnProperty.call(arr, 'size')) {
      Object.defineProperty(arr, 'size', {
        get() { return this.length; },
        configurable: true
      });
    }
    arr.toArray = function() { return [...this]; };
    arr.shuffle = function() { return self.shuffle(); };
    arr.clear = function() { return self.clear(); };
    return arr;
  }

  _initHistoryArray(arr) {
    const self = this;
    if (!Object.prototype.hasOwnProperty.call(arr, 'size')) {
      Object.defineProperty(arr, 'size', {
        get() { return this.length; },
        configurable: true
      });
    }
    arr.tracks = {
      get size() { return arr.length; },
      toArray() { return [...arr]; }
    };
    arr.back = function() { return self.previous(); };
    return arr;
  }

  get repeatMode() {
    return this.loopMode;
  }

  get metadata() {
    return {
      lastPanelMessage: this.lastPanelMessage
    };
  }

  get node() {
    return {
      play: () => this.play(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      stop: () => this.stop(),
      skip: () => this.skip(),
      seek: (ms) => this.seek(typeof ms === 'number' ? Math.floor(ms / 1000) : 0),
      setVolume: (vol) => this.setVolume(vol),
      isPaused: () => this.state === PlayerState.PAUSED,
      isPlaying: () => this.isPlaying(),
      remove: (idx) => this.remove(idx),
      move: (from, to) => this.move(from, to),
      getTimestamp: () => ({ current: { value: this.getPlaybackDuration() } }),
      get volume() { return this.volume; }
    };
  }

  /**
   * Execute an operation inside the per-guild Async Mutex lock
   * @param {() => Promise<any>} fn 
   * @returns {Promise<any>}
   */
  async withLock(fn) {
    const next = this._lockQueue.then(async () => {
      try {
        return await fn();
      } catch (err) {
        throw err;
      }
    });
    this._lockQueue = next.catch(() => {});
    return next;
  }

  _setupPlayerEvents() {
    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      this.state = PlayerState.PLAYING;
      logger.debug('GuildPlayer', `AudioPlayer entered PLAYING state in guild ${this.guildId}`);
    });

    this.audioPlayer.on(AudioPlayerStatus.Paused, () => {
      this.state = PlayerState.PAUSED;
    });

    this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      if (this.state === PlayerState.STOPPING) {
        this.state = PlayerState.IDLE;
        return;
      }

      logger.debug('GuildPlayer', `Track completed in guild ${this.guildId}`);
      await this.withLock(async () => {
        await this._handleTrackEnd();
      });
    });

    this.audioPlayer.on('error', async (error) => {
      logger.error('GuildPlayer', `Audio player error in guild ${this.guildId}: ${error.message}`);
      await this.withLock(async () => {
        await this.skip();
      });
    });
  }

  async _handleTrackEnd() {
    if (!this.currentTrack) return;

    this.history.unshift(this.currentTrack);
    if (this.history.length > 50) this.history.pop();

    if (this.loopMode === 1) {
      // Loop Current Track: replay same track
      await this._playTrack(this.currentTrack);
      return;
    }

    if (this.loopMode === 2) {
      // Loop Queue: add back to end of queue
      this.tracks.push(this.currentTrack);
    }

    if (this.tracks.length > 0) {
      const nextTrack = this.tracks.shift();
      await this._playTrack(nextTrack);
    } else {
      this.currentTrack = null;
      this.state = PlayerState.IDLE;
      this._destroyStream();
      this._sendQueueFinishedPanel();
    }
  }

  _destroyStream() {
    if (this.activeStream && typeof this.activeStream.destroy === 'function') {
      this.activeStream.destroy();
      this.activeStream = null;
    }
  }

  /**
   * Add one or multiple tracks to the queue
   * @param {object|Array<object>} trackOrTracks 
   */
  addTracks(trackOrTracks) {
    const items = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    const maxQueue = config.player.maxQueue || 500;

    for (const track of items) {
      if (this.tracks.length >= maxQueue) break;
      this.tracks.push(track);
    }
  }

  addTrack(trackOrTracks) {
    return this.addTracks(trackOrTracks);
  }

  /**
   * Begin or advance playback
   */
  async play() {
    return this.withLock(async () => {
      if (this.state === PlayerState.PLAYING || this.state === PlayerState.BUFFERING) {
        return;
      }

      if (this.state === PlayerState.PAUSED) {
        this.resume();
        return;
      }

      if (!this.currentTrack && this.tracks.length > 0) {
        const nextTrack = this.tracks.shift();
        await this._playTrack(nextTrack);
      }
    });
  }

  /**
   * Internal track player logic
   */
  async _playTrack(track, seekSec = 0) {
    this._destroyStream();
    this.currentTrack = track;
    this.state = PlayerState.RESOLVING;

    try {
      // 1. Lazy resolution of playable source (Spotify -> YouTube / SoundCloud)
      logger.info('GuildPlayer', `Resolving playable source for "${track.title}" in guild ${this.guildId}`);
      await resolvePlayable(track);

      this.state = PlayerState.BUFFERING;

      // 2. Spawn Audio Pipeline
      const streamObj = await AudioPipeline.createStream(this.guildId, track, {
        volume: this.volume,
        seek: seekSec,
        onStall: () => {
          logger.warn('GuildPlayer', `Handling stream stall for "${track.title}"`);
          this.withLock(() => this.skip());
        }
      });

      this.activeStream = streamObj;
      this.trackStartTime = Date.now() - (seekSec * 1000);
      this.totalPausedMs = 0;
      this.pauseStartTime = 0;

      // 3. Play Resource
      this.audioPlayer.play(streamObj.resource);

      // 4. Update UI Panel
      this._updatePlayerPanel(track);

      // 5. Log playback history
      if (track.requester || track.requestedBy) {
        const reqUser = track.requester || track.requestedBy;
        historyQueries.logPlayback(
          this.guildId,
          reqUser.id,
          track.title,
          track.artist || track.author,
          track.originSource || 'web'
        ).catch(() => {});
      }

      // 6. Background Prefetch next track if available
      this._prefetchNextTrack();
    } catch (err) {
      logger.error('GuildPlayer', `Playback failed for "${track.title}": ${err.message}`);
      if (this.textChannel) {
        const { createErrorEmbed } = require('../../utils/errors');
        this.textChannel.send({ embeds: [createErrorEmbed(err)] }).catch(() => {});
      }
      // Advance to next track on failure
      await this._handleTrackEnd();
    }
  }

  /**
   * Prefetches the next track's playable audio stream resolution in the background
   */
  async _prefetchNextTrack() {
    if (this.tracks.length > 0) {
      const next = this.tracks[0];
      if (!next.resolvedSource) {
        resolvePlayable(next).catch(() => {});
      }
    }
  }

  async skip() {
    return this.withLock(async () => {
      this.audioPlayer.stop(true);
      this._destroyStream();

      if (this.tracks.length > 0) {
        const nextTrack = this.tracks.shift();
        await this._playTrack(nextTrack);
      } else {
        this.currentTrack = null;
        this.state = PlayerState.IDLE;
        this._sendQueueFinishedPanel();
      }
    });
  }

  async previous() {
    return this.withLock(async () => {
      if (this.history.length === 0) return false;
      const prev = this.history.shift();

      if (this.currentTrack) {
        this.tracks.unshift(this.currentTrack);
      }

      await this._playTrack(prev);
      return true;
    });
  }

  pause() {
    if (this.state === PlayerState.PLAYING) {
      this.audioPlayer.pause();
      this.state = PlayerState.PAUSED;
      this.pauseStartTime = Date.now();
      return true;
    }
    return false;
  }

  resume() {
    if (this.state === PlayerState.PAUSED) {
      if (this.pauseStartTime > 0) {
        this.totalPausedMs += (Date.now() - this.pauseStartTime);
        this.pauseStartTime = 0;
      }
      this.audioPlayer.unpause();
      this.state = PlayerState.PLAYING;
      return true;
    }
    return false;
  }

  async stop() {
    return this.withLock(async () => {
      this.state = PlayerState.STOPPING;
      this.tracks.length = 0;
      this.currentTrack = null;
      this.audioPlayer.stop(true);
      this._destroyStream();
      this.state = PlayerState.IDLE;
      this._sendQueueFinishedPanel();
    });
  }

  async seek(seconds) {
    return this.withLock(async () => {
      if (!this.currentTrack) return false;
      await this._playTrack(this.currentTrack, seconds);
      return true;
    });
  }

  setVolume(vol) {
    this.volume = Math.min(100, Math.max(1, vol));
    return this.volume;
  }

  setLoopMode(mode) {
    this.loopMode = typeof mode === 'number' ? mode : (mode === 'track' ? 1 : mode === 'queue' ? 2 : mode === 'autoplay' ? 3 : 0);
    return this.loopMode;
  }

  setRepeatMode(mode) {
    return this.setLoopMode(mode);
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    return this.tracks;
  }

  remove(index) {
    if (index >= 0 && index < this.tracks.length) {
      return this.tracks.splice(index, 1)[0];
    }
    return null;
  }

  move(fromIndex, toIndex) {
    if (fromIndex >= 0 && fromIndex < this.tracks.length && toIndex >= 0 && toIndex < this.tracks.length) {
      const [item] = this.tracks.splice(fromIndex, 1);
      this.tracks.splice(toIndex, 0, item);
      return true;
    }
    return false;
  }

  clear() {
    this.tracks.length = 0;
  }

  isPlaying() {
    return this.state === PlayerState.PLAYING || this.state === PlayerState.BUFFERING;
  }

  getPlaybackDuration() {
    if (!this.trackStartTime) return 0;
    if (this.state === PlayerState.PAUSED && this.pauseStartTime > 0) {
      return this.pauseStartTime - this.trackStartTime - this.totalPausedMs;
    }
    return Date.now() - this.trackStartTime - this.totalPausedMs;
  }

  async _updatePlayerPanel(track) {
    if (!this.textChannel) return;

    try {
      // Adapts queue structure for existing UI panel builder
      const panel = await createPlayerPanel(track, this, true);

      if (this.lastPanelMessage) {
        try { await this.lastPanelMessage.delete(); } catch {}
      }

      this.lastPanelMessage = await this.textChannel.send(panel);
    } catch (err) {
      logger.error('GuildPlayer', 'Failed to render player dashboard panel', err);
    }
  }

  async _sendQueueFinishedPanel() {
    if (!this.textChannel) return;
    try {
      const { createInfoEmbed } = require('../../ui/embeds');
      await this.textChannel.send({
        embeds: [createInfoEmbed('Queue playback has concluded.')]
      });
    } catch {}
  }
}

module.exports = {
  GuildPlayer,
  PlayerState
};
