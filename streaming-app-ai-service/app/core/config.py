from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "music-streaming-ai-service"
    app_version: str = Field(default="0.5.0", validation_alias="APP_VERSION")
    environment: str = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "ENVIRONMENT"),
    )
    port: int = Field(default=8000, validation_alias="PORT")
    recommendation_mode: str = "hybrid-ranking"
    genre_analysis_mode: str = "essentia-first"
    default_recommendation_limit: int = 12
    default_candidate_pool: int = 80
    content_weight: float = 0.40
    collaborative_weight: float = 0.35
    popularity_weight: float = 0.15
    freshness_weight: float = 0.10
    audio_fetch_timeout_seconds: int = 12
    audio_fetch_max_bytes: int = 25_000_000
    audio_sample_rate: int = 16000
    audio_resample_quality: int = 4
    genre_top_k: int = 3
    genre_score_threshold: float = 0.15
    genre_confidence_threshold: float = 0.50
    genre_analysis_mock_enabled: bool = False
    essentia_enabled: bool = False
    essentia_models_dir: str = Field(
        default="./models",
        validation_alias=AliasChoices("MODELS_DIR", "ESSENTIA_MODELS_DIR"),
    )
    essentia_embedding_model_path: str = Field(
        default="./models/discogs-effnet-bs64-1.pb",
        validation_alias=AliasChoices("EMBEDDING_MODEL_PATH", "ESSENTIA_EMBEDDING_MODEL_PATH"),
    )
    essentia_embedding_metadata_path: str = Field(
        default="./models/discogs-effnet-bs64-1.json",
        validation_alias=AliasChoices("EMBEDDING_METADATA_PATH", "ESSENTIA_EMBEDDING_METADATA_PATH"),
    )
    essentia_embedding_output_layer: str = "PartitionedCall:1"
    essentia_classifier_model_path: str = Field(
        default="./models/mtg_jamendo_genre-discogs-effnet-1.pb",
        validation_alias=AliasChoices("GENRE_MODEL_PATH", "ESSENTIA_CLASSIFIER_MODEL_PATH"),
    )
    essentia_classifier_metadata_path: str = Field(
        default="./models/mtg_jamendo_genre-discogs-effnet-1.json",
        validation_alias=AliasChoices("GENRE_METADATA_PATH", "ESSENTIA_CLASSIFIER_METADATA_PATH"),
    )
    genre_classifier_backend: str = Field(
        default="essentia",
        validation_alias=AliasChoices("GENRE_CLASSIFIER_BACKEND", "CLASSIFIER_BACKEND"),
    )
    essentia_suppress_network_warnings: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
