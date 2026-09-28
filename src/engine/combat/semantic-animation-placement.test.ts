import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const map = JSON.parse(readFileSync('public/motion/command-clips.json', 'utf8')).fighters.bannon;

test('Bannon directional commands stay in their semantic animation families', () => {
  assert.equal(map.sb_chara_tutor2_CrouchUppercut, 'UPPERCUT');
  assert.equal(map.sb_chara_tutor2_Crouching_Kick, 'CROUCHINGKICK');
  assert.equal(map.sb_chara_tutor2_Knee_Commando, 'TIGERKNEEBASHSLOW');
  assert.equal(map.sb_chara_tutor2_AirScarletScrew, 'JUMPAXEKICK');
  assert.equal(map.sb_chara_tutor2_Ducking_Comet, 'ROUNDHOUSELOW');
  assert.notEqual(map.sb_chara_tutor2_CrouchUppercut, 'GRAFSURPRISEPUNCH');
});

test('semantic manifest explicitly separates attacker strikes from grapple receivers', () => {
  const manifest = JSON.parse(readFileSync('public/motion/semantic-placement-manifest.json', 'utf8'));
  assert.ok(manifest.categories.grapple_initiate.includes('THROWSTART'));
  assert.ok(manifest.categories.grapple_receiver.includes('KNEETHROWREACTION'));
  assert.equal(manifest.verification.status, 'runtime-playtest-required');
});
