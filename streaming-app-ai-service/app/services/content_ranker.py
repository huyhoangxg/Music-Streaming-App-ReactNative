from app.schemas.recommend_schema import RecommendationCandidate, RecommendationRequest
from app.services.autoplay_service import autoplay_service
from app.services.genre_postprocess import normalize_genre_label
from app.services.similar_song_service import similar_song_service


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, round(value, 4)))


class ContentRanker:
    def _collect_normalized_labels(self, values: list[str]) -> set[str]:
        return {
            normalized
            for value in values
            if (normalized := normalize_genre_label(value))
        }

    def score(self, candidate: RecommendationCandidate, payload: RecommendationRequest) -> float:
        candidate_genres = self._collect_normalized_labels(candidate.genres)

        if payload.contextType in {"autoplay", "similar_tracks"} and payload.seedGenres:
            raw_score = similar_song_service.score(payload, candidate)
            if payload.contextType == "autoplay":
                raw_score += autoplay_service.artist_penalty(payload, candidate)
            if payload.contextType == "similar_tracks":
                raw_score += similar_song_service.seed_artist_penalty(payload, candidate)
            return clamp01(raw_score)

        ranked_preferred_genres = [
            normalize_genre_label(item.name)
            for item in payload.userProfile.topGenres[:5]
            if normalize_genre_label(item.name)
        ]
        preferred_artists = [item.artistId for item in payload.userProfile.topArtists[:3]]

        if not ranked_preferred_genres:
            return 0.0

        for index, genre in enumerate(ranked_preferred_genres):
            if genre in candidate_genres:
                return clamp01(max(0.35, 1 - index * 0.18))

        if candidate.artistId in preferred_artists:
            return 0.3

        return 0.0


content_ranker = ContentRanker()
