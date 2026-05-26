import logging

from app.core.model_registry import model_registry
from app.core.config import settings
from app.schemas.analyze_schema import AnalyzeSongRequest, AnalyzeSongResponse
from app.services.audio_loader import download_audio_to_temp_file
from app.services.genre_inference_subprocess import infer_genres_in_subprocess
from app.services.genre_postprocess import postprocess_genre_scores

logger = logging.getLogger("uvicorn.error")


def _format_genres(genres) -> str:
    if not genres:
        return "none"

    return ", ".join(f"{genre.name}={genre.score:.3f}" for genre in genres)


class GenreTaggingService:
    def analyze_song(self, payload: AnalyzeSongRequest) -> AnalyzeSongResponse:
        if settings.genre_analysis_mock_enabled:
            response = AnalyzeSongResponse(
                songId=payload.songId,
                primaryGenre="Pop",
                genres=[
                    {"name": "Pop", "score": 0.82},
                    {"name": "Indie", "score": 0.33},
                    {"name": "Rock", "score": 0.11},
                ],
                confidence=0.82,
                status="success",
                modelVersion="mock-essentia-v1",
                errorMessage=None,
            )
            logger.info(
                'Genre analysis result: songId=%s title="%s" status=%s primary=%s confidence=%.3f top=%s model=%s',
                response.songId,
                payload.title or "unknown",
                response.status,
                response.primaryGenre,
                response.confidence or 0,
                _format_genres(response.genres),
                response.modelVersion,
            )
            return response

        model_version = self._resolve_model_version()

        try:
            with download_audio_to_temp_file(payload.audioUrl) as downloaded_audio:
                inference_result = infer_genres_in_subprocess(downloaded_audio.local_path)

            processed_result = postprocess_genre_scores(
                labels=inference_result.labels,
                scores=inference_result.scores,
            )

            if not processed_result.genres or not processed_result.primary_genre:
                response = AnalyzeSongResponse(
                    songId=payload.songId,
                    primaryGenre=None,
                    genres=[],
                    confidence=None,
                    status="failed",
                    modelVersion=inference_result.model_version,
                    errorMessage="Genre classifier did not produce any genre above the configured threshold.",
                )
                logger.warning(
                    'Genre analysis result: songId=%s title="%s" status=%s primary=none confidence=n/a top=none model=%s error="%s"',
                    response.songId,
                    payload.title or "unknown",
                    response.status,
                    response.modelVersion,
                    response.errorMessage,
                )
                return response

            response = AnalyzeSongResponse(
                songId=payload.songId,
                primaryGenre=processed_result.primary_genre,
                genres=processed_result.genres,
                confidence=processed_result.confidence,
                status="success",
                modelVersion=inference_result.model_version,
                errorMessage=None,
            )
            logger.info(
                'Genre analysis result: songId=%s title="%s" status=%s primary=%s confidence=%.3f top=%s model=%s',
                response.songId,
                payload.title or "unknown",
                response.status,
                response.primaryGenre,
                response.confidence or 0,
                _format_genres(response.genres),
                response.modelVersion,
            )
            return response
        except Exception as error:
            response = AnalyzeSongResponse(
                songId=payload.songId,
                primaryGenre=None,
                genres=[],
                confidence=None,
                status="failed",
                modelVersion=model_version,
                errorMessage=str(error),
            )
            logger.warning(
                'Genre analysis result: songId=%s title="%s" status=%s primary=none confidence=n/a top=none model=%s error="%s"',
                response.songId,
                payload.title or "unknown",
                response.status,
                response.modelVersion,
                response.errorMessage,
            )
            return response

    def _resolve_model_version(self) -> str | None:
        try:
            runtime_status = model_registry.inspect_genre_runtime()
            return runtime_status.model_version
        except Exception:
            return None


genre_tagging_service = GenreTaggingService()
