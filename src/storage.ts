import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { readFile, writeFile, access } from 'node:fs/promises';

export interface PomodoroData {
  /** ISO date string YYYY-MM-DD — used to reset the daily counter */
  date: string;
  /** Pomodoros completed today */
  count: number;
  /** Total pomodoros ever (never resets) */
  totalEver: number;
}

export interface TomattySettings {
  /** Work session duration in seconds */
  workDuration: number;
  /** Break duration in seconds */
  breakDuration: number;
}

const CONFIG_DIR = join(homedir(), '.config', 'tomatty');
const DATA_FILE = join(CONFIG_DIR, 'data.json');
const SETTINGS_FILE = join(CONFIG_DIR, 'settings.json');

// Default durations in seconds (25 min work, 5 min break)
const DEFAULT_SETTINGS: TomattySettings = {
  workDuration: 25 * 60,
  breakDuration: 5 * 60,
};

// Ensure the config directory exists at module load time
try {
  mkdirSync(CONFIG_DIR, { recursive: true });
} catch {
  // already exists or permission error — will surface on first write
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyData(): PomodoroData {
  return { date: todayStr(), count: 0, totalEver: 0 };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadData(): Promise<PomodoroData> {
  try {
    if (!(await fileExists(DATA_FILE))) return emptyData();

    const raw = await readFile(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw) as PomodoroData;

    // Reset daily counter if it's a new day
    if (data.date !== todayStr()) {
      return { date: todayStr(), count: 0, totalEver: data.totalEver ?? 0 };
    }

    return data;
  } catch {
    return emptyData();
  }
}

export async function saveData(data: PomodoroData): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function incrementPomodoro(
  current: PomodoroData
): Promise<PomodoroData> {
  const updated: PomodoroData = {
    ...current,
    count: current.count + 1,
    totalEver: current.totalEver + 1,
  };
  await saveData(updated);
  return updated;
}

// ── Settings (work/break durations) ──────────────────────────────────────────

/**
 * Load persisted duration settings.
 * Falls back to the built-in defaults if the file doesn't exist or is corrupt.
 */
export async function loadSettings(): Promise<TomattySettings> {
  try {
    if (!(await fileExists(SETTINGS_FILE))) return { ...DEFAULT_SETTINGS };
    const raw = await readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TomattySettings>;
    return {
      workDuration: parsed.workDuration ?? DEFAULT_SETTINGS.workDuration,
      breakDuration: parsed.breakDuration ?? DEFAULT_SETTINGS.breakDuration,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist duration settings to disk.
 * Merges with the current saved values so a partial update (only worktime, for
 * example) leaves the other field untouched.
 */
export async function saveSettings(
  patch: Partial<TomattySettings>
): Promise<TomattySettings> {
  const current = await loadSettings();
  const next: TomattySettings = { ...current, ...patch };
  await writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

/**
 * Reset both durations to the built-in defaults (25 min / 5 min).
 */
export async function resetSettings(): Promise<TomattySettings> {
  await writeFile(
    SETTINGS_FILE,
    JSON.stringify(DEFAULT_SETTINGS, null, 2),
    'utf-8'
  );
  return { ...DEFAULT_SETTINGS };
}
