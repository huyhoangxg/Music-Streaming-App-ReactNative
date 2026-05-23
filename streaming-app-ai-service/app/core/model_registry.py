import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import settings

SERVICE_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True, slots=True)
class GenreModelBundle:
    embedding_graph_path: Path
    embedding_metadata_path: Path
    classifier_graph_path: Path
    classifier_metadata_path: Path
    class_labels: list[str]
    model_version: str


@dataclass(frozen=True, slots=True)
class GenreModelRuntimeStatus:
    models_dir_path: Path
    models_dir_exists: bool
    embedding_model_path: Path
    embedding_model_exists: bool
    embedding_metadata_path: Path
    embedding_metadata_exists: bool
    embedding_metadata_load_ok: bool
    classifier_model_path: Path
    classifier_model_exists: bool
    classifier_metadata_path: Path
    classifier_metadata_exists: bool
    classifier_metadata_load_ok: bool
    classifier_labels_count: int
    model_version: str | None
    readiness_issues: list[str]


class ModelRegistry:
    def __init__(self) -> None:
        self._genre_bundle: GenreModelBundle | None = None

    def file_status(self) -> dict[str, bool]:
        runtime_status = self.inspect_genre_runtime()
        return {
            "models_dir_exists": runtime_status.models_dir_exists,
            "embedding_model_exists": runtime_status.embedding_model_exists,
            "embedding_metadata_exists": runtime_status.embedding_metadata_exists,
            "genre_model_exists": runtime_status.classifier_model_exists,
            "genre_metadata_exists": runtime_status.classifier_metadata_exists,
        }

    def load_genre_labels(self) -> list[str]:
        runtime_status = self.inspect_genre_runtime()
        if not runtime_status.classifier_metadata_exists:
            return []

        try:
            classifier_metadata = self._load_metadata(runtime_status.classifier_metadata_path)
            return self._extract_class_labels(classifier_metadata)
        except Exception:
            return []

    def get_genre_model_bundle(self) -> GenreModelBundle:
        if self._genre_bundle is None:
            runtime_status = self.inspect_genre_runtime()

            if runtime_status.readiness_issues:
                raise RuntimeError("; ".join(runtime_status.readiness_issues))

            embedding_graph_path = runtime_status.embedding_model_path
            embedding_metadata_path = runtime_status.embedding_metadata_path
            classifier_graph_path = runtime_status.classifier_model_path
            classifier_metadata_path = runtime_status.classifier_metadata_path

            classifier_metadata = self._load_metadata(classifier_metadata_path)
            class_labels = self._extract_class_labels(classifier_metadata)
            model_version = self._extract_model_version(classifier_metadata, classifier_graph_path)

            self._genre_bundle = GenreModelBundle(
                embedding_graph_path=embedding_graph_path,
                embedding_metadata_path=embedding_metadata_path,
                classifier_graph_path=classifier_graph_path,
                classifier_metadata_path=classifier_metadata_path,
                class_labels=class_labels,
                model_version=model_version,
            )

        return self._genre_bundle

    def inspect_genre_runtime(self) -> GenreModelRuntimeStatus:
        models_dir_path = self._resolve_models_dir()
        embedding_model_path = self._resolve_path(settings.essentia_embedding_model_path)
        embedding_metadata_path = self._resolve_path(settings.essentia_embedding_metadata_path)
        classifier_model_path = self._resolve_path(settings.essentia_classifier_model_path)
        classifier_metadata_path = self._resolve_path(settings.essentia_classifier_metadata_path)

        issues: list[str] = []
        embedding_metadata_load_ok = False
        classifier_metadata_load_ok = False
        classifier_labels_count = 0
        model_version: str | None = None

        if not models_dir_path.exists():
            issues.append(f"Models directory not found: {models_dir_path}")

        for label, path in (
            ("Embedding model file", embedding_model_path),
            ("Embedding metadata file", embedding_metadata_path),
            ("Classifier model file", classifier_model_path),
            ("Classifier metadata file", classifier_metadata_path),
        ):
            if not path.exists():
                issues.append(f"{label} not found: {path}")

        if embedding_metadata_path.exists():
            try:
                self._load_metadata(embedding_metadata_path)
                embedding_metadata_load_ok = True
            except Exception as error:
                issues.append(f"Failed to load embedding metadata: {embedding_metadata_path} ({error})")

        if classifier_metadata_path.exists():
            try:
                classifier_metadata = self._load_metadata(classifier_metadata_path)
                classifier_metadata_load_ok = True
                classifier_labels = self._extract_class_labels(classifier_metadata)
                classifier_labels_count = len(classifier_labels)
                model_version = self._extract_model_version(
                    classifier_metadata,
                    classifier_model_path,
                )
            except Exception as error:
                issues.append(f"Failed to load classifier metadata: {classifier_metadata_path} ({error})")

        return GenreModelRuntimeStatus(
            models_dir_path=models_dir_path,
            models_dir_exists=models_dir_path.exists(),
            embedding_model_path=embedding_model_path,
            embedding_model_exists=embedding_model_path.exists(),
            embedding_metadata_path=embedding_metadata_path,
            embedding_metadata_exists=embedding_metadata_path.exists(),
            embedding_metadata_load_ok=embedding_metadata_load_ok,
            classifier_model_path=classifier_model_path,
            classifier_model_exists=classifier_model_path.exists(),
            classifier_metadata_path=classifier_metadata_path,
            classifier_metadata_exists=classifier_metadata_path.exists(),
            classifier_metadata_load_ok=classifier_metadata_load_ok,
            classifier_labels_count=classifier_labels_count,
            model_version=model_version,
            readiness_issues=issues,
        )

    def _resolve_path(self, configured_path: str) -> Path:
        path = Path(configured_path)
        if not path.is_absolute():
            if len(path.parts) == 1:
                path = self._resolve_models_dir() / path
            else:
                path = SERVICE_ROOT / path

        return path

    def _resolve_models_dir(self) -> Path:
        path = Path(settings.essentia_models_dir)
        if path.is_absolute():
            return path

        return SERVICE_ROOT / path

    def _load_metadata(self, metadata_path: Path) -> dict[str, Any]:
        with metadata_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _extract_class_labels(self, metadata: dict[str, Any]) -> list[str]:
        for key in ("classes", "class_names", "labels"):
            values = metadata.get(key)
            if isinstance(values, list) and values and all(isinstance(item, str) for item in values):
                return values

        schema = metadata.get("schema")
        if isinstance(schema, dict):
            for key in ("classes", "class_names", "labels"):
                values = schema.get(key)
                if (
                    isinstance(values, list)
                    and values
                    and all(isinstance(item, str) for item in values)
                ):
                    return values

        raise ValueError("Classifier metadata JSON does not contain a valid classes list.")

    def _extract_model_version(self, metadata: dict[str, Any], classifier_graph_path: Path) -> str:
        for key in ("name", "model_name", "version", "model"):
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        return classifier_graph_path.stem


model_registry = ModelRegistry()
