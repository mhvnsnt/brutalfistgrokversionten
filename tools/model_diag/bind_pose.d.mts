/**
 * Types for the GLB reader the offline bake and the canonical-skeleton loader
 * both use. The implementation is .mjs on purpose — it runs as a standalone
 * tool with no build step — so its shape is declared here rather than by
 * loosening tsconfig for every script in the repo.
 */
export interface GlbNode {
  name?: string;
  children?: number[];
  rotation?: [number, number, number, number];
  translation?: [number, number, number];
  scale?: [number, number, number];
  matrix?: number[];
}

export interface GlbJson {
  nodes: GlbNode[];
  skins?: Array<{ joints: number[]; inverseBindMatrices?: number }>;
  meshes?: unknown[];
  accessors?: unknown[];
  bufferViews?: unknown[];
  [key: string]: unknown;
}

/** Split a .glb into its JSON chunk and its binary chunk. */
export function parseGlb(buf: Uint8Array): { json: GlbJson; bin: Uint8Array | null };

/** A joint's bind world position, from the inverse of its inverse-bind matrix. */
export function bindPositionFromIBM(m: ArrayLike<number>): { x: number; y: number; z: number };

/** T-POSE / A-POSE / I-POSE from an arm's angle below horizontal. */
export function classifyArmAngle(deg: number): string;
