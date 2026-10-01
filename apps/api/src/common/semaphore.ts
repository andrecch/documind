export class Semaphore {
  private busy = false;

  tryAcquire(): boolean {
    if (this.busy) return false;
    this.busy = true;
    return true;
  }

  release(): void {
    this.busy = false;
  }

  isBusy(): boolean {
    return this.busy;
  }
}
