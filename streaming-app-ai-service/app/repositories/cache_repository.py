class CacheRepository:
    """
    Placeholder for recommendation cache storage such as Redis.
    """

    def get_cached_recommendations(self, cache_key: str) -> list[str]:
        raise NotImplementedError("CacheRepository is not wired yet.")


cache_repository = CacheRepository()
