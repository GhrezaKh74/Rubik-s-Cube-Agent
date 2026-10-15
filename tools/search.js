// Finds/verifies the short algorithms used by the teacher policy.
const C = require('../web/cube.js');
const P = require('../web/policy.js');
const S = C.solved();
const crossOK = (s, except) => ['DF', 'DR', 'DB', 'DL'].filter(e => e !== except).every(e => C.pieceSolved(s, e));

// crossFlip: from DF-edge at UF with white facing front -> solved, keeping the other cross edges.
let found = null;
const moves = C.MOVES;
function dfs(s, depth, path) {
  if (found) return;
  if (depth === 0) {
    if (C.pieceSolved(s, 'DF') && crossOK(s)) found = path.slice();
    return;
  }
  for (const m of moves) {
    if (path.length && path[path.length - 1][0] === m[0]) continue;
    path.push(m); dfs(C.applyMove(s, m), depth - 1, path); path.pop();
  }
}
// state: DF edge at UF with white facing F, others solved
let start = null;
// build it explicitly by swapping stickers of the UF/DF edge positions
{
  const s = C.solved();
  const uf = C.EDGES.find(e => e.name === 'UF'), df = C.EDGES.find(e => e.name === 'DF');
  // UF currently holds U,F colours; DF holds D,F. Swap pieces with flip.
  const a = uf.idx.map(i => s[i]), b = df.idx.map(i => s[i]); // [U,F], [D,F]
  s[uf.idx[0]] = b[1]; s[uf.idx[1]] = b[0]; // U facelet gets F colour, F facelet gets D (white faces front)
  s[df.idx[0]] = a[0]; s[df.idx[1]] = a[1];
  start = s;
}
console.log('start DF edge', C.find(start, 'DF'));
for (let d = 1; d <= 6 && !found; d++) dfs(start, d, []);
console.log('crossFlip shortest:', found && found.join(' '), '| policy uses:', P.BASE.crossFlip,
  'ok:', C.pieceSolved(C.applyAlg(start, P.BASE.crossFlip), 'DF') && crossOK(C.applyAlg(start, P.BASE.crossFlip)));

// verify macros preserve what they must
const f2l = s => ['DF','DR','DB','DL','DFR','DBR','DBL','DFL','FR','BR','BL','FL'].every(p => C.pieceSolved(s, p));
for (const id of ['oll', 'sune_F', 'cycle_F', 'twistA_UBR', 'right_F', 'left_F', 'corner_F', 'extract_F']) {
  const t = C.applyAlg(S, P.ACTIONS[id].alg);
  console.log(id, 'keeps F2L:', f2l(t), 'keeps cross:', crossOK(t));
}
const c = C.applyAlg(S, P.ACTIONS.cycle_F.alg);
console.log('cycle keeps U edges:', ['UF','UR','UB','UL'].every(e => C.pieceSolved(c, e)), 'UFR fixed:', C.find(c, 'UFR').pos);
const t = C.applyAlg(S, P.ACTIONS.twistA_UBR.alg);
console.log('twist changes:', ['UFR','UFL','UBL','UBR','UF','UR','UB','UL'].filter(p => !C.pieceSolved(t, p)));
