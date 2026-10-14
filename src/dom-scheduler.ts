export async function yieldToBrowser(): Promise<void> {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: { yield(): Promise<void> };
    }
  ).scheduler;
  if (scheduler?.yield) {
    await scheduler.yield();
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

export function uniqueScanRoots(roots: Set<Node>): Node[] {
  return Array.from(roots).filter((root) => {
    for (let parent = root.parentNode; parent; parent = parent.parentNode) {
      if (roots.has(parent)) {
        return false;
      }
    }
    return root.isConnected;
  });
}
export const SCAN_TIME_BUDGET_MS = 4;
