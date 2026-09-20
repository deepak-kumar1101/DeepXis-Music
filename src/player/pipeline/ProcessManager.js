/**
 * DeepXis Music Bot - Subprocess Lifecycle & Process Tree Manager
 * Tracks spawned yt-dlp & FFmpeg processes per guild and guarantees zero zombie/orphan processes.
 */

const { execSync } = require('child_process');
const logger = require('../../utils/logger');

class ProcessManager {
  constructor() {
    this.guildProcesses = new Map(); // guildId -> Set<ChildProcess>
  }

  /**
   * Track a spawned child process under a guild
   * @param {string} guildId 
   * @param {import('child_process').ChildProcess} child 
   */
  register(guildId, child) {
    if (!guildId || !child) return;

    if (!this.guildProcesses.has(guildId)) {
      this.guildProcesses.set(guildId, new Set());
    }

    const set = this.guildProcesses.get(guildId);
    set.add(child);

    const cleanup = () => {
      set.delete(child);
      if (set.size === 0) {
        this.guildProcesses.delete(guildId);
      }
    };

    child.on('close', cleanup);
    child.on('exit', cleanup);
    child.on('error', cleanup);
  }

  /**
   * Forcibly kill the entire process tree for a guild
   * @param {string} guildId 
   */
  killGuild(guildId) {
    if (!this.guildProcesses.has(guildId)) return;

    const set = this.guildProcesses.get(guildId);
    for (const child of set) {
      this._killProcessTree(child);
    }
    this.guildProcesses.delete(guildId);
  }

  /**
   * Cross-platform process tree termination
   * @param {import('child_process').ChildProcess} child 
   */
  _killProcessTree(child) {
    if (!child || child.killed || !child.pid) return;

    const pid = child.pid;
    try {
      if (process.platform === 'win32') {
        // Windows: taskkill /T (tree) /F (force)
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        // POSIX: kill process group
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
  }

  /**
   * Kill all tracked processes across all guilds (shutdown cleanup)
   */
  killAll() {
    for (const guildId of Array.from(this.guildProcesses.keys())) {
      this.killGuild(guildId);
    }
  }
}

// Global Singleton
const processManager = new ProcessManager();
module.exports = processManager;
