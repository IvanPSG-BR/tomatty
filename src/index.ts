import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  ASCIIFontRenderable,
  InputRenderable,
  InputRenderableEvents,
} from '@opentui/core';

import { AppState } from './state';
import {
  WORK_DURATION,
  BREAK_DURATION,
  POMODOROS_PER_CYCLE,
  COLOR_WORK,
  COLOR_BREAK,
  COLOR_WHITE,
  COLOR_BORDER,
} from './config';
import { Timer } from './timer';
import { loadData, incrementPomodoro, type PomodoroData } from './storage';
import { suspendForBreak } from './suspend';
import { publishState, publishTick, clearStatus } from './panel';

// ─────────────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────────────

const renderer = await createCliRenderer({
  exitOnCtrlC: false, // we handle Q / Ctrl+C ourselves for clean shutdown
  useAlternateScreen: true,
  autoFocus: false,
});

renderer.setTerminalTitle('tomatty');

// ─────────────────────────────────────────────────────────────────────────────
// App state
// ─────────────────────────────────────────────────────────────────────────────

let state: AppState = AppState.IDLE;
let data: PomodoroData = await loadData();
let taskName = '';
let isEditing = false;

// Skip-break guard: user must press S twice to skip the post-break wait
let skipPressCount = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Timer
// ─────────────────────────────────────────────────────────────────────────────

const timer = new Timer(WORK_DURATION);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pomodoroDotsStr(count: number): string {
  const pos = count % POMODOROS_PER_CYCLE;
  return Array.from(
    { length: POMODOROS_PER_CYCLE },
    (_, i) => (i < pos ? '●' : '○')
  ).join(' ');
}

function controlsHint(s: AppState): string {
  switch (s) {
    case AppState.IDLE:
      return '[Space] Start  [E] Task  [Q] Quit';
    case AppState.WORKING:
      return '[Space] Pause  [R] Reset  [Q] Quit';
    case AppState.PAUSED:
      return '[Space] Resume  [R] Reset  [E] Task  [Q] Quit';
    case AppState.IDLE_AFTER_BREAK:
      return '[Space] Start  [E] Task  [Q] Quit';
    default:
      return '';
  }
}

function bell(times: number = 1): void {
  for (let i = 0; i < times; i++) {
    process.stdout.write('\x07');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// UI — Main view  (IDLE / WORKING / PAUSED)
// ─────────────────────────────────────────────────────────────────────────────

const mainContainer = new BoxRenderable(renderer, {
  flexGrow: 1,
  flexDirection: 'column',
});

// ── Header ────────────────────────────────────────────────────────────────────

const headerBox = new BoxRenderable(renderer, {
  height: 3,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingX: 2,
  border: ['bottom'],
  borderColor: COLOR_BORDER,
});

const titleText = new TextRenderable(renderer, {
  content: 'tomatty',
  fg: COLOR_WORK,
});

const dotsText = new TextRenderable(renderer, {
  content: pomodoroDotsStr(data.count),
  fg: COLOR_WHITE,
});

headerBox.add(titleText);
headerBox.add(dotsText);
mainContainer.add(headerBox);

// ── Timer area ────────────────────────────────────────────────────────────────

const timerAreaBox = new BoxRenderable(renderer, {
  flexGrow: 1,
  alignItems: 'center',
  justifyContent: 'center',
});

const timerContentBox = new BoxRenderable(renderer, {
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
});

const asciiTimer = new ASCIIFontRenderable(renderer, {
  text: formatTime(WORK_DURATION),
  font: 'block',
  color: COLOR_WHITE,
});

const sessionLabel = new TextRenderable(renderer, {
  content: 'READY 🍅',
  fg: COLOR_WHITE,
});

const taskDisplay = new TextRenderable(renderer, {
  content: '',
  fg: COLOR_WHITE,
  visible: false,
});

// Task edit row (hidden until user presses E)
const taskEditBox = new BoxRenderable(renderer, {
  flexDirection: 'row',
  alignItems: 'center',
  visible: false,
  height: 1,
});

const taskEditLabel = new TextRenderable(renderer, {
  content: 'Task: ',
  fg: COLOR_WHITE,
});

const taskInput = new InputRenderable(renderer, {
  value: '',
  placeholder: 'task name...',
  textColor: COLOR_WHITE,
  width: 32,
});

taskEditBox.add(taskEditLabel);
taskEditBox.add(taskInput);

timerContentBox.add(asciiTimer);
timerContentBox.add(sessionLabel);
timerContentBox.add(taskDisplay);
timerContentBox.add(taskEditBox);
timerAreaBox.add(timerContentBox);
mainContainer.add(timerAreaBox);

// ── Controls footer ───────────────────────────────────────────────────────────

const footerBox = new BoxRenderable(renderer, {
  height: 3,
  alignItems: 'center',
  justifyContent: 'center',
  border: ['top'],
  borderColor: COLOR_BORDER,
});

const controlsText = new TextRenderable(renderer, {
  content: controlsHint(AppState.IDLE),
  fg: COLOR_WHITE,
});

footerBox.add(controlsText);
mainContainer.add(footerBox);

// ─────────────────────────────────────────────────────────────────────────────
// UI — Break / Welcome-back view  (SUSPENDING / IDLE_AFTER_BREAK)
// ─────────────────────────────────────────────────────────────────────────────

const breakContainer = new BoxRenderable(renderer, {
  flexGrow: 1,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  visible: false,
  gap: 1,
});

const breakTitle = new ASCIIFontRenderable(renderer, {
  text: 'SUSPENDING',
  font: 'tiny',
  color: COLOR_WORK,
});

const breakSubtitle = new TextRenderable(renderer, {
  content: '5-minute break scheduled...',
  fg: COLOR_WHITE,
});

const breakCountText = new TextRenderable(renderer, {
  content: '',
  fg: COLOR_BREAK,
  visible: false,
});

const breakHint = new TextRenderable(renderer, {
  content: '[Space] Start new session  [E] Task  [Q] Quit',
  fg: COLOR_WHITE,
  visible: false,
});

breakContainer.add(breakTitle);
breakContainer.add(breakSubtitle);
breakContainer.add(breakCountText);
breakContainer.add(breakHint);

// ─────────────────────────────────────────────────────────────────────────────
// Mount to root
// ─────────────────────────────────────────────────────────────────────────────

renderer.root.add(mainContainer);
renderer.root.add(breakContainer);

// Publish initial state so panels see the file immediately on startup
publishState(state, timer.remaining, taskName);

// ─────────────────────────────────────────────────────────────────────────────
// UI update helpers
// ─────────────────────────────────────────────────────────────────────────────

function refreshMainUI(): void {
  dotsText.content = pomodoroDotsStr(data.count);
  controlsText.content = controlsHint(state);

  if (taskName) {
    taskDisplay.content = `Working on: ${taskName}`;
    taskDisplay.visible = true;
  } else {
    taskDisplay.visible = false;
  }

  renderer.requestRender();
}

function showMainView(): void {
  mainContainer.visible = true;
  breakContainer.visible = false;
}

function showBreakView(): void {
  mainContainer.visible = false;
  breakContainer.visible = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame callback — timer tick + live display update
// ─────────────────────────────────────────────────────────────────────────────

renderer.setFrameCallback(async (deltaMs) => {
  if (state === AppState.WORKING) {
    timer.tick(deltaMs);
    asciiTimer.text = formatTime(timer.remaining);
    publishTick(state, timer.remaining, taskName);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// State machine — transitions
// ─────────────────────────────────────────────────────────────────────────────

timer.onComplete = () => {
  // Schedule outside the frame callback to avoid conflicts with the render pass
  process.nextTick(() => void handleWorkComplete());
};

async function handleWorkComplete(): Promise<void> {
  state = AppState.SUSPENDING;
  renderer.dropLive();
  publishState(state, 0, taskName);

  // Show suspending screen
  showBreakView();
  breakTitle.text = 'SUSPENDING';
  breakTitle.color = COLOR_WORK;
  breakSubtitle.content = `${BREAK_DURATION / 60}-minute break scheduled...`;
  breakCountText.visible = false;
  breakHint.visible = false;
  renderer.requestRender();

  // Bell once — "work session ended"
  bell(1);

  // Give the UI a moment to render before the system suspends
  await sleep(600);

  // Suspend — this awaits until the system resumes
  const result = await suspendForBreak(BREAK_DURATION);

  // ── System has resumed ──

  // Increment counter before playing bells so the count is ready
  data = await incrementPomodoro(data);

  // Bell three times — "break is over, come back"
  for (let i = 0; i < 3; i++) {
    bell(1);
    await sleep(350);
  }

  // Transition to IDLE_AFTER_BREAK
  state = AppState.IDLE_AFTER_BREAK;
  timer.reset(WORK_DURATION);
  skipPressCount = 0;
  publishState(state, WORK_DURATION, taskName);

  // Update break/welcome view
  breakTitle.text = 'WELCOME BACK';
  breakTitle.color = COLOR_BREAK;

  breakSubtitle.content = result.earlyWake
    ? `Early wake - ${result.remainingSeconds}s remaining`
    : 'Break completed!';

  const plural = data.count !== 1 ? 's' : '';
  breakCountText.content = `${data.count} pomodoro${plural} today  (${data.totalEver} total)`;
  breakCountText.visible = true;
  breakHint.visible = true;

  renderer.requestRender();
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard — global handler
// ─────────────────────────────────────────────────────────────────────────────

function enterEditMode(): void {
  isEditing = true;
  taskEditBox.visible = true;
  taskInput.value = taskName;
  taskInput.focus();
  controlsText.content = '[Enter] Save  [Esc] Cancel';
  renderer.requestRender();
}

function exitEditMode(save: boolean): void {
  if (save) taskName = taskInput.value.trim();
  isEditing = false;
  taskInput.blur();
  taskEditBox.visible = false;
  refreshMainUI();
}

// InputRenderable fires this when the user presses Enter
taskInput.on(InputRenderableEvents.ENTER, () => exitEditMode(true));

renderer.keyInput.on('keypress', (key) => {
  // ── Escape: cancel edit ───────────────────────────────────────────────────
  if (key.name === 'escape') {
    if (isEditing) exitEditMode(false);
    return;
  }

  // ── Ctrl+C / q: quit ─────────────────────────────────────────────────────
  if ((key.ctrl && key.name === 'c') || key.name === 'q') {
    if (isEditing) return; // let input consume it
    clearStatus();
    renderer.destroy();
    process.exit(0);
  }

  // While editing, let the InputRenderable handle everything else
  if (isEditing) return;

  switch (key.name) {
    // ── Space: start / pause / resume ──────────────────────────────────────
    case 'space': {
      if (
        state === AppState.IDLE ||
        state === AppState.IDLE_AFTER_BREAK
      ) {
        state = AppState.WORKING;
        showMainView();
        asciiTimer.text = formatTime(timer.remaining);
        asciiTimer.color = COLOR_WORK;
        sessionLabel.content = 'WORK SESSION 🍅';
        sessionLabel.fg = COLOR_WORK;
        timer.start();
        renderer.requestLive();
        refreshMainUI();
        publishState(state, timer.remaining, taskName);
      } else if (state === AppState.WORKING) {
        state = AppState.PAUSED;
        timer.pause();
        renderer.dropLive();
        sessionLabel.content = 'PAUSED 🍅';
        sessionLabel.fg = COLOR_WHITE;
        refreshMainUI();
        publishState(state, timer.remaining, taskName);
      } else if (state === AppState.PAUSED) {
        state = AppState.WORKING;
        timer.start();
        renderer.requestLive();
        sessionLabel.content = 'WORK SESSION 🍅';
        sessionLabel.fg = COLOR_WORK;
        refreshMainUI();
        publishState(state, timer.remaining, taskName);
      }
      break;
    }

    // ── r: reset current session ───────────────────────────────────────────
    case 'r': {
      if (state !== AppState.WORKING && state !== AppState.PAUSED) break;
      if (state === AppState.WORKING) renderer.dropLive();
      state = AppState.IDLE;
      timer.reset(WORK_DURATION);
      asciiTimer.text = formatTime(WORK_DURATION);
      asciiTimer.color = COLOR_WHITE;
      sessionLabel.content = 'READY 🍅';
      sessionLabel.fg = COLOR_WHITE;
      refreshMainUI();
      publishState(state, WORK_DURATION, taskName);
      break;
    }

    // ── e: edit task name ──────────────────────────────────────────────────
    case 'e': {
      const canEdit =
        state === AppState.IDLE ||
        state === AppState.PAUSED ||
        state === AppState.IDLE_AFTER_BREAK;
      if (!canEdit) break;
      // If in break view, switch to main view first so the input is visible
      if (state === AppState.IDLE_AFTER_BREAK) showMainView();
      enterEditMode();
      break;
    }
  }
});
