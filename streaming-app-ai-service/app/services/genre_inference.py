from dataclasses import dataclass
from pathlib import Path
import gc
import logging
import threading
import time

import numpy as np

from app.core.config import settings
from app.core.model_registry import model_registry

try:
    from essentia.standard import (  # type: ignore
        MonoLoader,
        TensorflowPredict2D,
        TensorflowPredictEffnetDiscogs,
    )
    ESSENTIA_IMPORT_ERROR = None
except Exception as error:  # pragma: no cover - optional dependency at runtime
    MonoLoader = None
    TensorflowPredict2D = None
    TensorflowPredictEffnetDiscogs = None
    ESSENTIA_IMPORT_ERROR = str(error)

logger = logging.getLogger("uvicorn.error")


@dataclass(slots=True)
class RawGenreInferenceResult:
    scores: list[float]
    labels: list[str]
    model_version: str


class GenreInferenceService:
    def __init__(self) -> None:
        self._inference_lock = threading.Lock()

    def infer(self, local_audio_path: str | Path) -> RawGenreInferenceResult:
        self._ensure_runtime_available()

        with self._inference_lock:
            started_at = time.perf_counter()
            bundle = model_registry.get_genre_model_bundle()
            embedding_model = self._build_embedding_model(bundle)
            classifier_model = self._build_classifier_model(bundle)

            logger.info("Genre inference step: load_audio path=%s", local_audio_path)
            try:
                audio = self.load_audio(local_audio_path)
                logger.info(
                    "Genre inference step: extract_embeddings samples=%s",
                    audio.shape[0],
                )
                embeddings = self.extract_embeddings(audio, embedding_model)
                logger.info(
                    "Genre inference step: predict_genres embeddings=%s",
                    embeddings.shape,
                )
                predictions = self.predict_genres(embeddings, classifier_model)
                clip_scores = self._collapse_predictions(
                    predictions,
                    expected_size=len(bundle.class_labels),
                )

                logger.info(
                    "Genre inference complete: labels=%s elapsed=%.2fs",
                    len(bundle.class_labels),
                    time.perf_counter() - started_at,
                )

                return RawGenreInferenceResult(
                    scores=clip_scores.tolist(),
                    labels=list(bundle.class_labels),
                    model_version=bundle.model_version,
                )
            finally:
                del embedding_model
                del classifier_model
                gc.collect()

    def _build_audio_loader(self, local_audio_path: str | Path):
        return MonoLoader(
            filename=str(local_audio_path),
            sampleRate=settings.audio_sample_rate,
            resampleQuality=settings.audio_resample_quality,
        )

    def load_audio(self, local_audio_path: str | Path) -> np.ndarray:
        audio = self._build_audio_loader(local_audio_path)()

        audio_array = np.asarray(audio, dtype=np.float32)
        if audio_array.size == 0:
            raise ValueError(f"Audio loader returned an empty waveform for {local_audio_path}.")

        max_samples = settings.audio_sample_rate * settings.audio_analysis_max_seconds
        if max_samples > 0 and audio_array.size > max_samples:
            logger.info(
                "Genre inference step: trim_audio samples=%s maxSamples=%s",
                audio_array.size,
                max_samples,
            )
            audio_array = audio_array[:max_samples]

        return audio_array

    def extract_embeddings(self, audio: np.ndarray, embedding_model) -> np.ndarray:
        embeddings = embedding_model(audio)
        embeddings_array = np.asarray(embeddings, dtype=np.float32)

        if embeddings_array.size == 0:
            raise ValueError("Embedding model returned an empty tensor.")

        return embeddings_array

    def predict_genres(self, embeddings: np.ndarray, classifier_model) -> np.ndarray:
        predictions = classifier_model(embeddings)

        predictions_array = np.asarray(predictions, dtype=np.float32)

        if predictions_array.size == 0:
            raise ValueError("Genre classifier returned an empty predictions tensor.")

        return predictions_array

    def _ensure_runtime_available(self) -> None:
        if not settings.essentia_enabled:
            raise RuntimeError(
                "ESSENTIA_ENABLED is false. Run the AI service in Linux/WSL/Docker with Essentia enabled."
            )

        missing_symbols = [
            symbol_name
            for symbol_name, symbol_value in (
                ("MonoLoader", MonoLoader),
                ("TensorflowPredictEffnetDiscogs", TensorflowPredictEffnetDiscogs),
                ("TensorflowPredict2D", TensorflowPredict2D),
            )
            if symbol_value is None
        ]

        if missing_symbols:
            raise RuntimeError(
                "Essentia runtime is unavailable. Missing: " + ", ".join(missing_symbols)
            )

    def _build_embedding_model(self, bundle):
        return TensorflowPredictEffnetDiscogs(
            graphFilename=str(bundle.embedding_graph_path),
            output=settings.essentia_embedding_output_layer,
        )

    def _build_classifier_model(self, bundle):
        return TensorflowPredict2D(
            graphFilename=str(bundle.classifier_graph_path),
        )

    def _collapse_predictions(self, predictions: np.ndarray, expected_size: int) -> np.ndarray:
        predictions_array = np.asarray(predictions, dtype=float)

        if predictions_array.size == 0:
            raise ValueError("Genre classifier returned an empty predictions array.")

        if predictions_array.ndim == 1:
            clip_scores = predictions_array
        else:
            if predictions_array.shape[-1] != expected_size:
                if predictions_array.size % expected_size != 0:
                    raise ValueError(
                        f"Unexpected classifier output shape {predictions_array.shape}; "
                        f"cannot align it to {expected_size} labels."
                    )

                predictions_array = predictions_array.reshape(-1, expected_size)

            clip_scores = predictions_array.mean(axis=0)

        clip_scores = np.ravel(clip_scores)
        if clip_scores.shape[0] != expected_size:
            raise ValueError(
                f"Collapsed classifier output length {clip_scores.shape[0]} does not match "
                f"label count {expected_size}."
            )

        return np.clip(clip_scores, 0.0, 1.0)


genre_inference_service = GenreInferenceService()


def get_essentia_import_status() -> tuple[bool, list[str], str | None]:
    missing_symbols = [
        symbol_name
        for symbol_name, symbol_value in (
            ("MonoLoader", MonoLoader),
            ("TensorflowPredictEffnetDiscogs", TensorflowPredictEffnetDiscogs),
            ("TensorflowPredict2D", TensorflowPredict2D),
        )
        if symbol_value is None
    ]

    return len(missing_symbols) == 0, missing_symbols, ESSENTIA_IMPORT_ERROR
