"""
predict.py — ML inference module for Edu-Mitra.

Loads the trained model pipeline and provides the predict_risk() function.
Also computes SHAP-style feature importance for Explainable AI (XAI).
Falls back to rule-based prediction if model is not yet trained.
"""

import os
import numpy as np
import joblib
from typing import Dict, List, Any

# ── Paths ─────────────────────────────────────────────────────────────────────

ML_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(ML_DIR, "model.pkl")
META_PATH  = os.path.join(ML_DIR, "model_meta.pkl")

# ── Load Model (lazy-loaded on first call) ────────────────────────────────────

_model = None
_meta  = None


def _load_model():
    """Load model and metadata from disk (cached after first load)."""
    global _model, _meta
    if _model is None:
        if os.path.exists(MODEL_PATH) and os.path.exists(META_PATH):
            _model = joblib.load(MODEL_PATH)
            _meta  = joblib.load(META_PATH)
        else:
            _model = "rule_based"
            _meta  = {
                "feature_cols": ["attendance_pct", "assignment_avg", "midterm_score", "final_score", "quiz_avg"],
                "feature_labels": {
                    "attendance_pct": "Attendance %",
                    "assignment_avg": "Assignment Score",
                    "midterm_score" : "Midterm Score",
                    "final_score"   : "Final Exam Score",
                    "quiz_avg"      : "Quiz Average",
                },
                "risk_names": {0: "Low", 1: "Medium", 2: "High"},
            }


# ── Feature Importance (SHAP approximation) ───────────────────────────────────

def _compute_feature_importance(features: Dict[str, float], risk_label: int) -> List[Dict]:
    """
    Compute approximate per-feature contribution using model importances
    and deviation from thresholds. Returns sorted list of feature impacts.
    """
    _load_model()

    base_importances = {}
    if isinstance(_model, str):
        # Rule-based fallback: equal importance
        base_importances = {k: 0.2 for k in features}
    else:
        base_importances = _meta.get("feature_importances", {k: 0.2 for k in features})

    feature_labels = _meta.get("feature_labels", {})

    # Good thresholds for each feature
    thresholds = {
        "attendance_pct" : 75,
        "assignment_avg" : 60,
        "midterm_score"  : 55,
        "final_score"    : 55,
        "quiz_avg"       : 55,
    }

    result = []
    for col, value in features.items():
        base_imp = base_importances.get(col, 0.2)
        threshold = thresholds.get(col, 60)
        deviation = (value - threshold) / 100.0   # normalized deviation

        result.append({
            "feature"   : col,
            "label"     : feature_labels.get(col, col),
            "importance": round(float(base_imp), 4),
            "value"     : value,
            "direction" : "positive" if deviation >= 0 else "negative",
        })

    # Sort by importance (descending)
    result.sort(key=lambda x: x["importance"], reverse=True)
    return result


# ── Recommendations Engine ────────────────────────────────────────────────────

def _generate_recommendations(features: Dict[str, float], risk_level: str) -> List[str]:
    """Generate targeted, personalized recommendations based on weak areas."""
    recs = []

    att  = features.get("attendance_pct", 100)
    assn = features.get("assignment_avg", 100)
    mid  = features.get("midterm_score", 100)
    fin  = features.get("final_score", 100)
    quiz = features.get("quiz_avg", 100)

    # Attendance
    if att < 75:
        recs.append(f"📅 Your attendance is {att:.1f}% — below the 75% minimum. Make attending every class a priority.")
    elif att < 85:
        recs.append(f"📅 Attendance at {att:.1f}% — aim to be present for at least 90% of sessions for best retention.")

    # Assignments
    if assn < 50:
        recs.append("📝 Assignment scores are critically low. Submit all pending work and seek help from your instructor.")
    elif assn < 65:
        recs.append("📝 Work on improving assignment quality — try practice problems and peer study groups.")

    # Midterm
    if mid < 50:
        recs.append("📚 Midterm score needs significant improvement. Review core concepts and practice past papers.")
    elif mid < 65:
        recs.append("📚 Strengthen your understanding of midterm topics using additional study resources.")

    # Final exam
    if fin < 50:
        recs.append("🎯 Final exam score is a concern. Create a structured revision plan and stick to it daily.")
    elif fin < 65:
        recs.append("🎯 Aim to improve your final exam preparation — focus on high-weighted topics first.")

    # Quiz average
    if quiz < 50:
        recs.append("🧠 Quiz performance suggests gaps in understanding. Review lecture notes after every class.")
    elif quiz < 65:
        recs.append("🧠 Improve quiz scores by testing yourself regularly with flashcards or online quizzes.")

    # General recommendations by risk level
    if risk_level == "High":
        recs += [
            "⚠️ You are at HIGH risk. Consider speaking with your academic advisor immediately.",
            "🤝 Join a study group — collaborative learning significantly improves performance.",
            "🕐 Create a strict weekly study schedule and allocate time for each subject.",
        ]
    elif risk_level == "Medium":
        recs += [
            "📈 You're progressing but need focused effort to move to low risk.",
            "🔁 Review weak subjects daily for at least 30 minutes.",
            "💡 Use active recall and spaced repetition for better retention.",
        ]
    else:
        recs += [
            "✅ Great performance! Keep maintaining your current study habits.",
            "🚀 Challenge yourself with advanced problems and competitive exams.",
            "👨‍🏫 Consider mentoring peers — teaching reinforces your own knowledge.",
        ]

    # Deduplicate and limit
    seen = set()
    unique_recs = []
    for r in recs:
        if r not in seen:
            seen.add(r)
            unique_recs.append(r)

    return unique_recs[:6]


# ── Public Prediction Function ────────────────────────────────────────────────

def predict_risk(features: Dict[str, float]) -> Dict[str, Any]:
    """
    Main prediction function called by the API.

    Args:
        features: dict with keys:
            attendance_pct, assignment_avg, midterm_score, final_score, quiz_avg

    Returns:
        dict with risk_level, confidence, recommendations, feature_importance
    """
    _load_model()

    feature_cols = _meta["feature_cols"]
    risk_names   = _meta["risk_names"]

    # Build input array in the correct column order
    X = np.array([[features.get(col, 50.0) for col in feature_cols]])

    if isinstance(_model, str):
        # ── Rule-based fallback (no trained model) ────────────────────────────
        composite = (
            0.25 * features.get("attendance_pct", 50) +
            0.20 * features.get("assignment_avg", 50) +
            0.25 * features.get("midterm_score", 50) +
            0.20 * features.get("final_score", 50) +
            0.10 * features.get("quiz_avg", 50)
        )
        if composite >= 65:
            label, confidence = 0, min(0.99, 0.65 + (composite - 65) / 100)
        elif composite >= 45:
            label, confidence = 1, 0.70
        else:
            label, confidence = 2, min(0.99, 0.65 + (45 - composite) / 100)
    else:
        # ── ML model prediction ───────────────────────────────────────────────
        proba = _model.predict_proba(X)[0]
        label = int(np.argmax(proba))
        confidence = float(np.max(proba))

    risk_level = risk_names[label]
    recommendations = _generate_recommendations(features, risk_level)
    feature_importance = _compute_feature_importance(features, label)

    return {
        "risk_level"        : risk_level,
        "confidence"        : round(confidence, 4),
        "recommendations"   : recommendations,
        "feature_importance": feature_importance,
    }
