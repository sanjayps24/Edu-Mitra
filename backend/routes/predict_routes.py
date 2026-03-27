"""
predict_routes.py — ML model prediction endpoint.
POST /predict accepts student features and returns risk classification.
"""

from fastapi import APIRouter, HTTPException, Depends
from models import PredictRequest, PredictResponse, FeatureImportance, RiskLevel
from auth import get_current_user
from ml.predict import predict_risk

router = APIRouter()


@router.post("/predict", response_model=PredictResponse)
async def predict(
    request: PredictRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Run ML risk prediction on student academic features.

    Input:
        - attendance_pct: Attendance percentage (0-100)
        - assignment_avg: Average assignment score (0-100)
        - midterm_score: Mid-term exam score (0-100)
        - final_score: Final exam score (0-100)
        - quiz_avg: Average quiz score (0-100)

    Returns:
        - risk_level: "Low" | "Medium" | "High"
        - confidence: float (0.0 to 1.0)
        - recommendations: list of personalized improvement tips
        - feature_importance: SHAP-based explanation of key factors
    """
    try:
        result = predict_risk(request.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    # Map feature importance to response model
    feature_importance = [
        FeatureImportance(
            feature=fi["feature"],
            importance=fi["importance"],
            direction=fi["direction"],
        )
        for fi in result.get("feature_importance", [])
    ]

    return PredictResponse(
        risk_level=RiskLevel(result["risk_level"]),
        confidence=result["confidence"],
        recommendations=result["recommendations"],
        feature_importance=feature_importance,
    )
