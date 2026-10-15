// Teacher policy: turns a cube state into a Persian sentence + the next action.
// The policy is stateless: the action depends only on what the sentence says.
(function (root) {
  'use strict';
  const Cube = (typeof module !== 'undefined' && module.exports) ? require('./cube.js') : root.Cube;

  // White (D) on the bottom, yellow (U) on top.
  const SIDES = ['F', 'R', 'B', 'L']; // right(X) = next
  const right = x => SIDES[(SIDES.indexOf(x) + 1) % 4];
  const left = x => SIDES[(SIDES.indexOf(x) + 3) % 4];
  const opp = x => SIDES[(SIDES.indexOf(x) + 2) % 4];
  const ORDER = 'UDFBRL';
  const ctx = (text, title) => text ? ` ${title}: ${text}.` : ` ${title}: همه سر جایشان.`;
  const canon = s => s.split('').sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join('');

  const FACE_FA = { U: 'بالا', D: 'پایین', F: 'جلو', B: 'پشت', R: 'راست', L: 'چپ' };
  const COLOUR_FA = { U: 'زرد', D: 'سفید', F: 'سبز', B: 'آبی', R: 'نارنجی', L: 'قرمز' };
  const posFa = p => p.split('').map(c => FACE_FA[c]).join('-');
  const colFa = p => p.split('').map(c => COLOUR_FA[c]).join('-');
  const NUM_FA = ['۰', '۱', '۲', '۳', '۴'];

  // Re-express an algorithm written with F as front for another front face.
  function conj(alg, front) {
    const k = SIDES.indexOf(front);
    const map = { U: 'U', D: 'D' };
    SIDES.forEach((s, i) => { map[s] = SIDES[(i + k) % 4]; });
    return Cube.parseAlg(alg).map(m => map[m[0]] + m.slice(1)).join(' ');
  }

  // ---- action catalogue (labels) ----
  const ACTIONS = {};
  const add = (id, fa, alg) => { ACTIONS[id] = { id, fa, alg }; };
  add('U', 'بالا ساعتگرد', 'U');
  add("U'", 'بالا پادساعتگرد', "U'");
  add('U2', 'بالا دوتو', 'U2');
  SIDES.forEach(x => add(x + '2', FACE_FA[x] + ' دوتو', x + '2'));
  // Algorithms found by search (see tools/search.js), written for front = F.
  const BASE = {
    crossFlip: "U L F' L'",               // edge at UF, white facing front -> DF
    extract: "R U R'",                      // edge in FR slot -> U layer (keeps cross)
    cornerInsert: "R U R' U'",
    edgeRight: "U R U' R' U' F' U F",
    edgeLeft: "U' L' U L U F U' F'",
    oll: "F R U R' U' F'",
    sune: "R U R' U R U2 R' U",
    cycle: "U R U' L' U R' U' L",
    twist: "R' D' R D R' D' R D",
  };
  SIDES.forEach(x => {
    const slot = posFa(canon(x + right(x)).replace(/[UD]/g, ''));
    add('extract_' + x, 'بیرون‌آوردن لبه از جای ' + slot, conj(BASE.extract, x));
    add('flip_' + x, 'جاانداختن وارونه لبه در ' + FACE_FA[x], conj(BASE.crossFlip, x));
    add('corner_' + x, 'درج گوشه ' + slot, conj(BASE.cornerInsert, x));
    add('right_' + x, 'درج لبه از ' + FACE_FA[x] + ' به راست', conj(BASE.edgeRight, x));
    add('left_' + x, 'درج لبه از ' + FACE_FA[x] + ' به چپ', conj(BASE.edgeLeft, x));
    add('sune_' + x, 'سون از ' + FACE_FA[x], conj(BASE.sune, x));
    add('cycle_' + x, 'چرخه گوشه‌ها با ثابت ' + slot, conj(BASE.cycle, x));
  });
  add('oll', 'فرمول صلیب زرد', BASE.oll);
  const tw = BASE.twist, twi = Cube.invertAlg(BASE.twist);
  const PARTNER = { "U": 'UBR', 'U2': 'UBL', "U'": 'UFL' };
  Object.keys(PARTNER).forEach(u => {
    const inv = u === 'U2' ? 'U2' : (u === 'U' ? "U'" : 'U');
    const pf = posFa(PARTNER[u]);
    add('twistA_' + PARTNER[u], 'چرخش گوشه جلو-راست (نوع ۱) با همراه ' + pf, `${tw} ${u} ${twi} ${inv}`);
    add('twistB_' + PARTNER[u], 'چرخش گوشه جلو-راست (نوع ۲) با همراه ' + pf, `${twi} ${u} ${tw} ${inv}`);
  });

  const uTurn = k => ['', 'U', 'U2', "U'"][((k % 4) + 4) % 4];
  const OFFSET_FA = { U: 'یک ربع ساعتگرد', 'U2': 'نیم دور', "U'": 'یک ربع پادساعتگرد' };

  const STAGES = ['صلیب سفید', 'گوشه‌های سفید', 'لایه میانی', 'صلیب زرد', 'لبه‌های زرد', 'جای گوشه‌های زرد', 'جهت گوشه‌های زرد', 'تمام'];

  // ---- helpers for the last layer ----
  const uEdgeMatches = s => SIDES.filter(x => Cube.coloursAt(s, canon('U' + x))[x] === x);
  function edgesAlignTurn(s) {
    for (let k = 0; k < 4; k++) {
      const t = k ? Cube.applyAlg(s, uTurn(k)) : s;
      if (uEdgeMatches(t).length === 4) return k;
    }
    return -1;
  }
  const uCornerOf = x => canon('U' + x + right(x));
  function cornerInPlace(s, x) {
    const p = uCornerOf(x);
    const cols = Object.values(Cube.coloursAt(s, p)).join('');
    return canon(cols) === p;
  }
  // twist of a U-layer corner: 0 = yellow up, 1 / 2 = yellow on a side
  function yellowFace(s, p) {
    const c = Cube.coloursAt(s, p);
    return Object.keys(c).find(f => c[f] === 'U');
  }
  function twistOf(s, p) {
    const f = yellowFace(s, p);
    if (f === 'U') return 0;
    // the side face that comes first clockwise around the corner from U
    const sides = p.replace('U', '').split('');
    const a = sides[0], b = sides[1];
    const cwFirst = right(a) === b ? b : a; // seen from above
    return f === cwFirst ? 1 : 2;
  }

  const n = k => NUM_FA[k];
  // Extra context (other pieces of the same kind). It does not change the action,
  // so the model has to learn which parts of the sentence matter.
  function context(s, cols, skip) {
    return cols.filter(c => c !== skip && !Cube.pieceSolved(s, c))
      .map(c => `${colFa(c)} در ${posFa(Cube.find(s, c).pos)}`).join('، ');
  }
  function topContext(s) {
    return SIDES.map(x => `لبه ${FACE_FA[x]} ${COLOUR_FA[Object.values(Cube.coloursAt(s, canon('U' + x))).find(c => c !== 'U') || 'U']}`).join('، ');
  }

  // ---- main policy ----
  // Returns {stage, sentence, action} ; action === null when solved.
  function decide(s) {
    // Stage 1: white cross
    const crossDone = SIDES.filter(x => Cube.pieceSolved(s, canon('D' + x)));
    for (const x of SIDES) {
      const col = canon('D' + x);
      if (Cube.pieceSolved(s, col)) continue;
      const p = Cube.find(s, col);
      const w = p.faceOf.D;
      let where, action, extra = '';
      if (p.pos.includes('D')) {
        const y = p.pos.replace('D', '');
        where = 'در لایه پایین، جای ' + posFa(p.pos);
        extra = y === x ? 'لبه سر جای خودش است ولی برعکس است' : 'لبه در جای اشتباه لایه پایین است';
        action = y + '2';
      } else if (p.pos.includes('U')) {
        const y = p.pos.replace('U', '');
        const k = SIDES.indexOf(y) - SIDES.indexOf(x);
        where = 'در لایه بالا، جای ' + posFa(p.pos);
        if (k === 0) {
          extra = 'لبه درست بالای جای خودش است';
          action = w === 'U' ? x + '2' : 'flip_' + x;
        } else {
          extra = 'لبه ' + OFFSET_FA[uTurn(k)] + ' با بالای جای خودش فاصله دارد';
          action = uTurn(k);
        }
      } else {
        where = 'در لایه میانی، جای ' + posFa(p.pos);
        extra = 'لبه باید از لایه میانی بیرون بیاید';
        const a = SIDES.find(z => canon(z + right(z)) === p.pos);
        action = 'extract_' + a;
      }
      const sentence = `مرحله ${STAGES[0]}. ${n(crossDone.length)} لبه از ۴ لبه صلیب درست است. ` +
        `لبه هدف ${colFa(col)} است که باید به جای ${posFa(col)} برود. ` +
        `این لبه ${where} است و رنگ سفید آن رو به ${FACE_FA[w]} است. ${extra}.` +
        ctx(context(s, SIDES.map(z => canon('D' + z)), col), 'لبه‌های سفید دیگر');
      return { stage: 0, sentence, action };
    }

    // Stage 2: white corners
    const cornerTargets = SIDES.map(x => ({ x, col: canon('D' + x + right(x)) }));
    const cornersDone = cornerTargets.filter(t => Cube.pieceSolved(s, t.col)).length;
    for (const t of cornerTargets) {
      if (Cube.pieceSolved(s, t.col)) continue;
      const p = Cube.find(s, t.col);
      const w = p.faceOf.D;
      const slotX = SIDES.find(z => canon('D' + z + right(z)) === canon(p.pos.replace('U', 'D')));
      let where, extra, action;
      if (p.pos.includes('D')) {
        where = 'در لایه پایین، جای ' + posFa(p.pos);
        extra = slotX === t.x ? 'گوشه سر جای خودش است ولی چرخیده است' : 'گوشه در جای اشتباه لایه پایین است';
        action = 'corner_' + slotX;
      } else {
        where = 'در لایه بالا، جای ' + posFa(p.pos);
        const k = SIDES.indexOf(slotX) - SIDES.indexOf(t.x);
        if (k === 0) { extra = 'گوشه درست بالای جای خودش است'; action = 'corner_' + t.x; }
        else { extra = 'گوشه ' + OFFSET_FA[uTurn(k)] + ' با بالای جای خودش فاصله دارد'; action = uTurn(k); }
      }
      const sentence = `مرحله ${STAGES[1]}. صلیب سفید کامل است و ${n(cornersDone)} گوشه از ۴ گوشه سفید درست است. ` +
        `گوشه هدف ${colFa(t.col)} است که باید به جای ${posFa(t.col)} برود. ` +
        `این گوشه ${where} است و رنگ سفید آن رو به ${FACE_FA[w]} است. ${extra}.` +
        ctx(context(s, cornerTargets.map(z => z.col), t.col), 'گوشه‌های سفید دیگر');
      return { stage: 1, sentence, action };
    }

    // Stage 3: middle layer edges
    const midTargets = SIDES.map(x => ({ x, col: canon(x + right(x)) }));
    const midDone = midTargets.filter(t => Cube.pieceSolved(s, t.col)).length;
    for (const t of midTargets) {
      if (Cube.pieceSolved(s, t.col)) continue;
      const p = Cube.find(s, t.col);
      let where, extra, action, look;
      if (!p.pos.includes('U')) {
        const a = SIDES.find(z => canon(z + right(z)) === p.pos);
        where = 'در لایه میانی، جای ' + posFa(p.pos);
        extra = a === t.x ? 'لبه سر جای خودش است ولی برعکس است' : 'لبه در جای اشتباه لایه میانی است';
        look = '';
        action = 'right_' + a;
      } else {
        const y = p.pos.replace('U', '');
        const c = Object.keys(p.faceOf).find(k => p.faceOf[k] === y); // side colour
        const d = Object.keys(p.faceOf).find(k => p.faceOf[k] === 'U');
        where = 'در لایه بالا، جای ' + posFa(p.pos);
        look = ` رنگ کناری آن ${COLOUR_FA[c]} و رنگ رویی آن ${COLOUR_FA[d]} است.`;
        const k = SIDES.indexOf(y) - SIDES.indexOf(c);
        if (k !== 0) {
          extra = 'رنگ کناری ' + OFFSET_FA[uTurn(k)] + ' با مرکز هم‌رنگش فاصله دارد';
          action = uTurn(k);
        } else if (d === right(c)) {
          extra = 'رنگ کناری با مرکز جور است و لبه باید به سمت راست برود';
          action = 'right_' + c;
        } else {
          extra = 'رنگ کناری با مرکز جور است و لبه باید به سمت چپ برود';
          action = 'left_' + c;
        }
      }
      const sentence = `مرحله ${STAGES[2]}. دو لایه پایین تا حدی آماده است و ${n(midDone)} لبه از ۴ لبه میانی درست است. ` +
        `لبه هدف ${colFa(t.col)} است که باید به جای ${posFa(t.col)} برود. ` +
        `این لبه ${where} است.${look} ${extra}.` +
        ctx(context(s, midTargets.map(z => z.col), t.col), 'لبه‌های میانی دیگر');
      return { stage: 2, sentence, action };
    }

    // Stage 4: yellow cross (edge orientation)
    const up = SIDES.filter(x => Cube.coloursAt(s, canon('U' + x)).U === 'U');
    if (up.length < 4) {
      const list = up.length ? up.map(x => FACE_FA[x]).join(' و ') : 'هیچ‌کدام';
      let shape, action;
      if (up.length === 0) { shape = 'فقط نقطه وسط زرد است'; action = 'oll'; }
      else if (up.length === 2 && opp(up[0]) === up[1]) {
        if (up.includes('L')) { shape = 'یک خط افقی زرد از چپ به راست است'; action = 'oll'; }
        else { shape = 'یک خط عمودی زرد از جلو به پشت است'; action = 'U'; }
      } else {
        // L shape: want yellow at back and left
        const has = (a, b) => up.includes(a) && up.includes(b);
        if (has('B', 'L')) { shape = 'یک شکل L زرد در پشت و چپ است'; action = 'oll'; }
        else if (has('L', 'F')) { shape = 'یک شکل L زرد در چپ و جلو است'; action = 'U'; }
        else if (has('F', 'R')) { shape = 'یک شکل L زرد در جلو و راست است'; action = 'U2'; }
        else { shape = 'یک شکل L زرد در راست و پشت است'; action = "U'"; }
      }
      const sentence = `مرحله ${STAGES[3]}. دو لایه پایین کامل است. ${n(up.length)} لبه بالا زردشان رو به بالاست: ${list}. ${shape}. رنگ کناری لبه‌ها: ${topContext(s)}.`;
      return { stage: 3, sentence, action };
    }

    // Stage 5: permute yellow edges
    if (edgesAlignTurn(s) < 0) {
      const m = uEdgeMatches(s);
      const adjNow = m.length === 2 && opp(m[0]) !== m[1];
      let action, extra;
      if (adjNow) {
        const x = SIDES.find(z => m.includes(opp(z)) && m.includes(right(z)));
        action = 'sune_' + x;
        extra = `دو لبه کنار هم جورند، پس ${FACE_FA[x]} را جلو فرض می‌کنیم`;
      } else {
        let best = -1;
        for (let k = 1; k < 4 && best < 0; k++) {
          const mm = uEdgeMatches(Cube.applyAlg(s, uTurn(k)));
          if (mm.length === 2 && opp(mm[0]) !== mm[1]) best = k;
        }
        if (best > 0) { action = uTurn(best); extra = `با ${OFFSET_FA[action]} چرخاندن بالا دو لبه کنار هم جور می‌شوند`; }
        else { action = 'sune_F'; extra = 'هیچ دو لبه کنار همی جور نمی‌شوند'; }
      }
      const list = m.length ? m.map(x => FACE_FA[x]).join(' و ') : 'هیچ‌کدام';
      const sentence = `مرحله ${STAGES[4]}. صلیب زرد کامل است. ${n(m.length)} لبه زرد با مرکز کناری جورند: ${list}. ${extra}. رنگ کناری لبه‌ها: ${topContext(s)}.`;
      return { stage: 4, sentence, action };
    }

    // Stage 6: place yellow corners
    const k0 = edgesAlignTurn(s);
    const aligned = k0 === 0 ? s : Cube.applyAlg(s, uTurn(k0));
    const inPlace = SIDES.filter(x => cornerInPlace(aligned, x));
    if (inPlace.length < 4) {
      let action, extra;
      if (k0 !== 0) {
        action = uTurn(k0);
        extra = `لبه‌های زرد ${OFFSET_FA[action]} با مرکزها فاصله دارند و اول باید جور شوند`;
      } else if (inPlace.length === 1) {
        action = 'cycle_' + inPlace[0];
        extra = `فقط گوشه ${posFa(uCornerOf(inPlace[0]))} سر جایش است`;
      } else {
        action = 'cycle_F';
        extra = 'هیچ گوشه‌ای سر جایش نیست';
      }
      const sentence = `مرحله ${STAGES[5]}. صلیب زرد و لبه‌ها آماده‌اند. ${n(inPlace.length)} گوشه زرد سر جایشان هستند. ${extra}.`;
      return { stage: 5, sentence, action };
    }

    // Stage 7: orient yellow corners, then align the top layer
    const corners = ['UFR', 'UFL', 'UBL', 'UBR'].map(canon);
    const tw = corners.map(p => twistOf(s, p));
    const bad = tw.filter(t => t).length;
    const fr = canon('UFR');
    const describe = corners.map((p, i) => `گوشه ${posFa(p)} زردش رو به ${FACE_FA[yellowFace(s, p)]}`).join('، ');
    let action, extra;
    if (bad === 0) {
      if (Cube.isSolved(s)) return { stage: 7, sentence: 'مکعب کامل حل شده است.', action: null };
      action = uTurn(k0);
      extra = `همه گوشه‌ها درست‌اند و فقط لایه بالا ${OFFSET_FA[action]} جابه‌جاست`;
    } else if (tw[0] === 0) {
      // bring a twisted corner to front-right
      const iBR = corners.indexOf(canon('UBR')), iFL = corners.indexOf(canon('UFL'));
      action = tw[iBR] ? 'U' : tw[iFL] ? "U'" : 'U2';
      extra = 'گوشه جلو-راست درست است، پس یک گوشه چرخیده را به جلو-راست می‌آوریم';
    } else {
      // try every twist macro; keep the one that fixes front-right and leaves fewest twisted corners
      let best = null;
      for (const id of Object.keys(ACTIONS).filter(a => a.startsWith('twist'))) {
        const t = Cube.applyAlg(s, ACTIONS[id].alg);
        if (twistOf(t, fr)) continue;
        const left = corners.filter(p => twistOf(t, p)).length;
        if (!best || left < best.left) best = { id, left };
      }
      action = best.id;
      const rel = corners.slice(1).map(p => {
        const t = twistOf(s, p);
        return `${posFa(p)} ${t === 0 ? 'درست' : t === tw[0] ? 'هم‌جهت' : 'برعکس'}`;
      }).join('، ');
      extra = `گوشه جلو-راست نوع ${n(tw[0])} چرخیده است؛ نسبت به آن: ${rel}`;
    }
    const sentence = `مرحله ${STAGES[6]}. جای همه گوشه‌ها درست است و ${n(bad)} گوشه چرخیده‌اند. ${describe}. ${extra}.`;
    return { stage: 6, sentence, action };
  }

  // Run the teacher from a state; returns list of steps.
  function solve(s, maxSteps) {
    maxSteps = maxSteps || 400;
    const steps = [];
    for (let i = 0; i < maxSteps; i++) {
      const d = decide(s);
      if (!d.action) return { steps, solved: true, state: s };
      steps.push(d);
      s = Cube.applyAlg(s, ACTIONS[d.action].alg);
    }
    return { steps, solved: false, state: s };
  }

  const api = { ACTIONS, STAGES, decide, solve, conj, BASE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Policy = api;
})(typeof window !== 'undefined' ? window : globalThis);
