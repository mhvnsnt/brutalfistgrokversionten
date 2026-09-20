/**
 * The stage catalogue declares per-stage boundaries, walls, hazards and edge
 * zones. Three of those declarations had ZERO readers in src/ and the engine
 * used module constants or a hardcoded stage id instead. Nothing here tests a
 * constant — every case is driven off the real STAGE_CONFIGS record, so a new
 * stage is covered the moment it is added.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AMBIENT_CALIBRATION, neonAt, ringOutEdgeX, tickArenaState, createArenaCombatState,
  OPEN_STAGE_RING_OUT_X, STAGE_CONFIGS, type StageId,
} from './StageConfig.ts';
import {
  LocomotionSystem, locomotionBoundsFromStage, DEFAULT_LOCOMOTION_BOUNDS,
  OPEN_STAGE_RING_OUT_X as LOCO_RING_OUT_X, OPEN_STAGE_OVERRUN,
} from '../locomotion/LocomotionSystem.ts';
import {
  checkWallCollision,
  wallBoundsFromStage,
  DEFAULT_WALL_BOUNDS,
  WALL_PUSH_DISTANCE,
  WALL_LEFT_X,
  WALL_RIGHT_X,
} from './WallSystem.ts';
import {
  createStageManagerState,
  checkLedgeThrowOverride,
  LEDGE_THROW_PROXIMITY,
} from './StageManager.ts';

const STAGE_IDS = Object.keys(STAGE_CONFIGS) as Exclude<StageId, 'random'>[];

describe('wall bounds come from the stage, not a module constant', () => {
  it('covers every shipped stage', () => {
    assert.ok(STAGE_IDS.length >= 15, `expected the full catalogue, saw ${STAGE_IDS.length}`);
  });

  it('omitting bounds reproduces the historic +/-4.5 exactly', () => {
    // Non-destructive contract: existing callers must not change behaviour.
    const hit = checkWallCollision(WALL_RIGHT_X + 0.1, 0.2);
    assert.equal(hit.hitWall, true);
    assert.equal(hit.wall, 'right');
    assert.equal(hit.clampedX, WALL_RIGHT_X - WALL_PUSH_DISTANCE);
    assert.equal(checkWallCollision(0, 0).hitWall, false);
    assert.deepEqual(wallBoundsFromStage(null), DEFAULT_WALL_BOUNDS);
  });

  for (const id of STAGE_IDS) {
    const cfg = STAGE_CONFIGS[id];
    const bounds = wallBoundsFromStage(cfg);

    it(`${id}: splats at its own boundary (${cfg.boundaryX}), not 4.5`, () => {
      if (!bounds.hasWalls) {
        // Open stage: the edge is a ring-out, there is nothing to splat on.
        // This is the case that used to hit an invisible wall at +/-4.5.
        assert.equal(checkWallCollision(4.6, 0.3, bounds).hitWall, false, 'open stage must not splat');
        assert.equal(checkWallCollision(50, 0.3, bounds).hitWall, false, 'open stage must not splat far out');
        return;
      }
      const b = cfg.boundaryX;
      assert.equal(checkWallCollision(b + 0.01, 0.3, bounds).hitWall, true, 'past the wall must splat');
      assert.equal(checkWallCollision(-b - 0.01, -0.3, bounds).wall, 'left');
      assert.equal(checkWallCollision(b - 0.2, 0.3, bounds).hitWall, false, 'inside the wall must not splat');
      assert.equal(checkWallCollision(b + 0.01, 0.3, bounds).clampedX, b - WALL_PUSH_DISTANCE);
    });
  }

  it('a walled stage narrower or wider than 4.5 splatted at the wrong place', () => {
    // Derived, not hand-picked: any walled stage whose barrier is not the old
    // module constant was measuring the splat against the wrong surface.
    const mismatched = STAGE_IDS.filter((id) => {
      const b = wallBoundsFromStage(STAGE_CONFIGS[id]);
      return b.hasWalls && STAGE_CONFIGS[id].boundaryX !== WALL_RIGHT_X;
    });
    assert.ok(mismatched.length > 0, 'expected walled stages away from the old constant');

    for (const id of mismatched) {
      const cfg = STAGE_CONFIGS[id];
      const bounds = wallBoundsFromStage(cfg);
      // At the stage's own wall the splat now fires...
      assert.equal(checkWallCollision(cfg.boundaryX + 0.01, 0.3, bounds).hitWall, true, `${id} splats at its wall`);
      // ...and under the old constant it did not agree with the stage.
      const oldSaid = checkWallCollision(cfg.boundaryX + 0.01, 0.3).hitWall;
      if (cfg.boundaryX < WALL_RIGHT_X) {
        assert.equal(oldSaid, false, `${id} is narrower than 4.5, so the old wall was never reached`);
      } else {
        assert.equal(oldSaid, true, `${id} is wider than 4.5, so the old wall fired early`);
      }
    }
  });

  it('sky_crane is an open ledge, so it rings out instead of splatting', () => {
    // It reads like a walled stage (boundaryX 3) and is not: hasWalls false,
    // ringOutEnabled true. Worth pinning — the narrow boundary is the LEDGE.
    const cfg = STAGE_CONFIGS.sky_crane;
    assert.equal(cfg.hasWalls, false);
    assert.equal(cfg.ringOutEnabled, true);
    assert.equal(checkWallCollision(cfg.boundaryX + 0.01, 0.3, wallBoundsFromStage(cfg)).hitWall, false);
    // The old constant put an invisible wall 1.5 units off the end of the crane.
    assert.equal(checkWallCollision(WALL_RIGHT_X + 0.01, 0.3).hitWall, true);
  });

  it('every open stage is open on both the flag and the geometry', () => {
    const open = STAGE_IDS.filter((id) => !wallBoundsFromStage(STAGE_CONFIGS[id]).hasWalls);
    assert.ok(open.length >= 3, `expected the open-street stages, saw ${open.join(',') || 'none'}`);
    for (const id of open) {
      const cfg = STAGE_CONFIGS[id];
      assert.equal(cfg.ringOutEnabled, true, `${id} is open but has no ring-out — nothing stops the fighter`);
    }
  });
});

describe('the train hazard is read off the field, not the stage id', () => {
  for (const id of STAGE_IDS) {
    it(`${id}: trainHazard.enabled === hasTrainHazard`, () => {
      const sm = createStageManagerState(id, 100, 100);
      assert.equal(sm.trainHazard.enabled, STAGE_CONFIGS[id].hasTrainHazard);
    });
  }

  it('exactly the declaring stages get a train', () => {
    const declared = STAGE_IDS.filter((id) => STAGE_CONFIGS[id].hasTrainHazard);
    assert.ok(declared.length >= 1, 'no stage declares a train hazard');
    const enabled = STAGE_IDS.filter((id) => createStageManagerState(id, 100, 100).trainHazard.enabled);
    assert.deepEqual(enabled.sort(), declared.sort());
  });
});

describe('the ledge-throw zone is per stage', () => {
  it('omitting the zone reproduces the module constant', () => {
    const b = 5;
    assert.equal(checkLedgeThrowOverride(b - LEDGE_THROW_PROXIMITY + 0.01, 0, b, true), true);
    assert.equal(checkLedgeThrowOverride(0, 0, b, true), false);
  });

  it('a wider zone triggers further from the edge', () => {
    const b = 5;
    const x = b - 2.5; // outside the 1.5 default, inside a 3.0 zone
    assert.equal(checkLedgeThrowOverride(x, 0, b, true, 1.5), false);
    assert.equal(checkLedgeThrowOverride(x, 0, b, true, 3.0), true);
  });

  it('a zero or missing zone falls back rather than disabling the mechanic', () => {
    const b = 5;
    assert.equal(checkLedgeThrowOverride(b - 0.1, 0, b, true, 0), true);
  });

  it('never fires on a stage with no ring-out or an infinite boundary', () => {
    for (const id of STAGE_IDS) {
      const cfg = STAGE_CONFIGS[id];
      if (cfg.ringOutEnabled && isFinite(cfg.boundaryX)) continue;
      assert.equal(
        checkLedgeThrowOverride(999, 999, cfg.boundaryX, cfg.ringOutEnabled, cfg.edgeZoneDistance),
        false,
        `${id} must not ledge-throw`,
      );
    }
  });
});

describe('stage practical lights are driven by the catalogue palette', () => {
  it('an absent or empty palette falls back to the authored colour', () => {
    assert.equal(neonAt(undefined, 0, '#abcdef'), '#abcdef');
    assert.equal(neonAt([], 3, '#abcdef'), '#abcdef');
  });

  it('entries cycle, so a short palette still lights every fixture', () => {
    const p = ['#111111', '#222222'];
    assert.equal(neonAt(p, 0, '#000'), '#111111');
    assert.equal(neonAt(p, 1, '#000'), '#222222');
    assert.equal(neonAt(p, 2, '#000'), '#111111');
    assert.equal(neonAt(p, 11, '#000'), '#222222');
    // Never returns undefined for a negative index.
    assert.equal(neonAt(p, -1, '#000'), '#222222');
  });

  it('urban_night carries a colour for every one of its neon practicals', () => {
    // UrbanNightStage declares eleven NeonStrip practicals it drives from the
    // palette (the warm sodium lamp is deliberately excluded). A palette
    // shorter than that would silently start repeating colours down the street.
    const palette = STAGE_CONFIGS.urban_night.neonPalette;
    assert.ok(palette, 'urban_night must declare a palette');
    assert.equal(palette!.length, 11, 'one entry per driven practical');
    for (const c of palette!) assert.match(c, /^#[0-9a-fA-F]{6}$/, `${c} is not a hex colour`);
  });

  it('every palette entry on every stage is a usable colour', () => {
    for (const id of STAGE_IDS) {
      for (const c of STAGE_CONFIGS[id].neonPalette ?? []) {
        assert.match(c, /^#[0-9a-fA-F]{6}$/, `${id} palette entry ${c}`);
      }
    }
  });

  it('the ambient calibration reproduces the measured urban_night value', () => {
    // 0.16 was measured as the floor that keeps unlit surfaces readable without
    // greying the night sky. Wiring the field up must not have changed it.
    const rendered = STAGE_CONFIGS.urban_night.ambientIntensity * AMBIENT_CALIBRATION;
    assert.ok(Math.abs(rendered - 0.16) < 1e-9, `ambient rendered at ${rendered}, expected 0.16`);
  });

  it('no stage declares an ambient that renders black or blown out', () => {
    for (const id of STAGE_IDS) {
      const rendered = STAGE_CONFIGS[id].ambientIntensity * AMBIENT_CALIBRATION;
      assert.ok(rendered > 0.03, `${id} renders at ambient ${rendered.toFixed(3)} — a black block`);
      assert.ok(rendered < 1, `${id} renders at ambient ${rendered.toFixed(3)} — flat, no chiaroscuro`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a fighter cannot walk through the stage he is standing in', () => {
  it('the two copies of the open-stage ring-out line agree', () => {
    // LocomotionSystem mirrors the constant to stay free of a module cycle.
    assert.equal(LOCO_RING_OUT_X, OPEN_STAGE_RING_OUT_X);
  });

  it('with no stage set, bounds are the historic +/-4.5 x +/-2.0', () => {
    assert.deepEqual(locomotionBoundsFromStage(null), DEFAULT_LOCOMOTION_BOUNDS);
    assert.equal(DEFAULT_LOCOMOTION_BOUNDS.maxX, 4.5);
    assert.equal(DEFAULT_LOCOMOTION_BOUNDS.maxZ, 2.0);
  });

  for (const id of STAGE_IDS) {
    const cfg = STAGE_CONFIGS[id];
    it(`${id}: walking hard into the edge stops at the stage, not at 4.5`, () => {
      const loco = new LocomotionSystem(0, 0, 1);
      loco.setBounds(locomotionBoundsFromStage(cfg));
      const bounds = loco.getBounds();

      // Drive far past any plausible edge, both ways, in X and Z.
      for (const target of [500, -500]) {
        loco.setPosition(target, target);
        const { x, z } = loco.position;
        assert.ok(x <= bounds.maxX + 1e-9 && x >= bounds.minX - 1e-9, `${id}: x ${x} outside ${bounds.minX}..${bounds.maxX}`);
        assert.ok(z <= bounds.maxZ + 1e-9 && z >= bounds.minZ - 1e-9, `${id}: z ${z} outside ${bounds.minZ}..${bounds.maxZ}`);
      }
    });

    it(`${id}: the walkable X matches what the stage declares`, () => {
      const bounds = locomotionBoundsFromStage(cfg);
      if (Number.isFinite(cfg.boundaryX) && cfg.hasWalls) {
        assert.equal(bounds.maxX, cfg.boundaryX, `${id} must stop at its own wall`);
        assert.equal(bounds.walkMaxX, cfg.boundaryX, `${id} must not be walkable past its own wall`);
      } else if (Number.isFinite(cfg.boundaryX)) {
        // AN EDGE THAT IS NOT A WALL IS STILL AN EDGE. This branch used to be
        // folded in with the open streets and asserted a backstop of 10 for
        // stages whose edge is at 3.8 and 3.0 — which is the bug: you WALKED
        // out of the ring. Walking stops at the edge; the backstop past it is
        // only there so a throw has somewhere to put you.
        assert.equal(bounds.walkMaxX, cfg.boundaryX, `${id} must not be walkable past its own edge`);
        assert.equal(bounds.maxX, cfg.boundaryX + OPEN_STAGE_OVERRUN);
      } else {
        // Genuinely open: a distant backstop, past the ring-out line.
        assert.ok(bounds.maxX > OPEN_STAGE_RING_OUT_X, `${id} backstop must sit past the ring-out line`);
        assert.equal(bounds.maxX, OPEN_STAGE_RING_OUT_X + OPEN_STAGE_OVERRUN);
        assert.equal(bounds.walkMaxX, bounds.maxX);
      }
      assert.equal(bounds.maxZ, Number.isFinite(cfg.boundaryZ) ? cfg.boundaryZ : DEFAULT_LOCOMOTION_BOUNDS.maxZ);
    });
  }

  it('the ring and the cage stop a fighter SHORT of 4.5 — walking through ropes', () => {
    const narrow = STAGE_IDS.filter((id) => {
      const c = STAGE_CONFIGS[id];
      return c.hasWalls && Number.isFinite(c.boundaryX) && c.boundaryX < 4.5;
    });
    assert.ok(narrow.length >= 3, `expected the narrow walled stages, saw ${narrow.join(',')}`);
    for (const id of narrow) {
      const loco = new LocomotionSystem(0, 0, 1);
      loco.setBounds(locomotionBoundsFromStage(STAGE_CONFIGS[id]));
      loco.setPosition(4.5, 0);
      assert.ok(loco.position.x < 4.5, `${id} still let a fighter reach the old constant`);
    }
  });

  it('the ring and the octagon reach their ropes in Z — the clamp was too tight', () => {
    const deep = STAGE_IDS.filter((id) => Number.isFinite(STAGE_CONFIGS[id].boundaryZ) && STAGE_CONFIGS[id].boundaryZ > 2.0);
    assert.ok(deep.length >= 5, `expected stages deeper than the old Z clamp, saw ${deep.length}`);
    for (const id of deep) {
      const loco = new LocomotionSystem(0, 0, 1);
      loco.setBounds(locomotionBoundsFromStage(STAGE_CONFIGS[id]));
      loco.setPosition(0, 500);
      assert.ok(loco.position.z > 2.0, `${id} still stopped at the old Z clamp`);
    }
  });

  /**
   * YOU CANNOT WALK YOURSELF OUT OF THE RING.
   *
   * Owner: "the ring outs are still happening too easy because you can just
   * walk through the walls and walk through the ropes." One bug, both halves.
   *
   * MEASURED before the fix: `wrestling_ring` declares boundaryX 3.8 and
   * `hasWalls: false`, and `hasWalls: false` was read as "no boundary at
   * all", so the walk clamp became the open-street backstop of +/-10 while
   * `ringOutEdgeX` for that stage is 3.8. Walking right for two seconds rang
   * you out. `sky_crane` is the same shape at 3.0.
   */
  for (const id of STAGE_IDS) {
    const cfg = STAGE_CONFIGS[id];
    if (cfg.hasWalls || !Number.isFinite(cfg.boundaryX)) continue;
    it(`${id}: you cannot WALK past the ring-out line, only be put there`, () => {
      const loco = new LocomotionSystem(0, 0, 1);
      loco.setBounds(locomotionBoundsFromStage(cfg));
      // Walk hard into the edge for two seconds of frames.
      for (let i = 0; i < 120; i++) loco.update(1, 0, 1 / 60, false, false);
      const walked = Math.abs(loco.position.x);
      assert.ok(walked <= cfg.boundaryX + 1e-6,
        `${id}: walked to ${walked}, past its own edge at ${cfg.boundaryX}`);
      assert.ok(walked <= ringOutEdgeX(cfg) + 1e-6,
        `${id}: walked past the ring-out line at ${ringOutEdgeX(cfg)} on foot`);

      // BUT A THROW STILL PUTS YOU OUT. If the fix simply clamped everything
      // to the edge, the ring-out could never fire again — which is the
      // opposite bug and just as bad.
      loco.setPosition(cfg.boundaryX + 1.0, 0);
      assert.ok(Math.abs(loco.position.x) > ringOutEdgeX(cfg),
        `${id}: nothing can reach the ring-out line any more`);
    });
  }

  it('setPosition is clamped — a teleport cannot strand a body off screen', () => {
    // A WALLED stage: the cage is a hard boundary, so 4.0 is the end of the world.
    const loco = new LocomotionSystem(0, 0, 1);
    loco.setBounds(locomotionBoundsFromStage(STAGE_CONFIGS.steel_cage));
    loco.setPosition(999, -999);
    const { x, z } = loco.position;
    assert.ok(Number.isFinite(x) && Math.abs(x) <= 4.0 + 1e-9, `x drifted to ${x}`);
    assert.ok(Number.isFinite(z) && Math.abs(z) <= 4.0 + 1e-9, `z drifted to ${z}`);
  });

  it('the wrestling ring does NOT wall you in — you go over the ropes', () => {
    // wrestling_ring declares hasWalls false and ringOutEnabled true, so the
    // ropes are a ring-out line rather than a wall. Walking past 3.8 must ring
    // you out, not stop you dead — and the locomotion backstop has to sit
    // beyond that line or the ring-out could never fire.
    const cfg = STAGE_CONFIGS.wrestling_ring;
    assert.equal(cfg.hasWalls, false);
    assert.equal(cfg.ringOutEnabled, true);
    const bounds = locomotionBoundsFromStage(cfg);
    assert.ok(bounds.maxX > cfg.boundaryX, 'the backstop must sit past the ropes');
    const after = tickArenaState(createArenaCombatState('wrestling_ring'), cfg.boundaryX + 0.2, 0, 0, 0, false, false);
    assert.equal(after.p1RingOut, true, 'over the ropes must be a ring-out');
  });

  it('changing stage pulls a fighter inside the new walls', () => {
    const loco = new LocomotionSystem(0, 0, 1);
    loco.setBounds(locomotionBoundsFromStage(STAGE_CONFIGS.industrial)); // boundaryX 5
    loco.setPosition(5, 0);
    assert.equal(loco.position.x, 5);
    loco.setBounds(locomotionBoundsFromStage(STAGE_CONFIGS.sky_crane));  // an open ledge at 3
    assert.ok(loco.position.x <= OPEN_STAGE_RING_OUT_X + OPEN_STAGE_OVERRUN);
  });
});

describe('ring-out is reachable on the stages that enable it', () => {
  it('an infinite boundary resolves to a finite edge', () => {
    for (const id of STAGE_IDS) {
      const cfg = STAGE_CONFIGS[id];
      const edge = ringOutEdgeX(cfg);
      if (!cfg.ringOutEnabled) { assert.equal(edge, Infinity, `${id} has no ring-out`); continue; }
      assert.ok(Number.isFinite(edge), `${id} enables a ring-out with an unreachable edge`);
    }
  });

  it('every ring-out stage actually rings a fighter out when he walks past it', () => {
    const ringOutStages = STAGE_IDS.filter((id) => STAGE_CONFIGS[id].ringOutEnabled);
    assert.ok(ringOutStages.length >= 4, `expected the ring-out stages, saw ${ringOutStages.length}`);
    for (const id of ringOutStages) {
      const edge = ringOutEdgeX(STAGE_CONFIGS[id]);
      const state = createArenaCombatState(id);
      const after = tickArenaState(state, edge + 0.5, 0, 0, 0, false, false);
      assert.equal(after.p1RingOut, true, `${id} did not ring out at ${edge + 0.5}`);
    }
  });

  it('a fighter inside the edge is not rung out', () => {
    for (const id of STAGE_IDS.filter((s) => STAGE_CONFIGS[s].ringOutEnabled)) {
      const edge = ringOutEdgeX(STAGE_CONFIGS[id]);
      const after = tickArenaState(createArenaCombatState(id), edge - 0.5, 0, 0, 0, false, false);
      assert.equal(after.p1RingOut, false, `${id} rang out a fighter still on the stage`);
    }
  });

  it('the backstop sits past the ring-out line on every open stage', () => {
    for (const id of STAGE_IDS) {
      const cfg = STAGE_CONFIGS[id];
      if (Number.isFinite(cfg.boundaryX) && cfg.hasWalls) continue;
      if (!cfg.ringOutEnabled) continue;
      const bounds = locomotionBoundsFromStage(cfg);
      assert.ok(bounds.maxX > ringOutEdgeX(cfg),
        `${id}: locomotion stops at ${bounds.maxX} before the ring-out at ${ringOutEdgeX(cfg)} — the ring-out could never fire`);
    }
  });
});
