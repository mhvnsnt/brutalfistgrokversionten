'use client';

import dynamic from 'next/dynamic';
import { getBannonFighter } from '../../src/data/bannonRoster';
import type { StageId } from '../../src/engine/combat/StageConfig';

const GameBattleArena = dynamic(() => import('../../src/components/GameBattleArena'), {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050508', color: '#fff', fontFamily: 'monospace' }}>
      LOADING BRUTAL FIST...
    </main>
  ),
});

export default function PlayPage() {
  const p1 = getBannonFighter('bannon');
  const p2 = getBannonFighter('kobra');

  if (!p1 || !p2) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050508', color: '#fff', fontFamily: 'monospace' }}>
        PLAYABLE GLB ROSTER COULD NOT BE RESOLVED.
      </main>
    );
  }

  return (
    <GameBattleArena
      p1Fighter={p1}
      p2Fighter={p2}
      stageId={'urban_night' as StageId}
      onBack={() => { window.location.href = '/'; }}
    />
  );
}
