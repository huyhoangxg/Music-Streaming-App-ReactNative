from collections.abc import Iterable

from app.core.config import settings
from app.schemas.recommend_schema import RecommendationCandidate, RecommendationRequest


def _normalize_label(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = " ".join(value.strip().split())
    return normalized or None


def _merge_labels(values: Iterable[str | None]) -> list[str]:
    deduped: dict[str, str] = {}

    for value in values:
        normalized = _normalize_label(value)
        if normalized is None:
            continue

        deduped.setdefault(normalized.lower(), normalized)

    return list(deduped.values())


class CandidateService:
    def prepare_candidates(self, payload: RecommendationRequest) -> list[RecommendationCandidate]:
        excluded_song_ids = set(payload.recentSongIds)
        deduped_song_ids: set[str] = set()
        prepared_candidates: list[RecommendationCandidate] = []
        preferred_genres = {genre.name.lower() for genre in payload.userProfile.topGenres[:5]}
        seed_genres = {genre.strip().lower() for genre in payload.seedGenres if genre.strip()}

        for candidate in payload.candidates:
            if candidate.songId in excluded_song_ids or candidate.songId in deduped_song_ids:
                continue

            ai_genres = [item.name for item in candidate.aiGenres]
            merged_genres = _merge_labels([
                candidate.finalPrimaryGenre,
                candidate.aiPrimaryGenre,
                candidate.uploaderGenre,
                *ai_genres,
                *candidate.genres,
            ])
            merged_tags = _merge_labels([*candidate.tags, *merged_genres])

            prepared_candidates.append(
                candidate.model_copy(update={"genres": merged_genres, "tags": merged_tags})
            )
            deduped_song_ids.add(candidate.songId)

        prepared_candidates.sort(
            key=lambda candidate: (
                self._genre_match_priority(candidate, payload.contextType, preferred_genres, seed_genres),
                candidate.popularityScore,
                candidate.freshnessScore,
            ),
            reverse=True,
        )

        return prepared_candidates[: settings.default_candidate_pool]

    def _genre_match_priority(
        self,
        candidate: RecommendationCandidate,
        context_type: str,
        preferred_genres: set[str],
        seed_genres: set[str],
    ) -> int:
        candidate_genres = {genre.lower() for genre in candidate.genres}

        if context_type in {"autoplay", "similar_tracks"}:
            return 1 if candidate_genres.intersection(seed_genres) else 0

        if not preferred_genres:
            return 0

        return 1 if candidate_genres.intersection(preferred_genres) else 0


candidate_service = CandidateService()
