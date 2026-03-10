import { spawn } from 'node:child_process';

export interface SuspendResult {
  /** True if the user woke the system before the RTC alarm fired */
  earlyWake: boolean;
  /** Seconds that were remaining in the break when the system woke */
  remainingSeconds: number;
}

/**
 * Suspends the system using rtcwake and waits until it resumes.
 *
 * Requires passwordless sudo for rtcwake. Set it up once with:
 *   echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/rtcwake" \
 *     | sudo tee /etc/sudoers.d/tomatty
 *
 * @param breakSeconds - how many seconds to sleep before auto-wake
 */
export function suspendForBreak(breakSeconds: number): Promise<SuspendResult> {
  const scheduledWakeAt = Date.now() + breakSeconds * 1000;

  return new Promise((resolve) => {
    const proc = spawn(
      'sudo',
      ['/usr/sbin/rtcwake', '-m', 'suspend', '-s', String(breakSeconds)],
      { stdio: 'ignore' }
    );

    // Fires when rtcwake exits — which happens when the system resumes
    // (either from the RTC alarm or a manual wake by the user)
    proc.on('exit', () => {
      const now = Date.now();
      const msRemaining = Math.max(0, scheduledWakeAt - now);
      const remainingSeconds = Math.round(msRemaining / 1000);

      resolve({
        earlyWake: remainingSeconds > 10,
        remainingSeconds,
      });
    });
  });
}
