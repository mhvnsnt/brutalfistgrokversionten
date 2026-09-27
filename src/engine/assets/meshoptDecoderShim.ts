/**
 * Drop-in for three-stdlib's MeshoptDecoder.
 *
 * drei calls `MeshoptDecoder()` and the copy inside three-stdlib only
 * decodes on the main thread. three.js's decoder can run the same WASM
 * in workers (`useWorkers`), which is the background thread the roster
 * parse was missing.
 */
import { MeshoptDecoder as ThreeDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

let armed = false;

export function MeshoptDecoder() {
  if (!armed && typeof window !== 'undefined' && typeof ThreeDecoder.useWorkers === 'function') {
    armed = true;
    ThreeDecoder.useWorkers(2);
  }
  return ThreeDecoder;
}
