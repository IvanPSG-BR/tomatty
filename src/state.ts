export enum AppState {
  /** Timer not started, ready to go */
  IDLE = 'IDLE',

  /** Work session running */
  WORKING = 'WORKING',

  /** Work session paused by user */
  PAUSED = 'PAUSED',

  /**
   * Brief transitional state: work ended, rtcwake is about to be called.
   * UI shows "Suspendendo..." for a moment before the system goes to sleep.
   */
  SUSPENDING = 'SUSPENDING',

  /**
   * System resumed from suspend. Bell has rung. Waiting for user to press
   * Space to start the next work session.
   */
  IDLE_AFTER_BREAK = 'IDLE_AFTER_BREAK',
}
