from fastapi import APIRouter

from app.core.config import settings
from app.core.model_registry import model_registry
from app.schemas.common_schema import HealthResponse
from app.services.genre_inference import get_essentia_import_status

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    runtime_status = model_registry.inspect_genre_runtime()
    file_status = model_registry.file_status()
    labels = model_registry.load_genre_labels()
    essentia_import_ok, essentia_missing_symbols, essentia_import_error = get_essentia_import_status()

    return HealthResponse(
        status="ok" if essentia_import_ok and not runtime_status.readiness_issues else "degraded",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        recommendationMode=settings.recommendation_mode,
        essentiaEnabled=settings.essentia_enabled,
        essentiaImportOk=essentia_import_ok,
        essentiaImportError=essentia_import_error,
        essentiaMissingSymbols=essentia_missing_symbols,
        modelsDirPath=str(runtime_status.models_dir_path),
        modelsDirExists=runtime_status.models_dir_exists,
        models_dir_exists=file_status["models_dir_exists"],
        embeddingModelPath=str(runtime_status.embedding_model_path),
        embeddingModelExists=runtime_status.embedding_model_exists,
        embedding_model_exists=file_status["embedding_model_exists"],
        embeddingMetadataPath=str(runtime_status.embedding_metadata_path),
        embeddingMetadataExists=runtime_status.embedding_metadata_exists,
        embedding_metadata_exists=file_status["embedding_metadata_exists"],
        embeddingMetadataLoadOk=runtime_status.embedding_metadata_load_ok,
        classifierModelPath=str(runtime_status.classifier_model_path),
        classifierModelExists=runtime_status.classifier_model_exists,
        genre_model_exists=file_status["genre_model_exists"],
        classifierMetadataPath=str(runtime_status.classifier_metadata_path),
        classifierMetadataExists=runtime_status.classifier_metadata_exists,
        genre_metadata_exists=file_status["genre_metadata_exists"],
        classifierMetadataLoadOk=runtime_status.classifier_metadata_load_ok,
        classifierLabelsCount=runtime_status.classifier_labels_count,
        genre_labels_count=len(labels),
        modelVersion=runtime_status.model_version,
        readinessIssues=runtime_status.readiness_issues,
    )
