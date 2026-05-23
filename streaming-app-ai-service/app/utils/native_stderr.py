import os
import sys
import threading
from contextlib import contextmanager
from collections.abc import Iterator

_FILTER_LOCK = threading.Lock()


def _matches_any(raw_line: bytes, patterns: tuple[str, ...]) -> bool:
    text = raw_line.decode("utf-8", errors="replace")
    return any(pattern in text for pattern in patterns)


@contextmanager
def filter_native_stderr_lines(patterns: list[str] | tuple[str, ...]) -> Iterator[None]:
    pattern_tuple = tuple(patterns)
    if not pattern_tuple:
        yield
        return

    try:
        stderr_fd = sys.stderr.fileno()
    except Exception:
        yield
        return

    with _FILTER_LOCK:
        sys.stderr.flush()
        original_stderr_fd = os.dup(stderr_fd)
        read_fd, write_fd = os.pipe()

        def drain_filtered_stderr() -> None:
            with os.fdopen(read_fd, "rb", closefd=True) as reader:
                for raw_line in reader:
                    if _matches_any(raw_line, pattern_tuple):
                        continue
                    os.write(original_stderr_fd, raw_line)

        drain_thread = threading.Thread(target=drain_filtered_stderr, daemon=True)
        drain_thread.start()

        try:
            os.dup2(write_fd, stderr_fd)
            os.close(write_fd)
            yield
        finally:
            sys.stderr.flush()
            os.dup2(original_stderr_fd, stderr_fd)
            drain_thread.join(timeout=1)
            os.close(original_stderr_fd)
