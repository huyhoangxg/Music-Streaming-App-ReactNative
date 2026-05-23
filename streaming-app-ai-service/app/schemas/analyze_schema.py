from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common_schema import GenreScore


class AnalyzeSongRequest(BaseModel):
    songId: str
    audioUrl: str
    title: str | None = None


class AnalyzeSongResponse(BaseModel):
    songId: str
    primaryGenre: str | None = None
    genres: list[GenreScore] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)
    status: Literal["success", "failed"]
    modelVersion: str | None = None
    errorMessage: str | None = None
