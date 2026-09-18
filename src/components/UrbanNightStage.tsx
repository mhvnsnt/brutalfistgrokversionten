'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface UrbanNightStageProps {
  p1Color: string;
  p2Color: string;
}

/**
 * Animated neon strip that flickers AND throws its colour onto the street.
 *
 * THE REACH IS THE POINT. These strips sit on the back wall at z between -7 and
 * -8.8, and the fighters stand at z ~ 0. The light was `distance={6}`, so it
 * died at z ~ -2.8 and never arrived: the neon glowed, the street stayed black.
 * `distance` is the hard cutoff in three.js, so no amount of intensity helps
 * until the radius covers the fight plane — about 9 units from the wall.
 *
 * `decay={2}` is inverse-square and physically right, but at 9 units it leaves
 * a few percent of the nominal value, so intensity is raised to match the reach
 * rather than the number looking large for its own sake.
 */
function NeonStrip({
  position,
  rotation,
  width,
  color,
  flickerSpeed = 1.3,
  intensity = 16,
  distance = 22,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  color: string;
  flickerSpeed?: number;
  intensity?: number;
  distance?: number;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.elapsedTime * flickerSpeed;
    // Subtle flicker using sin + noise-like offset
    const flicker = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    lightRef.current.intensity = intensity * flicker;
  });
  return (
    <group position={position} rotation={rotation as any}>
      <mesh>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} color={color} intensity={intensity} distance={distance} decay={2} />
    </group>
  );
}

// Brick wall panel
function BrickWallPanel({
  position,
  rotation,
  width,
  height,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
}) {
  return (
    <group position={position} rotation={rotation as any}>
      {/* Base wall */}
      <mesh receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#1a1210" roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Brick row lines — horizontal */}
      {Array.from({ length: Math.floor(height / 0.35) }).map((_, i) => (
        <mesh key={`h${i}`} position={[0, -height / 2 + i * 0.35 + 0.175, 0.01]}>
          <planeGeometry args={[width, 0.02]} />
          <meshStandardMaterial color="#0d0b09" roughness={1} />
        </mesh>
      ))}
      {/* Brick column lines — vertical, offset every other row */}
      {Array.from({ length: Math.floor(height / 0.35) }).map((_, row) =>
        Array.from({ length: Math.floor(width / 0.7) + 1 }).map((_, col) => (
          <mesh
            key={`v${row}-${col}`}
            position={[
              -width / 2 + col * 0.7 + (row % 2 === 0 ? 0 : 0.35),
              -height / 2 + row * 0.35 + 0.175,
              0.012,
            ]}
          >
            <planeGeometry args={[0.02, 0.33]} />
            <meshStandardMaterial color="#0d0b09" roughness={1} />
          </mesh>
        ))
      )}
    </group>
  );
}

// Chain-link fence panel
function ChainlinkFence({
  position,
  rotation,
  width,
  height,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
}) {
  const posts = Math.floor(width / 2.5) + 1;
  return (
    <group position={position} rotation={rotation as any}>
      {/* Fence backing — very dark */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#080808" roughness={1} transparent opacity={0.7} />
      </mesh>
      {/* Vertical posts */}
      {Array.from({ length: posts }).map((_, i) => (
        <mesh key={`post${i}`} position={[-width / 2 + i * (width / (posts - 1)), 0, 0.05]}>
          <boxGeometry args={[0.06, height, 0.06]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.6} metalness={0.8} />
        </mesh>
      ))}
      {/* Horizontal rails */}
      {[height / 2 - 0.1, 0, -height / 2 + 0.1].map((y, i) => (
        <mesh key={`rail${i}`} position={[0, y, 0.05]}>
          <boxGeometry args={[width, 0.05, 0.05]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.6} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function UrbanNightStage({ p1Color, p2Color }: UrbanNightStageProps) {
  const P1_X = -1.8;
  const P2_X = 1.8;
  const FLOOR_W = 22;
  const FLOOR_D = 12;

  return (
    <group>
      {/* ── Fog / atmosphere — handled by parent Canvas fog ── */}

      {/* ── Concrete / asphalt floor ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FLOOR_W, FLOOR_D]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.92} metalness={0.08} />
      </mesh>
      {/* Asphalt crack lines */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.03, FLOOR_D]} />
        <meshStandardMaterial color="#141414" roughness={1} />
      </mesh>
      <mesh position={[-3, 0.003, 0]} rotation={[-Math.PI / 2, 0.15, 0]}>
        <planeGeometry args={[0.02, 5]} />
        <meshStandardMaterial color="#141414" roughness={1} />
      </mesh>
      <mesh position={[4, 0.003, -1]} rotation={[-Math.PI / 2, -0.1, 0]}>
        <planeGeometry args={[0.02, 4]} />
        <meshStandardMaterial color="#141414" roughness={1} />
      </mesh>
      {/* Center fight line — faint neon yellow */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.05, FLOOR_D]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.15} transparent opacity={0.4} />
      </mesh>

      {/* ── Sky dome / cyclorama backdrop — eliminates black void ── */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[45, 32, 16]} />
        <meshBasicMaterial color="#050508" side={THREE.BackSide} />
      </mesh>
      {/* Gradient cylinder backdrop — closer, catches lighting ── */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[28, 28, 20, 32, 1, true]} />
        <meshBasicMaterial color="#0a0810" side={THREE.BackSide} transparent opacity={0.95} />
      </mesh>

      {/* ── Background brick walls (Z: -8 to -12) ── */}
      <BrickWallPanel position={[0, 3.5, -9]} width={22} height={9} />
      {/* Side brick returns */}
      <BrickWallPanel
        position={[-10, 3.5, -4]}
        rotation={[0, Math.PI / 2, 0]}
        width={10}
        height={9}
      />
      <BrickWallPanel
        position={[10, 3.5, -4]}
        rotation={[0, -Math.PI / 2, 0]}
        width={10}
        height={9}
      />

      {/* ── Chain-link fence in front of brick walls ── */}
      <ChainlinkFence position={[0, 2.5, -8.5]} width={22} height={5} />

      {/* ── Neon accent strips on walls ── */}
      {/* UV / ultraviolet strip — top of back wall */}
      <NeonStrip position={[0, 6.8, -8.8]} width={18} color="#7c3aed" flickerSpeed={0.9} />
      {/* Deep purple strip — mid back wall */}
      <NeonStrip position={[-6, 4.2, -8.7]} width={6} color="#9333ea" flickerSpeed={1.7} />
      <NeonStrip position={[6, 4.2, -8.7]} width={6} color="#9333ea" flickerSpeed={1.4} />
      {/* Neon yellow accent — floor level, left side */}
      <NeonStrip position={[-8, 0.3, -7]} rotation={[0, Math.PI / 2, 0]} width={3} color="#eab308" flickerSpeed={2.1} />
      {/* Neon yellow accent — floor level, right side */}
      <NeonStrip position={[8, 0.3, -7]} rotation={[0, -Math.PI / 2, 0]} width={3} color="#eab308" flickerSpeed={1.8} />
      {/* Cyan accent — left fence post */}
      <NeonStrip position={[-9, 3, -8.4]} rotation={[0, Math.PI / 2, 0]} width={2} color="#06b6d4" flickerSpeed={1.1} />
      {/* Red accent — right fence post */}
      <NeonStrip position={[9, 3, -8.4]} rotation={[0, -Math.PI / 2, 0]} width={2} color="#dc2626" flickerSpeed={1.6} />

      {/* ── Street-level neon: the lights the fighters actually stand in ──
          Everything above is on the back wall 7-9 units away. These sit level
          with the fight plane on both sides, in different colours, so the
          street reads as a mix rather than one flat purple wash. */}
      <NeonStrip position={[-5.5, 2.6, -1.2]} rotation={[0, Math.PI / 2, 0]} width={3.2} color="#22d3ee" flickerSpeed={1.25} intensity={18} distance={16} />
      <NeonStrip position={[5.5, 2.6, -1.2]} rotation={[0, -Math.PI / 2, 0]} width={3.2} color="#ff3d81" flickerSpeed={0.95} intensity={18} distance={16} />
      <NeonStrip position={[-4.2, 0.35, 2.2]} rotation={[0, Math.PI / 2, 0]} width={2.2} color="#a855f7" flickerSpeed={1.9} intensity={10} distance={12} />
      <NeonStrip position={[4.2, 0.35, 2.2]} rotation={[0, -Math.PI / 2, 0]} width={2.2} color="#eab308" flickerSpeed={1.45} intensity={10} distance={12} />

      {/* Sodium street lamp overhead — the warm note the neon plays against */}
      <NeonStrip position={[0, 5.4, -1.5]} width={1.2} color="#ffa63d" flickerSpeed={0.55} intensity={22} distance={18} />

      {/* ── Chiaroscuro lighting: low ambient night, intense contrasting spots ──
          Ambient was 0.04, which is essentially black: with the practicals out
          of range, anything they did not hit rendered as a silhouette. It stays
          a night sky, just not a void — the practicals above do the colouring,
          this only keeps unlit surfaces readable. */}
      <ambientLight intensity={0.16} color="#241436" />
      {/* Sky-to-ground bounce: cold from above, warm sodium spill from the road */}
      <hemisphereLight args={['#2a1c4a', '#3a2410', 0.55]} />

      {/* Key spot — ultraviolet from above-front, hits floor and fighters.
          NOTE on aiming: a SpotLight points at its `target`, and three.js only
          uses that target's matrixWorld if the target is in the scene. R3F's
          `target-position` mutates the default target, which is NOT parented,
          so its matrixWorld stays identity and every spot here aims at the
          ORIGIN whatever its target-position says. That is what the fight plane
          wants, so the positions below are chosen to give the intended angle
          while aiming at origin - do not trust the target-position values. */}
      <spotLight
        position={[0, 9, 3]}
        intensity={26}
        color="#6d28d9"
        angle={0.35}
        penumbra={0.5}
        distance={18}
        decay={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Fill spot — deep purple from left, hits background wall */}
      <spotLight
        position={[-8, 7, 1]}
        intensity={18}
        color="#7c3aed"
        angle={0.45}
        penumbra={0.7}
        distance={20}
        decay={1.5}
      />
      {/* Counter spot — neon yellow from right, hits floor */}
      <spotLight
        position={[8, 6, 2]}
        intensity={20}
        color="#ca8a04"
        angle={0.4}
        penumbra={0.6}
        distance={16}
        decay={1.5}
      />
      {/* Rim light — cold blue from behind fighters */}
      <spotLight
        position={[0, 5, -7]}
        intensity={14}
        color="#1e40af"
        angle={0.5}
        penumbra={0.8}
        distance={14}
        decay={2}
      />
      {/* Faction floor glows */}
      <pointLight position={[P1_X, 0.4, 0]} intensity={6} color={p1Color} distance={7} decay={2} />
      <pointLight position={[P2_X, 0.4, 0]} intensity={6} color={p2Color} distance={7} decay={2} />
    </group>
  );
}
