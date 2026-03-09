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

const CONFIG_DIR = join(homedir(), '.config', 'tomatty');
const DATA_FILE = join(CONFIG_DIR, 'data.json');

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
