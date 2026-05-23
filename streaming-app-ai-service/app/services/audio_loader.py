import shutil
from contextlib import contextmanager
from dataclasses import dataclass
from mimetypes import guess_type
from pathlib import Path
from typing import Iterator
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from app.core.config import settings
from app.utils.temp_files import temporary_file_path

SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"}
SUPPORTED_AUDIO_CONTENT_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "application/octet-stream",
}


@dataclass(slots=True)
class DownloadedAudioFile:
    source_url: str
    local_path: Path
    content_type: str | None = None
    size_bytes: int = 0


def _guess_suffix(audio_url: str, content_type: str | None) -> str:
    parsed = urlparse(audio_url)
    suffix = Path(parsed.path).suffix
    if suffix:
        return suffix

    suffix_by_content_type = {
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/flac": ".flac",
        "audio/x-flac": ".flac",
        "audio/mp4": ".m4a",
        "audio/x-m4a": ".m4a",
        "audio/ogg": ".ogg",
        "audio/aac": ".aac",
    }

    if content_type in suffix_by_content_type:
        return suffix_by_content_type[content_type]

    return ".audio"


def _guess_local_content_type(path: Path) -> str | None:
    guessed_content_type, _ = guess_type(path.name)
    return guessed_content_type


def _normalize_content_type(content_type: str | None) -> str | None:
    if not content_type:
        return None

    return content_type.split(";", 1)[0].strip().lower() or None


def _is_supported_audio_source(content_type: str | None, path: Path) -> bool:
    normalized_content_type = _normalize_content_type(content_type)
    if normalized_content_type in SUPPORTED_AUDIO_CONTENT_TYPES:
        return True

    suffix = path.suffix.lower()
    if suffix in SUPPORTED_AUDIO_EXTENSIONS:
        return True

    return _normalize_content_type(_guess_local_content_type(path)) in SUPPORTED_AUDIO_CONTENT_TYPES


def _validate_audio_file(path: Path, content_type: str | None, size_bytes: int) -> None:
    if size_bytes <= 0:
        raise ValueError("Downloaded audio file is empty.")

    if not _is_supported_audio_source(content_type, path):
        normalized_content_type = _normalize_content_type(content_type) or "unknown"
        raise ValueError(
            f"Unsupported audio content type or extension. contentType={normalized_content_type}, "
            f"path={path.name}"
        )


def _resolve_local_input_path(audio_url: str, parsed) -> str | None:
    candidate_path = Path(audio_url)
    if candidate_path.exists():
        return str(candidate_path)

    if parsed.scheme == "file":
        raw_path = parsed.path
        if raw_path.startswith("/") and len(raw_path) > 2 and raw_path[2] == ":":
            raw_path = raw_path.lstrip("/")
        return raw_path

    if len(parsed.scheme) == 1 and audio_url[1:3] in {":\\", ":/"}:
        return audio_url

    if parsed.scheme == "":
        return audio_url

    return None


@contextmanager
def _copy_local_audio_to_temp_file(local_path_value: str) -> Iterator[DownloadedAudioFile]:
    source_path = Path(local_path_value)
    if not source_path.exists():
        raise FileNotFoundError(f"Local audio path not found: {source_path}")

    with temporary_file_path(suffix=source_path.suffix or ".audio") as temp_path:
        shutil.copyfile(source_path, temp_path)
        size_bytes = temp_path.stat().st_size
        content_type = _guess_local_content_type(source_path)
        _validate_audio_file(temp_path, content_type, size_bytes)
        yield DownloadedAudioFile(
            source_url=str(source_path.resolve()),
            local_path=temp_path,
            content_type=content_type,
            size_bytes=size_bytes,
        )


@contextmanager
def download_audio_to_temp_file(audio_url: str) -> Iterator[DownloadedAudioFile]:
    parsed = urlparse(audio_url)
    local_input_path = _resolve_local_input_path(audio_url, parsed)

    if local_input_path is not None and parsed.scheme not in {"http", "https"}:
        with _copy_local_audio_to_temp_file(local_input_path) as downloaded_audio:
            yield downloaded_audio
        return

    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"Unsupported audio URL scheme: {parsed.scheme}")

    request = Request(audio_url, headers={"User-Agent": "music-streaming-ai-service/0.5"})

    with urlopen(request, timeout=settings.audio_fetch_timeout_seconds) as response:
        content_type = _normalize_content_type(response.headers.get("Content-Type"))
        suffix = _guess_suffix(audio_url, content_type)

        with temporary_file_path(suffix=suffix) as temp_path:
            total_bytes = 0
            with temp_path.open("wb") as output_file:
                while True:
                    chunk = response.read(64 * 1024)
                    if not chunk:
                        break

                    total_bytes += len(chunk)
                    if total_bytes > settings.audio_fetch_max_bytes:
                        raise ValueError(
                            f"Audio sample exceeds {settings.audio_fetch_max_bytes} bytes fetch limit."
                        )

                    output_file.write(chunk)

            _validate_audio_file(temp_path, content_type, total_bytes)

            yield DownloadedAudioFile(
                source_url=audio_url,
                local_path=temp_path,
                content_type=content_type,
                size_bytes=total_bytes,
            )
