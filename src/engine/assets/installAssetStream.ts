/**
 * Asynchronous asset stream.
 *
 * - Meshopt WASM decode runs in workers (three's decoder, also aliased
 *   over drei's synchronous copy).
 * - KTX2 / Basis Universal transcoder is attached to every GLTF loader so
 *   a pre-cooked texture stays compressed in VRAM instead of being
 *   inflated from WebP/JPEG on the CPU.
 * - Scene builds are serialized and yield a frame between models, so the
 *   menu keeps taking input while the roster streams in.
 */
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { GLTFLoader as ThreeGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader as StdGLTFLoader } from 'three-stdlib';
import type { WebGLRenderer } from 'three';

import { createSerialLane } from './serialLane.ts';
import { MeshoptDecoder as workerCapableDecoder } from './meshoptDecoderShim.ts';

const lane = createSerialLane();
let ktx2: KTX2Loader | null = null;
let installed = false;

function basisLoader(): KTX2Loader {
  if (!ktx2) ktx2 = new KTX2Loader();
  return ktx2;
}

/** Call once a WebGL context exists so Basis picks a GPU-native format. */
export function bindBasisRenderer(renderer: WebGLRenderer): void {
  basisLoader().detectSupport(renderer);
}

type LoadFn = (
  url: string,
  onLoad?: (gltf: unknown) => void,
  onProgress?: (event: ProgressEvent) => void,
  onError?: (err: unknown) => void,
) => void;

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function patchLoader(Loader: { prototype: { load: LoadFn } }): void {
  const proto = Loader.prototype as { load: LoadFn & { __bfStream?: boolean }; ktx2Loader?: unknown; setKTX2Loader?: (k: KTX2Loader) => void };
  if (proto.load.__bfStream) return;
  const original = proto.load;
  const load: LoadFn & { __bfStream?: boolean } = function (this: { setKTX2Loader?: (k: KTX2Loader) => void; ktx2Loader?: unknown }, url, onLoad, onProgress, onError) {
    if (!this.ktx2Loader && this.setKTX2Loader) this.setKTX2Loader(basisLoader());
    void lane(async () => {
      await yieldFrame();
      await new Promise<void>((resolve) => {
        original.call(this, url, (gltf) => {
          onLoad?.(gltf);
          resolve();
        }, onProgress, (err) => {
          onError?.(err);
          resolve();
        });
      });
    });
  };
  load.__bfStream = true;
  proto.load = load;
}

/**
 * THE ALIAS THIS FILE'S OWN COMMENT PROMISED, WHICH WAS NEVER MADE.
 *
 * The header says meshopt decode runs in workers "also aliased over drei's
 * synchronous copy". It was not: `useWorkers(2)` was called on three's decoder
 * and drei was left alone, so every roster model still decoded on the main
 * thread. meshoptDecoderShim.ts exists for exactly this and had ZERO callers.
 *
 * drei's `useGLTF(url, draco, meshopt)` fetches three-stdlib's decoder and hands
 * it to `setMeshoptDecoder`. A module export cannot be reassigned, so the
 * substitution happens at the setter: whatever drei passes in, the loader gets
 * the worker-capable decoder instead. Both implement the same two-member
 * interface GLTFLoader uses (`ready`, `decodeGltfBuffer`), which is what makes
 * the swap safe rather than clever.
 */
function aliasMeshoptDecoder(proto: { setMeshoptDecoder?: (d: unknown) => unknown } & { __bfMeshopt?: boolean }): void {
  const original = proto.setMeshoptDecoder;
  if (typeof original !== 'function' || proto.__bfMeshopt) return;
  proto.__bfMeshopt = true;
  proto.setMeshoptDecoder = function patched(this: unknown) {
    return original.call(this, workerCapableDecoder());
  };
}

export function installAssetStream(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  if (typeof MeshoptDecoder.useWorkers === 'function') MeshoptDecoder.useWorkers(2);
  patchLoader(ThreeGLTFLoader as unknown as { prototype: { load: LoadFn } });
  patchLoader(StdGLTFLoader as unknown as { prototype: { load: LoadFn } });
  aliasMeshoptDecoder((StdGLTFLoader as unknown as { prototype: { setMeshoptDecoder?: (d: unknown) => unknown } }).prototype);
}

installAssetStream();
