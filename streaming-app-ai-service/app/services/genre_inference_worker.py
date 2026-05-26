import json
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[2]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.services.genre_inference import genre_inference_service


def main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")
    local_audio_path = payload.get("localAudioPath")

    if not isinstance(local_audio_path, str) or not local_audio_path:
        raise ValueError("localAudioPath is required.")

    result = genre_inference_service.infer(local_audio_path)
    print(
        json.dumps(
            {
                "scores": result.scores,
                "labels": result.labels,
                "modelVersion": result.model_version,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
