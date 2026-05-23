from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    recommendationMode: str
    essentiaEnabled: bool
    essentiaImportOk: bool
    essentiaImportError: str | None = None
    essentiaMissingSymbols: list[str] = Field(default_factory=list)
    modelsDirPath: str
    modelsDirExists: bool
    models_dir_exists: bool
    embeddingModelPath: str
    embeddingModelExists: bool
    embedding_model_exists: bool
    embeddingMetadataPath: str
    embeddingMetadataExists: bool
    embedding_metadata_exists: bool
    embeddingMetadataLoadOk: bool
    classifierModelPath: str
    classifierModelExists: bool
    genre_model_exists: bool
    classifierMetadataPath: str
    classifierMetadataExists: bool
    genre_metadata_exists: bool
    classifierMetadataLoadOk: bool
    classifierLabelsCount: int = 0
    genre_labels_count: int = 0
    modelVersion: str | None = None
    readinessIssues: list[str] = Field(default_factory=list)


class GenreScore(BaseModel):
    name: str
    score: float = Field(ge=0, le=1)


class GenreAffinity(BaseModel):
    name: str
    score: float = Field(ge=0, le=1)


class ArtistAffinity(BaseModel):
    artistId: str
    score: float = Field(ge=0, le=1)


class ProfileInteractionSignal(BaseModel):
    songId: str
    artistId: str
    genres: list[str] = Field(default_factory=list)
    completionRate: float = Field(default=0, ge=0, le=1)
    durationPlayed: int = Field(default=0, ge=0)
    liked: bool = False
    reposted: bool = False
    addedToPlaylist: bool = False
    followedCreator: bool = False
    playedAt: str | None = None


class UserTasteProfile(BaseModel):
    userId: str
    topGenres: list[GenreAffinity] = Field(default_factory=list)
    topArtists: list[ArtistAffinity] = Field(default_factory=list)
    activityScore: float = Field(default=0, ge=0, le=1)
    updatedAt: str
