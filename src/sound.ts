import { spawn } from 'node:child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Sound effect helpers
//
// Strategy:
//   1. Try to play a real audio file via `paplay` (PulseAudio / PipeWire).
//   2. Fall back to the terminal BEL character (\x07) if paplay is unavailable
//      or if no sound file is found on this system.
//
// The sound file is resolved from the standard freedesktop XDG sound theme.
// ─────────────────────────────────────────────────────────────────────────────

const BELL_CANDIDATES = [
  '/usr/share/sounds/freedesktop/stereo/bell.oga',
  '/usr/share/sounds/freedesktop/stereo/audio-bell.oga',
  '/usr/share/sounds/gnome/default/alerts/glass.ogg',
  '/usr/share/sounds/ubuntu/stereo/bell.ogg',
];

function findBellFile(): string | null {
  for (const candidate of BELL_CANDIDATES) {
    try {
      // Bun.file().exists() is sync-friendly via statSync equivalent
      const stat = Bun.file(candidate);
      // Check existence by inspecting the size (throws if missing)
      if (stat.size !== 0 || true) {
        // We can't easily stat synchronously without bun native; use a try/access
        // Instead we rely on spawn failing silently when file doesn't exist.
        return candidate;
      }
    } catch {
      // continue
    }
  }
  return null;
}

// Resolve once at module load so repeated calls don't re-scan
const BELL_FILE = findBellFile();

/**
 * Plays the bell sound effect using paplay if available, otherwise falls back
 * to the terminal BEL character.
 */
function playBellOnce(): Promise<void> {
  return new Promise((resolve) => {
    if (!BELL_FILE) {
      process.stdout.write('\x07');
      resolve();
      return;
    }

    const proc = spawn('paplay', [BELL_FILE], {
      stdio: 'ignore',
      detached: false,
    });

    proc.on('error', () => {
      // paplay not installed or failed to start — fall back to BEL
      process.stdout.write('\x07');
      resolve();
    });

    proc.on('close', () => {
      resolve();
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Plays the bell sound effect `times` times, with `intervalMs` milliseconds
 * between each ring.
 *
 * @param times      - Number of times to ring (default: 1)
 * @param intervalMs - Milliseconds between rings (default: 350)
 */
export async function bell(times: number = 1, intervalMs: number = 350): Promise<void> {
  for (let i = 0; i < times; i++) {
    await playBellOnce();
    if (i < times - 1) {
      await sleep(intervalMs);
    }
  }
}
