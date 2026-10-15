// TF-IDF + logistic regression inference (mirrors tools/train.py).
(function (root) {
  'use strict';
  function Model(m) {
    this.m = m;
    this.index = new Map(m.vocab.map((t, i) => [t, i]));
  }
  Model.prototype.features = function (sentence) {
    const words = sentence.split(/\s+/).filter(Boolean);
    const tf = new Map();
    for (let n = 1; n <= this.m.ngram; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const j = this.index.get(words.slice(i, i + n).join(' '));
        if (j !== undefined) tf.set(j, (tf.get(j) || 0) + 1);
      }
    }
    const x = new Map();
    let norm = 0;
    tf.forEach((c, j) => { const v = (1 + Math.log(c)) * this.m.idf[j]; x.set(j, v); norm += v * v; });
    norm = Math.sqrt(norm) || 1;
    x.forEach((v, j) => x.set(j, v / norm));
    return x;
  };
  // Returns [{label, p}] sorted by probability.
  Model.prototype.predict = function (sentence) {
    const x = this.features(sentence);
    const scores = this.m.coef.map((w, c) => {
      let s = this.m.intercept[c];
      x.forEach((v, j) => { s += w[j] * v; });
      return s;
    });
    const mx = Math.max(...scores);
    const e = scores.map(s => Math.exp(s - mx));
    const z = e.reduce((a, b) => a + b, 0);
    return this.m.classes.map((label, c) => ({ label, p: e[c] / z })).sort((a, b) => b.p - a.p);
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Model;
  else root.Model = Model;
})(typeof window !== 'undefined' ? window : globalThis);
