"""
XGBoost evaluation using same pre-train + in-season setup as TS eval.
Reads feature data exported by export-for-xgboost.ts.

Usage: python scripts/eval-xgboost.py
"""

import json
import numpy as np
import xgboost as xgb
from collections import defaultdict

# Load data
with open("docs/model-artifacts/xgboost-features.json", "r") as f:
    data = json.load(f)

print(f"Loaded {len(data)} samples, {len(data[0]['features'])} features")

# Get feature names from first sample
feature_names = list(data[0]["features"].keys())
print(f"Feature names: {len(feature_names)}")

def feat_vector(d):
    """Convert dict features to flat float array in consistent order."""
    return [float(d["features"][name]) for name in feature_names]

# Organize by race
races = defaultdict(list)
for d in data:
    key = f"{d['season']}-{d['round']}"
    races[key].append(d)

# Sort race keys chronologically
def sort_key(k):
    s, r = k.split("-")
    return (int(s), int(r))
race_keys = sorted(races.keys(), key=sort_key)

# Group by season
train_seasons = {2022, 2023, 2024}
test_season = 2025

train_race_keys = [k for k in race_keys if int(k.split("-")[0]) in train_seasons]
test_race_keys = [k for k in race_keys if int(k.split("-")[0]) == test_season]

print(f"Train races: {len(train_race_keys)} (2022-2024)")
print(f"Test races:  {len(test_race_keys)} (2025)")

# ============================================================
# Approach 1: Pre-train on 2022-2024, predict all of 2025
# ============================================================
print("\n=== Approach 1: Pretrain 2022-2024 -> Test 2025 ===")

# Collect all training data
X_train = []
y_train = []
for k in train_race_keys:
    for d in races[k]:
        X_train.append(feat_vector(d))
        y_train.append(1 if d["winner"] else 0)

X_train = np.array(X_train, dtype=np.float32)
y_train = np.array(y_train, dtype=np.float32)

# Class imbalance: ~20 drivers per race, 1 winner
scale_weight = (len(y_train) - sum(y_train)) / sum(y_train) if sum(y_train) > 0 else 1

# Train XGBoost
model = xgb.XGBClassifier(
    n_estimators=300,
    max_depth=3,
    learning_rate=0.03,
    subsample=0.7,
    colsample_bytree=0.7,
    min_child_weight=3,
    scale_pos_weight=scale_weight,
    reg_alpha=0.5,
    reg_lambda=1.0,
    objective="binary:logistic",
    eval_metric="logloss",
    random_state=42,
    verbosity=0,
)
print(f"  scale_pos_weight: {scale_weight:.1f}")
model.fit(X_train, y_train)

# Predict each 2025 race
correct = 0
total = 0
print("\nPer-race:")
for k in test_race_keys:
    race_data = races[k]
    X_race = np.array([feat_vector(d) for d in race_data], dtype=np.float32)
    probs = model.predict_proba(X_race)[:, 1]
    best_idx = np.argmax(probs)
    predicted = race_data[best_idx]["driverId"]
    actual = next(d["driverId"] for d in race_data if d["winner"])
    ok = "OK" if predicted == actual else "XX"
    if predicted == actual:
        correct += 1
    total += 1
    print(f"  {k}: actual={actual:<20} predict={predicted:<20} {ok}")

acc1 = correct / total
print(f"\nPretrain → Test: {acc1*100:.1f}% ({correct}/{total})")

# ============================================================
# Approach 2: Pre-train + In-Season Rolling (same as TS best)
# ============================================================
print("\n=== Approach 2: Pre-train + In-Season Rolling ===")

# Build base training set (2022-2024)
X_base = np.array([feat_vector(d) for k in train_race_keys for d in races[k]], dtype=np.float32)
y_base = np.array([1 if d["winner"] else 0 for k in train_race_keys for d in races[k]], dtype=np.float32)

# For each 2025 race, train on base + prior 2025 races, predict
correct2 = 0
total2 = 0
test_rounds = sorted([int(k.split("-")[1]) for k in test_race_keys])

print("\nPer-race:")
for round_num in test_rounds:
    k = f"2025-{round_num}"
    race_data = races[k]

    # Training = base + 2025 races before this round
    extra_data = [(feat_vector(d), d["winner"]) for r in range(1, round_num) for d in races.get(f"2025-{r}", [])]
    if extra_data:
        X_extra = np.array([x for x, _ in extra_data], dtype=np.float32)
        y_extra = np.array([1 if w else 0 for _, w in extra_data], dtype=np.float32)
        X_train2 = np.vstack([X_base, X_extra])
        y_train2 = np.concatenate([y_base, y_extra])
    else:
        X_train2 = X_base
        y_train2 = y_base

    # Train with more trees as data grows
    n_trees = 100 + (round_num - 1) * 2
    sw = (len(y_train2) - sum(y_train2)) / sum(y_train2) if sum(y_train2) > 0 else 1
    model2 = xgb.XGBClassifier(
        n_estimators=min(n_trees, 400),
        max_depth=3,
        learning_rate=0.03,
        subsample=0.7,
        colsample_bytree=0.7,
        min_child_weight=3,
        scale_pos_weight=sw,
        reg_alpha=0.5,
        reg_lambda=1.0,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        verbosity=0,
    )
    model2.fit(X_train2, y_train2)

    X_race = np.array([feat_vector(d) for d in race_data], dtype=np.float32)
    probs = model2.predict_proba(X_race)[:, 1]
    best_idx = np.argmax(probs)
    predicted = race_data[best_idx]["driverId"]
    actual = next(d["driverId"] for d in race_data if d["winner"])
    ok = "OK" if predicted == actual else "XX"
    if predicted == actual:
        correct2 += 1
    total2 += 1
    prob = probs[best_idx]
    print(f"  {k}: actual={actual:<20} predict={predicted:<20} {ok} ({prob:.2f})")

acc2 = correct2 / total2
print(f"\nPretrain + In-season: {acc2*100:.1f}% ({correct2}/{total2})")

# ============================================================
# Feature importance
# ============================================================
print("\n=== Top 15 Feature Importances ===")
importances = model.feature_importances_
sorted_idx = np.argsort(importances)[::-1]
for i in range(min(15, len(feature_names))):
    idx = sorted_idx[i]
    fname = feature_names[idx]
    if importances[idx] > 0.001:
        print(f"  {fname:<40}: {importances[idx]:.4f}")

# ============================================================
# Pole baseline for 2025
# ============================================================
print("\n=== Pole Baseline (2025) ===")
# We need to check if pole sitter won. This info is in the race data from the qualifying position
# For simplicity, use gridAdvantage feature: gridAdv > 0.9 means P1 or very close
pole_correct = 0
for k in test_race_keys:
    race_data = races[k]
    # Grid pole = gridAdvantage closest to 1
    best_grid = max(race_data, key=lambda d: d["features"].get("gridAdvantage", 0))
    actual_winner = next(d for d in race_data if d["winner"])
    if best_grid["driverId"] == actual_winner["driverId"]:
        pole_correct += 1
print(f"  {pole_correct/len(test_race_keys)*100:.1f}% ({pole_correct}/{len(test_race_keys)})")

print("\n=== Done ===")
