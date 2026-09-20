/**
 * POSE SHEET — render the real pipeline's clips on a real model and LOOK.
 *
 * OWNER LAW: SEE IT. Every number in this investigation (hand position, arm
 * elevation, facing) can be satisfied by a pose that still reads as wrong to
 * an eye. This page runs the SHIPPING pipeline, plays named clips on a named
 * model, and draws one labelled tile per pose from a fixed camera, so a
 * regression is visible rather than argued about.
 *
 * Driven by scripts/render-pose-sheet.mjs. Query params:
 *   ?model=BANNON_rigged.glb&clips=idle,block,GRAFQUICKJAB&t=0,0.2
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import { runCharacterPipeline } from '../../src/engine/pipeline/CharacterPipeline';
import { JOINT_LIMITS } from '../../src/engine/retarget/SkeletalLimits';

const params = new URLSearchParams(location.search);
const MODEL = params.get('model') ?? 'BANNON_rigged.glb';
const CLIPS = (params.get('clips') ?? 'idle,block,attack_1').split(',').filter(Boolean);
const TIMES = (params.get('t') ?? '0,0.25').split(',').map(Number);
const TILE = Number(params.get('tile') ?? 240);
/** Camera angle in degrees around the fighter. 0 looks down -X at his front. */
const VIEWS = (params.get('views') ?? '0,90').split(',').map(Number);
/** 'upper' frames the torso and arms close, for judging a limb rather than a silhouette. */
const FOCUS = params.get('focus') ?? 'full';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(TILE, TILE);
renderer.setClearColor(0x12151b, 1);

const scene3 = new THREE.Scene();
scene3.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(3, 5, 4);
scene3.add(key);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

function grid(): HTMLTableElement {
  const table = document.createElement('table');
  table.style.borderCollapse = 'collapse';
  app.appendChild(table);
  return table;
}

async function main() {
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(`/models/${MODEL}`);
  const result = await runCharacterPipeline(gltf.scene, gltf.animations, `/models/${MODEL}`, true);
  const { scene, mixer, actions } = result as {
    scene: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    actions: Map<string, THREE.AnimationAction> | Record<string, THREE.AnimationAction>;
  };
  const actionFor = (n: string): THREE.AnimationAction | undefined =>
    actions instanceof Map ? actions.get(n) : (actions as Record<string, THREE.AnimationAction>)[n];
  scene3.add(scene);

  const box = new THREE.Box3().setFromObject(scene);
  const centre = box.getCenter(new THREE.Vector3());
  const height = Math.max(box.max.y - box.min.y, 1);

  const table = grid();
  const head = table.insertRow();
  head.insertCell().textContent = '';
  for (const view of VIEWS) for (const t of TIMES) {
    const c = head.insertCell();
    c.textContent = `${view}° t=${t}`;
    c.style.color = '#8fb3ff';
  }

  for (const name of CLIPS) {
    const row = table.insertRow();
    const label = row.insertCell();
    label.textContent = name;
    label.style.color = '#ffd58f';
    const action = actionFor(name);
    for (const view of VIEWS) {
      for (const t of TIMES) {
        const cell = row.insertCell();
        mixer.stopAllAction();
        if (action) { action.reset().play(); mixer.setTime(t); }
        else mixer.setTime(0);
        scene.updateMatrixWorld(true);

        const rad = (view * Math.PI) / 180;
        const close = FOCUS === 'upper';
        const aim = close
          ? new THREE.Vector3(centre.x, box.min.y + height * 0.78, centre.z)
          : centre;
        const dist = height * (close ? 1.25 : 2.6);
        // View 0 stands in front of a fighter whose bind forward is +X.
        camera.position.set(
          aim.x + Math.cos(rad) * dist,
          aim.y + height * (close ? 0.05 : 0.12),
          aim.z + Math.sin(rad) * dist,
        );
        camera.lookAt(aim);
        camera.updateProjectionMatrix();
        renderer.render(scene3, camera);

        const img = new Image();
        img.src = renderer.domElement.toDataURL('image/png');
        img.width = TILE; img.height = TILE;
        cell.appendChild(img);
        if (!action) cell.style.outline = '2px solid #c0392b';
      }
    }
  }
  // Published so scripts/audit-joint-rotation.mjs can measure the SHIPPING
  // pipeline's output rather than re-deriving it and drifting from it.
  (window as unknown as { __POSESHEET: unknown }).__POSESHEET = {
    THREE, scene, mixer, actionFor, limits: JOINT_LIMITS,
    /** Every action name the pipeline registered, for whole-set audits. */
    clipNames: () =>
      actions instanceof Map ? [...actions.keys()] : Object.keys(actions as object),
  };
  (window as unknown as { __POSESHEET_READY: boolean }).__POSESHEET_READY = true;
}

main().catch((e) => {
  app.textContent = 'POSE SHEET FAILED: ' + (e instanceof Error ? e.stack : String(e));
  (window as unknown as { __POSESHEET_READY: boolean }).__POSESHEET_READY = true;
});
