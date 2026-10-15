// Colour scanner: reads the 9 stickers of each face from the camera (or a photo)
// and turns the 54 samples into a facelet state.
(function (root) {
  'use strict';

  // Scan order and how to hold the cube for each face (matches the editor's net layout).
  const ORDER = [
    { face: 'F', fa: 'سبز', how: 'مرکز سبز رو به دوربین، زرد بالا' },
    { face: 'R', fa: 'نارنجی', how: 'مکعب را یک ربع بچرخانید: مرکز نارنجی رو به دوربین، زرد بالا' },
    { face: 'B', fa: 'آبی', how: 'باز یک ربع: مرکز آبی رو به دوربین، زرد بالا' },
    { face: 'L', fa: 'قرمز', how: 'باز یک ربع: مرکز قرمز رو به دوربین، زرد بالا' },
    { face: 'U', fa: 'زرد', how: 'سبز را جلو بگیرید و بالا را به سمت دوربین خم کنید: مرکز زرد رو به دوربین، آبی بالای تصویر' },
    { face: 'D', fa: 'سفید', how: 'سبز را جلو بگیرید و پایین را به سمت دوربین خم کنید: مرکز سفید رو به دوربین، سبز بالای تصویر' },
  ];
  const GRID = 0.75; // the grid covers 75% of the square view

  // Average colour of the middle of each of the 9 cells. The view shows the
  // centred square of the source (object-fit: cover), so sample the same square.
  function sample(src, w, h) {
    const side = Math.min(w, h), size = 240;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    const d = g.getImageData(0, 0, size, size).data;
    const start = size * (1 - GRID) / 2, cell = size * GRID / 3, pad = cell * 0.3;
    const out = [];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      let R = 0, G = 0, B = 0, n = 0;
      const x0 = Math.round(start + k * cell + pad), x1 = Math.round(start + (k + 1) * cell - pad);
      const y0 = Math.round(start + r * cell + pad), y1 = Math.round(start + (r + 1) * cell - pad);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * size + x) * 4;
        R += d[i]; G += d[i + 1]; B += d[i + 2]; n++;
      }
      out.push([R / n, G / n, B / n]);
    }
    return out;
  }

  function toLab([r, g, b]) {
    const lin = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
    const R = lin(r), G = lin(g), B = lin(b);
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
    const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
    const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  }

  // samples: {face: [9 rgb]}. Each sticker gets the colour of the nearest centre,
  // with every colour used exactly 9 times (greedy on the smallest distances).
  function classify(samples) {
    const faces = ORDER.map(o => o.face);
    const ref = {};
    faces.forEach(f => { ref[f] = toLab(samples[f][4]); });
    const dist = (a, b) => 0.4 * (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    const pairs = [];
    faces.forEach(f => samples[f].forEach((rgb, i) => {
      if (i === 4) return;
      const lab = toLab(rgb);
      faces.forEach(c => pairs.push({ f, i, c, d: dist(lab, ref[c]) }));
    }));
    pairs.sort((a, b) => a.d - b.d);
    const left = {}, done = {};
    faces.forEach(c => { left[c] = 8; });
    const out = {};
    faces.forEach(f => { out[f] = new Array(9).fill(null); out[f][4] = f; });
    for (const p of pairs) {
      const k = p.f + p.i;
      if (done[k] || !left[p.c]) continue;
      done[k] = true; left[p.c]--; out[p.f][p.i] = p.c;
    }
    // facelet order of the engine: U R F D L B
    const state = [];
    ['U', 'R', 'F', 'D', 'L', 'B'].forEach(f => state.push(...out[f]));
    return state;
  }

  const api = { ORDER, GRID, sample, classify, toLab };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scan = api;
})(typeof window !== 'undefined' ? window : globalThis);
