from dataclasses import dataclass
from typing import Sequence

from app.core.config import settings
from app.schemas.common_schema import GenreScore

APP_GENRES = frozenset(
    {
        "Pop",
        "Rap/Hip-Hop",
        "R&B",
        "Rock",
        "Indie",
        "EDM",
        "Lo-Fi",
        "Jazz",
        "Acoustic",
        "Bolero",
        "Other",
    }
)

GENRE_ALIASES = {
    "alternative": "Indie",
    "alternativerock": "Rock",
    "bluesrock": "Rock",
    "breakbeat": "EDM",
    "chillout": "Lo-Fi",
    "classicrock": "Rock",
    "club": "EDM",
    "dance": "EDM",
    "deephouse": "EDM",
    "disco": "EDM",
    "downtempo": "Lo-Fi",
    "drumnbass": "EDM",
    "dubstep": "EDM",
    "electronic": "EDM",
    "electronica": "EDM",
    "electropop": "EDM",
    "eurodance": "EDM",
    "folk": "Acoustic",
    "funk": "R&B",
    "groove": "R&B",
    "grunge": "Rock",
    "hardrock": "Rock",
    "hip hop": "Rap/Hip-Hop",
    "hip-hop": "Rap/Hip-Hop",
    "hiphop": "Rap/Hip-Hop",
    "house": "EDM",
    "instrumentalpop": "Pop",
    "instrumentalrock": "Rock",
    "jazzfusion": "Jazz",
    "lounge": "Lo-Fi",
    "metal": "Rock",
    "popfolk": "Pop",
    "poprock": "Rock",
    "postrock": "Rock",
    "punkrock": "Rock",
    "rap": "Rap/Hip-Hop",
    "rap hip hop": "Rap/Hip-Hop",
    "rap/hip-hop": "Rap/Hip-Hop",
    "rap/hiphop": "Rap/Hip-Hop",
    "rap-hip-hop": "Rap/Hip-Hop",
    "rnb": "R&B",
    "rocknroll": "Rock",
    "singersongwriter": "Acoustic",
    "soul": "R&B",
    "swing": "Jazz",
    "synthpop": "EDM",
    "techno": "EDM",
    "trance": "EDM",
    "triphop": "Rap/Hip-Hop",
    "bolero": "Bolero",
    "classical": "Other",
    "lofi": "Lo-Fi",
    "lo-fi": "Lo-Fi",
    "lo fi": "Lo-Fi",
    "r&b": "R&B",
    "edm": "EDM",
}


@dataclass(slots=True)
class GenrePostprocessResult:
    primary_genre: str | None
    genres: list[GenreScore]
    confidence: float | None


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, round(value, 4)))


def normalize_genre_label(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = " ".join(value.strip().split())
    if not normalized:
        return None

    alias_key = normalized.lower()
    if alias_key in GENRE_ALIASES:
        return GENRE_ALIASES[alias_key]

    if normalized.isupper() and len(normalized) <= 5:
        return normalized

    return normalized.title()


def postprocess_genre_scores(
    labels: Sequence[str],
    scores: Sequence[float],
    top_k: int | None = None,
    min_score: float | None = None,
) -> GenrePostprocessResult:
    if len(labels) != len(scores):
        raise ValueError(
            "Classifier labels length "
            f"{len(labels)} does not match score length {len(scores)}."
        )

    normalized_top_k = max(1, top_k or settings.genre_top_k)
    threshold = min_score if min_score is not None else settings.genre_score_threshold

    merged_scores: dict[str, float] = {}
    for label, score in zip(labels, scores):
        normalized_label = normalize_genre_label(label)
        if normalized_label not in APP_GENRES:
            continue

        # Old models may emit separate Rap and Hip-Hop classes. Sum aliases so
        # their combined probability competes with the new merged app label.
        merged_scores[normalized_label] = clamp01(
            merged_scores.get(normalized_label, 0.0) + float(score)
        )

    ranked_pairs = sorted(merged_scores.items(), key=lambda item: item[1], reverse=True)

    filtered_pairs = [
        (label, score)
        for label, score in ranked_pairs
        if score >= threshold
    ][:normalized_top_k]

    genres = [GenreScore(name=label, score=score) for label, score in filtered_pairs]
    primary_genre = genres[0].name if genres else None
    confidence = genres[0].score if genres else None

    return GenrePostprocessResult(
        primary_genre=primary_genre,
        genres=genres,
        confidence=confidence,
    )
