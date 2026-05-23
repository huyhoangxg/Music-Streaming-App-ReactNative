from app.schemas.recommend_schema import RecommendationCandidate, RecommendationRequest
from app.services.genre_postprocess import normalize_genre_label


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, round(value, 4)))


class SimilarSongService:
    def seed_genre_score(
        self,
        payload: RecommendationRequest,
        candidate: RecommendationCandidate,
    ) -> float:
        seed_genres = {
            normalized
            for genre in payload.seedGenres
            if (normalized := normalize_genre_label(genre))
        }
        candidate_genres = {
            normalized
            for genre in candidate.genres
            if (normalized := normalize_genre_label(genre))
        }
        candidate_tags = {
            normalized
            for tag in candidate.tags
            if (normalized := normalize_genre_label(tag))
        }

        if not seed_genres:
            return 0.0

        if candidate.finalPrimaryGenre and normalize_genre_label(candidate.finalPrimaryGenre) in seed_genres:
            return 1.0

        if candidate_genres.intersection(seed_genres):
            return 0.8

        if candidate_tags.intersection(seed_genres):
            return 0.55

        return 0.0

    def seed_artist_penalty(
        self,
        payload: RecommendationRequest,
        candidate: RecommendationCandidate,
    ) -> float:
        if not payload.seedArtistId or not payload.preferDifferentArtist:
            return 0.0

        return -0.1 if candidate.artistId == payload.seedArtistId else 0.0

    def score(
        self,
        payload: RecommendationRequest,
        candidate: RecommendationCandidate,
    ) -> float:
        return clamp01(self.seed_genre_score(payload, candidate))


similar_song_service = SimilarSongService()
