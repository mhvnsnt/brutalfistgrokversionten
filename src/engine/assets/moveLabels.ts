// `.ts` extensions on purpose — the repo's runner resolves them literally.

/**
 * WHAT THE OWNER SAYS A CLIP IS.
 *
 * His words: "all the ones you don't know where to put them, you can put
 * them in a folder or in a place in the move library ... so I can look at
 * them and tell you what they are, where they should go."
 *
 * The project has hit "I cannot tell what this move is" over and over, and
 * the honest answer is that a human has to look. This is the record of what
 * he says when he does — kept on the device, and EXPORTABLE as text, because
 * the point is that it comes back to the repo and becomes real assignments.
 *
 * IT IS AN AUTHORITY NOW, AND THAT IS THE POINT. This used to end with
 * "nothing in combat reads it", which made the screen a suggestion box: the
 * owner could label every clip in the game and nothing would change. His
 * whole reason for asking for the viewer was the opposite — "I can help you
 * figure out what animations should go in what categories."
 *
 * So two of the fields are wired straight into combat:
 *   verdict 'broken'  the clip is refused everywhere, immediately. He can
 *                     see things no measurement here can — CROTCHCHOP plays
 *                     horizontal, TZ_SCOOP_SLAM holds a T-pose for 17 s and
 *                     passed every numeric gate I had.
 *   slot              the clip is PREFERRED for that slot, ahead of the
 *                     bake's own pick. A human who looked beats a heuristic.
 * `name` and `note` stay notes.
 */
export interface MoveLabel {
  /** What he calls it: "jin spinning kick", "this is a taunt", "junk". */
  name?: string;
  /** Where it belongs, in his words or a slot id. */
  slot?: string;
  /** Anything else — "mirrored", "starts too late", "use for CIPHER". */
  note?: string;
  /** A quick verdict, so a sweep can be done without typing. */
  verdict?: 'good' | 'broken' | 'unsure';
  /** When it was written, so a later pass can tell what is new. */
  at: number;
}

export type MoveLabelMap = Record<string, MoveLabel>;

import { COMBAT_STATE_TO_SEMANTIC, SEMANTIC_STATE_ALIASES } from '../retarget/SemanticStateAliases.ts';

const KEY = 'bf_move_labels_v1';

/** Read every label. Never throws — storage can be blocked or cleared. */
export function loadMoveLabels(): MoveLabelMap {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as MoveLabelMap) : {};
  } catch {
    return {};
  }
}

/** Write one label, merged into what is already there. Returns the new map. */
export function setMoveLabel(clip: string, label: Omit<MoveLabel, 'at'>): MoveLabelMap {
  const all = loadMoveLabels();
  const merged: MoveLabel = { ...all[clip], ...label, at: Date.now() };
  // An emptied label is a DELETE, so a mistake can be taken back rather than
  // leaving a blank entry that looks reviewed.
  if (!merged.name && !merged.slot && !merged.note && !merged.verdict) delete all[clip];
  else all[clip] = merged;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(all));
  } catch {
    /* a full or blocked store must not lose the session's other work */
  }
  return all;
}

/**
 * The labels as text to hand back.
 *
 * Deliberately a flat, readable list rather than raw JSON: it is going to be
 * pasted into a message, and a human has to be able to read it there.
 */
export function exportMoveLabels(labels: MoveLabelMap = loadMoveLabels()): string {
  const rows = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (rows.length === 0) return 'No moves labelled yet.';
  const lines = [`BRUTAL FIST — ${rows.length} move(s) labelled`, ''];
  for (const [clip, l] of rows) {
    const bits = [
      l.verdict ? `[${l.verdict}]` : null,
      l.name ? `= ${l.name}` : null,
      l.slot ? `-> ${l.slot}` : null,
      l.note ? `(${l.note})` : null,
    ].filter(Boolean);
    lines.push(`${clip}  ${bits.join('  ')}`);
  }
  return lines.join('\n');
}

/** Clips with no label yet — the queue of work, in the caller's order. */
export function unlabelled(all: readonly string[], labels: MoveLabelMap = loadMoveLabels()): string[] {
  return all.filter((c) => !labels[c]);
}


/**
 * THE OWNER SAID THIS CLIP IS BROKEN, SO IT IS.
 *
 * A verdict beats every measurement in this repo, because the measurements
 * keep missing things a person sees at a glance: a severed rig scores a
 * PERFECT deformation number, a T-pose that lasts 17 seconds passed the
 * T-pose gate at 0.49 against 0.50, and two taunts that play lying flat
 * passed everything except the eye.
 */
export function labelRefuses(clip: string, labels: MoveLabelMap = loadMoveLabels()): boolean {
  return labels[clip]?.verdict === 'broken';
}

/**
 * WHAT SLOT DID HE MEAN?
 *
 * He is typing into a free-text box on a phone, so he will write "Heavy
 * Kick", "heavy kick", "attack_rk" or "RK" and mean one slot. Comparing
 * the raw strings makes four of those five silently miss, which is the
 * worst possible outcome for a screen whose whole job is to collect his
 * judgement.
 *
 * Resolved through the engine's own tables — the combat-state names and
 * every alias each semantic slot already answers to — so no second
 * vocabulary is invented here and a slot added later works for free.
 */
const squash = (v: string) => v.replace(/[^a-z0-9]/gi, '').toLowerCase();

export function canonicalSlot(typed: string): string | null {
  const want = squash(typed);
  if (!want) return null;
  for (const semantic of Object.keys(SEMANTIC_STATE_ALIASES)) {
    if (squash(semantic) === want) return semantic;
  }
  for (const [combat, semantic] of Object.entries(COMBAT_STATE_TO_SEMANTIC)) {
    if (squash(combat) === want) return semantic;
  }
  for (const [semantic, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) {
    if (aliases.some((a) => squash(a) === want)) return semantic;
  }
  return null;
}

/**
 * Clips the owner assigned to a slot, most recently judged first.
 *
 * A clip he later called BROKEN is never served, whatever slot he put it
 * in — the verdict is the stronger statement.
 */
export function clipsLabelledFor(slot: string, labels: MoveLabelMap = loadMoveLabels()): string[] {
  const want = canonicalSlot(slot);
  if (!want) return [];
  return Object.entries(labels)
    .filter(([, l]) => l.verdict !== 'broken' && l.slot && canonicalSlot(l.slot) === want)
    .sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0))
    .map(([clip]) => clip);
}
