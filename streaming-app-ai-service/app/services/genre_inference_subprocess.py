from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
import sys

from app.core.config import settings


@dataclass(slots=True)
class GenreInferenceProcessResult:
    scores: list[float]
    labels: list[str]
    model_version: str


def infer_genres_in_subprocess(local_audio_path: str | Path) -> GenreInferenceProcessResult:
    service_root = Path(__file__).resolve().parents[2]
    worker_script = service_root / "app" / "services" / "genre_inference_worker.py"
    payload = json.dumps({"localAudioPath": str(local_audio_path)})

    try:
        completed = subprocess.run(
            [sys.executable, str(worker_script)],
            input=payload,
            capture_output=True,
            cwd=service_root,
            text=True,
            timeout=settings.genre_inference_timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise TimeoutError(
            "Genre inference timed out after "
            f"{settings.genre_inference_timeout_seconds}s."
        ) from error

    if completed.returncode != 0:
        details = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(details or f"Genre inference worker exited with {completed.returncode}.")

    try:
        raw_result = json.loads(completed.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError) as error:
        raise RuntimeError(
            "Genre inference worker did not return valid JSON. "
            f"stdout={completed.stdout.strip()} stderr={completed.stderr.strip()}"
        ) from error

    scores = raw_result.get("scores")
    labels = raw_result.get("labels")
    model_version = raw_result.get("modelVersion")

    if not isinstance(scores, list) or not isinstance(labels, list):
        raise RuntimeError("Genre inference worker returned an invalid payload.")

    return GenreInferenceProcessResult(
        scores=[float(score) for score in scores],
        labels=[str(label) for label in labels],
        model_version=str(model_version) if model_version else "unknown",
    )
