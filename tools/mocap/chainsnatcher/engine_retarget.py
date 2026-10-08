"""ENGINE-CONVENTION RETARGET for the BrutalFist bake.

WHY. The versionten bake (scripts/bake-fighter-animations.mjs) reads a Bannon-bank clip's bones{} Euler
as the bone's ABSOLUTE local rotation on public/models/BANNON_rigged.glb (sourceRest = targetRest = bind,
so q = bind * bind^-1 * q_src = q_src). video_to_clip.build_clip writes rest-relative swings measured in
CAMERA axes for a rig that faces +z with its left on +x. BANNON_rigged faces +x (toes) with its Left bones on +z and
its limbs have non-identity binds, so build_clip's bones played through this bake come out yawed 90 deg
(a forward bend becomes a sideways lean) with T-pose arms. Measured with a synthetic 40-degree forward
bend: see tools/mocap/chainsnatcher/README.md.

WHAT THIS DOES. From the same smoothed, resampled 3D joints build_clip keys on, it solves each bone's
absolute local rotation on the BANNON_rigged bind: the hips and chest get a full frame (up axis +
hip/shoulder line, so yaw and twist are kept), arms and legs get the swing to the measured segment with
the twist chosen so the elbow/knee bends in the measured plane (the bake's hinge constraint then has
nothing to fight), and the parts the capture does not measure reliably (clavicles, neck, head, hands,
feet, toes) keep the bind. Nothing is invented: every driven rotation comes from a measured (or flagged
solved / interpolated) joint position.
"""
import math, numpy as np
from pygltflib import GLTF2

GLB = '/workspace/vten-stages/public/models/BANNON_rigged.glb'

def _qmat(q):
    x, y, z, w = np.asarray(q, float) / np.linalg.norm(q)
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])

def _mat_to_q(m):
    t = np.trace(m)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2; w = 0.25 * s
        x = (m[2, 1] - m[1, 2]) / s; y = (m[0, 2] - m[2, 0]) / s; z = (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w = (m[2, 1] - m[1, 2]) / s; x = 0.25 * s; y = (m[0, 1] + m[1, 0]) / s; z = (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w = (m[0, 2] - m[2, 0]) / s; x = (m[0, 1] + m[1, 0]) / s; y = 0.25 * s; z = (m[1, 2] + m[2, 1]) / s
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w = (m[1, 0] - m[0, 1]) / s; x = (m[0, 2] + m[2, 0]) / s; y = (m[1, 2] + m[2, 1]) / s; z = 0.25 * s
    q = np.array([x, y, z, w]); q /= np.linalg.norm(q)
    return q if q[3] >= 0 else -q

def euler_xyz(m):
    """THREE.Euler.setFromRotationMatrix(m, 'XYZ')."""
    m13 = m[0, 2]; ey = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        ex = math.atan2(-m[1, 2], m[2, 2]); ez = math.atan2(-m[0, 1], m[0, 0])
    else:
        ex = math.atan2(m[2, 1], m[1, 1]); ez = 0.0
    return ex, ey, ez

def _n(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v * 0

def _swing(a, b):
    a = _n(a); b = _n(b); v = np.cross(a, b); c = float(np.dot(a, b))
    if c < -0.999999:
        p = np.cross(a, [1, 0, 0]);
        if np.linalg.norm(p) < 1e-6: p = np.cross(a, [0, 1, 0])
        p = _n(p); return 2 * np.outer(p, p) - np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)

def _frame(primary, secondary):
    """Orthonormal basis with column 0 = primary, column 1 = secondary made orthogonal."""
    p = _n(primary); s = _n(secondary - np.dot(secondary, p) * p); t = np.cross(p, s)
    return np.stack([p, s, t], 1)

class Rig:
    def __init__(self, path=GLB):
        g = GLTF2().load(path); self.nodes = g.nodes
        self.idx = {n.name: i for i, n in enumerate(g.nodes)}; self.parent = {}
        for i, n in enumerate(g.nodes):
            for c in (n.children or []): self.parent[c] = i
        self.L = {}; self.T = {}
        for nm, i in self.idx.items():
            n = self.nodes[i]
            self.L[nm] = _qmat(n.rotation) if n.rotation else np.eye(3)
            self.T[nm] = np.array(n.translation or [0, 0, 0.])
        self.W = {}; self.P = {}
        self._fk('mixamorig:Hips', np.eye(3), np.zeros(3))
    def _fk(self, nm, Wp, Pp, root=True):
        W = self.L[nm] if root else Wp @ self.L[nm]
        P = np.zeros(3) if root else Pp + Wp @ self.T[nm]
        self.W[nm] = W; self.P[nm] = P
        for c in (self.nodes[self.idx[nm]].children or []):
            self._fk(self.nodes[c].name, W, P, False)
    def head(self, nm): return self.P['mixamorig:' + nm]

M = 'mixamorig:'

def tool_to_rig(p):
    """Tool space after build_clip's flip (x image-right, y up, z toward camera; a performer facing the
    camera has his left on +x) -> rig space. BANNON_rigged, measured from its bind: the toes point +x
    (forward), up is +y, and the Left-named bones sit on +z. That rig is left-handed with respect to its
    own names (+z is the anatomical right of a +x-facing, +y-up body), so the anatomical mapping
    performer-left -> Left bones, forward -> toes is a reflection: (x, y, z) -> (z, y, x)."""
    p = np.asarray(p, float)
    return np.stack([p[..., 2], p[..., 1], p[..., 0]], -1)

class Retarget:
    def __init__(self, rig=None):
        self.r = rig or Rig()
        r = self.r
        self.bind_up = _n(r.head('Spine2') - r.head('Hips'))
        self.bind_hlat = _n(r.head('LeftUpLeg') - r.head('RightUpLeg'))
        self.bind_cup = _n(r.head('Neck') - r.head('Spine2'))
        self.bind_slat = _n(r.head('LeftArm') - r.head('RightArm'))
    @staticmethod
    def _twist_about(m, axis):
        """Signed twist (deg) of rotation matrix m about unit axis, and the off-axis swing (deg)."""
        q = _mat_to_q(m); v = float(np.dot(q[:3], axis))
        tw = math.degrees(2 * math.atan2(v, q[3]))
        tw = (tw + 180) % 360 - 180
        sw = q[:3] - v * axis; nsw = np.linalg.norm(sw); den = math.hypot(q[3], v)
        off = math.degrees(2 * math.atan2(nsw, den))
        return tw, off
    def _limb(self, out, Wp, upper, lower, end, a_t, f_t, flex_sign, twist_limit):
        """Upper bone (arm / thigh) points along the measured a_t. Its free twist about that line is
        chosen by search so the LOWER bone can reach the measured f_t by bending about its own hinge
        (local Z in the bake's SkeletalLimits.HINGE_JOINTS: knee flexion +Z, elbow flexion -Z) inside the
        hinge range, while the upper bone's own twist stays inside the bake's joint limit. When the limb
        is straight every twist fits, and the smallest twist from the bind wins. The lower bone then
        swings exactly onto f_t, so the clip keeps the measured joint positions."""
        r = self.r
        Lu = r.L[M + upper]; Ll = r.L[M + lower]
        u_loc = _n(r.T[M + lower]); y = np.array([0, 1.0, 0]); z = np.array([0, 0, 1.0])
        e_loc = r.T[M + end]
        lo, hi = ((-8, 150) if flex_sign > 0 else (-150, 8))
        C = Wp @ Lu
        W0 = _swing(C @ u_loc, a_t) @ C
        at = _n(a_t); ft = _n(f_t)
        best = None
        for psi in np.arange(-180, 180, 3.0):
            th = math.radians(psi); K = np.array([[0, -at[2], at[1]], [at[2], 0, -at[0]], [-at[1], at[0], 0]])
            Rt = np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K
            W1 = Rt @ W0
            ytw, _ = self._twist_about(Lu.T @ (Wp.T @ W1), y)
            C2 = W1 @ Ll
            W2 = _swing(C2 @ e_loc, ft) @ C2
            rel = Ll.T @ (W1.T @ W2)
            flex, off = self._twist_about(rel, z)
            cost = off + 3 * max(0, abs(ytw) - twist_limit) + 2 * max(0, lo - flex, flex - hi) + 0.03 * abs(ytw)
            if best is None or cost < best[0]: best = (cost, W1, W2)
        _, W1, W2 = best
        out[upper] = Wp.T @ W1
        out[lower] = W1.T @ W2
        return W2
    def frame(self, pts):
        """pts: derive_points() dict, already in RIG space. Returns {bone: absolute local 3x3}."""
        r = self.r; out = {}
        up = pts['spine2'] - pts['pelvis']; hl = pts['l_hip'] - pts['r_hip']
        Wh = _frame(up, hl) @ _frame(self.bind_up, self.bind_hlat).T @ r.L[M + 'Hips']
        out['Hips'] = Wh
        # spine: Spine and Spine1 swing along the measured pelvis->chest line; Spine2 gets the full chest
        # frame (chest up + shoulder line) so upper-body twist is kept
        W = Wh
        for b, c, seg in (('Spine', 'Spine1', ('pelvis', 'spine1')), ('Spine1', 'Spine2', ('spine1', 'spine2'))):
            C = W @ r.L[M + b]; S = _swing(C @ r.T[M + c], pts[seg[1]] - pts[seg[0]]); Wn = S @ C
            out[b] = W.T @ Wn; W = Wn
        C = W @ r.L[M + 'Spine2']
        cur = _frame(C @ np.linalg.inv(r.W[M + 'Spine2']) @ self.bind_cup, C @ np.linalg.inv(r.W[M + 'Spine2']) @ self.bind_slat)
        goal = _frame(pts['neck'] - pts['spine2'], pts['l_sh'] - pts['r_sh'])
        Wc = goal @ cur.T @ C
        out['Spine2'] = W.T @ Wc
        for side, s in (('Left', 'l'), ('Right', 'r')):
            Wsh = Wc @ r.L[M + side + 'Shoulder']          # clavicle keeps the bind
            self._limb(out, Wsh, side + 'Arm', side + 'ForeArm', side + 'Hand',
                       pts[s + '_el'] - pts[s + '_sh'], pts[s + '_wr'] - pts[s + '_el'], -1.0, 90)
            self._limb(out, Wh, side + 'UpLeg', side + 'Leg', side + 'Foot',
                       pts[s + '_kn'] - pts[s + '_hip'], pts[s + '_ank'] - pts[s + '_kn'], 1.0, 50)
        return out
    def fk(self, local):
        """World joint positions for a {bone: local 3x3} pose (missing bones = bind)."""
        r = self.r; P = {}
        def go(nm, Wp, Pp, root):
            short = nm.replace(M, '')
            L = local.get(short, r.L[nm])
            W = L if root else Wp @ L
            p = np.zeros(3) if root else Pp + Wp @ r.T[nm]
            P[short] = p
            for c in (r.nodes[r.idx[nm]].children or []): go(r.nodes[c].name, W, p, False)
        go(M + 'Hips', None, None, True)
        return P

def bones_json(local):
    out = {}
    for b, m in local.items():
        ex, ey, ez = euler_xyz(m)
        out[M + b] = {'rx': round(ex, 4), 'ry': round(ey, 4), 'rz': round(ez, 4)}
    return out
