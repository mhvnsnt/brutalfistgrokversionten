import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAirborneDive } from './AirborneDiveSystem.ts';
test('air attack can be pressed after the jump edge',()=>{ const m=resolveAirborneDive({airborne:true,source:'JUMP',forward:0,falling:false,attackPressed:true,kickPressed:false}); assert.equal(m?.kind,'NEUTRAL_DIVE'); assert.equal(m?.command,8); });
test('up plus forward selects forward airborne route',()=>{ const m=resolveAirborneDive({airborne:true,source:'JUMP',forward:1,falling:false,attackPressed:true,kickPressed:false}); assert.equal(m?.kind,'FORWARD_DIVE'); assert.equal(m?.command,9); });
test('stage-origin falling attack stays airborne',()=>{ const m=resolveAirborneDive({airborne:true,source:'STAGE_DIVE',forward:0,falling:true,attackPressed:true,kickPressed:false}); assert.equal(m?.source,'STAGE_DIVE'); assert.equal(m?.falling,true); });
test('grounded attack is not a dive',()=>{ assert.equal(resolveAirborneDive({airborne:false,source:'JUMP',forward:1,falling:false,attackPressed:true,kickPressed:false}),null); });