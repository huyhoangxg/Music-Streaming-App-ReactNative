from collections import defaultdict
from datetime import datetime, timezone

from app.schemas.common_schema import ArtistAffinity, GenreAffinity, ProfileInteractionSignal
from app.schemas.recommend_schema import ProfileBuildResponse
from app.services.genre_postprocess import normalize_genre_label


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, round(value, 4)))


class UserProfileService:
    def build_profile(
        self,
        user_id: str,
        interactions: list[ProfileInteractionSignal],
    ) -> ProfileBuildResponse:
        genre_scores: dict[str, float] = defaultdict(float)
        artist_scores: dict[str, float] = defaultdict(float)

        for interaction in interactions:
            weight = self._interaction_weight(interaction)

            seen_genres: set[str] = set()
            for genre in interaction.genres:
                normalized_genre = normalize_genre_label(genre)
                if normalized_genre is None or normalized_genre in seen_genres:
                    continue

                genre_scores[normalized_genre] += weight
                seen_genres.add(normalized_genre)

            artist_scores[interaction.artistId] += weight

        top_genres = self._normalize_top_genres(genre_scores)
        top_artists = self._normalize_top_artists(artist_scores)
        activity_score = clamp01(len(interactions) / 40)

        return ProfileBuildResponse(
            userId=user_id,
            topGenres=top_genres,
            topArtists=top_artists,
            activityScore=activity_score,
            updatedAt=datetime.now(timezone.utc).isoformat(),
        )

    def _interaction_weight(self, interaction: ProfileInteractionSignal) -> float:
        weight = 0.2
        weight += interaction.completionRate * 0.55
        weight += min(interaction.durationPlayed / 180, 1) * 0.25
        weight += 0.35 if interaction.liked else 0
        weight += 0.45 if interaction.addedToPlaylist else 0

        return weight

    def _normalize_top_genres(self, scores: dict[str, float]) -> list[GenreAffinity]:
        if not scores:
            return []

        max_score = max(scores.values()) or 1
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:10]

        return [GenreAffinity(name=name, score=clamp01(score / max_score)) for name, score in ranked]

    def _normalize_top_artists(self, scores: dict[str, float]) -> list[ArtistAffinity]:
        if not scores:
            return []

        max_score = max(scores.values()) or 1
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:10]

        return [ArtistAffinity(artistId=artist_id, score=clamp01(score / max_score)) for artist_id, score in ranked]


user_profile_service = UserProfileService()
