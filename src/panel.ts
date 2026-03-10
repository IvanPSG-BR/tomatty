/**
 * panel.ts — Status publisher for external panels (Waybar, Polybar, i3blocks, tmux…)
 *
 * Writes ~/.cache/tomatty/status.json at most once per second so that any bar
 * script can read it and display the current Pomodoro state without extra daemons.
 *
 * Schema:
 * {
 *   "state":     "IDLE" | "WORKING" | "PAUSED" | "SUSPENDING" | "IDLE_AFTER_BREAK",
 *   "remaining": 1500,          // seconds left (integer), 0 when not applicable
 *   "taskName":  "study",       // empty string when no task is set
 *   "updatedAt": "2026-03-09T14:30:00.000Z"
 * }
 *
 * When tomatty exits cleanly the file is removed so bars can detect inactivity.
 */

import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, unlinkSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

import type { AppState } from './state';

// ── File path ─────────────────────────────────────────────────────────────────

const CACHE_DIR = join(homedir(), '.cache', 'tomatty');
const STATUS_FILE = join(CACHE_DIR, 'status.json');

try {
  mkdirSync(CACHE_DIR, { recursive: true });
} catch {
  // directory already exists or unwritable — fail silently
}

// ── Internal state ────────────────────────────────────────────────────────────

/** Last whole-second value written to disk — avoids redundant I/O on every tick */
let _lastWrittenSecond = -1;
/** Current payload tracked in memory */
let _current: PanelStatus = {
  state: 'IDLE',
  remaining: 0,
  taskName: '',
  updatedAt: new Date().toISOString(),
};

export interface PanelStatus {
  state: string;
  remaining: number;
  taskName: string;
  updatedAt: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call whenever app state or task name changes (state transitions, task edits).
 * Always writes immediately, ignoring the 1 s throttle.
 */
export function publishState(
  state: AppState,
  remainingSeconds: number,
  taskName: string
): void {
  _lastWrittenSecond = Math.floor(remainingSeconds);
  _current = {
    state,
    remaining: Math.floor(remainingSeconds),
    taskName,
    updatedAt: new Date().toISOString(),
  };
  void _write(_current);
}

/**
 * Call on every timer tick (frame callback).  Writes at most once per second
 * to avoid hammering the filesystem while the timer is running.
 */
export function publishTick(
  state: AppState,
  remainingSeconds: number,
  taskName: string
): void {
  const wholeSecond = Math.floor(remainingSeconds);
  if (wholeSecond === _lastWrittenSecond) return; // same second — skip

  _lastWrittenSecond = wholeSecond;
  _current = {
    state,
    remaining: wholeSecond,
    taskName,
    updatedAt: new Date().toISOString(),
  };
  void _write(_current);
}

/**
 * Remove the status file on clean exit so panels can detect tomatty is gone.
 * Safe to call multiple times.
 */
export function clearStatus(): void {
  try {
    unlinkSync(STATUS_FILE);
  } catch {
    // file not found or already removed — that's fine
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function _write(status: PanelStatus): Promise<void> {
  try {
    await writeFile(STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');
  } catch {
    // Best-effort: if the cache dir disappeared we don't crash the app
  }
}

/** Exposed for tests / debug inspection only */
export { STATUS_FILE };
