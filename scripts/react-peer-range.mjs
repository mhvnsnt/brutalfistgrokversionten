/**
 * IS OUR RANGE INSIDE THEIRS? — without semver.subset.
 *
 * `semver.subset` arrived in semver 7 and this repo resolves 6.3.1, so the
 * question is answered by PROBING instead: walk a dense grid of plausible
 * versions and look for one our range admits that theirs does not. That is
 * exactly the failure mode — a version npm is allowed to pick and the package
 * rejects — so probing tests the thing that matters rather than proving set
 * containment in the abstract.
 *
 * The grid covers three majors either side of anything mentioned in either
 * range, every minor 0-19 and patches 0-3, which is far denser than React's
 * release cadence.
 */
import semver from 'semver';

export function versionsOursAdmitsTheirsRejects(ours, theirs) {
  const majors = new Set();
  for (const r of [ours, theirs]) {
    for (const m of String(r).matchAll(/(\d+)\.\d+/g)) majors.add(Number(m[1]));
  }
  if (!majors.size) majors.add(0);
  const lo = Math.max(0, Math.min(...majors) - 1);
  const hi = Math.max(...majors) + 2;
  const bad = [];
  for (let maj = lo; maj <= hi; maj++) {
    for (let min = 0; min <= 19; min++) {
      for (let pat = 0; pat <= 3; pat++) {
        const v = `${maj}.${min}.${pat}`;
        if (semver.satisfies(v, ours) && !semver.satisfies(v, theirs)) bad.push(v);
      }
    }
  }
  return bad;
}
