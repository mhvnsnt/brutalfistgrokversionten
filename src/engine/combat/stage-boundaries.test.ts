/**
 * The stage catalogue declares per-stage boundaries, walls, hazards and edge
 * zones. Three of those declarations had ZERO readers in src/ and the engine
 * used module constants or a hardcoded stage id instead. Nothing here tests a
 * constant — every case is driven off the real STAGE_CONFIGS record, so a new
 * stage is covered the moment it is added.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AMBIENT_CALIBRATION, neonAt, STAGE_CONFIGS, type StageId } from './StageConfig.ts';
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
