from app.schemas.common_schema import UserTasteProfile
from app.schemas.recommend_schema import RecommendationCandidate


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, round(value, 4)))


class CollaborativeRanker:
    def score(self, candidate: RecommendationCandidate, user_profile: UserTasteProfile) -> float:
        artist_affinity = 0.0
        for artist in user_profile.topArtists:
            if artist.artistId == candidate.artistId:
                artist_affinity = max(artist_affinity, artist.score)

        return clamp01(candidate.collaborativeScore + artist_affinity * 0.2)


collaborative_ranker = CollaborativeRanker()
