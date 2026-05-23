import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


@contextmanager
def temporary_file_path(suffix: str = "") -> Iterator[Path]:
    file_descriptor, raw_path = tempfile.mkstemp(prefix="genre-analysis-", suffix=suffix)
    os.close(file_descriptor)
    temp_path = Path(raw_path)

    try:
        yield temp_path
    finally:
        temp_path.unlink(missing_ok=True)
