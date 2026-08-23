from ..config.database import get_db

class UserRepository:
    @staticmethod
    def find_by_email(email: str) -> dict | None:
        """
        Fetch a user profile by email address.
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, email, password, name, role, created_at FROM users WHERE email = %s;",
                    (email,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    "id": str(row[0]),
                    "email": row[1],
                    "password": row[2],
                    "name": row[3],
                    "role": row[4],
                    "created_at": row[5].isoformat() if row[5] else None
                }

    @staticmethod
    def create(data: dict) -> dict:
        """
        Create a new user in the PostgreSQL database.
        """
        email = data["email"]
        password = data["password"]
        name = data.get("name")
        role = data.get("role", "user")

        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (email, password, name, role)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, email, name, role, created_at;
                    """,
                    (email, password, name, role)
                )
                row = cur.fetchone()
                conn.commit()
                return {
                    "id": str(row[0]),
                    "email": row[1],
                    "name": row[2],
                    "role": row[3],
                    "created_at": row[4].isoformat() if row[4] else None
                }
