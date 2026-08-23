import logging
from contextlib import contextmanager
from psycopg2 import pool
from .settings import settings

logger = logging.getLogger("app")

# Thread-safe database connection pool singleton
db_pool = None

def init_db_pool():
    global db_pool
    if db_pool is None:
        try:
            logger.info("Initializing database connection pool...")
            db_pool = pool.SimpleConnectionPool(
                minconn=1,
                maxconn=20,
                dsn=settings.DATABASE_URL
            )
            logger.info("Database connection pool created.")
        except Exception as e:
            logger.error(f"Error creating connection pool: {e}")
            raise e

def get_db_connection():
    if db_pool is None:
        init_db_pool()
    return db_pool.getconn()

def release_db_connection(conn):
    if db_pool is not None and conn is not None:
        db_pool.putconn(conn)

@contextmanager
def get_db():
    """
    Context manager that yields a database connection from the pool.
    """
    conn = None
    try:
        conn = get_db_connection()
        yield conn
    except Exception as e:
        logger.error(f"Database error: {e}")
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            release_db_connection(conn)

def test_connection() -> bool:
    """
    Verifies that the server can connect to the database.
    """
    try:
        init_db_pool()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT NOW();")
                db_time = cur.fetchone()[0]
                logger.info(f"[Database] Connection verified. Current DB timestamp: {db_time}")
                return True
    except Exception as e:
        logger.error(f"[Database] Connection verification failed: {e}")
        raise e
