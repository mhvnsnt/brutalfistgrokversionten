/**
 * BOTH FIGHTERS HAVE TO BE ON THE SCREEN.
 *
 * Owner: "I can't visually really tell that it's a fight or what's happening
 * going on." Found by LOOKING at a captured frame rather than measuring one:
 * both fighters were clipped off the left and right edges with empty floor
 * between them. Every probe in this repo reported numbers; none of them had
 * ever rendered a frame and looked at it.
 *
 * The cause is arithmetic. three.js `fov` is VERTICAL, so on a portrait phone
 * (412x915, aspect 0.45) a 55 degree vertical fov is a 26 degree HORIZONTAL
 * one — and the camera distance rule was written as if the view were wide.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const DEG = Math.PI / 180;
/** The minimum horizontal field of view the camera guarantees. */
const MIN_HORIZONTAL_FOV = 38 * DEG;
/** Half a body's width of breathing room, so nobody rides the edge. */
const FRAME_MARGIN_M = 0.75;

/** The framing the camera rig computes, extracted so it can be checked. */
function framing(authoredFovDeg: number, width: number, height: number, gap: number) {
  const aspect = Math.max(0.2, width / Math.max(1, height));
  const neededV = 2 * Math.atan(Math.tan(MIN_HORIZONTAL_FOV / 2) / aspect);
  const vFov = Math.min(85 * DEG, Math.max(authoredFovDeg * DEG, neededV));
  const hHalf = Math.atan(Math.tan(vFov / 2) * aspect);
  const fit = (gap / 2 + FRAME_MARGIN_M) / Math.max(0.05, Math.tan(hHalf));
  const distance = Math.max(4.5, Math.min(13, Math.max(gap * 1.05 + 3.0, fit)));
  return { vFovDeg: vFov / DEG, halfWidth: distance * Math.tan(hHalf), distance };
}

const PHONE = [412, 915] as const;
const GAPS = [0.85, 1.5, 2.5, 3.6, 5.0];

describe('camera framing', () => {
  it('holds both fighters on a portrait phone at every separation', () => {
    const clipped: string[] = [];
    for (const gap of GAPS) {
      const f = framing(55, PHONE[0], PHONE[1], gap);
      // Each fighter stands gap/2 from the midpoint the camera aims at.
      if (f.halfWidth < gap / 2 + 0.3) {
        clipped.push(`gap ${gap}m: half-width ${f.halfWidth.toFixed(2)}m vs fighter at ${(gap / 2).toFixed(2)}m`);
      }
    }
    assert.deepEqual(clipped, [], `a fighter is off the edge of the screen:\n${clipped.join('\n')}`);
  });

  it('the old rule really was clipping them — this is what was wrong', () => {
    // The previous distance rule, with no aspect correction at all.
    const aspect = PHONE[0] / PHONE[1];
    const hHalfOld = Math.atan(Math.tan((55 * DEG) / 2) * aspect);
    const clipped = GAPS.filter((gap) => {
      const d = Math.max(4.5, Math.min(11, gap * 1.05 + 3.0));
      return d * Math.tan(hHalfOld) < gap / 2 + 0.3;
    });
    // MEASURED: 3 of the 5 separations put a fighter off the edge outright
    // (2.5m, 3.6m, 5.0m), and 1.5m cleared by 2cm with the body straddling the
    // edge. Asserting the measured 3 rather than the 4 I first guessed.
    assert.ok(clipped.length >= 3,
      `the old rule clipped only ${clipped.length} of ${GAPS.length} separations — `
      + 'the regression this test exists for is not reproduced');
  });

  it('leaves a landscape screen exactly as it was authored', () => {
    // On 16:9 the derived vertical fov is smaller than 55, so Math.max keeps
    // the authored value and desktop framing does not move.
    const f = framing(55, 1920, 1080, 3.6);
    assert.ok(Math.abs(f.vFovDeg - 55) < 0.001, `landscape fov moved to ${f.vFovDeg.toFixed(2)}`);
  });

  it('never backs off so far that the fighters become specks', () => {
    for (const gap of GAPS) {
      assert.ok(framing(55, PHONE[0], PHONE[1], gap).distance <= 13,
        `camera retreated past the 13m cap at gap ${gap}`);
    }
  });
});
