import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { runCharacterPipeline } from '../engine/pipeline/CharacterPipeline';
import { loadGLTF } from '../engine/pipeline/glbCache';
import { assetUrl } from '../lib/assetBase';
import {
  canonicalSlot,
  exportMoveLabels,
  loadMoveLabels,
  setMoveLabel,
  type MoveLabelMap,
} from '../engine/assets/moveLabels';
import { BANNON_GLB_PLAYABLE_MODELS } from '../data/bannonGlbRoster';
import { resolveGlbUrl } from '../data/bannonGlbUrl';

/**
 * THE MOVE LIBRARY — every clip in the game, playable, and labellable.
 *
 * Owner: "we got to figure out how to get our animations and all our moves
 * organized ... all the ones you don't know where to put them, you can put
 * them in a folder or in a place in the move library ... so I can look at
 * them and tell you what they are, where they should go."
 *
 * This project keeps hitting "I cannot tell what this move is", and the
 * honest answer is that a human has to look. So: all 366 baked clips, one at
 * a time, on a real fighter, with somewhere to write down what it is. The
 * list EXPORTS as plain text, because the point is that it comes back and
 * becomes real slot assignments.
 *
 * It reads the BAKED manifest, not the source banks: the baked set is what
 * the game actually plays, so it is what he should be judging.
 */
interface ManifestEntry {
  file: string;
  bank: string;
  dur: number;
  bones: number;
  semantic?: string;
  owns?: boolean;
  airborne?: boolean;
}

type Filter = 'all' | 'unlabelled' | 'unassigned' | 'airborne' | 'labelled';

function ClipPlayer({
  modelUrl,
  clip,
  speed,
  onClips,
}: {
  modelUrl: string;
  clip: string | null;
  speed: number;
  onClips: (names: string[]) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [rig, setRig] = useState<{
    scene: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    actions: Record<string, THREE.AnimationAction>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: { mixer: THREE.AnimationMixer } | null = null;
    void (async () => {
      // The shared cache, not a fresh GLTFLoader: every shipped model uses
      // EXT_meshopt_compression, and a loader without the decoder throws
      // "setMeshoptDecoder must be called before loading compressed files"
      // and renders nothing. Measured by driving this screen — the list came
      // up, the canvas came up, and the fighter never did.
      const gltf = await loadGLTF(assetUrl(modelUrl));
      if (cancelled) return;
      const result = await runCharacterPipeline(gltf.scene, gltf.animations, modelUrl, false);
      if (cancelled || !result) return;
      loaded = { mixer: result.mixer };
      setRig({ scene: result.scene, mixer: result.mixer, actions: result.actions });
      onClips(Object.keys(result.actions).sort());
    })();
    return () => {
      cancelled = true;
      loaded?.mixer.stopAllAction();
    };
  }, [modelUrl, onClips]);

  useEffect(() => {
    if (!rig || !clip) return;
    const action = rig.actions[clip];
    rig.mixer.stopAllAction();
    if (!action) return;
    action.reset();
    action.timeScale = speed;
    action.play();
  }, [rig, clip, speed]);

  useEffect(() => {
    if (!rig) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      rig.mixer.update((now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rig]);

  // FRAME THE WHOLE FIGHTER. A fixed offset put the camera at chest height on
  // a 1.85 m model and cut the head off — and judging a move by its torso is
  // the whole thing this screen exists to stop. Measure the model and sit it
  // on the floor with its middle at the origin.
  useEffect(() => {
    if (!rig || !group.current) return;
    if (rig.scene.parent !== group.current) group.current.add(rig.scene);
    const box = new THREE.Box3().setFromObject(rig.scene);
    const centre = box.getCenter(new THREE.Vector3());
    group.current.position.set(-centre.x, -centre.y, -centre.z);
  }, [rig]);

  return <group ref={group} />;
}

export default function MoveLibrary({ onBack }: { onBack: () => void }) {
  const [manifest, setManifest] = useState<Record<string, ManifestEntry>>({});
  const [labels, setLabels] = useState<MoveLabelMap>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [speed, setSpeed] = useState(1);
  const [available, setAvailable] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ name: string; slot: string; note: string }>({ name: '', slot: '', note: '' });
  const [copied, setCopied] = useState(false);

  const models = useMemo(() => [...new Set(BANNON_GLB_PLAYABLE_MODELS.map((m) => m.model))], []);
  const [model, setModel] = useState(() => models.find((m) => m.startsWith('BANNON_rigged')) ?? models[0]);

  useEffect(() => { setLabels(loadMoveLabels()); }, []);

  // THE LIST CAME UP EMPTY AND SAID "Nothing matches."
  //
  // One fetch, no retry, and every failure collapsed to `{}` — which the
  // list renders as "0 shown · 0 baked" and a filter with no results. That
  // is indistinguishable from a working screen with nothing in it, and it
  // is what the owner was looking at when he asked for a live preview that
  // already existed. Measured in the harness: the title screen's asset warm
  // aborted the same URL and this screen inherited the failure.
  //
  // Retries with a short backoff, and SAYS SO when it cannot load, because
  // "the manifest did not arrive" and "there are no clips" are different
  // problems and the screen has to tell them apart.
  const [manifestError, setManifestError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let tries = 0;
    const pull = () => {
      void fetch(assetUrl('/motion/baked/index.json'), { cache: 'no-cache' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<Record<string, ManifestEntry>>;
        })
        .then((m) => {
          if (!live) return;
          if (!m || Object.keys(m).length === 0) throw new Error('empty index');
          setManifest(m);
          setManifestError(null);
        })
        .catch((e: unknown) => {
          if (!live) return;
          tries += 1;
          setManifestError(e instanceof Error ? e.message : String(e));
          if (tries < 5) setTimeout(pull, 400 * tries);
        });
    };
    pull();
    return () => { live = false; };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    return Object.entries(manifest)
      .filter(([name, m]) => {
        if (q && !name.toUpperCase().includes(q)) return false;
        switch (filter) {
          case 'unlabelled': return !labels[name];
          case 'labelled': return Boolean(labels[name]);
          // "Unassigned" is the real queue: the bake gave it a semantic by
          // guessing from its NAME, and nothing chose it for a slot.
          case 'unassigned': return !m.owns;
          case 'airborne': return Boolean(m.airborne);
          default: return true;
        }
      })
      .sort(([a], [b]) => a.localeCompare(b));
  }, [manifest, filter, query, labels]);

  useEffect(() => {
    if (!selected && rows.length) setSelected(rows[0][0]);
  }, [rows, selected]);

  useEffect(() => {
    const l = selected ? labels[selected] : undefined;
    setDraft({ name: l?.name ?? '', slot: l?.slot ?? '', note: l?.note ?? '' });
  }, [selected, labels]);

  const save = (verdict?: 'good' | 'broken' | 'unsure') => {
    if (!selected) return;
    setLabels(setMoveLabel(selected, { ...draft, verdict }));
  };

  const copyAll = async () => {
    const text = exportMoveLabels(labels);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be refused; showing the text is the fallback that
      // always works, and it is what gets pasted back to the repo anyway.
      window.prompt('Copy your labels:', text);
    }
  };

  const entry = selected ? manifest[selected] : undefined;
  const missing = Boolean(selected && available.length > 0 && !available.includes(selected));
  const labelledCount = Object.keys(labels).length;

  return (
    <div className="fixed inset-0 bg-[#0d1016] text-white font-mono flex flex-col p-safe">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-white/10">
        <button onClick={onBack} className="text-[10px] tracking-[0.3em] text-zinc-400 px-2 py-1 border border-white/15">
          BACK
        </button>
        <span className="text-xs font-black tracking-[0.25em]">MOVE LIBRARY</span>
        <span className="text-[10px] text-zinc-500">
          {rows.length} shown · {Object.keys(manifest).length} baked · {labelledCount} labelled
        </span>
        <button onClick={copyAll} className="ml-auto text-[10px] tracking-[0.2em] px-2 py-1 border border-emerald-500/50 text-emerald-300">
          {copied ? 'COPIED' : 'EXPORT LABELS'}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="md:w-64 border-b md:border-b-0 md:border-r border-white/10 flex flex-col min-h-0">
          <div className="p-2 flex flex-wrap gap-1">
            {(['all', 'unlabelled', 'unassigned', 'airborne', 'labelled'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[9px] tracking-[0.15em] px-2 py-1 border ${
                  filter === f ? 'border-yellow-400 text-yellow-300' : 'border-white/15 text-zinc-400'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search"
            className="mx-2 mb-2 bg-black/40 border border-white/15 px-2 py-1 text-[11px]"
          />
          <div className="flex-1 overflow-y-auto">
            {rows.map(([name, m]) => {
              const l = labels[name];
              return (
                <button
                  key={name}
                  onClick={() => setSelected(name)}
                  className={`w-full text-left px-2 py-1 text-[10px] border-l-2 ${
                    selected === name ? 'bg-white/10 border-yellow-400' : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className={l?.verdict === 'broken' ? 'text-red-300' : l ? 'text-emerald-300' : 'text-zinc-200'}>
                    {name}
                  </span>
                  <span className="block text-[8px] text-zinc-500">
                    {m.dur.toFixed(2)}s · {m.bank}{m.owns ? ` · ${m.semantic}` : ''}{m.airborne ? ' · air' : ''}
                    {l?.name ? ` · "${l.name}"` : ''}
                  </span>
                </button>
              );
            })}
            {rows.length === 0 && (
              <div className="p-3 text-[10px] text-zinc-500">
                {manifestError
                  ? `The baked clip list did not load (${manifestError}). Retrying…`
                  : Object.keys(manifest).length === 0
                    ? 'Loading the baked clip list…'
                    : 'Nothing matches this filter.'}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 relative">
            <Canvas camera={{ position: [0, 0.15, 4.6], fov: 32 }} dpr={[1, 1.5]}>
              <hemisphereLight intensity={2.2} groundColor={0x334455} />
              <directionalLight position={[3, 5, 4]} intensity={2} />
              <Suspense fallback={null}>
                <ClipPlayer modelUrl={resolveGlbUrl(model)} clip={selected} speed={speed} onClips={setAvailable} />
              </Suspense>
              <OrbitControls target={[0, 0, 0]} enablePan={false} />
            </Canvas>
            {missing && (
              <div className="absolute inset-x-0 top-2 text-center text-[10px] text-red-300">
                this clip does not resolve on {model}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-2 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-yellow-300 font-bold">{selected ?? '—'}</span>
              {entry && (
                <span className="text-[9px] text-zinc-500">
                  {entry.dur.toFixed(2)}s · {entry.bones} bones · {entry.bank}
                  {entry.owns ? ` · owns ${entry.semantic}` : ` · guessed ${entry.semantic}`}
                </span>
              )}
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="ml-auto bg-black/40 border border-white/15 text-[10px] px-1 py-0.5"
              >
                {models.map((m) => <option key={m} value={m}>{m.replace(/\.glb$/, '')}</option>)}
              </select>
              {[0.25, 0.5, 1].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`text-[9px] px-2 py-0.5 border ${speed === s ? 'border-yellow-400 text-yellow-300' : 'border-white/15 text-zinc-400'}`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="what is it? (spinning kick, taunt, junk)"
                className="flex-1 min-w-[140px] bg-black/40 border border-white/15 px-2 py-1 text-[11px]"
              />
              <input
                value={draft.slot}
                onChange={(e) => setDraft({ ...draft, slot: e.target.value })}
                placeholder="where does it go?"
                className="w-40 bg-black/40 border border-white/15 px-2 py-1 text-[11px]"
              />
            </div>
            {/*
              SAY WHETHER THE SLOT LANDED.
              A free-text box on a phone that silently ignores four spellings
              out of five is worse than no box: he would label a hundred
              clips and none of them would reach the game. This is the
              engine's own answer, not a second vocabulary.
            */}
            {draft.slot.trim() !== '' && (
              <div className="text-[10px]">
                {canonicalSlot(draft.slot)
                  ? <span className="text-emerald-400">
                      → goes to <b>{canonicalSlot(draft.slot)}</b> in the game
                    </span>
                  : <span className="text-amber-400">
                      → not a slot the engine knows yet — saved as a note, and
                      it will not change the game until it is wired
                    </span>}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <input
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="note"
                className="flex-1 min-w-[140px] bg-black/40 border border-white/15 px-2 py-1 text-[11px]"
              />
              <button onClick={() => save('good')} className="text-[10px] px-3 py-1 border border-emerald-500/60 text-emerald-300">GOOD</button>
              <button onClick={() => save('broken')} className="text-[10px] px-3 py-1 border border-red-500/60 text-red-300">BROKEN</button>
              <button onClick={() => save('unsure')} className="text-[10px] px-3 py-1 border border-white/25 text-zinc-300">UNSURE</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
