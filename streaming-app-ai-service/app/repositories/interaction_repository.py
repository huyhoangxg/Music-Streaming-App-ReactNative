class InteractionRepository:
    """
    Placeholder for future access to play history, likes, reposts,
    and playlist interactions from PostgreSQL or a cache layer.
    """

    def fetch_user_interactions(self, user_id: str) -> list[dict]:
        raise NotImplementedError("InteractionRepository is not wired yet.")


interaction_repository = InteractionRepository()
