import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { runCharacterPipeline } from '../engine/pipeline/CharacterPipeline';
import { loadGLTF } from '../engine/pipeline/glbCache';
import { assetUrl } from '../lib/assetBase';
import { markGrapplePairs, receiverClipFor } from '../engine/combat/GrapplePairing';
import type { BakedManifestEntry } from '../engine/retarget/BakedMotionBank';
import {
  MOVE_KINDS,
  canonicalSlot,
  exportMoveLabels,
  kindsOf,
  loadMoveLabels,
  setMoveLabel,
  taggingProgress,
  toggleMoveKind,
  type MoveKind,
  type MoveLabelMap,
} from '../engine/assets/moveLabels';
import { BANNON_ROSTER } from '../data/bannonRoster';
import { moveSetForFighter, schwarzerblitzSpecials } from '../engine/combat/SchwarzerblitzSpecials';
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
  /** The opponent's half, paired at bake time. */
  pairedWith?: string[];
  /** This clip IS somebody being thrown. */
  receives?: boolean;
}

type Filter = 'all' | 'untagged' | 'unlabelled' | 'unassigned' | 'airborne' | 'labelled';

function ClipPlayer({
  modelUrl,
  clip,
  speed,
  onClips,
  onProgress,
}: {
  modelUrl: string;
  clip: string | null;
  speed: number;
  onClips: (names: string[]) => void;
  /** 0..1 through the clip, so the list can show it is really running. */
  onProgress?: (p: { t: number; dur: number }) => void;
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
    // LOOP IT, START TO FINISH, EXPLICITLY.
    //
    // Owner: "when I am hovering over a move, like WWE games, it shows the
    // animation from start to finish and keeps replaying it, so I can know
    // what move I'm looking at while I'm doing the checkbox list."
    //
    // Named rather than left to the default: a clip that arrives with
    // LoopOnce baked in stops on its last frame and reads as a frozen
    // statue, which is indistinguishable from the broken clips he is here
    // to find. This screen must never make a good clip look dead.
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
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
      if (onProgress && clip) {
        const a = rig.actions[clip];
        if (a) onProgress({ t: a.time, dur: a.getClip().duration });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rig, clip, onProgress]);

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
  /**
   * WWE / TEKKEN FLOW: pick the fighter first, then his move list.
   *
   * Owner: "I kind of want it like WWE or Tekken where you go to the move
   * library or moveset creator, then you have to select the character off
   * the character selection list, then it takes you to the move list."
   *
   * `null` is the character-select step; a fighter id is his move list.
   */
  const [fighter, setFighter] = useState<string | null>(null);
  const [tab, setTab] = useState<'moves' | 'pool'>('moves');
  /**
   * HOVER PLAYS IT. Owner: "when I am hovering over a move, like WWE games,
   * it shows the animation from start to finish and keeps replaying it,
   * while I'm hovering over each move and animation so I can know what move
   * I'm looking at while I'm doing the checkbox list."
   *
   * On a phone there IS no hover, and this screen is used on a phone — so
   * the finger is treated as the pointer: `onPointerEnter` fires for a
   * mouse, and a drag down the list fires it for touch too. Tapping still
   * SELECTS, which is what the checkboxes edit; hovering only previews, so
   * scrubbing the list never loses the clip being tagged.
   */
  const [hovered, setHovered] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState<{ t: number; dur: number }>({ t: 0, dur: 0 });
  /** What the viewport is showing: the hovered clip if any, else the selected one. */
  const previewing = hovered ?? selected;

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
          // The pairing lives in this same index, and this screen can be
          // opened from the menu without a match ever having loaded the
          // bank — so it seeds the pairing itself rather than showing
          // "nothing close enough" for every throw in the game.
          markGrapplePairs(m as Record<string, BakedManifestEntry>);
          setManifestError(null);
        })
        .catch((e: unknown) => {
          if (!live) return;
          tries += 1;
          setManifestError(e instanceof Error ? e.message : String(e));
          // KEEP TRYING WHILE THE SCREEN IS OPEN.
          //
          // Five tries with a 400 ms step is four seconds, which sounds
          // generous and is not: opening this screen while the server is
          // still waking, or on a phone that has just come back on signal,
          // burns all five before anything can succeed and then the list
          // is permanently empty with a stale error under it. MEASURED —
          // it happened on the first drive of this screen after a dev
          // restart. The backoff climbs to 5 s and then holds.
          setTimeout(pull, Math.min(5000, 400 * tries));
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
          // The pool sweep's queue: what he has not tapped a kind on yet.
          case 'untagged': return (labels[name]?.kinds?.length ?? 0) === 0;
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

  /**
   * Every clip in the bank that IS somebody being thrown — the only honest
   * shortlist for "what does the other man do?". Sorted by length, because
   * the victim's half has to last about as long as the throw.
   */
  const victimClips = useMemo(
    () => Object.entries(manifest).filter(([, m]) => m.receives)
      .sort((a, b) => (b[1].dur ?? 0) - (a[1].dur ?? 0)).map(([n]) => n),
    [manifest],
  );
  /** What the game would play right now with nothing chosen by hand. */
  const pairedAuto = selected ? (receiverClipFor(selected, { labels })?.receiver ?? null) : null;
  const pairedShown = selected ? (labels[selected]?.pairedWith ?? pairedAuto) : null;
  /**
   * Is this worth asking about? A clip he tagged grapple or throw, or one
   * the bake already paired. Never every clip — 366 dropdowns is not a tool.
   */
  const isGrappleish = (c: string) => {
    const k = kindsOf(c, labels);
    return k.includes('grapple') || k.includes('throw');
  };
  const missing = Boolean(selected && available.length > 0 && !available.includes(selected));
  const labelledCount = Object.keys(labels).length;

  const pool = useMemo(() => Object.keys(manifest), [manifest]);
  const progress = useMemo(() => taggingProgress(pool, labels), [pool, labels]);

  /** The commands this fighter actually owns, for the move list. */
  const fighterCommands = useMemo(() => {
    if (!fighter) return [];
    return schwarzerblitzSpecials(moveSetForFighter(fighter)).map((sp) => ({
      id: sp.id,
      name: sp.name,
      /** `6+P`, `2,1,4+P` — written the way a command list is written. */
      input: (sp.command ?? [])
        .map((step) => [...step.dirs, ...step.buttons].join('+'))
        .join(' , '),
      stance: sp.stance ?? 'Ground',
    }));
  }, [fighter]);

  // ── STEP ONE: PICK THE FIGHTER ───────────────────────────────────────────
  // Owner: "you go to the move library or moveset creator, then you have to
  // select the character off the character selection list, then it takes you
  // to the move list." A flat list of 366 clips with no character attached
  // is a debugging tool, not a moveset creator.
  if (!fighter) {
    return (
      <div className="fixed inset-0 bg-[#0d1016] text-white font-mono flex flex-col p-safe">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/10">
          <button onClick={onBack} className="text-[10px] tracking-[0.3em] text-zinc-400 px-2 py-1 border border-white/15">
            BACK
          </button>
          <span className="text-xs font-black tracking-[0.25em]">MOVESET CREATOR</span>
          <span className="text-[10px] text-zinc-500">pick a fighter</span>
          <span className="ml-auto text-[10px] text-zinc-500">
            {progress.tagged}/{progress.total} clips tagged
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {BANNON_ROSTER.map((f) => (
              <button
                key={f.id}
                onClick={() => setFighter(f.id)}
                className="text-left px-3 py-2 border border-white/15 hover:border-yellow-400/70 hover:bg-white/5"
              >
                <span className="block text-[11px] font-bold tracking-[0.12em] text-zinc-100">
                  {f.name.toUpperCase()}
                </span>
                <span className="block text-[9px] text-zinc-500">{f.role}</span>
              </button>
            ))}
          </div>
          {/*
            THE ANIMATION POOL IS REACHABLE WITHOUT A FIGHTER, because
            tagging what a clip IS has nothing to do with who performs it —
            and it is the work that unblocks everything else.
          */}
          <button
            onClick={() => { setFighter(BANNON_ROSTER[0]?.id ?? 'bannon'); setTab('pool'); }}
            className="mt-4 w-full px-3 py-2 border border-emerald-500/50 text-emerald-300 text-[10px] tracking-[0.2em]"
          >
            ANIMATION POOL — TAG WHAT EACH CLIP IS ({progress.total - progress.tagged} LEFT)
          </button>
        </div>
      </div>
    );
  }

  const fighterName = BANNON_ROSTER.find((f) => f.id === fighter)?.name ?? fighter;

  return (
    <div className="fixed inset-0 bg-[#0d1016] text-white font-mono flex flex-col p-safe">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-white/10">
        <button onClick={() => setFighter(null)} className="text-[10px] tracking-[0.3em] text-zinc-400 px-2 py-1 border border-white/15">
          BACK
        </button>
        <span className="text-xs font-black tracking-[0.25em] text-yellow-300">{fighterName.toUpperCase()}</span>
        {(['moves', 'pool'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[9px] tracking-[0.2em] px-2 py-1 border ${
              tab === t ? 'border-yellow-400 text-yellow-300' : 'border-white/15 text-zinc-400'
            }`}
          >
            {t === 'moves' ? 'MOVE LIST' : 'ANIMATION POOL'}
          </button>
        ))}
        <span className="text-[10px] text-zinc-500">
          {tab === 'pool'
            ? `${progress.tagged}/${progress.total} tagged`
            : `${fighterCommands.length} commands · ${labelledCount} labelled`}
        </span>
        <button onClick={copyAll} className="ml-auto text-[10px] tracking-[0.2em] px-2 py-1 border border-emerald-500/50 text-emerald-300">
          {copied ? 'COPIED' : 'EXPORT LABELS'}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="md:w-64 border-b md:border-b-0 md:border-r border-white/10 flex flex-col min-h-0">
          {/*
            HIS MOVE LIST, with the input written the way a command list is
            written. This is what "then it takes you to the move list" means
            — and it is also the honest picture: every fighter is currently
            drawing from one of two imported sets, which is exactly the
            "all the fighters do the same moves" he reported. Showing it per
            fighter is what makes that visible instead of arguable.
          */}
          {tab === 'moves' && (
            <div className="border-b border-white/10 max-h-56 overflow-y-auto">
              {fighterCommands.map((c) => (
                <div key={c.id} className="px-2 py-1 text-[10px] flex gap-2">
                  <span className="text-yellow-300 w-20 shrink-0">{c.input || '—'}</span>
                  <span className="text-zinc-300 flex-1 truncate">{c.name}</span>
                  {c.stance !== 'Ground' && <span className="text-[8px] text-zinc-500">{c.stance}</span>}
                </div>
              ))}
              {fighterCommands.length === 0 && (
                <div className="p-2 text-[10px] text-zinc-500">No commands for this fighter yet.</div>
              )}
            </div>
          )}
          <div className="p-2 flex flex-wrap gap-1">
            {(['all', 'untagged', 'unlabelled', 'unassigned', 'airborne', 'labelled'] as Filter[]).map((f) => (
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
                  onClick={() => { setSelected(name); setHovered(null); }}
                  onPointerEnter={() => setHovered(name)}
                  onPointerLeave={() => setHovered((h) => (h === name ? null : h))}
                  className={`w-full text-left px-2 py-1 text-[10px] border-l-2 ${
                    selected === name
                      ? 'bg-white/10 border-yellow-400'
                      : hovered === name
                        ? 'bg-white/5 border-sky-400'
                        : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className={l?.verdict === 'broken' ? 'text-red-300' : l ? 'text-emerald-300' : 'text-zinc-200'}>
                    {name}
                  </span>
                  <span className="block text-[8px] text-zinc-500">
                    {m.dur.toFixed(2)}s · {m.bank}{m.owns ? ` · ${m.semantic}` : ''}{m.airborne ? ' · air' : ''}
                    {l?.name ? ` · "${l.name}"` : ''}
                  </span>
                  {(l?.kinds?.length ?? 0) > 0 && (
                    <span className="block text-[8px] text-emerald-400/80">{l!.kinds!.join(' · ')}</span>
                  )}
                </button>
              );
            })}
            {rows.length === 0 && (
              <div className="p-3 text-[10px] text-zinc-500">
                {manifestError
                  ? `The baked clip list did not load (${manifestError}). Still trying…`
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
                <ClipPlayer
                  modelUrl={resolveGlbUrl(model)}
                  clip={previewing}
                  speed={speed}
                  onClips={setAvailable}
                  onProgress={setPlayhead}
                />
              </Suspense>
              <OrbitControls target={[0, 0, 0]} enablePan={false} />
            </Canvas>
            {missing && (
              <div className="absolute inset-x-0 top-2 text-center text-[10px] text-red-300">
                this clip does not resolve on {model}
              </div>
            )}
            {/*
              SAY WHAT IS PLAYING AND PROVE IT IS PLAYING.
              A looping clip and a frozen one look identical in a still
              frame, and telling those apart is the whole job on this
              screen. The bar is the playhead; if it does not sweep, the
              clip is not animating and that is a finding, not a glitch.
            */}
            <div className="absolute inset-x-0 top-1 px-2 flex items-center gap-2">
              <span className={`text-[10px] ${hovered ? 'text-sky-300' : 'text-yellow-300'}`}>
                {previewing ?? '—'}
              </span>
              {hovered && hovered !== selected && (
                <span className="text-[9px] text-zinc-500">preview · tap to tag</span>
              )}
              <span className="ml-auto text-[9px] text-zinc-500">
                {playhead.dur > 0 ? `${playhead.t.toFixed(2)} / ${playhead.dur.toFixed(2)}s` : ''}
              </span>
            </div>
            {playhead.dur > 0 && (
              <div className="absolute inset-x-2 top-5 h-[2px] bg-white/10">
                <div
                  className={hovered ? 'h-full bg-sky-400' : 'h-full bg-yellow-400'}
                  style={{ width: `${Math.min(100, (playhead.t / playhead.dur) * 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-2 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-yellow-300 font-bold">
                {selected ?? '—'}
                {hovered && hovered !== selected && (
                  <span className="ml-1 font-normal text-zinc-500">(tagging this one)</span>
                )}
              </span>
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

            {/*
              THE ANIMATION POOL CHECKBOXES.

              Owner: "put a little check box next to it and I'll literally
              be able to just tap the checkbox of what kind of animation it
              is, and that'll help the whole pipeline."

              One tap, no typing, no dropdown. It writes straight through to
              the label store, and `attack` / `reaction` are read by combat
              immediately — a clip tagged reaction stops being eligible for
              an attack slot the moment he taps it. That is the ground truth
              no measurement in this repo could produce: a body being thrown
              extends a limb forward exactly like a body punching.
            */}
            <div className="flex gap-1 flex-wrap">
              {MOVE_KINDS.map((k) => {
                const on = selected ? kindsOf(selected, labels).includes(k) : false;
                return (
                  <button
                    key={k}
                    disabled={!selected}
                    onClick={() => selected && setLabels(toggleMoveKind(selected, k as MoveKind))}
                    className={`text-[9px] tracking-[0.1em] px-2 py-1 border disabled:opacity-40 ${
                      on ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200' : 'border-white/15 text-zinc-400'
                    }`}
                  >
                    {on ? '\u2713 ' : ''}{k.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/*
              THE OPPONENT SIDE.

              Owner, twice: "neck breaker ... would have two animation parts,
              one for the deliverer and the receiver", then "Scoop slam is a
              grapple too that needs the opponent side, and same for all
              grapples."

              The bake pairs the thirteen it can pair by name and confirms
              them on duration. It cannot pair NECKBREAKER, SUPLEX,
              GERMANSUPLEX, CHOKESLAM or TOMBSTONE with anything, because
              those halves were never recorded. This is where he says which
              recording to use — with SEE IT next to it, because he is
              already watching clips loop on this screen and picking a throw
              victim blind from a list of names is exactly the guess the
              owner law forbids.
            */}
            {selected && (isGrappleish(selected) || Boolean(manifest[selected]?.pairedWith)) && (
              <div className="border border-white/10 bg-black/30 p-2 space-y-1">
                <div className="text-[9px] tracking-[0.2em] text-zinc-500">OPPONENT HALF</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={labels[selected]?.pairedWith ?? ''}
                    onChange={(e) => setLabels(setMoveLabel(selected, {
                      ...labels[selected], pairedWith: e.target.value || undefined,
                    }))}
                    className="flex-1 min-w-[150px] bg-black/40 border border-white/15 px-2 py-1 text-[11px]"
                  >
                    <option value="">
                      {pairedAuto ? `auto · ${pairedAuto}` : 'auto · nothing close enough'}
                    </option>
                    {victimClips.map((v) => (
                      <option key={v} value={v}>{v} · {manifest[v]?.dur ?? '?'}s</option>
                    ))}
                  </select>
                  <button
                    disabled={!pairedShown}
                    onPointerEnter={() => pairedShown && setHovered(pairedShown)}
                    onClick={() => pairedShown && setHovered(pairedShown)}
                    className="text-[10px] px-3 py-1 border border-sky-500/60 text-sky-300 disabled:opacity-40"
                  >
                    SEE IT
                  </button>
                </div>
                <div className="text-[10px] text-zinc-400">
                  {pairedShown
                    ? <>the other man plays <b className="text-sky-300">{pairedShown}</b>{' '}
                        ({labels[selected]?.pairedWith ? 'you chose it'
                          : manifest[selected]?.pairedWith?.includes(pairedShown) ? 'paired at bake time'
                          : 'stand-in, chosen on length'})</>
                    : <span className="text-amber-400">no half recorded for this throw — pick one and the victim stops playing the stock knockdown</span>}
                </div>
              </div>
            )}

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
