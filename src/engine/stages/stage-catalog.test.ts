// `.ts` extensions on purpose — the repo's runner resolves them literally.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ALL_STAGE_IDS, STAGE_CONFIGS, STAGE_SPAWN_X, stageBuildStatus, stageSpawnPoints,
} from '../combat/StageConfig.ts';
import { locomotionBoundsFromStage } from '../locomotion/LocomotionSystem.ts';
import { BRUTAL_FIST_STAGES, SELECTABLE_STAGES, resolveStageId } from '../../data/stageCatalog.ts';
import {
  BLOCKOUT_LIGHTS, BLOCKOUT_STAGE_IDS, FIGHT_LANE_HALF_DEPTH, FIGHT_LANE_HEIGHT, HIT_FX_WORLD_Y, RING_HALF,
  buildStageBlockout, isBlockoutStage, primBounds,
} from './StageBlockouts.ts';
import { HIT_FX_WORLD_Y as ENGINE_HIT_FX_Y } from '../V7OrientationContract.ts';
import { blockoutToObject3D, disposeBlockoutObject3D } from './stageBlockoutThree.ts';

/**
 * EVERY STAGE THAT EXISTS IS SELECTABLE, AND EVERY CANON BLOCKOUT IS PLAYABLE.
 *
 * Driven off STAGE_CONFIGS, so a stage added later is covered with no edit.
 */

const ORIGINAL_15 = [
  'urban_night', 'training', 'dojo', 'wrestling_ring', 'mma_octagon', 'steel_cage', 'industrial',
  'ghetto_streets', 'junkyard', 'sky_crane', 'spike_pit', 'acid_pit', 'grinder_pit', 'gang_brawl', 'subway',
];
const CANON_8 = ['black_swamp', 'jpcw_arena', 'club_onyx', 'kennedy_debate', 'void_ring', 'aztec_temple', 'parking_lot', 'banyan_tree'];

describe('the selectable stage catalogue lists every stage', () => {
  it('holds the original 15 and the 8 canon stages — 23, not 2', () => {
    for (const id of [...ORIGINAL_15, ...CANON_8]) assert.ok(id in STAGE_CONFIGS, `${id} missing from STAGE_CONFIGS`);
    assert.equal(ALL_STAGE_IDS.length, 23);
  });

  it('the select screen list is exactly RANDOM + every config', () => {
    assert.equal(BRUTAL_FIST_STAGES[0].id, 'random');
    assert.deepEqual(SELECTABLE_STAGES.map((s) => s.id), ALL_STAGE_IDS);
    assert.equal(BRUTAL_FIST_STAGES.length, ALL_STAGE_IDS.length + 1);
  });

  it('StageSelectScreen reads the catalogue instead of a hand-typed list', () => {
    const src = readFileSync('src/components/StageSelectScreen.tsx', 'utf8');
    assert.match(src, /BRUTAL_FIST_STAGES\.map/);
    assert.doesNotMatch(src, /id: 'subway',/, 'the old hand-typed stage list is back');
  });

  it('canon stages are marked BLOCKOUT and nothing claims final art', () => {
    for (const id of CANON_8) {
      assert.equal(stageBuildStatus(STAGE_CONFIGS[id as keyof typeof STAGE_CONFIGS]), 'BLOCKOUT', id);
      const entry = SELECTABLE_STAGES.find((s) => s.id === id)!;
      assert.equal(entry.buildStatus, 'BLOCKOUT');
      assert.ok(entry.badges.includes('BLOCKOUT'), `${id} card must show BLOCKOUT`);
      assert.ok(isBlockoutStage(id));
    }
    for (const id of ORIGINAL_15) assert.equal(stageBuildStatus(STAGE_CONFIGS[id as keyof typeof STAGE_CONFIGS]), 'PROCEDURAL');
    for (const s of SELECTABLE_STAGES) assert.doesNotMatch(JSON.stringify(s), /\bFINAL\b/i, `${s.id} claims final`);
  });

  it('random resolves to a real stage, including the new ones', () => {
    const seen = new Set<string>();
    for (let i = 0; i < ALL_STAGE_IDS.length; i++) seen.add(resolveStageId('random', () => (i + 0.5) / ALL_STAGE_IDS.length));
    assert.equal(seen.size, ALL_STAGE_IDS.length);
  });
});

describe('every stage has a valid floor and spawn points', () => {
  for (const id of ALL_STAGE_IDS) {
    const cfg = STAGE_CONFIGS[id];
    it(`${id}: spawns on its floor, on the fight plane, inside the walkable edge`, () => {
      const sp = stageSpawnPoints(cfg);
      const walk = locomotionBoundsFromStage(cfg);
      assert.equal(sp.p1.y, cfg.levels[0].floorY);
      assert.equal(sp.p2.y, cfg.levels[0].floorY);
      assert.equal(sp.p1.z, 0);
      assert.equal(sp.p2.z, 0);
      assert.equal(sp.p1.x, -STAGE_SPAWN_X);
      assert.equal(sp.p2.x, STAGE_SPAWN_X);
      for (const p of [sp.p1, sp.p2]) {
        assert.ok(p.x > walk.walkMinX && p.x < walk.walkMaxX, `${id}: spawn x ${p.x} outside ${walk.walkMinX}..${walk.walkMaxX}`);
        assert.ok(Math.abs(p.x) < cfg.boundaryX, `${id}: spawn on or past the edge`);
      }
      assert.ok(cfg.levels.length >= 1 && Number.isFinite(cfg.levels[0].floorY));
    });
  }
});

describe('canon stage blockouts build and respect the engine floor contract', () => {
  it('uses the engine hit-FX height', () => {
    const arena = readFileSync('src/components/CombatArena3D.tsx', 'utf8');
    assert.match(arena, /worldY: HIT_FX_WORLD_Y/, 'CombatArena3D no longer places hit FX at HIT_FX_WORLD_Y');
    assert.equal(HIT_FX_WORLD_Y, ENGINE_HIT_FX_Y);
    assert.equal(HIT_FX_WORLD_Y, 1.05);
  });

  for (const id of BLOCKOUT_STAGE_IDS) {
    const cfg = STAGE_CONFIGS[id];

    it(`${id}: builds (data and THREE group) without throwing`, () => {
      const spec = buildStageBlockout(id);
      assert.equal(spec.status, 'BLOCKOUT');
      assert.ok(spec.prims.length > 20, `${id}: a blockout needs actual layout`);
      const group = blockoutToObject3D(spec);
      let meshes = 0;
      let lights = 0;
      group.traverse((o: any) => { if (o.isMesh) meshes++; if (o.isLight) lights++; });
      assert.ok(meshes >= spec.prims.length);
      assert.equal(lights, BLOCKOUT_LIGHTS, `${id}: the practical light count must be fixed`);
      for (const p of spec.prims) {
        for (const v of [...p.p]) assert.ok(Number.isFinite(v), `${id}: non-finite prim position`);
      }
      disposeBlockoutObject3D(group);
      // deterministic: the same stage twice is the same stage
      assert.deepEqual(buildStageBlockout(id), spec);
    });

    it(`${id}: combat floor top is y = 0 and covers the whole lane`, () => {
      const spec = buildStageBlockout(id);
      assert.equal(spec.floor.y, 0);
      assert.equal(cfg.levels[0].floorY, 0);
      assert.equal(cfg.levels.length, 1);
      assert.ok(spec.floor.halfW >= cfg.boundaryX, `${id}: floor ${spec.floor.halfW} narrower than boundary ${cfg.boundaryX}`);
      assert.ok(spec.floor.halfD >= Math.min(cfg.boundaryZ, 3.5), `${id}: floor too shallow`);
      const floors = spec.prims.filter((p) => p.role === 'floor');
      const slab = floors.find((p) => {
        const b = primBounds(p);
        return Math.abs(b.max[1]) < 1e-9 && b.min[0] <= -cfg.boundaryX && b.max[0] >= cfg.boundaryX
          && b.min[2] <= -FIGHT_LANE_HALF_DEPTH && b.max[2] >= FIGHT_LANE_HALF_DEPTH;
      });
      assert.ok(slab, `${id}: no floor slab with its top at y = 0 spanning the lane`);
      for (const p of floors) assert.ok(primBounds(p).max[1] <= 0.005, `${id}: a floor piece rises above y = 0`);
      for (const p of spec.prims.filter((q) => q.role === 'under')) {
        assert.ok(primBounds(p).max[1] <= 1e-9, `${id}: an under-floor piece pokes above the canvas`);
      }
    });

    it(`${id}: the fight lane is clear, so a hit at ${HIT_FX_WORLD_Y} m is never inside scenery`, () => {
      const spec = buildStageBlockout(id);
      const X = cfg.boundaryX - 0.05;
      for (const p of spec.prims) {
        if (p.role !== 'prop') continue;
        const b = primBounds(p);
        const hit = b.max[0] > -X && b.min[0] < X
          && b.max[2] > -FIGHT_LANE_HALF_DEPTH && b.min[2] < FIGHT_LANE_HALF_DEPTH
          && b.max[1] > 0.02 && b.min[1] < FIGHT_LANE_HEIGHT;
        assert.ok(!hit, `${id}: ${p.kind} at ${p.p.join(',')} blocks the fight lane`);
      }
      assert.equal(spec.hitFxY, HIT_FX_WORLD_Y);
      assert.equal(spec.fightPlaneZ, 0);
      assert.deepEqual(spec.spawn, stageSpawnPoints(cfg));
    });
  }

  it('ring stages use the canon 3.5 m ring and ring-out over the ropes', () => {
    for (const id of ['jpcw_arena', 'void_ring'] as const) {
      const cfg = STAGE_CONFIGS[id];
      assert.equal(cfg.boundaryX, RING_HALF);
      assert.equal(cfg.boundaryZ, RING_HALF);
      assert.equal(cfg.ringOutEnabled, true);
      assert.equal(cfg.hasWalls, false);
      const ropes = buildStageBlockout(id).prims.filter((p) => p.role === 'boundary' && p.kind === 'box' && p.p[1] > 0.3 && p.p[1] < 1.3);
      assert.ok(ropes.length >= 12, `${id}: expected 3 ropes x 4 sides`);
    }
  });

  it('the Great Banyan Tree is the canon 60 x 60 m space, with the sky enclosing it', () => {
    const spec = buildStageBlockout('banyan_tree');
    assert.equal(spec.ground.w, 60);
    assert.equal(spec.ground.d, 60);
    assert.ok(spec.skyRadius >= Math.hypot(30, 30), 'sky dome clips the corners of the clearing');
    const trunk = spec.prims.find((p) => p.kind === 'cyl' && p.args[0] >= 3);
    assert.ok(trunk, 'the tree needs its trunk');
    assert.ok(spec.prims.length > 150, 'the biggest stage should be the biggest blockout');
  });
});
