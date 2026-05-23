class SongRepository:
    """
    Placeholder for future read-only access to songs if the AI service
    needs to query PostgreSQL directly instead of relying on backend payloads.
    """

    def fetch_candidates(self, user_id: str) -> list[dict]:
        raise NotImplementedError("SongRepository is not wired yet.")


song_repository = SongRepository()
