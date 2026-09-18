/**
 * Browser stand-in for `node:async_hooks`, used ONLY by the Next.js
 * compatibility surface under `app/`.
 *
 * WHY THIS EXISTS — measured, not assumed
 *   `npm run next:dev` served HTTP 500 on `/` with a fatal Turbopack panic:
 *
 *     Failed to write app endpoint /page
 *     Caused by: the chunking context (unknown) does not support external
 *     modules (request: node:async_hooks)
 *
 *   `app/page.tsx` renders `src/App`, whose import graph reaches
 *   `src/lib/app-data/readiness.ts` -> `createServerFn` from
 *   `@tanstack/react-start` -> `@tanstack/start-storage-context` ->
 *   `node:async_hooks`. Under Vite the TanStack Start plugin compiles server
 *   functions out of the client build, so the node builtin never reaches the
 *   browser. Turbopack has no such transform, so it tries to chunk a Node
 *   builtin for the browser and panics — and the route never compiles, which
 *   is a preview that spins forever rather than an error anyone can see.
 *
 *   The game itself never runs a server function in the browser; this only has
 *   to exist so the module graph resolves. The Vite runtime is untouched.
 */

type Store = unknown;

/** The only surface `@tanstack/start-storage-context` uses. */
export class AsyncLocalStorage<T = Store> {
  #store: T | undefined;

  getStore(): T | undefined {
    return this.#store;
  }

  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.#store;
    this.#store = store;
    try {
      return callback(...args);
    } finally {
      this.#store = previous;
    }
  }

  enterWith(store: T): void {
    this.#store = store;
  }

  exit<R>(callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.#store;
    this.#store = undefined;
    try {
      return callback(...args);
    } finally {
      this.#store = previous;
    }
  }

  disable(): void {
    this.#store = undefined;
  }
}

export class AsyncResource {
  constructor(public readonly type: string) {}
  runInAsyncScope<R>(fn: (...args: unknown[]) => R, _thisArg?: unknown, ...args: unknown[]): R {
    return fn(...args);
  }
  emitDestroy(): this { return this; }
  asyncId(): number { return 0; }
  triggerAsyncId(): number { return 0; }
}

export function createHook() {
  return { enable() { return this; }, disable() { return this; } };
}

export function executionAsyncId(): number { return 0; }
export function triggerAsyncId(): number { return 0; }

export default { AsyncLocalStorage, AsyncResource, createHook, executionAsyncId, triggerAsyncId };
