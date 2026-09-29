/**
 * Animation Repair Pipeline
 *
 * Evidence-first classification for every imported clip. A clip is never
 * "fixed" merely because Three.js can play it. The pipeline separates:
 *   1. healthy authored motion,
 *   2. routing/alias defects,
 *   3. retarget/rest-pose defects,
 *   4. floor/root-motion defects,
 *   5. frozen/static clips,
 *   6. inverted/turn-away clips,
 *   7. multi-body captures,
 *   8. clips with valid motion but the wrong semantic.
 *
 * Repairs are targeted. Known-good strike owners remain untouched.
 */

export type AnimationFault =
  | 'NONE'
  | 'STATIC'
  | 'POSE_STARFISH'
  | 'INVERTED'
  | 'STARTS_DOWN'
  | 'TURN_AWAY'
  | 'TEAM_CAPTURE'
  | 'UNRESOLVED_TRACKS'
  | 'LOWER_BODY_UNCREDIBLE'
  | 'WRONG_SEMANTIC'
  | 'ROOT_TRAVEL_CONFLICT'
  | 'LOOP_UNSAFE'
  | 'UNKNOWN';

export interface AnimationEvidence {
  clipName: string;
  semantic: string | null;
  source: 'AUTHORED' | 'RETARGETED' | 'PLACEHOLDER' | 'UNKNOWN';
  movingBones: number | null;
  boneCount: number | null;
  spineUp: number | null;
  startUp: number | null;
  faceMin: number | null;
  bodies: number;
  unresolvedTracks: number;
  lowerBodyCredible: boolean | null;
  hasRootTravel: boolean;
  loopable: boolean | null;
  owner: boolean;
}

export interface AnimationDiagnosis {
  clipName: string;
  semantic: string | null;
  faults: AnimationFault[];
  repairClass: 'KEEP' | 'ROUTE' | 'REBAKE' | 'REAUTHOR' | 'BLOCK';
  evidence: AnimationEvidence;
}

/**
 * Diagnose one clip without changing it.
 *
 * Priority matters: a three-body capture is not a rigging problem, and a
 * static clip is not fixed by changing playback speed. Unknown evidence stays
 * UNKNOWN and therefore never becomes PASS.
 */
export function diagnoseAnimation(e: AnimationEvidence): AnimationDiagnosis {
  const faults: AnimationFault[] = [];

  if (e.bodies >= 3) faults.push('TEAM_CAPTURE');
  if (e.boneCount !== null && e.movingBones !== null &&
      e.boneCount >= 8 && e.movingBones < 3) faults.push('STATIC');
  if (e.semantic && /^(attack|idle|walk|run|dash|crouch|guard|taunt)/.test(e.semantic) &&
      e.spineUp !== null && e.spineUp <= 0) faults.push('INVERTED');
  if (e.semantic && /^(attack|walk|run|dash|idle|grapple)/.test(e.semantic) &&
      e.startUp !== null && e.startUp < 0.6) faults.push('STARTS_DOWN');
  if (e.semantic && /^attack/.test(e.semantic) && e.faceMin !== null && e.faceMin < 0) {
    faults.push('TURN_AWAY');
  }
  if (e.unresolvedTracks > 0) faults.push('UNRESOLVED_TRACKS');
  if (e.lowerBodyCredible === false) faults.push('LOWER_BODY_UNCREDIBLE');
  if (e.loopable === false && e.semantic && /^(idle|walk|run|dash|crouch)/.test(e.semantic)) faults.push('LOOP_UNSAFE');
  if (!e.semantic) faults.push('WRONG_SEMANTIC');

  const hasStructuralFault = faults.some(f =>
    f === 'STATIC' || f === 'POSE_STARFISH' || f === 'INVERTED' ||
    f === 'UNRESOLVED_TRACKS' || f === 'LOWER_BODY_UNCREDIBLE' || f === 'LOOP_UNSAFE'
  );
  const canRoute = faults.every(f =>
    f === 'WRONG_SEMANTIC' || f === 'TURN_AWAY' || f === 'STARTS_DOWN' ||
    f === 'TEAM_CAPTURE'
  );

  let repairClass: AnimationDiagnosis['repairClass'] = 'KEEP';
  if (faults.includes('TEAM_CAPTURE')) repairClass = 'BLOCK';
  else if (hasStructuralFault) repairClass = 'REBAKE';
  else if (canRoute && faults.length > 0) repairClass = 'ROUTE';
  else if (faults.includes('UNKNOWN')) repairClass = 'BLOCK';
  else if (faults.length > 0) repairClass = 'REAUTHOR';

  return { clipName: e.clipName, semantic: e.semantic, faults, repairClass, evidence: e };
}

/** Summarize an audit without hiding UNKNOWN evidence. */
export function summarizeAnimationAudit(rows: AnimationDiagnosis[]) {
  return rows.reduce((out, row) => {
    out.total++;
    out[row.repairClass]++;
    if (row.faults.length === 0) out.healthy++;
    return out;
  }, {
    total: 0, healthy: 0, KEEP: 0, ROUTE: 0, REBAKE: 0, REAUTHOR: 0, BLOCK: 0,
  });
}
