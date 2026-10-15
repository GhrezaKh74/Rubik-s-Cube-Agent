// Runs the teacher on N random scrambles and writes (sentence, label) pairs.
// usage: node tools/gen_data.js [N] [seed] > data/dataset.json
const C = require('../web/cube.js');
const P = require('../web/policy.js');
const N = +(process.argv[2] || 500);
let seed = +(process.argv[3] || 1394);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const counts = {};
let totalMoves = 0;
for (let i = 0; i < N; i++) {
  const r = P.solve(C.applyAlg(C.solved(), C.randomScramble(25, rnd)), 600);
  if (!r.solved) throw new Error('teacher failed');
  for (const st of r.steps) {
    const k = st.sentence + '\t' + st.action;
    counts[k] = (counts[k] || 0) + 1;
    totalMoves += C.parseAlg(P.ACTIONS[st.action].alg).length;
  }
}
const rows = Object.entries(counts).map(([k, c]) => { const [sentence, label] = k.split('\t'); return { sentence, label, count: c }; });
process.stdout.write(JSON.stringify({ solves: N, avgMoves: totalMoves / N, labels: P.ACTIONS, rows }));
