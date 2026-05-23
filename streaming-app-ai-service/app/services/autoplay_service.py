from app.schemas.recommend_schema import RecommendationCandidate, RecommendationRequest


class AutoplayService:
    def artist_penalty(
        self,
        payload: RecommendationRequest,
        candidate: RecommendationCandidate,
    ) -> float:
        if payload.contextType != "autoplay":
            return 0.0

        if not payload.preferDifferentArtist or not payload.seedArtistId:
            return 0.0

        return -0.15 if candidate.artistId == payload.seedArtistId else 0.0


autoplay_service = AutoplayService()
