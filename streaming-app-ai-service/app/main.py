import logging

from fastapi import FastAPI

from app.api.routes.analyze import router as analyze_router
from app.api.routes.health import router as health_router
from app.api.routes.profile import router as profile_router
from app.api.routes.recommend import router as recommend_router
from app.core.config import settings
from app.core.model_registry import model_registry
from app.services.genre_inference import get_essentia_import_status

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Essentia-first AI service for internal music genre tagging and hybrid recommendation.",
)

app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(profile_router)
app.include_router(recommend_router)


@app.on_event("startup")
async def log_runtime_readiness() -> None:
    runtime_status = model_registry.inspect_genre_runtime()
    essentia_import_ok, essentia_missing_symbols, essentia_import_error = get_essentia_import_status()

    logger.info(
        "AI service runtime: env=%s, modelsDirExists=%s, essentiaImportOk=%s, classifierLabels=%s",
        settings.environment,
        runtime_status.models_dir_exists,
        essentia_import_ok,
        runtime_status.classifier_labels_count,
    )

    if essentia_import_error:
        logger.warning("Essentia import error: %s", essentia_import_error)

    if essentia_missing_symbols:
        logger.warning("Essentia missing symbols: %s", ", ".join(essentia_missing_symbols))

    if runtime_status.readiness_issues:
        for issue in runtime_status.readiness_issues:
            logger.warning("AI readiness issue: %s", issue)
    else:
        logger.info("Genre model metadata loaded successfully. modelVersion=%s", runtime_status.model_version)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Music AI service is ready."}
