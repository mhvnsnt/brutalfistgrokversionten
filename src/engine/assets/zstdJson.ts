// `.ts` extensions on purpose — the repo's runner resolves them literally.
import { decompress } from 'fzstd';

import { assetUrl } from '../../lib/assetBase.ts';

const ZSTD = [0x28, 0xb5, 0x2f, 0xfd] as const;

export function isZstd(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === ZSTD[0] && buf[1] === ZSTD[1] && buf[2] === ZSTD[2] && buf[3] === ZSTD[3];
}

/** Zstd frame or already-plain UTF-8 JSON bytes → value. */
export function decodeZstdJson(buf: Uint8Array): unknown {
  const raw = isZstd(buf) ? decompress(buf) : buf;
  return JSON.parse(new TextDecoder().decode(raw));
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type WorkerLike = {
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
  onmessage: ((ev: { data: { id: number; ok: boolean; json?: unknown; error?: string } }) => void) | null;
};

let pool: WorkerLike[] | null = null;
let rr = 0;
let nextId = 1;
const pending = new Map<number, Pending>();

function workers(): WorkerLike[] | null {
  if (typeof Worker === 'undefined') return null;
  if (pool) return pool;
  pool = [0, 1].map(() => {
    const worker = new Worker(new URL('./zstd.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
    worker.onmessage = (ev) => {
      const wait = pending.get(ev.data.id);
      if (!wait) return;
      pending.delete(ev.data.id);
      if (ev.data.ok) wait.resolve(ev.data.json);
      else wait.reject(new Error(ev.data.error || 'zstd worker failed'));
    };
    return worker;
  });
  return pool;
}

/** Decompress + JSON.parse off the main thread when a worker exists. */
export function parsePackedJson(buf: Uint8Array): Promise<unknown> {
  const crew = workers();
  if (!crew) return Promise.resolve(decodeZstdJson(buf));
  const id = nextId++;
  const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const worker = crew[rr++ % crew.length];
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, buf: copy }, [copy]);
  });
}

/**
 * Prefer the zstd sibling (`file.json.zst`). Plain JSON remains the fallback
 * so a checkout that has not been packed still loads.
 */
export async function fetchZstdJson(path: string): Promise<unknown> {
  if (path.endsWith('.json')) {
    const packed = await fetch(assetUrl(`${path}.zst`));
    if (packed.ok) {
      const buf = new Uint8Array(await packed.arrayBuffer());
      if (isZstd(buf)) return parsePackedJson(buf);
    }
  }
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return parsePackedJson(buf);
}
