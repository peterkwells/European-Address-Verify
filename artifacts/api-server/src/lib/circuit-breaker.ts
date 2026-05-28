const FAILURE_THRESHOLD = 5;
const COOL_DOWN_MS = 60_000;

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const circuits = new Map<string, CircuitState>();

function getState(key: string): CircuitState {
  if (!circuits.has(key)) {
    circuits.set(key, { failures: 0, openedAt: null });
  }
  return circuits.get(key)!;
}

export function isOpen(key: string): boolean {
  const state = getState(key);
  if (state.openedAt === null) return false;
  if (Date.now() - state.openedAt >= COOL_DOWN_MS) {
    state.failures = 0;
    state.openedAt = null;
    return false;
  }
  return true;
}

export function retryAfterSeconds(key: string): number {
  const state = getState(key);
  if (state.openedAt === null) return 0;
  const elapsed = Date.now() - state.openedAt;
  return Math.max(0, Math.ceil((COOL_DOWN_MS - elapsed) / 1000));
}

export function recordSuccess(key: string): void {
  const state = getState(key);
  state.failures = 0;
  state.openedAt = null;
}

export function recordFailure(key: string): void {
  const state = getState(key);
  state.failures += 1;
  if (state.failures >= FAILURE_THRESHOLD && state.openedAt === null) {
    state.openedAt = Date.now();
  }
}
