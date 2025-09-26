export class RafBatcher {
  private pending = new Set<() => void>();
  private rafId: number | null = null;

  schedule(task: () => void) {
    this.pending.add(task);
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  flush() {
    const tasks = Array.from(this.pending);
    this.pending.clear();
    this.rafId = null;
    for (const task of tasks) {
      try { task(); } catch (error) { console.error('RAF batch operation failed:', error); }
    }
  }
}
