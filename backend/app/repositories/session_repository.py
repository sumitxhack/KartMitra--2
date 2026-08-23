from ..config.database import get_db

class SessionRepository:
    @staticmethod
    def create(user_id: str | None, store_id: str) -> dict:
        """
        Start a new shopping session in the database.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO shopping_sessions (user_id, status)
                    VALUES (%s, 'active')
                    RETURNING id, user_id, status, created_at, updated_at;
                    """,
                    (user_id,)
                )
                row = cur.fetchone()
                conn.commit()
                return {
                    "id": str(row[0]),
                    "user_id": str(row[1]) if row[1] else None,
                    "status": row[2],
                    "storeId": store_id,
                    "created_at": row[3].isoformat() if row[3] else None,
                    "updated_at": row[4].isoformat() if row[4] else None
                }

    @staticmethod
    def find_by_id(session_id: str) -> dict | None:
        """
        Fetch session by ID.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, user_id, status, created_at, updated_at "
                    "FROM shopping_sessions WHERE id = %s;",
                    (session_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    "id": str(row[0]),
                    "user_id": str(row[1]) if row[1] else None,
                    "status": row[2],
                    "created_at": row[3].isoformat() if row[3] else None,
                    "updated_at": row[4].isoformat() if row[4] else None
                }

    @staticmethod
    def update_status(session_id: str, status: str) -> dict | None:
        """
        Update the session status (e.g. 'completed', 'active').
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE shopping_sessions
                    SET status = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, user_id, status, created_at, updated_at;
                    """,
                    (status, session_id)
                )
                row = cur.fetchone()
                conn.commit()
                if not row:
                    return None
                return {
                    "id": str(row[0]),
                    "user_id": str(row[1]) if row[1] else None,
                    "status": row[2],
                    "created_at": row[3].isoformat() if row[3] else None,
                    "updated_at": row[4].isoformat() if row[4] else None
                }
