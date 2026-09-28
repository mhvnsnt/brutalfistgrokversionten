import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import { selectCoreBakedNames } from './BakedMotionBank.ts';

describe('baked motion startup selection',()=>{
  it('prioritizes combat owners and paired receivers',()=>{
    const manifest={
      IDLE:{file:'IDLE.json',bank:'bannon',dur:1,bones:58,semantic:'idle',owns:true},
      TAUNT:{file:'TAUNT.json',bank:'bannon',dur:1,bones:58,semantic:'taunt'},
      THROW:{file:'THROW.json',bank:'bannon',dur:1,bones:58,semantic:'grapple',owns:true,pairedWith:['THROW_REC']},
      THROW_REC:{file:'THROW_REC.json',bank:'bannon',dur:1,bones:58,semantic:'grapple',receives:true},
    };
    const names=selectCoreBakedNames(manifest);
    assert.ok(names.includes('IDLE'));
    assert.ok(names.includes('THROW'));
    assert.ok(names.includes('THROW_REC'));
    assert.ok(!names.includes('TAUNT'));
  });
});
