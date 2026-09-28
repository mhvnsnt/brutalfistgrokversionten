import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

type ClipMeta = {
  semantic?: string;
  airborne?: boolean;
  receives?: boolean;
  bodies?: number;
  movingBones?: number;
  spineUp?: number;
  strike?: { reachFace?: number; startUp?: number; handReach?: number; footReach?: number; reachLimb?: string };
};

const index = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8')) as Record<string, ClipMeta>;
const commands = JSON.parse(readFileSync('public/motion/command-clips.json', 'utf8')) as {
  sets: Record<string, Record<string, string>>;
  fighters: Record<string, Record<string, string>>;
};

function isKick(m: ClipMeta): boolean {
  const limb = String(m.strike?.reachLimb ?? '').toLowerCase();
  if (/foot|leg/.test(limb)) return true;
  if (/hand|arm/.test(limb)) return false;
  return (m.strike?.footReach ?? 0) > (m.strike?.handReach ?? 0);
}

function isSafeSoloAttack(m: ClipMeta): boolean {
  return /^attack/.test(m.semantic ?? '')
    && !m.receives
    && (m.bodies ?? 1) < 3
    && (m.movingBones ?? 0) >= 3
    && (m.spineUp ?? 1) >= 0.75
    && (m.strike?.reachFace ?? 0) >= 0.5
    && (m.strike?.startUp ?? 0) >= 0.6
    && (m as any).dur <= 2.2;
}

describe('directional animation safety', () => {
  it('never routes the known airborne crouching clip into the crouching kick slot', () => {
    expect(commands.sets.chara_tutor2.sb_chara_tutor2_Crouching_Kick).not.toBe('CROUCHINGKICK');
    expect(commands.sets.chara_tutor2.sb_chara_tutor2_Crouching_Kick).toBe('QUICKKICK');
    expect(index[commands.sets.chara_tutor2.sb_chara_tutor2_Crouching_Kick].airborne).toBe(false);
  });

  it('keeps grapples out of the strike bank', () => {
    const all = [
      ...Object.values(commands.sets).flatMap((m) => Object.values(m)),
      ...Object.values(commands.fighters).flatMap((m) => Object.values(m)),
    ];
    expect(all).not.toContain('KNEETHROW_SLOW');
    expect(all).not.toContain('KNEETHROWREACTION');
    expect(all).not.toContain('JOHNSONWAVESWEEPERLAUNCHER');
  });

  it('routes the uppercut to an actual hand-driven uppercut clip', () => {
    const name = commands.sets.chara_tutor2.sb_chara_tutor2_CrouchUppercut;
    expect(name).toBe('UPPERCUT');
    expect(index[name].strike?.reachLimb?.toLowerCase()).toContain('hand');
    expect(index[name].strike?.reachFace).toBeGreaterThan(0.5);
  });

  it('uses airborne clips for the explicit air screw family', () => {
    const name = commands.sets.chara_tutor2.sb_chara_tutor2_AirScarletScrew;
    expect(name).toBe('JUMPAXEKICK');
    expect(index[name].airborne).toBe(true);
    expect(isKick(index[name])).toBe(true);
  });

  it('does not put a clip into a limb slot it cannot satisfy', () => {
    for (const [setName, map] of Object.entries(commands.sets)) {
      for (const [id, clipName] of Object.entries(map)) {
        const meta = index[clipName];
        expect(meta, setName + ':' + id + ' -> missing ' + clipName).toBeTruthy();
        if (/Crouch|Ground|Low/i.test(id)) expect(meta.airborne).not.toBe(true);
        if (/Kick|Knee|Axe/i.test(id)) expect(isKick(meta)).toBe(true);
        if (/Punch|Hammer|Dynamo|Uppercut|Gyaku/i.test(id)) expect(isKick(meta)).toBe(false);
      }
    }
  });
});
