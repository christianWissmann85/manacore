/**
 * ProgressBar - Terminal progress bar for simulations
 *
 * Displays a nice progress bar with stats during simulation.
 */

export class ProgressBar {
  private total: number;
  private current: number = 0;
  private startTime: number = 0;
  private lastUpdate: number = 0;
  private readonly barLength: number = 40;

  constructor(total: number) {
    this.total = total;
    this.startTime = Date.now();
  }

  /**
   * Start the progress bar
   */
  start(): void {
    this.render();
  }

  /**
   * Update progress
   */
  update(current: number): void {
    this.current = current;

    // Throttle updates (max every 100ms)
    const now = Date.now();
    if (now - this.lastUpdate < 100 && current < this.total) {
      return;
    }
    this.lastUpdate = now;

    this.render();
  }

  /**
   * Complete the progress bar
   */
  complete(): void {
    this.current = this.total;
    this.render();
    process.stdout.write('\n');
  }

  /**
   * Render the progress bar
   */
  private render(): void {
    const percentage = this.current / this.total;
    const filled = Math.floor(this.barLength * percentage);
    const empty = this.barLength - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    // Calculate stats
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.current / elapsed;

    let line = `⏳ [${bar}] ${this.current}/${this.total}`;

    if (this.current > 0) {
      line += ` (${elapsed.toFixed(1)}s) | ${rate.toFixed(1)} games/sec`;
    }

    // Use ANSI escape codes to clear line and move cursor to start
    // \x1b[2K clears the entire line, \r moves cursor to start
    process.stdout.write('\x1b[2K\r' + line);
  }
}
