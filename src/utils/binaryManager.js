/**
 * DeepXis Music Bot - Binary & Runtime Manager
 * Discovers, downloads, validates, and auto-updates yt-dlp and ffmpeg binaries.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');
const https = require('https');
const logger = require('./logger');

let cachedYtDlpPath = null;
let cachedFFmpegPath = null;
let activeResolvesCount = 0;
let isUpdating = false;

/**
 * Acquire a resolve lock to prevent binary updates during active resolving/streaming
 */
function acquireResolveLock() {
  activeResolvesCount++;
}

/**
 * Release resolve lock
 */
function releaseResolveLock() {
  activeResolvesCount = Math.max(0, activeResolvesCount - 1);
}

/**
 * Determine the expected yt-dlp binary name for the current platform
 */
function getYtDlpFilename() {
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}

/**
 * Resolve the absolute path to the yt-dlp binary
 * @returns {string} Path to executable
 */
function resolveYtDlpPath() {
  if (cachedYtDlpPath && fs.existsSync(cachedYtDlpPath)) {
    return cachedYtDlpPath;
  }

  // 1. Check explicit environment variable
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
    cachedYtDlpPath = path.resolve(process.env.YTDLP_PATH);
    return cachedYtDlpPath;
  }

  // 2. Check local ./bin directory
  const binDir = path.resolve(process.cwd(), 'bin');
  const localBin = path.join(binDir, getYtDlpFilename());
  if (fs.existsSync(localBin)) {
    if (process.platform !== 'win32') {
      try { fs.chmodSync(localBin, 0o755); } catch {}
    }
    cachedYtDlpPath = localBin;
    return cachedYtDlpPath;
  }

  // 3. Check system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where.exe yt-dlp' : 'which yt-dlp';
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstMatch = output.split(/\r?\n/)[0];
    if (firstMatch && fs.existsSync(firstMatch)) {
      cachedYtDlpPath = firstMatch;
      return cachedYtDlpPath;
    }
  } catch {}

  // 4. Default to localBin target path
  cachedYtDlpPath = localBin;
  return cachedYtDlpPath;
}

/**
 * Resolve the absolute path to FFmpeg binary
 * @returns {string} Path to executable
 */
function resolveFFmpegPath() {
  if (cachedFFmpegPath && fs.existsSync(cachedFFmpegPath)) {
    return cachedFFmpegPath;
  }

  // 1. Check explicit environment variable
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    cachedFFmpegPath = path.resolve(process.env.FFMPEG_PATH);
    return cachedFFmpegPath;
  }

  // 2. Check ffmpeg-static package
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      if (process.platform !== 'win32') {
        try { fs.chmodSync(ffmpegStatic, 0o755); } catch {}
      }
      cachedFFmpegPath = ffmpegStatic;
      return cachedFFmpegPath;
    }
  } catch {}

  // 3. Check system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where.exe ffmpeg' : 'which ffmpeg';
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstMatch = output.split(/\r?\n/)[0];
    if (firstMatch && fs.existsSync(firstMatch)) {
      cachedFFmpegPath = firstMatch;
      return cachedFFmpegPath;
    }
  } catch {}

  cachedFFmpegPath = 'ffmpeg';
  return cachedFFmpegPath;
}

/**
 * Downloads the official standalone yt-dlp binary from GitHub releases if missing
 * @returns {Promise<string>} Path to binary
 */
async function ensureYtDlpBinary() {
  const binaryPath = resolveYtDlpPath();
  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }

  const binDir = path.dirname(binaryPath);
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const downloadUrl = process.platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  logger.info('BinaryManager', `Downloading standalone yt-dlp binary from ${downloadUrl}...`);

  return new Promise((resolve, reject) => {
    function fetchUrl(url) {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download yt-dlp: HTTP ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(binaryPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          if (process.platform !== 'win32') {
            try { fs.chmodSync(binaryPath, 0o755); } catch {}
          }
          logger.info('BinaryManager', `Successfully downloaded yt-dlp to ${binaryPath}`);
          cachedYtDlpPath = binaryPath;
          resolve(binaryPath);
        });

        fileStream.on('error', (err) => {
          try { fs.unlinkSync(binaryPath); } catch {}
          reject(err);
        });
      }).on('error', reject);
    }

    fetchUrl(downloadUrl);
  });
}

/**
 * Get current yt-dlp version
 * @returns {string|null}
 */
function getYtDlpVersion() {
  try {
    const bin = resolveYtDlpPath();
    const res = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (res.status === 0 && res.stdout) {
      return res.stdout.trim();
    }
  } catch {}
  return null;
}

/**
 * Check if the JS runtime (Node.js) meets minimum EJS requirements (Node 18+)
 * @returns {{ valid: boolean, version: string, engine: string }}
 */
function checkJsRuntime() {
  const version = process.version;
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  const valid = major >= 18;
  return { valid, version, engine: 'node' };
}

/**
 * Check if yt-dlp supports --js-runtimes flag
 * @returns {boolean}
 */
function supportsJsRuntimes() {
  try {
    const bin = resolveYtDlpPath();
    const res = spawnSync(bin, ['--help'], { encoding: 'utf8', timeout: 5000 });
    return res.stdout && res.stdout.includes('--js-runtimes');
  } catch {
    return false;
  }
}

/**
 * Auto-update yt-dlp binary with resolve locking
 */
async function updateYtDlp() {
  if (isUpdating) return;
  if (activeResolvesCount > 0) {
    logger.debug('BinaryManager', 'Skipping scheduled yt-dlp update: active resolve lock held.');
    return;
  }

  isUpdating = true;
  const bin = resolveYtDlpPath();
  const oldVersion = getYtDlpVersion() || 'unknown';

  logger.info('BinaryManager', `Checking for yt-dlp updates (current: ${oldVersion})...`);

  try {
    const child = spawn(bin, ['-U'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    child.stdout.on('data', (d) => output += d.toString());
    child.stderr.on('data', (d) => output += d.toString());

    child.on('close', (code) => {
      isUpdating = false;
      const newVersion = getYtDlpVersion() || oldVersion;
      if (code === 0) {
        if (oldVersion !== newVersion) {
          logger.info('BinaryManager', `yt-dlp updated: ${oldVersion} -> ${newVersion}`);
        } else {
          logger.info('BinaryManager', `yt-dlp is already up to date (${oldVersion}).`);
        }
      } else {
        logger.warn('BinaryManager', `yt-dlp update exited with code ${code}: ${output.trim()}`);
      }
    });

    child.on('error', (err) => {
      isUpdating = false;
      logger.warn('BinaryManager', `yt-dlp auto-update check failed non-fatally: ${err.message}`);
    });
  } catch (err) {
    isUpdating = false;
    logger.warn('BinaryManager', `yt-dlp update error: ${err.message}`);
  }
}

/**
 * Initialize binary management on startup and schedule 6-hour recurring updates
 */
async function initBinaryManager() {
  await ensureYtDlpBinary().catch((err) => {
    logger.warn('BinaryManager', `Initial yt-dlp verification warning: ${err.message}`);
  });

  const ytVer = getYtDlpVersion();
  const jsRuntime = checkJsRuntime();

  logger.info('BinaryManager', `yt-dlp resolved: ${resolveYtDlpPath()} (version: ${ytVer || 'unknown'})`);
  logger.info('BinaryManager', `FFmpeg resolved: ${resolveFFmpegPath()}`);
  logger.info('BinaryManager', `JS Runtime verified: ${jsRuntime.engine} ${jsRuntime.version} (valid: ${jsRuntime.valid})`);

  // Run startup update check
  updateYtDlp();

  // Schedule updates every 6 hours
  setInterval(() => {
    updateYtDlp();
  }, 6 * 60 * 60 * 1000).unref();
}

module.exports = {
  resolveYtDlpPath,
  resolveFFmpegPath,
  ensureYtDlpBinary,
  getYtDlpVersion,
  checkJsRuntime,
  supportsJsRuntimes,
  updateYtDlp,
  acquireResolveLock,
  releaseResolveLock,
  initBinaryManager
};
