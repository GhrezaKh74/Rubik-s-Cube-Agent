/* global THREE, Cube, Policy, Model, MODEL_DATA */
'use strict';

const COLORS = { U: 0xffd500, D: 0xffffff, F: 0x009b48, B: 0x0046ad, R: 0xff5800, L: 0xc41e3a };
const CSS = c => '#' + COLORS[c].toString(16).padStart(6, '0');
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const fa = x => String(x).replace(/[0-9]/g, d => FA_DIGITS[d]);
const $ = id => document.getElementById(id);

const model = new Model(MODEL_DATA);
let state = Cube.solved();
let busy = false, playing = false;
const stats = { moves: 0, steps: 0, fixes: 0, solvedCount: 0, attempts: 0, totals: [], current: 0 };

// ---------------- header stats ----------------
(function () {
  const st = MODEL_DATA.stats;
  const kb = Math.round(JSON.stringify(MODEL_DATA).length / 1024);
  $('kb').textContent = fa(kb);
  $('sAcc').textContent = fa((st.holdoutAcc * 100).toFixed(1)) + '٪';
  $('sSent').textContent = fa(st.sentences.toLocaleString('en'));
  $('sLab').textContent = fa(st.labels);
})();

// ---------------- 3D scene ----------------
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 11);
const world = new THREE.Group();
world.rotation.set(0.5, -0.65, 0);
scene.add(world);

const bodyMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
const cubies = [];
const stickers = []; // {mesh, idx}
const stickerGeo = new THREE.PlaneGeometry(0.82, 0.82);
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.home = new THREE.Vector3(x, y, z);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.97, 0.97), bodyMat));
  world.add(g);
  cubies.push(g);
}
Cube.FACELETS.forEach((f, idx) => {
  const [x, y, z] = f.pos, n = f.normal;
  const g = cubies.find(c => c.userData.home.x === x && c.userData.home.y === y && c.userData.home.z === z);
  const m = new THREE.Mesh(stickerGeo, new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide }));
  m.position.set(n[0] * 0.49, n[1] * 0.49, n[2] * 0.49);
  m.lookAt(new THREE.Vector3(n[0], n[1], n[2]).multiplyScalar(2));
  g.add(m);
  stickers.push({ mesh: m, idx });
});
function paint() {
  stickers.forEach(s => s.mesh.material.color.setHex(COLORS[state[s.idx]]));
}
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// drag to rotate the whole cube
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', e => {
  if (!drag) return;
  world.rotation.y += (e.clientX - drag.x) * 0.01;
  world.rotation.x = Math.max(-1.4, Math.min(1.4, world.rotation.x + (e.clientY - drag.y) * 0.01));
  drag = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', () => { drag = null; });

let anim = null;
function loop(t) {
  if (anim) {
    const k = Math.min(1, (t - anim.t0) / anim.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    anim.pivot.setRotationFromAxisAngle(anim.axis, anim.angle * e);
    if (k >= 1) { const done = anim.done; anim = null; done(); }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

const speed = () => +$('speed').value;
function animateMove(m) {
  return new Promise(resolve => {
    const n = Cube.FACELETS.find(f => f.face === m[0]).normal;
    const axis = new THREE.Vector3(n[0], n[1], n[2]);
    const turns = m.endsWith('2') ? 2 : 1;
    const angle = (m.endsWith("'") ? 1 : -1) * turns * Math.PI / 2;
    const pivot = new THREE.Group();
    world.add(pivot);
    const layer = cubies.filter(c => c.userData.home.dot(axis) > 0.5);
    layer.forEach(c => pivot.attach(c));
    const dur = (turns === 2 ? 1.5 : 1) * (560 - speed() * 52);
    anim = {
      pivot, axis, angle, t0: performance.now(), dur,
      done: () => {
        layer.forEach(c => { world.attach(c); c.position.copy(c.userData.home); c.rotation.set(0, 0, 0); });
        world.remove(pivot);
        state = Cube.applyMove(state, m);
        paint();
        resolve();
      },
    };
  });
}
async function playAlg(alg) {
  for (const m of Cube.parseAlg(alg)) {
    await animateMove(m);
    stats.moves++; stats.current++;
    $('tMoves').textContent = fa(stats.moves);
  }
}

// ---------------- model panel ----------------
function showDecision(d, preds, used, fixed) {
  $('stageBadge').textContent = 'مرحله ' + fa(d.stage + 1) + ' از ۷ — ' + Policy.STAGES[d.stage];
  $('sentence').textContent = d.sentence;
  const a = Policy.ACTIONS[used];
  $('choiceName').textContent = a.fa;
  $('choiceAlg').textContent = a.alg;
  $('choiceP').textContent = fixed ? '(مدل اشتباه کرد؛ معلم اصلاح کرد)' : 'اطمینان ' + fa(Math.round(preds[0].p * 100)) + '٪';
  const bars = $('bars');
  bars.innerHTML = '';
  preds.slice(0, 5).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'bar' + (i === 0 ? ' top' : '');
    row.innerHTML = `<span class="name"></span><span class="track"><span class="fill" style="width:${(p.p * 100).toFixed(1)}%"></span></span><span class="pv">${(p.p * 100).toFixed(1)}%</span>`;
    row.querySelector('.name').textContent = Policy.ACTIONS[p.label].fa;
    bars.appendChild(row);
  });
  const log = $('log');
  const line = document.createElement('div');
  line.innerHTML = `<b></b> — <span dir="ltr"></span>`;
  line.querySelector('b').textContent = fa(stats.steps) + '. ' + a.fa;
  line.querySelector('span').textContent = a.alg;
  log.prepend(line);
  while (log.childNodes.length > 200) log.removeChild(log.lastChild);
}

function setMsg(text, cls) { const m = $('msg'); m.textContent = text; m.className = cls || ''; }
function updateTiles() {
  $('tSteps').textContent = fa(stats.steps);
  $('tFix').textContent = fa(stats.fixes);
  $('tSolved').textContent = fa(stats.solvedCount) + '/' + fa(stats.attempts);
  if (stats.totals.length) {
    $('tAvg').textContent = fa(Math.round(stats.totals.reduce((a, b) => a + b, 0) / stats.totals.length));
    $('tBest').textContent = fa(Math.min(...stats.totals));
  }
}

// One decision: Persian sentence -> model -> action. The rule-based teacher only
// steps in if the model's top choice disagrees with it (counted as a fix).
async function step() {
  if (Cube.isSolved(state)) { finish(); return false; }
  const d = Policy.decide(state);
  const preds = model.predict(d.sentence);
  let used = preds[0].label, fixed = false;
  if (used !== d.action) { used = d.action; fixed = true; stats.fixes++; }
  stats.steps++;
  showDecision(d, preds, used, fixed);
  updateTiles();
  await playAlg(Policy.ACTIONS[used].alg);
  if (Cube.isSolved(state)) { finish(); return false; }
  return true;
}
let counted = true;
function finish() {
  $('stageBadge').textContent = '🏆 حل شد';
  $('sentence').textContent = 'مکعب کامل حل شد!';
  $('choiceName').textContent = 'حل شد 🏆';
  $('choiceAlg').textContent = ''; $('choiceP').textContent = '';
  if (!counted) {
    counted = true;
    stats.solvedCount++;
    stats.totals.push(stats.current);
    setMsg('مکعب با ' + fa(stats.current) + ' حرکت حل شد.', 'ok');
  }
  updateTiles();
}

function setBusy(b) {
  busy = b;
  ['bStep', 'bScramble', 'bEdit', 'bReset'].forEach(id => { $(id).disabled = b; });
  document.querySelectorAll('#moves button').forEach(x => { x.disabled = b; });
}
async function play() {
  if (busy && !playing) return;
  if (playing) { playing = false; $('bPlay').textContent = '▶ حل'; return; }
  playing = true; $('bPlay').textContent = '⏸ توقف';
  setBusy(true);
  while (playing && await step()) { /* keep going */ }
  playing = false; $('bPlay').textContent = '▶ حل';
  setBusy(false);
}
function newAttempt() {
  stats.current = 0; counted = false; stats.attempts++;
  $('log').innerHTML = '';
  updateTiles();
}
async function scramble() {
  if (busy) return;
  setBusy(true); $('bPlay').disabled = true;
  const alg = Cube.randomScramble(22);
  setMsg('بهم‌ریختن: ' + alg);
  const old = $('speed').value; $('speed').value = 10;
  for (const m of Cube.parseAlg(alg)) await animateMove(m);
  $('speed').value = old;
  newAttempt();
  const d = Policy.decide(state);
  $('stageBadge').textContent = 'مرحله ' + fa(d.stage + 1) + ' از ۷ — ' + Policy.STAGES[d.stage];
  $('sentence').textContent = d.sentence;
  setBusy(false); $('bPlay').disabled = false;
}

$('bPlay').onclick = play;
$('bStep').onclick = async () => {
  if (busy) return;
  if (counted && !Cube.isSolved(state)) newAttempt();
  setBusy(true); $('bPlay').disabled = true;
  await step();
  setBusy(false); $('bPlay').disabled = false;
};
$('bScramble').onclick = scramble;
$('bReset').onclick = () => {
  if (busy) return;
  state = Cube.solved(); paint(); counted = true;
  setMsg(''); $('stageBadge').textContent = 'آماده';
  $('sentence').textContent = 'مکعب حل شده است.'; $('bars').innerHTML = '';
  $('choiceName').textContent = '—'; $('choiceAlg').textContent = ''; $('choiceP').textContent = '';
};
// manual face turns
Cube.FACES.forEach(f => [f, f + "'", f + '2'].forEach(m => {
  const b = document.createElement('button');
  b.textContent = m;
  b.onclick = async () => {
    if (busy) return;
    setBusy(true); await animateMove(m); setBusy(false);
    if (!Cube.isSolved(state)) { counted = false; stats.current = 0; }
  };
  $('moves').appendChild(b);
}));

// ---------------- colour editor ----------------
let edit = Cube.solved();
let brush = 'U';
const NET = [[null, 'U', null, null], ['L', 'F', 'R', 'B'], [null, 'D', null, null]];
function buildPalette() {
  const p = $('palette');
  p.innerHTML = '';
  Cube.FACES.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'sw' + (c === brush ? ' sel' : '');
    sw.style.background = CSS(c);
    sw.onclick = () => { brush = c; buildPalette(); };
    p.appendChild(sw);
  });
}
function buildNet() {
  const net = $('net');
  net.innerHTML = '';
  for (let R = 0; R < 9; R++) for (let C = 0; C < 12; C++) {
    const face = NET[R / 3 | 0][C / 3 | 0];
    const d = document.createElement('div');
    if (!face) { d.className = 'empty'; net.appendChild(d); continue; }
    const idx = Cube.FACES.indexOf(face) * 9 + (R % 3) * 3 + (C % 3);
    d.className = 'cell' + (idx % 9 === 4 ? ' center' : '');
    d.style.background = CSS(edit[idx]);
    d.onclick = () => {
      if (idx % 9 === 4) return; // centres are fixed
      edit[idx] = brush; d.style.background = CSS(brush);
    };
    net.appendChild(d);
  }
}
$('bEdit').onclick = () => {
  edit = state.slice();
  buildPalette(); buildNet();
  $('editor').classList.add('open');
  $('editor').scrollIntoView({ behavior: 'smooth' });
};
$('bClose').onclick = () => $('editor').classList.remove('open');
$('bFillSolved').onclick = () => { edit = Cube.solved(); buildNet(); };
$('bFromCube').onclick = () => { edit = state.slice(); buildNet(); };
$('bApply').onclick = () => {
  if (busy) return;
  const err = Cube.validate(edit);
  if (err) { setMsg('خطا: ' + err + ' رنگ‌ها را دوباره بررسی کنید.', 'bad'); return; }
  state = edit.slice(); paint();
  $('editor').classList.remove('open');
  if (Cube.isSolved(state)) { setMsg('این مکعب از قبل حل شده است.', 'ok'); return; }
  newAttempt();
  const d = Policy.decide(state);
  $('stageBadge').textContent = 'مرحله ' + fa(d.stage + 1) + ' از ۷ — ' + Policy.STAGES[d.stage];
  $('sentence').textContent = d.sentence;
  setMsg('مکعب شما بارگذاری شد. «گام بعد» را بزنید و هر حرکت را روی مکعب واقعی تکرار کنید.', 'ok');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

paint();
resize();
requestAnimationFrame(loop);
