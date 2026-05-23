from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.recommend_schema import RecommendationRequest, RecommendationResponse
from app.services.candidate_service import candidate_service
from app.services.hybrid_ranker import hybrid_ranker

router = APIRouter(prefix="/v1", tags=["recommend"])


@router.post("/recommend", response_model=RecommendationResponse)
async def recommend(payload: RecommendationRequest) -> RecommendationResponse:
    candidates = candidate_service.prepare_candidates(payload)
    items = hybrid_ranker.rank(payload, candidates)

    return RecommendationResponse(
        userId=payload.userId,
        contextType=payload.contextType,
        strategy="recommendation-v1-demo",
        generatedAt=datetime.now(timezone.utc).isoformat(),
        items=items[: payload.limit],
    )
