class UserRepository:
    """
    Placeholder for future user graph access such as follows,
    artist affinity, and cached user profile features.
    """

    def fetch_user_context(self, user_id: str) -> dict:
        raise NotImplementedError("UserRepository is not wired yet.")


user_repository = UserRepository()
