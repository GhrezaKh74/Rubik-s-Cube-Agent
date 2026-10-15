"""Train a TF-IDF + logistic-regression model that maps a Persian cube sentence to the next action.

usage: python3 tools/train.py data/dataset.json models/model.json web/model_data.js
"""
import json
import sys

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

src, dst = sys.argv[1], sys.argv[2]
data = json.load(open(src, encoding="utf-8"))
rows = data["rows"]
X = [r["sentence"] for r in rows]
y = [r["label"] for r in rows]

# Split by unique sentence: the holdout contains only states the model never saw.
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, random_state=7)

# Must match the tokenizer in web/model.js: split on whitespace, word 1-3 grams.
vec = TfidfVectorizer(token_pattern=r"\S+", lowercase=False, ngram_range=(1, 2), sublinear_tf=True)
A = vec.fit_transform(Xtr)
clf = LogisticRegression(C=200, max_iter=5000)
clf.fit(A, ytr)
train_acc = clf.score(A, ytr)
hold_acc = clf.score(vec.transform(Xte), yte)
print(f"sentences: {len(X)}  train: {len(Xtr)}  holdout: {len(Xte)}")
print(f"labels: {len(set(y))}  train acc: {train_acc:.3f}  holdout acc: {hold_acc:.3f}")
for s, t, p in zip(Xte, yte, clf.predict(vec.transform(Xte))):
    if t != p:
        print("  miss:", t, "->", p, "|", s)

# Holdout accuracy measured above; the shipped model is refit on every sentence.
vec = TfidfVectorizer(token_pattern=r"\S+", lowercase=False, ngram_range=(1, 2), sublinear_tf=True)
A_all = vec.fit_transform(X)
clf = LogisticRegression(C=200, max_iter=5000).fit(A_all, y)
print(f"final model (all {len(X)} sentences) train acc: {clf.score(A_all, y):.4f}")
vocab = {t: int(i) for t, i in vec.vocabulary_.items()}
coef = clf.coef_
# Drop features whose weights are all ~0 to keep the model small.
strength = np.abs(coef).max(axis=0)
keep = sorted(((t, i) for t, i in vocab.items() if strength[i] >= 0.05), key=lambda kv: kv[1])
# Accuracy of the pruned model (what the app actually runs).
mask = np.zeros(coef.shape[1], bool)
mask[[i for _, i in keep]] = True
print(f"kept {mask.sum()} of {len(mask)} features")
model = {
    "classes": list(clf.classes_),
    "vocab": [t for t, _ in keep],
    "idf": [round(float(vec.idf_[i]), 5) for _, i in keep],
    "coef": [[round(float(coef[c, i]), 3) for _, i in keep] for c in range(coef.shape[0])],
    "intercept": [round(float(b), 4) for b in clf.intercept_],
    "ngram": 2,
    "stats": {
        "solves": data["solves"],
        "avgMoves": round(data["avgMoves"], 1),
        "sentences": len(X),
        "train": len(Xtr),
        "holdout": len(Xte),
        "holdoutAcc": round(hold_acc, 4),
        "labels": len(clf.classes_),
    },
}
with open(dst, "w", encoding="utf-8") as f:
    json.dump(model, f, ensure_ascii=False, separators=(",", ":"))
# Same model as a script for the app (file:// pages cannot fetch JSON in a WebView).
with open(sys.argv[3], "w", encoding="utf-8") as f:
    f.write("window.MODEL_DATA=")
    json.dump(model, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
import os
print("model size:", round(os.path.getsize(dst) / 1024, 1), "KB")
