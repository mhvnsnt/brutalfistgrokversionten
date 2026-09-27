/**
 * One GLTF parse at a time. Meshopt decode is already off-thread; the
 * remaining scene build is still main-thread work, and stacking a roster
 * of those builds is the multi-second freeze.
 */
export function createSerialLane() {
  let tail: Promise<void> = Promise.resolve();
  return function lane<T>(job: () => Promise<T>): Promise<T> {
    const run = tail.then(job, job);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
