from ..repositories.session_repository import SessionRepository
from fastapi import HTTPException

class SessionService:
    @staticmethod
    def start_session(user_id: str | None, store_id: str) -> dict:
        """
        Starts a new shopping session for a store.
        """
        return SessionRepository.create(user_id, store_id)

    @staticmethod
    def get_session(session_id: str) -> dict:
        """
        Fetches session details.
        """
        session = SessionRepository.find_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Shopping session {session_id} not found")
        return session

    @staticmethod
    def complete_session(session_id: str) -> dict:
        """
        Completes the shopping session.
        """
        session = SessionRepository.update_status(session_id, "completed")
        if not session:
            raise HTTPException(status_code=404, detail=f"Shopping session {session_id} not found")
        return session
