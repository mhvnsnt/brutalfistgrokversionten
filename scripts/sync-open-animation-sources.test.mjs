import test from 'node:test';
import assert from 'node:assert/strict';
import { inferMotionRoles } from './sync-open-animation-sources.mjs';
test('open animation role inference recognizes combat and defense without inventing ownership',()=>{assert.deepEqual(inferMotionRoles('Combat/Combo_Punch_01.glb'),['attack']);assert.deepEqual(inferMotionRoles('Defense/Dodge_Left.glb'),['defense']);assert.deepEqual(inferMotionRoles('Reactions/Throw_Reaction.glb'),['hit_reaction','throw']);});
test('unknown filenames remain unclassified',()=>{assert.deepEqual(inferMotionRoles('misc/character_pose.glb'),[]);});
