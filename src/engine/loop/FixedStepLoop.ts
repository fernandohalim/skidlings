/**
 * Fixed-timestep accumulator. Feed it real frame deltas; it calls `step`
 * zero or more times at a constant dt and returns the interpolation alpha.
 */
export class FixedStepLoop {
  private accumulator = 0;

  constructor(
    readonly stepDt = 1 / 60,
    readonly maxStepsPerFrame = 5,
  ) {}

  advance(frameDt: number, step: (dt: number) => void): number {
    this.accumulator += Math.max(0, frameDt);
    let steps = 0;
    while (this.accumulator >= this.stepDt && steps < this.maxStepsPerFrame) {
      step(this.stepDt);
      this.accumulator -= this.stepDt;
      steps++;
    }
    // Drop backlog after a stall (tab switch) instead of spiralling.
    if (steps === this.maxStepsPerFrame && this.accumulator >= this.stepDt) {
      this.accumulator = 0;
    }
    return this.accumulator / this.stepDt;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
