/**
 * Simple countdown timer driven by deltaTime ticks from the renderer
 * frame callback. All time values are in seconds.
 */
export class Timer {
  private _remaining: number;
  private _running = false;
  private _onComplete?: () => void;

  constructor(durationSeconds: number) {
    this._remaining = durationSeconds;
  }

  /**
   * Called every frame by the renderer frame callback.
   * @param deltaMs - time elapsed since last frame in milliseconds
   */
  tick(deltaMs: number): void {
    if (!this._running || this._remaining <= 0) return;

    this._remaining -= deltaMs / 1000;

    if (this._remaining <= 0) {
      this._remaining = 0;
      this._running = false;
      this._onComplete?.();
    }
  }

  start(): void {
    this._running = true;
  }

  pause(): void {
    this._running = false;
  }

  reset(durationSeconds: number): void {
    this._remaining = durationSeconds;
    this._running = false;
  }

  get remaining(): number {
    return this._remaining;
  }

  get running(): boolean {
    return this._running;
  }

  set onComplete(fn: () => void) {
    this._onComplete = fn;
  }
}
