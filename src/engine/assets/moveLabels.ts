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
 * It is not a second source of truth. Nothing in combat reads it. A label is
 * a note from the person who can tell, waiting to be turned into a slot.
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
