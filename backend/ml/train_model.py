"""
train_model.py — ML model training script for Edu-Mitra.

Loads the student performance dataset, engineers features,
trains an XGBoost classifier to predict risk level (Low/Medium/High),
and saves the trained model + feature metadata.

Run this script once before starting the server:
    python backend/ml/train_model.py

Algorithm: XGBoost Classifier (with fallback to RandomForest)
Labels: Low (0), Medium (1), High (2)
"""

import os
import sys
import warnings
import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_PATH = os.path.join(BASE_DIR, "student_performance_enhanced.xlsx")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
META_PATH = os.path.join(os.path.dirname(__file__), "model_meta.pkl")

# ── Feature columns used for prediction ───────────────────────────────────────
FEATURE_COLS = [
    "attendance_pct",
    "assignment_avg",
    "midterm_score",
    "final_score",
    "quiz_avg",
]

FEATURE_LABELS = {
    "attendance_pct": "Attendance %",
    "assignment_avg": "Assignment Score",
    "midterm_score": "Midterm Score",
    "final_score": "Final Exam Score",
    "quiz_avg": "Quiz Average",
}

# ── Risk Label Thresholds ─────────────────────────────────────────────────────
# If dataset doesn't have a risk column, we derive it from composite score.
# Composite = 0.25*attendance + 0.20*assignment + 0.25*midterm + 0.20*final + 0.10*quiz

def compute_composite(df: pd.DataFrame) -> pd.Series:
    return (
        0.25 * df["attendance_pct"] +
        0.20 * df["assignment_avg"] +
        0.25 * df["midterm_score"] +
        0.20 * df["final_score"] +
        0.10 * df["quiz_avg"]
    )


def label_risk(composite: float) -> int:
    """Map composite score to risk label: 0=Low, 1=Medium, 2=High."""
    if composite >= 65:
        return 0   # Low risk
    elif composite >= 45:
        return 1   # Medium risk
    else:
        return 2   # High risk


RISK_NAMES = {0: "Low", 1: "Medium", 2: "High"}

# ── Data Loading & Cleaning ──────────────────────────────────────────────────

def load_and_prepare(path: str) -> pd.DataFrame:
    """Load Excel dataset and map columns to our feature schema."""
    print(f"[Training] Loading dataset from: {path}")
    df = pd.read_excel(path)
    print(f"[Training] Raw shape: {df.shape}")
    print(f"[Training] Columns: {list(df.columns)}")

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # ── Column Mapping ──────────────────────────────────────────────────────
    # Auto-detect common column name variants and map to our schema.
    col_map = {}

    def find_col(variants):
        """Return the first matching column name from the dataframe."""
        for v in variants:
            for c in df.columns:
                if v in c:
                    return c
        return None

    attendance_col = find_col(["attendance"])
    assignment_col = find_col(["assignment", "assign"])
    midterm_col    = find_col(["midterm", "mid_term", "mid-term", "mid"])
    final_col      = find_col(["final", "final_exam"])
    quiz_col       = find_col(["quiz"])
    risk_col       = find_col(["risk", "label", "grade", "performance"])

    # Build a clean working dataframe
    clean = pd.DataFrame()

    def safe_get(col, default=50.0):
        if col and col in df.columns:
            return pd.to_numeric(df[col], errors="coerce").fillna(default)
        return pd.Series([default] * len(df))

    clean["attendance_pct"]  = safe_get(attendance_col)
    clean["assignment_avg"]  = safe_get(assignment_col)
    clean["midterm_score"]   = safe_get(midterm_col)
    clean["final_score"]     = safe_get(final_col)
    clean["quiz_avg"]        = safe_get(quiz_col)

    # Clip all features to [0, 100]
    for col in FEATURE_COLS:
        clean[col] = clean[col].clip(0, 100)

    # Derive risk label from composite score (or use existing if present)
    if risk_col and risk_col in df.columns:
        raw_risk = df[risk_col].astype(str).str.strip().str.lower()
        # Map text labels if present
        label_map = {
            "low": 0, "medium": 1, "high": 2,
            "0": 0, "1": 1, "2": 2,
            "a": 0, "b": 0, "c": 1, "d": 2, "f": 2,
            "pass": 0, "fail": 2,
        }
        mapped = raw_risk.map(label_map)
        if mapped.notna().sum() > len(df) * 0.5:
            clean["risk_label"] = mapped.fillna(
                compute_composite(clean).apply(label_risk)
            ).astype(int)
        else:
            clean["risk_label"] = compute_composite(clean).apply(label_risk)
    else:
        clean["risk_label"] = compute_composite(clean).apply(label_risk)

    print(f"[Training] Risk distribution:\n{clean['risk_label'].map(RISK_NAMES).value_counts()}")
    return clean


# ── Model Training ────────────────────────────────────────────────────────────

def train(df: pd.DataFrame):
    """Train XGBoost classifier and save model artifacts."""
    from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline
    from sklearn.metrics import classification_report, accuracy_score

    X = df[FEATURE_COLS].values
    y = df["risk_label"].values

    # Train/test split (stratified to preserve class balance)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Try XGBoost first, fall back to RandomForest
    try:
        from xgboost import XGBClassifier
        clf = XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            use_label_encoder=False,
            eval_metric="mlogloss",
            random_state=42,
        )
        model_name = "XGBoost"
        print("[Training] Using XGBoost classifier")
    except ImportError:
        from sklearn.ensemble import RandomForestClassifier
        clf = RandomForestClassifier(
            n_estimators=300,
            max_depth=10,
            random_state=42,
            class_weight="balanced",
        )
        model_name = "RandomForest"
        print("[Training] XGBoost not available, using RandomForest")

    # Build pipeline: scale → classify
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", clf),
    ])

    # Cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(pipeline, X, y, cv=cv, scoring="accuracy")
    print(f"[Training] 5-Fold CV Accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Final training on full train set
    pipeline.fit(X_train, y_train)

    # Evaluation on test set
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"[Training] Test Accuracy: {acc:.4f}")
    print(f"[Training] Classification Report:\n{classification_report(y_test, y_pred, target_names=['Low', 'Medium', 'High'])}")

    # ── Feature Importance ──────────────────────────────────────────────────
    try:
        feature_importances = pipeline.named_steps["clf"].feature_importances_
    except AttributeError:
        feature_importances = np.ones(len(FEATURE_COLS)) / len(FEATURE_COLS)

    importance_dict = dict(zip(FEATURE_COLS, feature_importances.tolist()))
    print(f"[Training] Feature Importances: {importance_dict}")

    # ── Save Artifacts ──────────────────────────────────────────────────────
    joblib.dump(pipeline, MODEL_PATH)
    joblib.dump({
        "feature_cols": FEATURE_COLS,
        "feature_labels": FEATURE_LABELS,
        "feature_importances": importance_dict,
        "risk_names": RISK_NAMES,
        "model_name": model_name,
        "test_accuracy": acc,
        "cv_accuracy_mean": float(cv_scores.mean()),
    }, META_PATH)

    print(f"[Training] ✅ Model saved → {MODEL_PATH}")
    print(f"[Training] ✅ Metadata saved → {META_PATH}")
    return pipeline, importance_dict


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not os.path.exists(DATA_PATH):
        print(f"[ERROR] Dataset not found at: {DATA_PATH}")
        sys.exit(1)

    df = load_and_prepare(DATA_PATH)
    pipeline, importance = train(df)
    print("\n[Training] 🎓 Model training complete! You can now start the server.")
