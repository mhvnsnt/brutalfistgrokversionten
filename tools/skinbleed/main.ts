/**
 * SKIN BLEED — is any vertex being pulled by two joints that are nowhere near
 * each other on the body?
 *
 * Owner, on the shipped roster: "he had from his wrist to his hip or pelvis
 * area almost like a wrist cuff handcuff shred going from his waist to his
 * wrist on each side ... some of them are almost turning into pterodactyl
 * Cronenberg beasts."
 *
 * That webbing is not a retarget problem and it is not the A-pose/T-pose
 * correction. It is SKIN WEIGHTS. A vertex on the hip that also carries
 * weight from the hand bone gets dragged toward the hand the moment the arm
 * leaves the bind pose, and the triangles between them stretch into a
 * membrane. Bind pose hides it completely — which is why it survives every
 * check that looks at a model standing still.
 *
 * WHY skinqa CANNOT SEE THIS, and it is the same trap as the severed rig:
 * skinqa measures how far a vertex drifts from where ITS OWN WEIGHTS predict.
 * Weights that are anatomically absurd still predict themselves perfectly, so
 * the residual is zero and the model passes. A metric has to be able to
 * express the failure you are hunting.
 *
 * THE MEASURE. Build the skeleton as a graph and take the HOP DISTANCE
 * between joints. A legitimate vertex sits across ONE joint: elbow verts are
 * ForeArm+Arm (1 hop), a shoulder blends Arm+Shoulder+Spine2 (2 hops). A
 * vertex weighted to both Hand and Hips spans SEVEN. The span is the defect,
 * measured on the asset, with no rendering and no opinion.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const params = new URLSearchParams(location.search);
const MODELS = (params.get('models') ?? 'BANNON_rigged.glb').split(',').filter(Boolean);
/** Below this an influence is numerical dust, not a weight someone authored. */
const MIN_WEIGHT = Number(params.get('minw') ?? 0.02);
/** Past this many hops apart, two joints cannot legitimately share a vertex. */
const MAX_SPAN = Number(params.get('span') ?? 4);
/**
 * `?pipeline=1` measures what the GAME loads, not what the file holds.
 *
 * Both readings matter and they answer different questions: the raw asset
 * says how bad the source is, and the pipeline reading says whether the
 * repair actually reaches the body on screen. A fix that only ever passes
 * its own unit test is not a fix.
 */
const THROUGH_PIPELINE = params.get('pipeline') === '1';

export interface BleedReport {
  model: string;
  error?: string;
  verts: number;
  /** Vertices whose influences span more than MAX_SPAN hops. */
  bleeding: number;
  /** Worst span seen anywhere on the mesh. */
  worstSpan: number;
  /** The joint pairs responsible, commonest first. */
  pairs: Array<{ a: string; b: string; hops: number; verts: number; weight: number }>;
}

/** Hop distance between every pair of joints, from the bone parent links. */
function hopMatrix(bones: THREE.Bone[]): number[][] {
  const index = new Map<THREE.Object3D, number>();
  bones.forEach((b, i) => index.set(b, i));
  const adj: number[][] = bones.map(() => []);
  bones.forEach((b, i) => {
    const p = b.parent;
    if (p && index.has(p)) {
      const j = index.get(p)!;
      adj[i].push(j);
      adj[j].push(i);
    }
  });
  return bones.map((_, start) => {
    const dist = new Array(bones.length).fill(Infinity);
    dist[start] = 0;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      for (const next of adj[cur]) {
        if (dist[next] === Infinity) { dist[next] = dist[cur] + 1; queue.push(next); }
      }
    }
    return dist;
  });
}

function auditMesh(mesh: THREE.SkinnedMesh, out: BleedReport, hops: number[][]): void {
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const skinWeight = mesh.geometry.attributes.skinWeight;
  if (!skinIndex || !skinWeight) return;
  const bones = mesh.skeleton.bones;
  const pairs = new Map<string, { a: string; b: string; hops: number; verts: number; weight: number }>();

  for (let v = 0; v < skinIndex.count; v++) {
    out.verts++;
    const idx: number[] = [];
    const wts: number[] = [];
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(v, k);
      if (w > MIN_WEIGHT) { idx.push(skinIndex.getComponent(v, k)); wts.push(w); }
    }
    if (idx.length < 2) continue;
    let worst = 0;
    let worstPair: [number, number] | null = null;
    for (let i = 0; i < idx.length; i++) {
      for (let j = i + 1; j < idx.length; j++) {
        const d = hops[idx[i]]?.[idx[j]] ?? Infinity;
        if (Number.isFinite(d) && d > worst) { worst = d; worstPair = [i, j]; }
      }
    }
    if (worst > out.worstSpan) out.worstSpan = worst;
    if (worst <= MAX_SPAN || !worstPair) continue;
    out.bleeding++;
    const [i, j] = worstPair;
    const na = bones[idx[i]]?.name ?? `#${idx[i]}`;
    const nb = bones[idx[j]]?.name ?? `#${idx[j]}`;
    const key = [na, nb].sort().join(' ~ ');
    const rec = pairs.get(key) ?? { a: na, b: nb, hops: worst, verts: 0, weight: 0 };
    rec.verts++;
    // The SMALLER of the two is what is doing the dragging: a hip vertex with
    // 0.9 on the hip and 0.1 on the hand is still pulled a tenth of the way to
    // the hand, and that tenth is the membrane.
    rec.weight = Math.max(rec.weight, Math.min(wts[i], wts[j]));
    pairs.set(key, rec);
  }
  out.pairs.push(...pairs.values());
}

async function main() {
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const reports: BleedReport[] = [];

  for (const model of MODELS) {
    const out: BleedReport = { model, verts: 0, bleeding: 0, worstSpan: 0, pairs: [] };
    try {
      // THE RAW ASSET, deliberately — not the pipeline's output. The weights
      // are what has to be fixed, and measuring after a runtime correction
      // would hide whether the fix reached the file.
      const gltf = await loader.loadAsync(`/models/${model}`);
      let root: THREE.Object3D = gltf.scene;
      if (THROUGH_PIPELINE) {
        const { runCharacterPipeline } = await import('../../src/engine/pipeline/CharacterPipeline');
        const result = await runCharacterPipeline(gltf.scene, gltf.animations, `/models/${model}`, true);
        if (!result) { out.error = 'pipeline BLOCKED this asset'; reports.push(out); continue; }
        root = (result as { scene: THREE.Object3D }).scene;
      }
      const meshes: THREE.SkinnedMesh[] = [];
      root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
      if (meshes.length === 0) { out.error = 'no skinned mesh'; reports.push(out); continue; }
      const hops = hopMatrix(meshes[0].skeleton.bones);
      for (const m of meshes) auditMesh(m, out, hops);
      out.pairs.sort((a, b) => b.verts - a.verts);
      out.pairs = out.pairs.slice(0, 6);
    } catch (e) {
      out.error = e instanceof Error ? e.message : String(e);
    }
    reports.push(out);
    (window as unknown as { __BLEED_PROGRESS: number }).__BLEED_PROGRESS = reports.length;
  }

  (window as unknown as { __BLEED: BleedReport[] }).__BLEED = reports;
  (window as unknown as { __BLEED_READY: boolean }).__BLEED_READY = true;
}

main().catch((e) => {
  (window as unknown as { __BLEED: BleedReport[] }).__BLEED = [
    { model: 'FATAL', error: String(e), verts: 0, bleeding: 0, worstSpan: 0, pairs: [] },
  ];
  (window as unknown as { __BLEED_READY: boolean }).__BLEED_READY = true;
});
