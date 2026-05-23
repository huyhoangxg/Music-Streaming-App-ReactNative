from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common_schema import GenreScore, ProfileInteractionSignal, UserTasteProfile


class ProfileBuildRequest(BaseModel):
    userId: str
    interactions: list[ProfileInteractionSignal] = Field(default_factory=list)


class ProfileBuildResponse(UserTasteProfile):
    pass


class RecommendationCandidate(BaseModel):
    songId: str
    title: str
    artistId: str
    finalPrimaryGenre: str | None = None
    uploaderGenre: str | None = None
    aiPrimaryGenre: str | None = None
    aiGenres: list[GenreScore] = Field(default_factory=list)
    genres: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    popularityScore: float = Field(default=0, ge=0, le=1)
    freshnessScore: float = Field(default=0, ge=0, le=1)
    collaborativeScore: float = Field(default=0, ge=0, le=1)


class RecommendationRequest(BaseModel):
    userId: str
    contextType: Literal["home_feed", "autoplay", "similar_tracks"]
    limit: int = Field(default=12, ge=1, le=50)
    seedSongId: str | None = None
    seedGenres: list[str] = Field(default_factory=list)
    seedArtistId: str | None = None
    preferDifferentArtist: bool = False
    recentSongIds: list[str] = Field(default_factory=list)
    userProfile: UserTasteProfile
    candidates: list[RecommendationCandidate] = Field(default_factory=list)


class RecommendationItem(BaseModel):
    songId: str
    contentScore: float = Field(ge=0, le=1)
    collaborativeScore: float = Field(ge=0, le=1)
    popularityScore: float = Field(ge=0, le=1)
    freshnessScore: float = Field(ge=0, le=1)
    finalScore: float = Field(ge=0, le=1)
    reasons: list[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    userId: str
    contextType: Literal["home_feed", "autoplay", "similar_tracks"]
    strategy: str
    generatedAt: str
    items: list[RecommendationItem]
