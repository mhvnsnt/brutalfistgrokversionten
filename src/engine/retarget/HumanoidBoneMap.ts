// `.ts` extensions on purpose — `node --experimental-strip-types` resolves
// them literally, and the offline harness imports these same modules.
import * as THREE from 'three';

/**
 * CANONICAL HUMANOID BONE MAP.
 *
 * One vocabulary every source and target rig is resolved into, so a clip can
 * move between skeletons that disagree about bone count, naming, hierarchy
 * depth, rest pose and scale. This EXTENDS the alias layer in
 * AnimationRetargeter (which only knows 17 fixed names and rewrites tracks by
 * name) with:
 *
 *   - variable-length spine and neck chains (1..n bones, resolved from the
 *     hierarchy between hips and head, not from names),
 *   - clavicles, toes and fingers as OPTIONAL slots,
 *   - side detection for every convention seen in the staged packs
 *     (Mixamo `LeftArm`, CMU `LHipJoint`/`LThumb`, Unreal/UAL `upperarm_l`,
 *     KayKit/Blender `upperarm.l`, `L_Arm`, `Arm_L`, `J_Shoulder_L`),
 *   - a topology fallback that finds hips/legs/arms/head from the rest-pose
 *     geometry when names say nothing (`bone_10`),
 *   - per-rig override tables (HumanoidRigOverrides) that win over both.
 *
 * Detection never invents a bone. A required slot it cannot resolve is
 * reported in `missingRequired`, and the retargeter turns that into
 * UNMAPPABLE rather than guessing.
 */

export type LimbSlot =
  | 'hips'
  | 'head'
  | 'leftClavicle' | 'leftUpperArm' | 'leftLowerArm' | 'leftHand'
  | 'rightClavicle' | 'rightUpperArm' | 'rightLowerArm' | 'rightHand'
  | 'leftUpperLeg' | 'leftLowerLeg' | 'leftFoot' | 'leftToes'
  | 'rightUpperLeg' | 'rightLowerLeg' | 'rightFoot' | 'rightToes';

export const REQUIRED_SLOTS: readonly LimbSlot[] = [
  'hips', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

export const OPTIONAL_SLOTS: readonly LimbSlot[] = [
  'leftClavicle', 'rightClavicle', 'leftToes', 'rightToes',
];

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export const FINGER_NAMES: readonly FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export type DetectionMethod = 'override' | 'name' | 'topology';

export interface HumanoidBoneMap {
  /** Fixed limb slots -> joint name (the Object3D.name in the loaded scene). */
  slots: Partial<Record<LimbSlot, string>>;
  /** Hips-exclusive, neck-exclusive spine chain, bottom -> top. May be empty. */
  spine: string[];
  /** Neck chain between the spine top and the head, bottom -> top. May be empty. */
  neck: string[];
  /** `left.index.1` -> joint name. Optional; absent fingers are skipped. */
  fingers: Record<string, string>;
  /** How each slot was resolved. */
  method: Partial<Record<LimbSlot | 'spine' | 'neck', DetectionMethod>>;
  missingRequired: LimbSlot[];
  /** Slots resolved / (required + optional + spine/neck presence). */
  coverage: number;
  jointCount: number;
  /** Joints no slot claimed — left at rest by the retargeter. */
  unmapped: string[];
}

/** A per-rig override table: slot -> joint name. Wins over names and topology. */
export interface HumanoidRigOverride {
  /** Matched against the rig signature, a model file name, or both. */
  match: { file?: RegExp; anyJoint?: string[] };
  slots?: Partial<Record<LimbSlot, string>>;
  spine?: string[];
  neck?: string[];
  fingers?: Record<string, string>;
  /** Joints that must never be claimed (weapon slots, helpers). */
  ignore?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Joint collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The joints of a rig. Bones when the scene has any; otherwise every named
 * non-mesh descendant, because skeleton-only exports (the 804 CMU GLBs) carry
 * their joints as plain nodes.
 */
export function collectJoints(root: THREE.Object3D): THREE.Object3D[] {
  const bones: THREE.Object3D[] = [];
  root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o); });
  if (bones.length) return bones;
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o === root) return;
    if ((o as THREE.Mesh).isMesh || (o as THREE.Camera).isCamera || (o as THREE.Light).isLight) return;
    if (!o.name) return;
    nodes.push(o);
  });
  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Name parsing
// ─────────────────────────────────────────────────────────────────────────────

export type Side = 'left' | 'right' | null;

export interface ParsedBoneName {
  side: Side;
  /** Lowercase tokens with prefixes, side markers and digits removed. */
  tokens: string[];
  /** First number in the name, e.g. `spine_02` -> 2, `Index3` -> 3. */
  index: number | null;
  core: string;
}

// Case-SENSITIVE on purpose: an /i lookahead would read `Skull`, `ball_l` or
// `Back` as a prefix plus a name.
const PREFIX_RE = /^(?:[Mm]ixamorig\d*(?:[\s:_.\-|]+|(?=[A-Z]))|(?:[Bb]ip0*1|DEF|ORG|MCH|CC_Base|J|B|Bn|Jnt|SK|Armature)[\s:_.\-|]+)/;

const GLUED_SIDE_WORDS = new Set([
  'hand', 'wrist', 'upperarm', 'lowerarm', 'forearm', 'arm', 'shoulder', 'clavicle', 'collar',
  'upperleg', 'lowerleg', 'upleg', 'leg', 'thigh', 'calf', 'shin', 'knee', 'foot', 'ankle', 'toes', 'toe', 'ball',
  'handslot', 'thumb', 'index', 'middle', 'ring', 'pinky', 'eye',
]);

export function parseBoneName(raw: string): ParsedBoneName {
  let name = raw;
  // Namespaces: `mixamorig:Hips`, `Armature|Hips`, `Rig/Hips`.
  const ns = Math.max(name.lastIndexOf(':'), name.lastIndexOf('|'), name.lastIndexOf('/'));
  if (ns >= 0 && ns < name.length - 1) name = name.slice(ns + 1);
  for (let i = 0; i < 3; i++) {
    const next = name.replace(PREFIX_RE, '');
    if (next === name || !next) break;
    name = next;
  }
  // `mixamorigHips` (sanitized, no separator) — the regex above needs a capital
  // after the prefix, which Mixamo always has.
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2');
  let tokens = spaced.split(/[\s_.-]+/).filter(Boolean).map((t) => t.toLowerCase());
  let side: Side = null;
  const sideOf = (t: string): Side =>
    t === 'l' || t === 'left' || t === 'lft' ? 'left' : t === 'r' || t === 'right' || t === 'rgt' || t === 'rt' ? 'right' : null;
  const kept: string[] = [];
  for (const t of tokens) {
    const s = sideOf(t);
    if (s && !side) { side = s; continue; }
    kept.push(t);
  }
  tokens = kept;
  // GLTFLoader sanitizes `hand.l` to `handl` (PropertyBinding strips dots),
  // so KayKit/Blender sides arrive glued onto the word.
  if (!side && tokens.length) {
    const last = tokens[tokens.length - 1];
    const m = /^(.+?)(l|r)$/.exec(last);
    if (m && GLUED_SIDE_WORDS.has(m[1])) {
      side = m[2] === 'l' ? 'left' : 'right';
      tokens[tokens.length - 1] = m[1];
    }
  }
  let index: number | null = null;
  const words: string[] = [];
  for (const t of tokens) {
    if (/^\d+$/.test(t)) { if (index === null) index = Number(t); continue; }
    words.push(t);
  }
  return { side, tokens: words, index, core: words.join('') };
}

/** A helper, end-site or attachment joint — never a humanoid slot. */
export function isHelperName(raw: string): boolean {
  const p = parseBoneName(raw);
  return p.tokens.some((t) =>
    /^(leaf|end|endsite|nub|tip|top|slot|handslot|weapon|prop|ik|pole|target|twist|roll|helper|socket|attach|jiggle|breast|ponytail|hair|cape|skirt|eye|jaw|tongue|teeth|lip|brow|eyebrow|eyelid|cheek|forehead|nose|ear)$/.test(t),
  ) || /headtop|head_end|end_site|endsite/i.test(raw);
}

type NameRole =
  | { kind: 'hips' } | { kind: 'root' } | { kind: 'spine' } | { kind: 'neck' } | { kind: 'head' }
  | { kind: 'clavicle' } | { kind: 'upperArm' } | { kind: 'lowerArm' } | { kind: 'hand' } | { kind: 'wrist' }
  | { kind: 'upperLeg' } | { kind: 'lowerLeg' } | { kind: 'foot' } | { kind: 'toes' }
  | { kind: 'hipJoint' } | { kind: 'shoulderAmbiguous' }
  | { kind: 'finger'; finger: FingerName }
  | { kind: 'fingerBase' }
  | null;

export function classifyBoneName(raw: string): NameRole {
  if (isHelperName(raw)) return null;
  const { side, tokens, core } = parseBoneName(raw);
  const has = (w: string) => tokens.includes(w);
  if (!core) return null;
  for (const f of FINGER_NAMES) if (has(f)) return { kind: 'finger', finger: f };
  if (has('little')) return { kind: 'finger', finger: 'pinky' };
  if (core === 'fingerbase' || core === 'metacarpal' || core === 'palm') return { kind: 'fingerBase' };
  if (/^(hips?|pelvis)$/.test(core) && !side) return { kind: 'hips' };
  if (/^(hips?)(joint)?$/.test(core) && side) return { kind: 'hipJoint' };
  if (/^(root|armature|reference|skeleton|rig|charroot|characterroot|master)$/.test(core)) return { kind: 'root' };
  if (/^(spine|abdomen|lowerback|upperback|chest|upperchest|torso|back|waist|belly|stomach|ribcage)$/.test(core) && !side) return { kind: 'spine' };
  if (core === 'neck') return { kind: 'neck' };
  if (core === 'head' || core === 'skull') return { kind: 'head' };
  if (/^(clavicle|collar|collarbone|clav)$/.test(core)) return { kind: 'clavicle' };
  if (core === 'shoulder' && side) return { kind: 'shoulderAmbiguous' };
  if (/^(upperarm|uparm|arm|humerus|bicep)$/.test(core) && side) return { kind: 'upperArm' };
  if (/^(forearm|lowerarm|loarm|elbow|radius)$/.test(core) && side) return { kind: 'lowerArm' };
  if (core === 'wrist' && side) return { kind: 'wrist' };
  if (core === 'hand' && side) return { kind: 'hand' };
  if (/^(upleg|upperleg|thigh|femur)$/.test(core) && side) return { kind: 'upperLeg' };
  if (/^(leg|lowerleg|loleg|calf|shin|knee|tibia)$/.test(core) && side) return { kind: 'lowerLeg' };
  if (/^(foot|ankle)$/.test(core) && side) return { kind: 'foot' };
  if (/^(toe|toes|toebase|ball|toe base)$/.test(core) && side) return { kind: 'toes' };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────────────────────────────────────

interface RigIndex {
  joints: THREE.Object3D[];
  byName: Map<string, THREE.Object3D>;
  jointSet: Set<THREE.Object3D>;
  world: Map<THREE.Object3D, THREE.Vector3>;
}

function indexRig(root: THREE.Object3D): RigIndex {
  root.updateMatrixWorld(true);
  const joints = collectJoints(root);
  const byName = new Map<string, THREE.Object3D>();
  const world = new Map<THREE.Object3D, THREE.Vector3>();
  for (const j of joints) {
    if (!byName.has(j.name)) byName.set(j.name, j);
    world.set(j, new THREE.Vector3().setFromMatrixPosition(j.matrixWorld));
  }
  return { joints, byName, jointSet: new Set(joints), world };
}

function jointParent(idx: RigIndex, j: THREE.Object3D): THREE.Object3D | null {
  let p = j.parent;
  while (p && !idx.jointSet.has(p)) p = p.parent;
  return p;
}

function isAncestor(idx: RigIndex, a: THREE.Object3D, b: THREE.Object3D): boolean {
  let p = jointParent(idx, b);
  while (p) { if (p === a) return true; p = jointParent(idx, p); }
  return false;
}

function pathUp(idx: RigIndex, from: THREE.Object3D, to: THREE.Object3D): THREE.Object3D[] | null {
  // joints strictly between `to` (ancestor) and `from`, ordered top -> bottom.
  const out: THREE.Object3D[] = [];
  let p = jointParent(idx, from);
  while (p && p !== to) { out.push(p); p = jointParent(idx, p); }
  return p === to ? out.reverse() : null;
}

function lca(idx: RigIndex, a: THREE.Object3D, b: THREE.Object3D): THREE.Object3D | null {
  const anc = new Set<THREE.Object3D>();
  for (let p: THREE.Object3D | null = a; p; p = jointParent(idx, p)) anc.add(p);
  for (let p: THREE.Object3D | null = b; p; p = jointParent(idx, p)) if (anc.has(p)) return p;
  return null;
}

function jointChildren(idx: RigIndex, j: THREE.Object3D): THREE.Object3D[] {
  return idx.joints.filter((c) => jointParent(idx, c) === j);
}

/** Walk up past helper/twist joints to the next real parent. */
function realParent(idx: RigIndex, j: THREE.Object3D): THREE.Object3D | null {
  let p = jointParent(idx, j);
  while (p && isHelperName(p.name)) p = jointParent(idx, p);
  return p;
}

export function rigSignature(root: THREE.Object3D): string {
  const joints = collectJoints(root);
  return `${joints.length}:${joints.slice(0, 4).map((j) => j.name).join(',')}`;
}

export interface DetectOptions {
  overrides?: readonly HumanoidRigOverride[];
  /** Model file name, matched against override `file` patterns. */
  file?: string;
  /** Disable name detection entirely (tests the topology fallback). */
  topologyOnly?: boolean;
}

export function detectHumanoidBoneMap(root: THREE.Object3D, opts: DetectOptions = {}): HumanoidBoneMap {
  const idx = indexRig(root);
  const slots: Partial<Record<LimbSlot, THREE.Object3D>> = {};
  const method: HumanoidBoneMap['method'] = {};
  const override = (opts.overrides ?? []).find((o) =>
    (o.match.file ? Boolean(opts.file && o.match.file.test(opts.file)) : true)
    && (o.match.anyJoint ? o.match.anyJoint.some((n) => idx.byName.has(n)) : true)
    && Boolean(o.match.file || o.match.anyJoint));
  const ignored = new Set(override?.ignore ?? []);
  const set = (slot: LimbSlot, j: THREE.Object3D | null | undefined, m: DetectionMethod) => {
    if (!j || slots[slot] || ignored.has(j.name)) return;
    slots[slot] = j;
    method[slot] = m;
  };

  if (override?.slots) {
    for (const [slot, name] of Object.entries(override.slots) as [LimbSlot, string][]) set(slot, idx.byName.get(name), 'override');
  }

  // ── Pass 1: names ─────────────────────────────────────────────────────────
  const roles = new Map<THREE.Object3D, NonNullable<NameRole>>();
  if (!opts.topologyOnly) {
    for (const j of idx.joints) {
      if (ignored.has(j.name)) continue;
      const r = classifyBoneName(j.name);
      if (r) roles.set(j, r);
    }
  }
  const sideOf = (j: THREE.Object3D) => parseBoneName(j.name).side;
  const findRole = (kind: string, side: Side = null) =>
    idx.joints.filter((j) => roles.get(j)?.kind === kind && (side === null || sideOf(j) === side));
  const shallowest = (list: THREE.Object3D[]) => {
    const depth = (j: THREE.Object3D) => { let d = 0; for (let p = jointParent(idx, j); p; p = jointParent(idx, p)) d++; return d; };
    return list.slice().sort((a, b) => depth(a) - depth(b))[0] ?? null;
  };

  for (const side of ['left', 'right'] as const) {
    const S = side === 'left' ? 'left' : 'right';
    // Hand: a wrist with a `hand` child is the rotating joint; the child is a
    // finger/slot carrier. Otherwise the shallowest `hand`.
    const wrist = shallowest(findRole('wrist', side));
    const hand = shallowest(findRole('hand', side));
    set(`${S}Hand` as LimbSlot, wrist ?? hand, 'name');
    set(`${S}Foot` as LimbSlot, shallowest(findRole('foot', side)), 'name');
    const footJ = slots[`${S}Foot` as LimbSlot];
    const toes = findRole('toes', side).filter((t) => footJ && isAncestor(idx, footJ, t));
    set(`${S}Toes` as LimbSlot, shallowest(toes), 'name');
  }
  set('head', shallowest(findRole('head')), 'name');
  const namedHips = shallowest(findRole('hips'));

  // ── Pass 2: topology fallback for the anchors names did not give ─────────
  if (!slots.leftFoot || !slots.rightFoot || !slots.head || !slots.leftHand || !slots.rightHand) {
    topologyAnchors(idx, slots, method, set);
  }

  // ── Limb chains from anchors: parent walk, verified by names when present ─
  for (const side of ['left', 'right'] as const) {
    const S = side;
    const hand = slots[`${S}Hand` as LimbSlot];
    if (hand) {
      const named = findRole('lowerArm', side).find((j) => isAncestor(idx, j, hand));
      const lower = named ?? realParent(idx, hand);
      set(`${S}LowerArm` as LimbSlot, lower, named ? 'name' : 'topology');
      if (lower) {
        const namedUp = [...findRole('upperArm', side), ...findRole('shoulderAmbiguous', side)]
          .filter((j) => isAncestor(idx, j, lower))
          .sort((a, b) => (isAncestor(idx, a, b) ? 1 : -1))[0];
        const upper = namedUp ?? realParent(idx, lower);
        set(`${S}UpperArm` as LimbSlot, upper, namedUp ? 'name' : 'topology');
        if (upper) {
          const clav = realParent(idx, upper);
          const role = clav ? roles.get(clav)?.kind : undefined;
          if (clav && (role === 'clavicle' || role === 'shoulderAmbiguous')) set(`${S}Clavicle` as LimbSlot, clav, 'name');
        }
      }
    }
    const foot = slots[`${S}Foot` as LimbSlot];
    if (foot) {
      const lowerNamed = findRole('lowerLeg', side).find((j) => realParent(idx, foot) === j);
      const lower = lowerNamed ?? realParent(idx, foot);
      set(`${S}LowerLeg` as LimbSlot, lower, lowerNamed ? 'name' : 'topology');
      if (lower) {
        const up = realParent(idx, lower);
        const upRole = up ? roles.get(up)?.kind : undefined;
        set(`${S}UpperLeg` as LimbSlot, up, upRole === 'upperLeg' || upRole === 'hipJoint' ? 'name' : 'topology');
      }
      if (!slots[`${S}Toes` as LimbSlot]) {
        const kids = jointChildren(idx, foot).filter((c) => !isHelperName(c.name));
        if (kids.length === 1) set(`${S}Toes` as LimbSlot, kids[0], 'topology');
      }
    }
  }

  // ── Hips: named if it is above both legs, else their common ancestor ─────
  const lu = slots.leftUpperLeg;
  const ru = slots.rightUpperLeg;
  if (lu && ru) {
    const common = lca(idx, lu, ru);
    if (namedHips && isAncestor(idx, namedHips, lu) && isAncestor(idx, namedHips, ru)) set('hips', namedHips, 'name');
    else set('hips', common, 'topology');
  } else if (namedHips) {
    set('hips', namedHips, 'name');
  }

  // ── Spine / neck chains: whatever sits between hips and head ─────────────
  let spine: THREE.Object3D[] = [];
  let neck: THREE.Object3D[] = [];
  let spineMethod: DetectionMethod = 'topology';
  const hips = slots.hips;
  const head = slots.head;
  if (override?.spine) { spine = override.spine.map((n) => idx.byName.get(n)).filter(Boolean) as THREE.Object3D[]; spineMethod = 'override'; }
  if (override?.neck) neck = override.neck.map((n) => idx.byName.get(n)).filter(Boolean) as THREE.Object3D[];
  if (hips && head && !override?.spine) {
    const between = (pathUp(idx, head, hips) ?? []).filter((j) => !isHelperName(j.name));
    // Anything named neck is neck; if nothing is, joints above BOTH clavicle
    // (or upper-arm) branch points are neck too.
    const armRoots = [slots.leftUpperArm, slots.rightUpperArm].filter(Boolean) as THREE.Object3D[];
    // The arms branch off the deepest spine joint that is an ancestor of the
    // upper arm. Joints above that branch are neck even when unnamed.
    const branchTop = between.reduce((acc, j, i) => (armRoots.some((a) => isAncestor(idx, j, a)) ? i : acc), -1);
    for (const side of ['left', 'right'] as const) {
      const upper = slots[`${side}UpperArm` as LimbSlot];
      if (!upper || slots[`${side}Clavicle` as LimbSlot] || branchTop < 0) continue;
      const path = (pathUp(idx, upper, between[branchTop]) ?? []).filter((j) => !isHelperName(j.name));
      if (path.length === 1) set(`${side}Clavicle` as LimbSlot, path[0], 'topology');
    }
    for (let i = 0; i < between.length; i++) {
      const j = between[i];
      const r = roles.get(j)?.kind;
      if (r === 'neck' || (branchTop >= 0 && i > branchTop)) neck.push(j);
      else spine.push(j);
    }
    spineMethod = between.some((j) => roles.get(j)?.kind === 'spine') ? 'name' : 'topology';
  }
  if (spine.length) method.spine = spineMethod;
  if (neck.length) method.neck = spineMethod;

  // ── Fingers (optional) ────────────────────────────────────────────────────
  const fingers: Record<string, string> = { ...(override?.fingers ?? {}) };
  for (const side of ['left', 'right'] as const) {
    const hand = slots[`${side}Hand` as LimbSlot];
    if (!hand) continue;
    for (const f of FINGER_NAMES) {
      const chain = idx.joints
        .filter((j) => { const r = roles.get(j); return r?.kind === 'finger' && r.finger === f && isAncestor(idx, hand, j) && sideOf(j) !== (side === 'left' ? 'right' : 'left'); })
        .sort((a, b) => (isAncestor(idx, a, b) ? -1 : isAncestor(idx, b, a) ? 1 : 0));
      chain.slice(0, 3).forEach((j, i) => { fingers[`${side}.${f}.${i + 1}`] ??= j.name; });
    }
  }

  const slotNames: Partial<Record<LimbSlot, string>> = {};
  for (const [k, v] of Object.entries(slots) as [LimbSlot, THREE.Object3D][]) slotNames[k] = v.name;
  const claimed = new Set<string>([...Object.values(slotNames), ...spine.map((j) => j.name), ...neck.map((j) => j.name), ...Object.values(fingers)]);
  const missingRequired = REQUIRED_SLOTS.filter((s) => !slotNames[s]);
  const possible = REQUIRED_SLOTS.length + OPTIONAL_SLOTS.length + 2;
  const got = REQUIRED_SLOTS.filter((s) => slotNames[s]).length + OPTIONAL_SLOTS.filter((s) => slotNames[s]).length + (spine.length ? 1 : 0) + (neck.length ? 1 : 0);
  return {
    slots: slotNames,
    spine: spine.map((j) => j.name),
    neck: neck.map((j) => j.name),
    fingers,
    method,
    missingRequired,
    coverage: got / possible,
    jointCount: idx.joints.length,
    unmapped: idx.joints.map((j) => j.name).filter((n) => !claimed.has(n)),
  };
}

/**
 * Geometry-only anchors: feet are the two lowest leaf chains on opposite
 * sides, the head is the top of the chain to the highest leaf, hands are the
 * branch points of the two most lateral subtrees. Side comes from the
 * character's own facing (feet -> toes), never from a world-axis assumption,
 * with glTF +Z facing as the last resort.
 */
function topologyAnchors(
  idx: RigIndex,
  slots: Partial<Record<LimbSlot, THREE.Object3D>>,
  _method: HumanoidBoneMap['method'],
  set: (slot: LimbSlot, j: THREE.Object3D | null | undefined, m: DetectionMethod) => void,
): void {
  const leaves = idx.joints.filter((j) => jointChildren(idx, j).length === 0);
  if (leaves.length < 4) return;
  const pos = (j: THREE.Object3D) => idx.world.get(j)!;
  let minY = Infinity; let maxY = -Infinity;
  for (const j of idx.joints) { minY = Math.min(minY, pos(j).y); maxY = Math.max(maxY, pos(j).y); }
  const height = Math.max(1e-6, maxY - minY);

  // Feet: lowest leaves, pairwise far apart laterally.
  const low = leaves.slice().sort((a, b) => pos(a).y - pos(b).y);
  let pair: [THREE.Object3D, THREE.Object3D] | null = null;
  for (let i = 0; i < low.length && !pair; i++) {
    for (let k = i + 1; k < low.length; k++) {
      if (pos(low[k]).y - minY > 0.2 * height) break;
      const d = pos(low[i]).clone().sub(pos(low[k])); d.y = 0;
      const common = lca(idx, low[i], low[k]);
      if (d.length() > 0.05 * height && common && pos(common).y - minY > 0.3 * height) { pair = [low[i], low[k]]; break; }
    }
  }
  if (!pair) return;
  const hipsGuess = lca(idx, pair[0], pair[1])!;
  const footOf = (leaf: THREE.Object3D) => {
    // Deepest joint on the chain still clearly above the floor = ankle.
    const chain = [leaf, ...(pathUp(idx, leaf, hipsGuess) ?? []).reverse()];
    for (const j of chain) if (pos(j).y - minY > 0.03 * height) return j;
    return chain[0];
  };
  const footA = footOf(pair[0]);
  const footB = footOf(pair[1]);
  // Facing from ankle -> toe, averaged over both feet.
  const fwd = new THREE.Vector3();
  for (const [foot, leaf] of [[footA, pair[0]], [footB, pair[1]]] as const) {
    if (foot !== leaf) fwd.add(pos(leaf).clone().sub(pos(foot)).setY(0));
  }
  if (fwd.lengthSq() < 1e-10) fwd.set(0, 0, 1);
  fwd.normalize();
  const leftAxis = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
  const lateral = (j: THREE.Object3D) => pos(j).clone().sub(pos(hipsGuess)).dot(leftAxis);
  const [lf, rf] = lateral(footA) >= lateral(footB) ? [footA, footB] : [footB, footA];
  set('leftFoot', lf, 'topology');
  set('rightFoot', rf, 'topology');

  // Head: highest leaf; its parent if the leaf is a short end-site.
  const top = leaves.slice().sort((a, b) => pos(b).y - pos(a).y)[0];
  if (top) {
    const p = jointParent(idx, top);
    const endSite = p && pos(top).distanceTo(pos(p)) < 0.12 * height && jointChildren(idx, p).length === 1;
    set('head', endSite ? p : top, 'topology');
  }
  // Hands: most lateral leaves on each side; hand = LCA of that side's
  // lateral leaves (the finger split), or the leaf's parent for a bare chain.
  for (const [slot, sign] of [['leftHand', 1], ['rightHand', -1]] as const) {
    const cands = leaves.filter((l) => sign * lateral(l) > 0.1 * height && pos(l).y - minY > 0.3 * height)
      .sort((a, b) => sign * (lateral(b) - lateral(a)));
    if (!cands.length) continue;
    let hand: THREE.Object3D | null = cands[0];
    const cluster = cands.filter((c) => pos(c).distanceTo(pos(cands[0])) < 0.15 * height);
    for (const c of cluster) hand = hand ? lca(idx, hand, c) : c;
    if (hand === cands[0]) hand = jointParent(idx, cands[0]);
    set(slot, hand, 'topology');
  }
}

/** Every mapped joint name — the joints the retargeter will write. */
export function mappedJointNames(map: HumanoidBoneMap): string[] {
  return [...Object.values(map.slots), ...map.spine, ...map.neck, ...Object.values(map.fingers)].filter(Boolean) as string[];
}
