/* topplay020 · The low-poly descent
   One mesh of loose triangles. For every stop on the page (the hero, each project, each section) the
   triangles hold a different shape; between two stops they shatter, tumble and land in the next one.
   Each project's real screenshot assembles out of the shards. Behind them, a tall faceted wall whose
   colour runs from blue through violet and pink to gold as the page goes down.
   Native scroll only: this file reads scrollY once a frame and never touches it. */
import * as THREE from './vendor/three.module.min.js';

const BG = 0x0c0a1c;
const FOV = 30;
const TAU = Math.PI * 2;
const SHARDS = 1536;      // grid planes use 28 x 24 x 2 of these, the rest float around each shape
const MAIN = 1344;
const GAP = 16;           // world units between two stops, the distance the camera walks down

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const damp = (dt, k) => 1 - Math.exp(-dt * k);
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/* The reference gradient, as colour stops from the top of the page to the bottom. */
const STOPS = [
    [0.13, 0.82, 1.00], [0.17, 0.52, 1.00], [0.22, 0.20, 0.82], [0.48, 0.20, 0.85],
    [0.92, 0.38, 0.72], [1.00, 0.13, 0.42], [1.00, 0.50, 0.28], [1.00, 0.84, 0.48]
];
function palette(t, out = [0, 0, 0]) {
    t = clamp(t) * (STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(t)), f = t - i;
    for (let k = 0; k < 3; k++) out[k] = lerp(STOPS[i][k], STOPS[i + 1][k], f);
    return out;
}
const GLSL_PALETTE = `
    const vec3 PAL[8] = vec3[8](${STOPS.map((c) => `vec3(${c.map((v) => v.toFixed(3)).join(',')})`).join(',')});
    vec3 palette(float t) {
        t = clamp(t, 0., 1.) * 7.;
        int i = int(min(floor(t), 6.));
        return mix(PAL[i], PAL[i + 1], t - float(i));
    }`;

/* ---------- Building shapes out of big flat facets ---------- */
function facetsFrom(geometry, matrix, colorAt, group = -1) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.attributes.position, v = new THREE.Vector3(), list = [];
    for (let i = 0; i < p.count; i += 3) {
        const t = [0, 1, 2].map((k) => {
            v.fromBufferAttribute(p, i + k);
            if (matrix) v.applyMatrix4(matrix);
            return v.toArray();
        });
        const c = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3, (t[0][2] + t[1][2] + t[2][2]) / 3];
        list.push({ a: t[0], b: t[1], c: t[2], col: colorAt(c, list.length), group });
    }
    return list;
}
const area = (f) => {
    const ux = f.b[0] - f.a[0], uy = f.b[1] - f.a[1], uz = f.b[2] - f.a[2];
    const vx = f.c[0] - f.a[0], vy = f.c[1] - f.a[1], vz = f.c[2] - f.a[2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    return Math.sqrt(x * x + y * y + z * z) / 2;
};
const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];

/* Split the largest triangle along its longest edge until there are exactly n. Each split stays coplanar,
   so a big facet still reads as one big flat facet until it shatters. */
function fillTo(list, n) {
    const out = list.slice(), areas = out.map(area);
    while (out.length < n) {
        let best = 0;
        for (let i = 1; i < out.length; i++) if (areas[i] > areas[best]) best = i;
        const f = out[best];
        const ab = dist2(f.a, f.b), bc = dist2(f.b, f.c), ca = dist2(f.c, f.a);
        let p, q, r;
        if (ab >= bc && ab >= ca) { p = f.a; q = f.b; r = f.c; } else if (bc >= ca) { p = f.b; q = f.c; r = f.a; } else { p = f.c; q = f.a; r = f.b; }
        const m = mid(p, q);
        const f1 = { ...f, a: p, b: m, c: r }, f2 = { ...f, a: m, b: q, c: r };
        out[best] = f1; areas[best] = area(f1);
        out.push(f2); areas.push(area(f2));
    }
    return out.slice(0, n);
}

/* Facet colour: a band of the gradient, shifted across the shape, with a little per-facet variation. */
const bandColor = (hue, spread, seed = 0) => (c, i) => {
    const t = hue + (c[0] * .6 - c[1]) * spread + (hash(i + seed) - .5) * .09;
    const out = palette(t), l = .84 + hash(i * 3 + seed) * .3;
    return [out[0] * l, out[1] * l, out[2] * l];
};

function gem() {
    const geo = new THREE.IcosahedronGeometry(4.5, 2);
    const p = geo.attributes.position, keyed = new Map();
    for (let i = 0; i < p.count; i++) {
        const key = [p.getX(i), p.getY(i), p.getZ(i)].map((n) => Math.round(n * 50)).join();
        if (!keyed.has(key)) keyed.set(key, .82 + hash(keyed.size * 7.3) * .34);
        const k = keyed.get(key);
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 1.06, p.getZ(i) * k);
    }
    // The full reference gradient on one object: blue at one side, pink and gold at the other.
    return facetsFrom(geo, null, (c, i) => {
        const t = .47 + (c[0] * .75 + c[1] * .2 - c[2] * .12) * .1 + (hash(i) - .5) * .13;
        const out = palette(t), l = .86 + hash(i * 5) * .26;
        return [out[0] * l, out[1] * l, out[2] * l];
    });
}

function slabs(hue, count) {
    let list = [];
    const span = 9.4, h = span / count, m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
        const r = 3.3 + hash(i + 1) * .8;
        const geo = new THREE.CylinderGeometry(r * .97, r, h * .8, 7, 1);
        q.setFromAxisAngle(up, hash(i + 4) * TAU);
        m.compose(new THREE.Vector3(0, span / 2 - h * (i + .5), 0), q, new THREE.Vector3(1, 1, 1));
        list = list.concat(facetsFrom(geo, m, bandColor(hue + (i / count - .5) * .1, .012, i * 11), i));
    }
    return list;
}

function orbit(hue, count) {
    let list = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
        const a = i / count * TAU * 2.2, y = 4.2 - i / (count - 1) * 8.4, r = 4.2 * Math.cos((i / (count - 1) - .5) * 1.9) + .3;
        const size = .62 + hash(i + 2) * .34;
        const geo = new THREE.IcosahedronGeometry(size, 0);
        q.setFromEuler(e.set(hash(i) * TAU, hash(i + 9) * TAU, 0));
        m.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1));
        list = list.concat(facetsFrom(geo, m, bandColor(hue + (hash(i + 30) - .5) * .12, .012, i * 7), i));
    }
    return list;
}

function crystals(hue, count) {
    let list = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
        const a = i / count * TAU + .5, r = 3.3;
        const geo = new THREE.OctahedronGeometry(1.25, 1);
        const p = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
        q.setFromEuler(e.set(.2, a, -a * .5));
        m.compose(p, q, new THREE.Vector3(1, 1.75, 1));
        list = list.concat(facetsFrom(geo, m, bandColor(hue + (i / count - .5) * .12, .012, i * 5), i));
    }
    return list;
}

function rising(hue, count) {
    let list = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
        const h = 2.2 + i * 1.9;
        const geo = new THREE.CylinderGeometry(1.08, 1.32, h, 6, 1);
        q.setFromAxisAngle(up, i * .5);
        m.compose(new THREE.Vector3(-3.6 + i * 2.4, -4 + h / 2, (i % 2) * .5), q, new THREE.Vector3(1, 1, 1));
        list = list.concat(facetsFrom(geo, m, bandColor(hue + i * .018, .01, i * 3), i));
    }
    return list;
}

/* An origami dart: the send button of the page. */
function paperPlane(hue) {
    const N = [0, .2, 5.6], L = [-4.5, .9, -3.2], R = [4.5, .9, -3.2], S = [0, .25, -2.6], K = [0, -1.5, -3.2], FL = [-.9, .75, -3], FR = [.9, .75, -3];
    const face = (a, b, c, t) => ({ a, b, c, col: palette(hue + t), group: -1 });
    return [
        face(N, L, FL, .0), face(N, FL, S, .05), face(N, S, FR, -.04), face(N, FR, R, -.08),
        face(N, S, K, -.2), face(N, K, S, -.14), face(S, FL, L, .04), face(S, R, FR, -.05)
    ];
}

/* A screen: a jittered grid whose triangles carry the screenshot's own uv. No T-junctions, so no cracks. */
const SURFACES = {
    curve: (u) => ((2 * u - 1) ** 2) * 1.15,                                // a curved monitor
    fold: (u) => Math.abs(((u * 4) % 2) - 1) * .8,                          // folded like paper, four panels
    crumple: (u, w) => {                                                    // a crumpled low-poly sheet
        const gx = u * 5, gy = w * 4, x = Math.floor(gx), y = Math.floor(gy), fx = gx - x, fy = gy - y;
        const n = (a, b) => hash(a * 19 + b * 53 + 7) - .5;
        return lerp(lerp(n(x, y), n(x + 1, y), fx), lerp(n(x, y + 1), n(x + 1, y + 1), fx), fy) * .95;
    },
    wave: (u, w) => Math.sin(u * TAU * 1.15 + w * 1.4) * .5,                // a flag in the wind
    crease: (u, w) => Math.abs(u + w - 1) * 1.45,                           // one diagonal crease
    bowl: (u, w) => ((2 * u - 1) ** 2 + (2 * w - 1) ** 2) * .62             // dished toward the viewer
};
const SURFACE_ORDER = ['curve', 'fold', 'crumple', 'wave', 'crease', 'bowl'];

/* How each project stands at rest: [turn toward its words, nod, lean]. */
const POSES = [[.2, .04, 0], [.34, -.08, .025], [.16, .1, -.03], [.4, .02, .03], [.26, -.12, -.02], [.3, .08, .04]];

/* How the shards travel out of each stop: 0 burst, 1 vortex, 2 rain, 3 wave, 4 flip, 5 ring. */
const MOVES = [0, 1, 2, 3, 4, 5, 1, 3, 4, 0, 5, 1, 2, 0];

function imagePlane(aspect, hue, surface) {
    const W = Math.min(10.4, 7.4 * aspect), H = W / aspect, zOf = SURFACES[surface];
    const cols = 28, rows = 24, v = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
        const inner = x > 0 && x < cols && y > 0 && y < rows;
        const jx = inner ? (hash(x * 13 + y * 7) - .5) * .55 : 0, jy = inner ? (hash(x * 3 + y * 17) - .5) * .55 : 0;
        const u = (x + jx) / cols, w = (y + jy) / rows;
        v.push({ p: [(u - .5) * W, (w - .5) * H, zOf(u, w)], uv: [u, w] });
    }
    const at = (x, y) => v[y * (cols + 1) + x], list = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1), flip = hash(x * 5 + y * 11) > .5;
        const col = palette(hue + (x / cols - .5) * .18 + (y / rows - .5) * .12);
        const push = (p, q, r) => list.push({ a: p.p, b: q.p, c: r.p, uvs: [p.uv, q.uv, r.uv], col, group: 0 });
        if (flip) { push(a, b, d); push(a, d, c); } else { push(a, b, c); push(b, d, c); }
    }
    return list;
}

/* Small loose chips around a shape. They stay inside the width the scene owns, so they never drift over
   the words, and behind a screenshot, so they never sit on it. uv -1 keeps them out of the image. */
function debris(count, seed, hue, behind) {
    const list = [], NO_UV = [[-1, -1], [-1, -1], [-1, -1]];
    for (let i = 0; i < count; i++) {
        const a = hash(i + seed) * TAU, r = .55 + hash(i * 2 + seed) * .55;
        const z = behind ? -2 - hash(i * 5 + seed) * 8 : (hash(i * 5 + seed) - .55) * 8;
        const c = [Math.cos(a) * r * 4.7, Math.sin(a) * r * 7, z];
        const s = .1 + hash(i * 7 + seed) * .3, d = (k) => (hash(i * k + seed) - .5) * s * 2;
        const col = palette(hue + (hash(i * 11 + seed) - .5) * .22);
        list.push({ a: [c[0] + d(13), c[1] + d(17), c[2] + d(19)], b: [c[0] + d(23), c[1] + d(29), c[2] + d(31)], c: [c[0] + d(37), c[1] + d(41), c[2] + d(43)], col, group: -1, uvs: NO_UV });
    }
    return list;
}

/* Flatten a shape into the typed arrays the shader reads. Sorted roughly top to bottom, so shards pour
   from one shape into the next instead of crossing at random. */
function pack(mainList, loose, seed) {
    const key = (f) => -((f.a[1] + f.b[1] + f.c[1]) / 3) + ((f.a[0] + f.b[0] + f.c[0]) / 3) * .35;
    const main = fillTo(mainList, MAIN).map((f, i) => ({ f, k: key(f) + hash(i + seed) * 2.5 })).sort((x, y) => x.k - y.k).map((o) => o.f);
    const all = main.concat(loose);
    const n = SHARDS * 3;
    const pos = new Float32Array(n * 3), cen = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), grp = new Float32Array(n);
    all.forEach((f, i) => {
        const c = [(f.a[0] + f.b[0] + f.c[0]) / 3, (f.a[1] + f.b[1] + f.c[1]) / 3, (f.a[2] + f.b[2] + f.c[2]) / 3];
        [f.a, f.b, f.c].forEach((p, k) => {
            const o = i * 3 + k;
            pos.set(p, o * 3); cen.set(c, o * 3); col.set(f.col, o * 3);
            if (f.uvs) uv.set(f.uvs[k], o * 2);
            grp[o] = f.group;
        });
    });
    return { pos, cen, col, uv, grp };
}

/* ---------- Shaders ---------- */
const SHARD_VERT = `
    attribute vec3 aA, aB, aCA, aCB, aColA, aColB;
    attribute vec2 aUvA, aUvB;
    attribute float aGrpA, aGrpB, aLoose;
    attribute vec4 aRand;
    uniform float uT, uIntro, uScatter, uHoverGroup, uHoverAmt, uKickX, uStyle, uTime, uVel, uKindA, uKindB, uPush, uLooseY;
    uniform mat3 uRotA, uRotB;
    uniform vec3 uCenterA, uCenterB, uPtr;
    varying vec3 vP, vCol;
    varying vec2 vUvA, vUvB;
    varying float vE, vHover;

    mat3 spin(vec3 a, float t) {
        float s = sin(t), c = cos(t), o = 1. - c;
        return mat3(o*a.x*a.x+c, o*a.x*a.y+a.z*s, o*a.z*a.x-a.y*s,
                    o*a.x*a.y-a.z*s, o*a.y*a.y+c, o*a.y*a.z+a.x*s,
                    o*a.z*a.x+a.y*s, o*a.y*a.z-a.x*s, o*a.z*a.z+c);
    }
    vec3 rotY(vec3 p, float a) {
        float s = sin(a), c = cos(a);
        return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
    }
    // Each shape's own life: slabs counter-rotate, gems orbit, crystals breathe, pillars rise and fall.
    vec3 local(vec3 p, float g, float kind) {
        if (g < -.5 || kind < .5) return p;
        if (kind < 1.5) return rotY(p, uTime * .35 * (mod(g, 2.) * 2. - 1.) * (.6 + fract(g * .37)));
        if (kind < 2.5) {
            p = rotY(p, uTime * (.16 + fract(g * .61) * .2));
            p.y += sin(uTime * .9 + g) * .28;
            return p;
        }
        if (kind < 3.5) { p.xy *= 1. + sin(uTime * 1.1 + g * 1.05) * .09; return p; }
        p.y += sin(uTime * .9 + g * .9) * .6;
        return p;
    }
    void main() {
        float r0 = aRand.w, st = r0;
        if (abs(uStyle - 3.) < .5) st = clamp(aCA.x / 11. + .5, 0., 1.) * .82 + r0 * .18;
        else if (abs(uStyle - 2.) < .5) st = clamp(.5 - aCA.y / 11., 0., 1.) * .82 + r0 * .18;
        float w = .52, s = st * (1. - w);
        float e = smoothstep(s, s + w, uT);
        float arc = sin(e * 3.14159);
        vec3 ax = normalize(aRand.xyz - .5 + 1e-3), rnd = aRand.xyz - .5;

        vec3 la = local(aA, aGrpA, uKindA), lb = local(aB, aGrpB, uKindB);
        vec3 ca = local(aCA, aGrpA, uKindA), cb = local(aCB, aGrpB, uKindB);
        vec3 c = mix(uCenterA + uRotA * ca, uCenterB + uRotB * cb, e);
        vec3 rel = mix(uRotA * (la - ca), uRotB * (lb - cb), e);
        vec3 mid = mix(uCenterA, uCenterB, e);
        float tumble = 1.;

        if (uStyle < .5) {          // burst: some shards fly past the camera
            c += vec3(rnd.x * 9. + uKickX, rnd.y * 10., (aRand.z - .25) * 26.) * arc * uScatter;
        } else if (uStyle < 1.5) {  // vortex
            vec3 o = c - mid;
            float an = arc * (3.2 + r0 * 2.2) * uScatter, cs = cos(an), sn = sin(an);
            o.xy = mat2(cs, sn, -sn, cs) * o.xy * (1. + arc * .7 * uScatter);
            o.z += rnd.z * 14. * arc * uScatter;
            c = mid + o;
            c.x += uKickX * arc * uScatter;
        } else if (uStyle < 2.5) {  // rain: the top lets go first
            c += vec3(rnd.x * 3. + uKickX * .6, -(5. + aRand.y * 12.), rnd.z * 5.) * arc * uScatter;
        } else if (uStyle < 3.5) {  // wave: a sweep from one side to the other
            c.z += arc * (7. + aRand.z * 5.) * uScatter;
            c.y += sin(c.x * .7 + uT * 6.) * arc * 1.6 * uScatter;
            c.x += uKickX * arc * uScatter;
        } else if (uStyle < 4.5) {  // flip: the whole sheet turns over, barely breaking
            c += rnd * 1.2 * arc * uScatter;
            tumble = .25;
        } else {                    // ring: everything circles before it lands
            float a = aRand.x * 6.2832 + uT * 3.;
            vec3 rp = mid + vec3(cos(a) * 6.4, sin(a) * 6.4, rnd.z * 4.);
            c = mix(c, rp, smoothstep(.1, .8, arc) * uScatter);
            c.x += uKickX * arc * uScatter;
        }
        rel = spin(ax, arc * (2.5 + r0 * 5.) * uScatter * tumble) * rel;

        // Loose chips drift on their own, and streak when the page moves fast.
        c += vec3(sin(uTime * .6 + aRand.x * 6.28), cos(uTime * .5 + aRand.y * 6.28), 0.) * .42 * aLoose;
        c.y += uVel * (.4 + r0) * 4.5 * aLoose;
        c.y = mix(c.y, mid.y + (c.y - mid.y) * uLooseY, aLoose);

        // The cursor presses into the shape like a thumb into a soft surface.
        vec2 dp = c.xy - uPtr.xy;
        float near = exp(-dot(dp, dp) / 5.) * uPush * (1. - arc);
        float solid = aUvA.x > -.5 ? mix(uHasA, uHasB, e) : 0.;
        c.z += near * 1.3;
        c.xy += normalize(dp + 1e-4) * near * .5 * (1. - solid);

        // Entrance: the first shape assembles out of the air.
        float ii = clamp(uIntro * 1.7 - r0 * .7, 0., 1.);
        c += rnd * vec3(44., 34., 40.) * ii * ii;
        rel *= 1. - ii * .6;

        float h = uHoverAmt * step(abs(aGrpA - uHoverGroup), .5) * (1. - e);
        c += vec3(0., 0., h * 1.5);
        vHover = h;

        vec3 p = c + rel;
        vP = p;
        vE = e;
        vCol = mix(aColA, aColB, e);
        vUvA = aUvA; vUvB = aUvB;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
    }`.replace('uniform mat3 uRotA', 'uniform float uHasA, uHasB;\n    uniform mat3 uRotA');

const SHARD_FRAG = `
    precision highp float;
    uniform sampler2D uTexA, uTexB;
    uniform float uHasA, uHasB;
    uniform vec3 uLight;
    varying vec3 vP, vCol;
    varying vec2 vUvA, vUvB;
    varying float vE, vHover;
    void main() {
        vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
        vec3 L1 = normalize(vec3(-.45, .6, .66));
        float d1 = max(dot(n, L1), 0.), d2 = max(dot(n, uLight), 0.);
        vec3 lit = vCol * (.36 + .72 * d1 + .3 * d2);
        lit += vec3(1.) * pow(d2, 26.) * .32;
        float a = uHasA * (1. - smoothstep(.0, .3, vE)), b = uHasB * smoothstep(.7, 1., vE);
        if (vUvA.x < -.5) a = 0.;
        if (vUvB.x < -.5) b = 0.;
        // A screenshot keeps its colours, with just enough light to show the fold of its surface.
        float shade = min(1., .8 + .3 * d1);
        vec3 col = lit;
        if (a > .001) col = mix(lit, texture2D(uTexA, vUvA, -.8).rgb * shade, a);
        if (b > .001) col = mix(lit, texture2D(uTexB, vUvB, -.8).rgb * shade, b);
        col += vHover * .16 * (1. - max(a, b) * .7);
        gl_FragColor = vec4(col, 1.);
    }`;

const WALL_VERT = `
    attribute vec2 aHue;
    uniform float uTime, uVel;
    uniform vec3 uPtrW;
    varying vec3 vP;
    varying vec2 vHue;
    varying float vGlow;
    void main() {
        vec3 p = position;
        // The wall breathes, ripples when the page moves, and lifts toward the cursor.
        p.z += sin(p.x * .17 + uTime * .5) * cos(p.y * .12 + uTime * .38) * 1.5;
        p.z += sin(p.y * .24 + uTime * 1.4) * uVel * 4.5;
        vec2 d = p.xy - uPtrW.xy;
        float near = exp(-dot(d, d) / 70.);
        p.z += near * 3.2;
        vGlow = near;
        vP = p; vHue = aHue;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
    }`;

const WALL_FRAG = `
    precision highp float;
    uniform vec2 uRes, uFocus;
    uniform float uHalf, uKMin, uKMax, uAxis;
    uniform vec3 uLight, uBg;
    varying vec3 vP;
    varying vec2 vHue;
    varying float vGlow;
    ${GLSL_PALETTE}
    void main() {
        vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
        float d1 = max(dot(n, normalize(vec3(-.5, .55, .67))), 0.), d2 = max(dot(n, uLight), 0.);
        vec3 lit = palette(vHue.x) * (.42 + .6 * d1 + .22 * d2) * vHue.y;
        vec2 s = gl_FragCoord.xy / uRes;
        float aspect = uRes.x / uRes.y;
        float r = length((s - uFocus) * vec2(aspect, 1.));
        // The wall burns bright around the shape and falls to near dark under the words, whichever side they are on.
        float side = 1. - smoothstep(uHalf - .1, uHalf + .03, uAxis > .5 ? abs(s.y - uFocus.y) : abs(s.x - uFocus.x));
        float k = mix(uKMin, uKMax, side * smoothstep(1.05, .12, r)) + vGlow * .13;
        gl_FragColor = vec4(mix(uBg, lit, k), 1.);
    }`;

/* ---------- The wall ---------- */
function buildWall(top, bottom, hueOfY) {
    const cell = 6.4, xMin = -78, xMax = 78, z = -24;
    const cols = Math.ceil((xMax - xMin) / cell), rows = Math.ceil((top - bottom) / cell);
    const pts = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
        const n = x * 131 + y * 17;
        pts.push([
            xMin + (x + (hash(n) - .5) * .8) * cell,
            top - (y + (hash(n + 1) - .5) * .8) * cell,
            z + (hash(n + 2) - .5) * 6.5
        ]);
    }
    const at = (x, y) => pts[y * (cols + 1) + x];
    const pos = [], hue = [];
    const tri = (a, b, c, seed) => {
        const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
        const t = hueOfY(cy) + cx * .0045 + (hash(seed) - .5) * .13;
        const l = .78 + hash(seed + 5) * .36;
        for (const p of [a, b, c]) { pos.push(...p); hue.push(t, l); }
    };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1), s = x * 3 + y * 41;
        if (hash(s) > .5) { tri(a, b, d, s); tri(a, d, c, s + .5); } else { tri(a, b, c, s); tri(b, d, c, s + .5); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aHue', new THREE.Float32BufferAttribute(hue, 2));
    return geo;
}

/* ---------- The whole thing ---------- */
export async function createScene({ canvas, data, reduced, stops: stopElements, focus, onFirstFrame }) {
    THREE.ColorManagement.enabled = false;
    const small = () => innerWidth < 1000;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(BG, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 300);

    /* Stops: what the shards are at each point of the page */
    const nProjects = data.projects.length;
    const nStops = nProjects + 6;
    // Each section's place on the gradient, matching its accent colour in site.css.
    const HUE = { home: .3, workFrom: .06, workTo: .24, service: .33, tech: .44, feature: .63, process: .82, contact: .98 };
    const forms = [];
    const KIND = { service: 1, tech: 2, feature: 3, process: 4 };
    const addForm = (main, opt, i, hue) => {
        const loose = debris(SHARDS - MAIN, i * 97 + 3, hue, opt.kind === 'work');
        forms.push({ ...pack(main, loose, i * 13), hue, y: -i * GAP, image: null, kindId: KIND[opt.kind] || 0, ...opt });
    };
    addForm(gem(), { spin: [.09, .14], tilt: .35, kind: 'gem' }, 0, HUE.home);
    data.projects.forEach((p, i) => {
        const aspect = p.size ? p.size[0] / p.size[1] : 1.6;
        const hue = lerp(HUE.workFrom, HUE.workTo, nProjects > 1 ? i / (nProjects - 1) : 0);
        addForm(imagePlane(aspect, hue, SURFACE_ORDER[i % SURFACE_ORDER.length]), { spin: [0, 0], tilt: 0, kind: 'work', image: i, pose: POSES[i % POSES.length] }, i + 1, hue);
    });
    let k = nProjects + 1;
    addForm(slabs(HUE.service, data.services.length), { spin: [0, .2], tilt: .36, kind: 'service' }, k, HUE.service); k++;
    addForm(orbit(HUE.tech, data.technologies.length), { spin: [.06, .24], tilt: .1, kind: 'tech' }, k, HUE.tech); k++;
    addForm(crystals(HUE.feature, data.features.length), { spin: [0, .12], tilt: .22, kind: 'feature', rotZ: true }, k, HUE.feature); k++;
    addForm(rising(HUE.process, data.process.length), { spin: [0, .1], tilt: .3, kind: 'process' }, k, HUE.process); k++;
    addForm(paperPlane(HUE.contact), { spin: [0, 0], tilt: 0, kind: 'contact', plane: true }, k, HUE.contact);

    const hueOfY = (y) => {
        const f = clamp(-y / GAP, 0, forms.length - 1), i = Math.min(forms.length - 2, Math.floor(f));
        return lerp(forms[i].hue, forms[i + 1].hue, f - i);
    };

    /* The one mesh */
    const geometry = new THREE.BufferGeometry();
    const n = SHARDS * 3;
    const rand = new Float32Array(n * 4);
    for (let i = 0; i < SHARDS; i++) {
        const r = [hash(i + .1), hash(i + 1000.3), hash(i + 2000.7), hash(i + 3000.9)];
        for (let v = 0; v < 3; v++) rand.set(r, (i * 3 + v) * 4);
    }
    const attr = (name, array, size) => {
        const a = new THREE.BufferAttribute(array, size);
        a.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute(name, a);
        return a;
    };
    const A = {
        aA: attr('aA', forms[0].pos, 3), aB: attr('aB', forms[1].pos, 3),
        aCA: attr('aCA', forms[0].cen, 3), aCB: attr('aCB', forms[1].cen, 3),
        aColA: attr('aColA', forms[0].col, 3), aColB: attr('aColB', forms[1].col, 3),
        aUvA: attr('aUvA', forms[0].uv, 2), aUvB: attr('aUvB', forms[1].uv, 2),
        aGrpA: attr('aGrpA', forms[0].grp, 1), aGrpB: attr('aGrpB', forms[1].grp, 1)
    };
    const loose = new Float32Array(n);
    for (let i = MAIN * 3; i < n; i++) loose[i] = 1;
    geometry.setAttribute('aLoose', new THREE.BufferAttribute(loose, 1));
    geometry.setAttribute('position', new THREE.BufferAttribute(forms[0].pos, 3));
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));

    const blank = new THREE.DataTexture(new Uint8Array([12, 10, 28, 255]), 1, 1);
    blank.needsUpdate = true;
    const U = {
        uT: { value: 0 }, uIntro: { value: reduced ? 0 : 1 }, uScatter: { value: reduced ? 0 : 1 },
        uHoverGroup: { value: -99 }, uHoverAmt: { value: 0 }, uKickX: { value: 0 }, uStyle: { value: 0 }, uTime: { value: 0 }, uVel: { value: 0 }, uLooseY: { value: 1 },
        uKindA: { value: 0 }, uKindB: { value: 0 }, uPush: { value: reduced ? 0 : 1 }, uPtr: { value: new THREE.Vector3(999, 999, 0) },
        uRotA: { value: new THREE.Matrix3() }, uRotB: { value: new THREE.Matrix3() },
        uCenterA: { value: new THREE.Vector3() }, uCenterB: { value: new THREE.Vector3() },
        uTexA: { value: blank }, uTexB: { value: blank }, uHasA: { value: 0 }, uHasB: { value: 0 },
        uLight: { value: new THREE.Vector3(.3, .3, .9).normalize() }
    };
    const shards = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ vertexShader: SHARD_VERT, fragmentShader: SHARD_FRAG, uniforms: U, side: THREE.DoubleSide }));
    shards.frustumCulled = false;
    scene.add(shards);

    const wallU = {
        uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: new THREE.Vector2(.5, .5) },
        uHalf: { value: .2 }, uAxis: { value: 0 }, uKMin: { value: .1 }, uKMax: { value: .62 }, uTime: U.uTime, uVel: U.uVel,
        uPtrW: { value: new THREE.Vector3(999, 999, 0) }, uLight: U.uLight, uBg: { value: new THREE.Color(BG) }
    };
    const wall = new THREE.Mesh(buildWall(44, -(nStops - 1) * GAP - 44, hueOfY), new THREE.ShaderMaterial({ vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, uniforms: wallU, side: THREE.DoubleSide }));
    wall.frustumCulled = false;
    scene.add(wall);

    /* Project screenshots */
    const textures = new Array(nProjects).fill(null);
    const loader = new THREE.TextureLoader();
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const loadImages = () => data.projects.forEach((p, i) => loader.load(innerWidth < 1000 ? p.image.replace('Assets/', 'Assets/thumbs/') : p.image, (tex) => {
        tex.anisotropy = maxAniso;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        textures[i] = tex;
        segment = -1;
        dirty = true;
    }));

    /* ---------- Layout ---------- */
    let W = 0, H = 0, baseDist = 30, keys = [], fit = focus(), quality = 1, dirty = true, viewX = -1e5, viewY = -1e5;
    const spotX = (i) => (fit.split ? fit.spots[i].x : W / 2);
    const sideOf = (i) => (fit.split ? (fit.spots[i].x > W / 2 ? 1 : -1) : (i % 2 ? 1 : -1));
    const NAV = 60;
    let dists = [];
    /* Stacked: each stop has its own open space, so each stop gets the camera distance that fills it. */
    function fitStacked() {
        const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        dists = fit.spots.map((o, i) => {
            const work = forms[i].kind === 'work';
            return clamp(H / (2 * tan * Math.min(W / (work ? 12.4 : 11.2), o.h / (work ? 7.4 : 10.6))), 18, 90);
        });
    }
    function pixelRatio() { return Math.min(devicePixelRatio || 1, small() ? 1.5 : 1.75) * quality; }
    function measureStops() {
        const els = stopElements();
        fit = focus();
        const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), vh = innerHeight;
        if (fit.split) keys = els.map((el) => { const r = el.getBoundingClientRect(); return r.top + scrollY + r.height / 2 - vh / 2; });
        else {
            // A shape is at rest when its open space sits right under the nav, with its words below.
            keys = fit.spots.map((o) => o.cy - NAV - o.h / 2);
            if (H) fitStacked();
        }
        keys[0] = 0;
        keys[keys.length - 1] = Math.min(keys[keys.length - 1], max);
        for (let i = 1; i < keys.length; i++) keys[i] = Math.max(keys[i], keys[i - 1] + 1);
        dirty = true;
    }
    function applyFit() {
        const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        const avail = fit.split ? Math.min(...fit.spots.map((o) => o.avail)) : W;
        const pxPerUnit = Math.min(avail / 11.2, H / 12.5);
        baseDist = clamp(H / (2 * tan * pxPerUnit), 18, 70);
        if (!fit.split) fitStacked();
        U.uLooseY.value = fit.split ? 1 : .68;
        wallU.uAxis.value = fit.split ? 0 : 1;
        camera.updateProjectionMatrix();
        viewX = viewY = -1e5;
        if (fit.split) {
            wallU.uHalf.value = avail / 2 / W;
            wallU.uKMin.value = .11; wallU.uKMax.value = .66;
        } else {
            wallU.uKMin.value = .11; wallU.uKMax.value = .74;
        }
        dirty = true;
    }
    function resize() {
        const r = canvas.getBoundingClientRect();
        const nw = Math.round(r.width), nh = Math.round(r.height);
        fit = focus();
        // Phone browsers resize the viewport as the address bar hides; only a real change counts.
        if (nw === W && Math.abs(nh - H) < 120) { applyFit(); measureStops(); return; }
        W = nw; H = nh;
        renderer.setPixelRatio(pixelRatio());
        renderer.setSize(W, H, false);
        renderer.getDrawingBufferSize(wallU.uRes.value);
        camera.aspect = W / H;
        applyFit();
        measureStops();
    }
    addEventListener('resize', resize, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(() => measureStops()).observe(document.body);

    /* ---------- State ---------- */
    let cur = 0, segment = -1, time = 0, paused = false;
    let px = 0, py = 0, pxS = 0, pyS = 0, intro = reduced ? 1 : 0;
    let hoverAmt = 0, hoverWant = 0, hasPointer = false, ss = scrollY, vel = 0, lastCur = 0;

    if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        addEventListener('pointermove', (e) => { px = e.clientX / innerWidth * 2 - 1; py = e.clientY / innerHeight * 2 - 1; hasPointer = true; dirty = true; }, { passive: true });
    }

    function highlight(kind, i) {
        const form = forms[Math.round(cur)];
        if (kind && form && form.kind === kind && (kind !== 'work' || form.image === i)) { U.uHoverGroup.value = kind === 'work' ? 0 : i; hoverWant = 1; } else hoverWant = 0;
        dirty = true;
    }

    function targetFromScroll() {
        const s = scrollY;
        let i = 0;
        while (i < keys.length - 2 && s >= keys[i + 1]) i++;
        const u = clamp((s - keys[i]) / Math.max(1, keys[i + 1] - keys[i]));
        // A rest around each stop, so the shape is whole while its words are read.
        return i + smooth(.2, .8, u);
    }

    function setSegment(i) {
        if (i === segment) return;
        segment = i;
        const a = forms[i], b = forms[i + 1];
        const put = (attribute, array) => { attribute.array = array; attribute.needsUpdate = true; };
        put(A.aA, a.pos); put(A.aB, b.pos); put(A.aCA, a.cen); put(A.aCB, b.cen);
        put(A.aColA, a.col); put(A.aColB, b.col); put(A.aUvA, a.uv); put(A.aUvB, b.uv);
        put(A.aGrpA, a.grp); put(A.aGrpB, b.grp);
        U.uKindA.value = a.kindId; U.uKindB.value = b.kindId;
        U.uStyle.value = reduced ? 0 : MOVES[i % MOVES.length];
        const texA = a.image !== null ? textures[a.image] : null, texB = b.image !== null ? textures[b.image] : null;
        U.uTexA.value = texA || blank; U.uHasA.value = texA ? 1 : 0;
        U.uTexB.value = texB || blank; U.uHasB.value = texB ? 1 : 0;
    }

    const m4 = new THREE.Matrix4(), e3 = new THREE.Euler();
    /* d: how far the page has scrolled past this stop (keeps turning while it is read). extra: the twist on the way in or out. */
    function rotationOf(form, side, d, extra, out) {
        if (form.kind === 'work') {
            const [ry, rx, rz] = form.pose;
            const ps = fit.split ? 1 : .5;
            e3.set((rx + pyS * .07 - d * .12) * ps, (-side * ry + pxS * .16 + d * .42 * side) * ps + extra, rz * ps);
        } else if (form.plane) {
            e3.set(.55 + pyS * .1 + Math.sin(time * .5) * .04, side * -.65 + pxS * .2 + Math.sin(time * .32) * .08 + d * .5 + extra, side * -.28 + Math.sin(time * .42) * .05);
        } else if (form.rotZ) {
            e3.set(form.tilt + pyS * .1, pxS * .3 + d * 1.1 + extra, time * form.spin[1] + d * .9);
        } else {
            e3.set(form.tilt + time * form.spin[0] + pyS * .12 + d * .35, time * form.spin[1] + pxS * .35 + d * 1.5 + extra, 0);
        }
        out.setFromMatrix4(m4.makeRotationFromEuler(e3));
    }

    /* ---------- Frame ---------- */
    let lastT = performance.now(), started = false, drawn = 0, slowSum = 0, tick = 0;
    const ptr = new THREE.Vector3();
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(.05, (now - lastT) / 1000);
        lastT = now;

        const target = targetFromScroll();
        let moving = false;
        if (reduced) {
            const snap = Math.round(target);
            if (cur !== snap) { cur = snap; moving = true; }
        } else if (Math.abs(target - cur) > .0004) { cur += (target - cur) * damp(dt, 5.5); moving = true; }
        else if (cur !== target) { cur = target; moving = true; }

        const pointerMoving = Math.abs(pxS - px) > .002 || Math.abs(pyS - py) > .002;
        const hoverMoving = Math.abs(hoverAmt - hoverWant) > .002 || Math.abs(vel) > .003 || Math.abs(ss - scrollY) > .5;
        const idle = !reduced && !paused;
        if (intro < 1) moving = true;

        // Nothing changed and the idle spin is off: draw nothing at all.
        if (!moving && !pointerMoving && !hoverMoving && !idle && !dirty) return;
        // Only the idle spin is running: half the frames are plenty.
        tick++;
        if (!moving && !pointerMoving && !hoverMoving && !dirty && tick % 2) return;
        dirty = false;

        if (idle) time += dt * (tick % 2 ? 1 : 2);
        pxS += (px - pxS) * damp(dt, 4);
        pyS += (py - pyS) * damp(dt, 4);
        hoverAmt += (hoverWant - hoverAmt) * damp(dt, 9);
        U.uHoverAmt.value = hoverAmt;

        const i = Math.min(forms.length - 2, Math.floor(cur));
        const t = cur - i;
        setSegment(i);
        U.uT.value = t;

        // Scroll keeps the shapes turning even between the shatters.
        ss += (scrollY - ss) * (reduced ? 1 : damp(dt, 7));
        const past = (k) => (reduced ? 0 : clamp((ss - keys[k]) / H, -1.3, 1.3));
        const flip = U.uStyle.value === 4;
        const twist = reduced ? 0 : flip ? Math.PI : .95;
        const sA = sideOf(i), sB = sideOf(i + 1);
        rotationOf(forms[i], sA, past(i), t * twist, U.uRotA.value);
        rotationOf(forms[i + 1], sB, past(i + 1), (t - 1) * twist, U.uRotB.value);

        // Each shape floats a little, the plane flies a little.
        const bob = reduced ? 0 : Math.sin(time * .7) * .14;
        const fly = fit.split ? 2.6 : .9;
        const planeA = forms[i].plane ? past(i) * fly * sA : 0, planeB = forms[i + 1].plane ? past(i + 1) * fly * sB : 0;
        U.uCenterA.value.set(planeA, forms[i].y + bob, 0);
        U.uCenterB.value.set(planeB, forms[i + 1].y + bob, 0);

        // Shards lean away from the words while both stops sit on one side; crossing, they go straight over.
        U.uKickX.value = fit.split ? (sA + sB) * 1.5 : 0;
        U.uTime.value = time;
        const v = reduced ? 0 : clamp((cur - lastCur) / Math.max(dt, .008) * .35, -1, 1);
        lastCur = cur;
        vel += (v - vel) * damp(dt, 6);
        U.uVel.value = vel;

        if (intro < 1) { intro = Math.min(1, intro + dt / 2); U.uIntro.value = Math.pow(1 - intro, 2.2); }

        /* Camera walks straight down, and leans in through the shards between two stops */
        const y = lerp(forms[i].y, forms[i + 1].y, smooth(0, 1, t));
        const through = Math.sin(t * Math.PI);
        const ease = reduced ? Math.round(t) : smooth(.12, .88, t);
        const dist = fit.split ? baseDist : lerp(dists[i], dists[i + 1], ease);
        camera.position.set(pxS * .55, y - pyS * .4, dist * (1 - .1 * through));
        // The shape's place on the screen slides from one side to the other, and the camera banks into the turn.
        const sx = lerp(spotX(i), spotX(i + 1), ease);
        // Stacked: the shape stays locked to its open space as the page scrolls, and hands over to the next one.
        let sy = H / 2;
        if (!fit.split) {
            const a = fit.spots[i], b = fit.spots[i + 1], s0 = scrollY;
            sy = lerp(a.cy - s0, b.cy - s0, ease);
            wallU.uHalf.value = lerp(a.h, b.h, ease) / 2 / H;
        }
        const vy = H / 2 - sy;
        if (sx !== viewX || vy !== viewY) {
            viewX = sx; viewY = vy;
            camera.setViewOffset(W, H, W / 2 - sx, vy, W, H);
            camera.updateProjectionMatrix();
            wallU.uFocus.value.set(sx / W, 1 - sy / H);
        }
        const bank = reduced || !fit.split ? 0 : (sA - sB) * through * .05;
        camera.up.set(Math.sin(bank), Math.cos(bank), 0);
        camera.lookAt(pxS * .12, y, 0);
        camera.updateMatrixWorld();

        // Where the cursor lands on the shape's plane and on the wall.
        if (hasPointer && !reduced) {
            ptr.set(px, -py, .5).unproject(camera).sub(camera.position).normalize();
            const atShape = -camera.position.z / ptr.z, atWall = (-24 - camera.position.z) / ptr.z;
            U.uPtr.value.set(camera.position.x + ptr.x * atShape, camera.position.y + ptr.y * atShape, 0);
            wallU.uPtrW.value.set(camera.position.x + ptr.x * atWall, camera.position.y + ptr.y * atWall, 0);
        }

        U.uLight.value.set(pxS * .75 + Math.sin(time * .3) * .25, -pyS * .75 + .2, .75).normalize();

        renderer.render(scene, camera);

        if (!started) {
            started = true;
            onFirstFrame && onFirstFrame();
            setTimeout(loadImages, 200);
        }

        // Slow device: trade resolution for frames.
        slowSum += dt;
        if (++drawn === 40) {
            if (slowSum / drawn > .028 && quality > .6) {
                quality *= .82;
                renderer.setPixelRatio(pixelRatio());
                renderer.setSize(W, H, false);
                renderer.getDrawingBufferSize(wallU.uRes.value);
            }
            drawn = 0; slowSum = 0;
        }
    }

    resize();
    cur = reduced ? Math.round(targetFromScroll()) : targetFromScroll();
    lastCur = cur;
    if (scrollY > 40) { intro = 1; U.uIntro.value = 0; }
    requestAnimationFrame(frame);

    return {
        highlight,
        setPaused(v) { paused = v; dirty = true; },
        relayout() {
            requestAnimationFrame(() => { fit = focus(); applyFit(); measureStops(); });
        }
    };
}
