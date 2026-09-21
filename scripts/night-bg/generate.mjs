// Generates src/components/NightBrief/NightBackground.generated.css — the parts
// of the animated background that are data, not hand-written CSS:
//
//   - two tileable "plexus" meshes (glowing nodes joined by fine lines), drawn
//     as SVG data URIs. They are built on a torus, so lines that leave one edge
//     of the tile re-enter on the opposite edge and the pattern loops with no seam.
//   - two layers of soft bokeh discs
//   - two twinkling starfields
//
// Run:  npm run night-bg
// Seeded, so the same numbers always give the same sky. Change the LAYERS /
// counts below (or the seed) and re-run to get a different mesh.

import { writeFileSync } from 'node:fs';

let seed = 20260921;
const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (lo, hi) => lo + rand() * (hi - lo);
const round = (n) => Math.round(n * 10) / 10;

/** Shortest signed distance from a to b on a wrapping axis of length T. */
const wrap = (a, b, T) => {
    let d = b - a;
    if (d > T / 2) d -= T;
    if (d < -T / 2) d += T;
    return d;
};

// The tile sizes are shared with NightBackground.css through CSS variables.
const FAR = 800;
const NEAR = 1100;
const BOKEH_TILE = 1000;

const LAYERS = {
    far: {
        tile: FAR,
        count: 62,
        k: 4,
        maxLen: 170,
        lineWidth: 0.8,
        lineAlpha: [0.12, 0.34],
        glowR: [5, 8],
        hubShare: 0.14,
        hubGlowR: [16, 24],
        coreR: 1.1,
        hubCoreR: 1.9,
        nodeAlpha: [0.55, 0.95],
    },
    near: {
        tile: NEAR,
        count: 30,
        k: 4,
        maxLen: 300,
        lineWidth: 1.2,
        lineAlpha: [0.25, 0.62],
        glowR: [10, 16],
        hubShare: 0.2,
        hubGlowR: [34, 50],
        coreR: 1.8,
        hubCoreR: 3.2,
        nodeAlpha: [0.7, 1],
    },
};

function buildMesh(cfg) {
    const T = cfg.tile;

    // Points spread out with a minimum spacing, measured across the wrap.
    const minDist = (0.62 * T) / Math.sqrt(cfg.count);
    const pts = [];
    for (let tries = 0; pts.length < cfg.count && tries < cfg.count * 300; tries++) {
        const p = { x: rand() * T, y: rand() * T };
        if (pts.every((q) => Math.hypot(wrap(p.x, q.x, T), wrap(p.y, q.y, T)) >= minDist)) pts.push(p);
    }
    for (const p of pts) {
        p.hub = rand() < cfg.hubShare;
        p.glow = p.hub ? between(...cfg.hubGlowR) : between(...cfg.glowR);
        p.alpha = between(...cfg.nodeAlpha);
    }

    // Join every point to its nearest few neighbours.
    const seen = new Set();
    const edges = [];
    pts.forEach((p, i) => {
        const nearest = pts
            .map((q, j) => ({ j, d: Math.hypot(wrap(p.x, q.x, T), wrap(p.y, q.y, T)) }))
            .filter((o) => o.j !== i && o.d <= cfg.maxLen)
            .sort((a, b) => a.d - b.d)
            .slice(0, cfg.k + (rand() < 0.35 ? 1 : 0));
        for (const o of nearest) {
            const key = i < o.j ? `${i}-${o.j}` : `${o.j}-${i}`;
            if (!seen.has(key)) {
                seen.add(key);
                edges.push({ a: i, b: o.j, len: o.d });
            }
        }
    });

    // Lines, bucketed by strength so each bucket is one <path>. A line that
    // crosses the tile edge is drawn again from the far side, which is what makes
    // the tile seamless.
    const BUCKETS = 4;
    const paths = Array.from({ length: BUCKETS }, () => []);
    for (const e of edges) {
        const A = pts[e.a];
        const B = pts[e.b];
        const dx = wrap(A.x, B.x, T);
        const dy = wrap(A.y, B.y, T);
        const strength = 1 - e.len / cfg.maxLen;
        const bucket = Math.min(BUCKETS - 1, Math.floor(strength * BUCKETS));
        for (const ox of [-T, 0, T]) {
            for (const oy of [-T, 0, T]) {
                const x1 = A.x + ox;
                const y1 = A.y + oy;
                const x2 = x1 + dx;
                const y2 = y1 + dy;
                const touchesTile = Math.max(x1, x2) >= -2 && Math.min(x1, x2) <= T + 2 && Math.max(y1, y2) >= -2 && Math.min(y1, y2) <= T + 2;
                if (touchesTile) paths[bucket].push(`M${round(x1)} ${round(y1)}L${round(x2)} ${round(y2)}`);
            }
        }
    }

    const [aMin, aMax] = cfg.lineAlpha;
    const lines = paths
        .map((d, i) => (d.length ? `<path stroke-opacity='${(aMin + ((aMax - aMin) * (i + 0.5)) / BUCKETS).toFixed(2)}' d='${d.join('')}'/>` : ''))
        .join('');

    // Nodes: a soft glow underneath and a small bright core on top.
    const glows = [];
    const cores = [];
    for (const p of pts) {
        for (const ox of [-T, 0, T]) {
            for (const oy of [-T, 0, T]) {
                const cx = p.x + ox;
                const cy = p.y + oy;
                if (cx + p.glow < 0 || cx - p.glow > T || cy + p.glow < 0 || cy - p.glow > T) continue;
                glows.push(`<circle cx='${round(cx)}' cy='${round(cy)}' r='${round(p.glow)}' opacity='${p.alpha.toFixed(2)}' fill='url(#g)'/>`);
                cores.push(`<circle cx='${round(cx)}' cy='${round(cy)}' r='${p.hub ? cfg.hubCoreR : cfg.coreR}' opacity='${Math.min(1, p.alpha + 0.15).toFixed(2)}'/>`);
            }
        }
    }

    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}' viewBox='0 0 ${T} ${T}'>` +
        `<defs><radialGradient id='g'>` +
        `<stop offset='0' stop-color='rgb(175,222,255)' stop-opacity='.75'/>` +
        `<stop offset='.35' stop-color='rgb(70,150,255)' stop-opacity='.28'/>` +
        `<stop offset='1' stop-color='rgb(40,110,255)' stop-opacity='0'/>` +
        `</radialGradient></defs>` +
        `<g fill='none' stroke='rgb(125,190,255)' stroke-width='${cfg.lineWidth}' stroke-linecap='round'>${lines}</g>` +
        `<g>${glows.join('')}</g>` +
        `<g fill='rgb(215,238,255)'>${cores.join('')}</g>` +
        `</svg>`;

    // Minimal escaping for an inline url("data:...") in CSS.
    const uri = svg.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E');
    return { uri, nodes: pts.length, edges: edges.length };
}

const bokeh = (count, rMin, rMax, aMin, aMax) =>
    Array.from({ length: count }, () => {
        const x = between(4, 96).toFixed(1);
        const y = between(6, 94).toFixed(1);
        const r = Math.round(between(rMin, rMax));
        const a = between(aMin, aMax);
        return `radial-gradient(circle ${r}px at ${x}% ${y}%, rgba(120, 200, 255, ${(a * 0.55).toFixed(3)}) 0, rgba(120, 200, 255, ${(a * 0.75).toFixed(3)}) 70%, rgba(120, 200, 255, 0) 100%)`;
    }).join(',\n        ');

const stars = (count, minA, maxA) =>
    Array.from({ length: count }, () => {
        const cool = rand() < 0.4;
        return `${between(0, 100).toFixed(1)}vw ${between(0, 100).toFixed(1)}vh 0 0 rgba(${cool ? '175,210,255' : '255,255,255'}, ${between(minA, maxA).toFixed(2)})`;
    }).join(',\n        ');

const far = buildMesh(LAYERS.far);
const near = buildMesh(LAYERS.near);

const css = `/*
 * GENERATED by scripts/night-bg/generate.mjs — do not edit by hand.
 * Change the counts or colours in that file and run:  npm run night-bg
 */

.nb-bg {
    --nb-far-tile: ${FAR}px;
    --nb-near-tile: ${NEAR}px;
    --nb-bokeh-tile: ${BOKEH_TILE}px;
}

/* mesh: ${far.nodes} nodes, ${far.edges} lines per tile */
.nb-net-far {
    background-image: url("data:image/svg+xml,${far.uri}");
    background-size: var(--nb-far-tile) var(--nb-far-tile);
}

/* mesh: ${near.nodes} nodes, ${near.edges} lines per tile */
.nb-net-near {
    background-image: url("data:image/svg+xml,${near.uri}");
    background-size: var(--nb-near-tile) var(--nb-near-tile);
}

.nb-bokeh-a {
    background-image: ${bokeh(16, 8, 22, 0.16, 0.4)};
    background-size: 100% var(--nb-bokeh-tile);
}

.nb-bokeh-b {
    background-image: ${bokeh(8, 26, 46, 0.1, 0.24)};
    background-size: 100% var(--nb-bokeh-tile);
}

.nb-stars-sm {
    box-shadow: ${stars(60, 0.3, 0.75)};
}

.nb-stars-lg {
    box-shadow: ${stars(18, 0.5, 0.95)};
}
`;

const OUT = 'src/components/NightBrief/NightBackground.generated.css';
writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${(css.length / 1024).toFixed(1)} KB) — far mesh ${far.nodes} nodes / ${far.edges} lines, near mesh ${near.nodes} nodes / ${near.edges} lines`);
