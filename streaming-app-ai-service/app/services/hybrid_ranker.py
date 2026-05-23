from app.schemas.recommend_schema import (
    RecommendationCandidate,
    RecommendationItem,
    RecommendationRequest,
)
from app.services.content_ranker import content_ranker


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, round(value, 4)))


class HybridRanker:
    def rank(
        self,
        payload: RecommendationRequest,
        candidates: list[RecommendationCandidate],
    ) -> list[RecommendationItem]:
        ranked_items: list[RecommendationItem] = []

        for candidate in candidates:
            content_score = content_ranker.score(candidate, payload)
            collaborative_score = clamp01(candidate.collaborativeScore)
            popularity_score = clamp01(candidate.popularityScore)
            freshness_score = clamp01(candidate.freshnessScore)
            final_score = clamp01(
                content_score * 0.40
                + collaborative_score * 0.30
                + popularity_score * 0.20
                + freshness_score * 0.10
            )

            reasons = self._build_reasons(
                content_score,
                collaborative_score,
                popularity_score,
                freshness_score,
                payload.contextType,
            )

            ranked_items.append(
                RecommendationItem(
                    songId=candidate.songId,
                    contentScore=content_score,
                    collaborativeScore=collaborative_score,
                    popularityScore=popularity_score,
                    freshnessScore=freshness_score,
                    finalScore=final_score,
                    reasons=reasons,
                )
            )

        ranked_items.sort(key=lambda item: item.finalScore, reverse=True)
        return ranked_items

    def _build_reasons(
        self,
        content_score: float,
        collaborative_score: float,
        popularity_score: float,
        freshness_score: float,
        context_type: str,
    ) -> list[str]:
        reasons: list[str] = []

        if content_score >= 0.35:
            reasons.append("Strong genre match")
        if collaborative_score >= 0.35:
            reasons.append("Listeners with similar behavior liked this")
        if popularity_score >= 0.4:
            reasons.append("Popular in the app")
        if freshness_score >= 0.4:
            reasons.append("Recent track boost")
        if context_type == "autoplay":
            reasons.append("Autoplay continuation candidate")
        if context_type == "similar_tracks":
            reasons.append("Similar track continuation candidate")

        return reasons or ["Balanced fallback score"]


hybrid_ranker = HybridRanker()
