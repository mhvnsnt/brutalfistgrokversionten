// `.ts` extensions on purpose — the repo's test runner resolves them literally.
import * as THREE from 'three';
import type { BlockoutPrim, StageBlockout } from './StageBlockouts.ts';

/**
 * Turn a canon-stage BLOCKOUT description into a THREE.Group. The game renders
 * this exact group (ProceduralStage -> <primitive>), and the tests build it in
 * Node, so "the stage builds" is checked on the same code path players see.
 *
 * Materials are cached per colour/emissive/opacity so a 300-prim stage does
 * not allocate 300 materials. Call `disposeBlockoutObject3D` on unmount.
 */
export function blockoutToObject3D(spec: StageBlockout): THREE.Group {
  const group = new THREE.Group();
  group.name = `blockout:${spec.id}`;
  group.userData.status = spec.status;
  const mats = new Map<string, THREE.Material>();
  const mat = (p: BlockoutPrim): THREE.Material => {
    const e = 'e' in p && p.e ? p.e : '#000000';
    const ei = 'ei' in p && p.ei ? p.ei : 0;
    const op = 'opacity' in p && p.opacity !== undefined ? p.opacity : 1;
    const key = `${p.c}|${e}|${ei}|${op}`;
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: p.c, emissive: e, emissiveIntensity: ei, roughness: 0.85, metalness: 0.1,
        transparent: op < 1, opacity: op, depthWrite: op >= 1,
      });
      mats.set(key, m);
    }
    return m;
  };

  if (spec.ground.w > 0 && spec.ground.d > 0) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(spec.ground.w, spec.ground.d), new THREE.MeshStandardMaterial({ color: spec.ground.c, roughness: 0.95 }));
    g.rotation.x = -Math.PI / 2;
    // just under the combat floor slab so the slab top (y = 0) always wins
    g.position.y = spec.floor.y - 0.25;
    g.name = 'ground';
    g.receiveShadow = true;
    group.add(g);
  }

  for (const p of spec.prims) {
    let geo: THREE.BufferGeometry;
    switch (p.kind) {
      case 'box': geo = new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]); break;
      case 'cyl': geo = new THREE.CylinderGeometry(p.args[0], p.args[1], p.args[2], p.args[3]); break;
      case 'sphere': geo = new THREE.SphereGeometry(p.r, 12, 10); break;
      case 'plane': geo = new THREE.PlaneGeometry(p.size[0], p.size[1]); break;
    }
    const mesh = new THREE.Mesh(geo, mat(p));
    mesh.position.set(p.p[0], p.p[1], p.p[2]);
    if (p.kind === 'plane') mesh.rotation.x = -Math.PI / 2;
    else if ((p.kind === 'box' || p.kind === 'cyl') && p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
    if (p.kind === 'sphere' && p.scale) mesh.scale.set(p.scale[0], p.scale[1], p.scale[2]);
    mesh.userData.role = p.role;
    group.add(mesh);
  }

  for (const l of spec.lights) {
    const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
    pl.position.set(l.p[0], l.p[1], l.p[2]);
    group.add(pl);
  }
  return group;
}

export function disposeBlockoutObject3D(group: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      const mm = m.material as THREE.Material;
      if (!seen.has(mm)) { seen.add(mm); mm.dispose(); }
    }
  });
}
