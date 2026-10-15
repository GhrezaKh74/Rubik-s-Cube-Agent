// Rubik's cube engine: facelet model, moves, piece lookup, validation.
// Works both in the browser (window.Cube) and in Node (require).
(function (root) {
  'use strict';

  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const NORMAL = {
    U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
  };

  // Cubie position of facelet (face, row, col) in the standard unfolded net.
  function faceletPos(face, r, c) {
    switch (face) {
      case 'U': return [c - 1, 1, r - 1];
      case 'D': return [c - 1, -1, 1 - r];
      case 'F': return [c - 1, 1 - r, 1];
      case 'B': return [1 - c, 1 - r, -1];
      case 'R': return [1, 1 - r, 1 - c];
      case 'L': return [-1, 1 - r, c - 1];
    }
  }

  // FACELETS[i] = {face, pos, normal}; index = faceIdx*9 + r*3 + c
  const FACELETS = [];
  FACES.forEach(f => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      FACELETS.push({ face: f, pos: faceletPos(f, r, c), normal: NORMAL[f] });
    }
  });
  const key = (p, n) => p.join(',') + '|' + n.join(',');
  const INDEX = {};
  FACELETS.forEach((f, i) => { INDEX[key(f.pos, f.normal)] = i; });

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Rotate v by -90deg about unit axis a (clockwise seen from outside along a).
  function rotCW(v, a) {
    const c = cross(a, v), d = dot(a, v);
    return [0, 1, 2].map(i => -c[i] + a[i] * d);
  }

  // PERM[move][dest] = src
  const PERM = {};
  FACES.forEach(f => {
    const a = NORMAL[f];
    const p = new Array(54);
    FACELETS.forEach((fl, i) => {
      if (dot(fl.pos, a) === 1) {
        const j = INDEX[key(rotCW(fl.pos, a), rotCW(fl.normal, a))];
        p[j] = i;
      } else p[i] = i;
    });
    PERM[f] = p;
  });
  function compose(p, q) { return p.map((_, i) => p[q[i]]); } // apply p then q
  FACES.forEach(f => {
    PERM[f + '2'] = compose(PERM[f], PERM[f]);
    PERM[f + "'"] = compose(PERM[f + '2'], PERM[f]);
  });
  const MOVES = Object.keys(PERM);

  function solved() {
    const s = [];
    FACES.forEach(f => { for (let i = 0; i < 9; i++) s.push(f); });
    return s;
  }
  function applyMove(s, m) { const p = PERM[m]; return p.map(src => s[src]); }
  function parseAlg(alg) { return alg.trim().split(/\s+/).filter(Boolean); }
  function applyAlg(s, alg) {
    const ms = Array.isArray(alg) ? alg : parseAlg(alg);
    for (const m of ms) {
      if (!PERM[m]) throw new Error('bad move ' + m);
      s = applyMove(s, m);
    }
    return s;
  }
  function invertAlg(alg) {
    return parseAlg(alg).reverse().map(m =>
      m.endsWith("'") ? m[0] : m.endsWith('2') ? m : m + "'").join(' ');
  }
  function isSolved(s) {
    for (let i = 0; i < 54; i++) if (s[i] !== s[(i / 9 | 0) * 9 + 4]) return false;
    return true;
  }

  // Pieces: positions named by the faces they touch (e.g. "UF", "UFR").
  const ORDER = 'UDFBRL';
  function pieceList(n) {
    const map = {};
    FACELETS.forEach((fl, i) => {
      const nz = fl.pos.filter(x => x !== 0).length;
      if (nz !== n) return;
      const k = fl.pos.join(',');
      (map[k] = map[k] || []).push(i);
    });
    return Object.values(map).map(idx => {
      idx.sort((a, b) => ORDER.indexOf(FACELETS[a].face) - ORDER.indexOf(FACELETS[b].face));
      return { name: idx.map(i => FACELETS[i].face).join(''), idx };
    });
  }
  const EDGES = pieceList(2);
  const CORNERS = pieceList(3);
  const POS_BY_NAME = {};
  EDGES.concat(CORNERS).forEach(p => { POS_BY_NAME[p.name] = p; });
  const canon = name => name.split('').sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join('');

  // Find the piece with the given colours. Returns {pos, faceOf:{colour: face}}.
  function find(s, colours) {
    const want = canon(colours);
    const list = colours.length === 2 ? EDGES : CORNERS;
    for (const p of list) {
      const cols = p.idx.map(i => s[i]);
      if (canon(cols.join('')) === want) {
        const faceOf = {};
        p.idx.forEach(i => { faceOf[s[i]] = FACELETS[i].face; });
        return { pos: p.name, faceOf };
      }
    }
    return null;
  }
  function pieceSolved(s, colours) {
    const f = find(s, colours);
    return !!f && colours.split('').every(c => f.faceOf[c] === c);
  }
  function coloursAt(s, posName) {
    const p = POS_BY_NAME[posName];
    const r = {};
    p.idx.forEach(i => { r[FACELETS[i].face] = s[i]; });
    return r;
  }

  function randomScramble(n, rnd) {
    rnd = rnd || Math.random;
    const out = [];
    let last = '';
    while (out.length < n) {
      const m = MOVES[Math.floor(rnd() * MOVES.length)];
      if (m[0] === last) continue;
      out.push(m); last = m[0];
    }
    return out.join(' ');
  }

  // Validate a facelet state (colour letters = home faces of centres).
  function validate(s) {
    if (!Array.isArray(s) || s.length !== 54) return 'تعداد خانه‌ها باید ۵۴ باشد.';
    for (let f = 0; f < 6; f++) if (s[f * 9 + 4] !== FACES[f]) return 'مرکزها نباید عوض شوند.';
    const cnt = {};
    s.forEach(c => { cnt[c] = (cnt[c] || 0) + 1; });
    for (const f of FACES) if (cnt[f] !== 9) return 'از هر رنگ باید دقیقاً ۹ خانه باشد.';
    const home = solved();
    const permOf = (list) => {
      const perm = [], ori = [];
      for (const p of list) {
        const cols = p.idx.map(i => s[i]).join('');
        const j = list.findIndex(q => canon(q.idx.map(i => home[i]).join('')) === canon(cols));
        if (j < 0) return null;
        perm.push(j);
        // orientation: where the U/D colour (or F/B for E-slice edges) sits
        const refs = list[j].name;
        const refColour = refs[0];
        ori.push(p.idx.findIndex(i => s[i] === refColour));
      }
      return { perm, ori };
    };
    const e = permOf(EDGES), c = permOf(CORNERS);
    if (!e || !c) return 'یکی از قطعه‌ها رنگ‌بندی غیرممکن دارد.';
    if (new Set(e.perm).size !== 12 || new Set(c.perm).size !== 8) return 'یک قطعه دو بار تکرار شده است.';
    if (e.ori.reduce((a, b) => a + b, 0) % 2) return 'یک لبه برعکس شده (حالت غیرقابل حل).';
    const twist = c.ori.reduce((a, b) => a + b, 0);
    // corner ori via U/D sticker index in a fixed clockwise order
    let tw = 0;
    for (const p of CORNERS) {
      const k = p.idx.findIndex(i => s[i] === 'U' || s[i] === 'D');
      const order = cwOrder(p);
      tw += order.indexOf(p.idx[k]);
    }
    if (tw % 3) return 'یک گوشه چرخیده (حالت غیرقابل حل).';
    const parity = perm => {
      let p = 0; const seen = new Array(perm.length).fill(false);
      for (let i = 0; i < perm.length; i++) {
        if (seen[i]) continue;
        let j = i, len = 0;
        while (!seen[j]) { seen[j] = true; j = perm[j]; len++; }
        p += len - 1;
      }
      return p % 2;
    };
    if (parity(e.perm) !== parity(c.perm)) return 'جای دو قطعه با هم عوض شده (حالت غیرقابل حل).';
    void twist;
    return null;
  }
  // Corner facelets ordered: U/D sticker first, then clockwise around the corner.
  function cwOrder(p) {
    const first = p.idx.find(i => 'UD'.includes(FACELETS[i].face));
    const rest = p.idx.filter(i => i !== first);
    const n = FACELETS[first].normal;
    const pos = FACELETS[first].pos;
    // clockwise seen from outside the corner: next = rotate around corner diagonal
    const diag = pos;
    const a = FACELETS[rest[0]].normal, b = FACELETS[rest[1]].normal;
    const tp = dot(cross(n, a), diag);
    void b;
    return tp < 0 ? [first, rest[0], rest[1]] : [first, rest[1], rest[0]];
  }

  const api = {
    FACES, FACELETS, MOVES, PERM, EDGES, CORNERS,
    solved, applyMove, applyAlg, parseAlg, invertAlg, isSolved,
    find, pieceSolved, coloursAt, randomScramble, validate,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cube = api;
})(typeof window !== 'undefined' ? window : globalThis);
