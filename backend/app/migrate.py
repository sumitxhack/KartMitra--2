import os
import logging
from .config.database import get_db

logger = logging.getLogger("app")

def run_migrations():
    """
    Scans the SQL migration scripts directory and applies any pending scripts.
    """
    logger.info("[Migrations] Scanning for pending SQL migrations...")

    cwd = os.getcwd()
    migrations_dir = os.path.join(cwd, "src/db/migrations")

    # Fallback paths for running scripts under different paths
    if not os.path.exists(migrations_dir):
        migrations_dir = os.path.join(cwd, "backend/src/db/migrations")

    if not os.path.exists(migrations_dir):
        logger.error(f"[Migrations] Migrations folder could not be located. Checked path: {migrations_dir}")
        raise FileNotFoundError("Migrations directory not found")

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Create tracking table if missing
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) UNIQUE NOT NULL,
                        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()

                # Get applied migrations
                cur.execute("SELECT name FROM schema_migrations;")
                applied = {row[0] for row in cur.fetchall()}

                # Read and sort pending files
                files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".sql")])

                for file in files:
                    if file in applied:
                        logger.info(f"[Migrations] Skipping: {file} (already applied)")
                        continue

                    logger.info(f"[Migrations] Applying: {file}...")
                    file_path = os.path.join(migrations_dir, file)
                    with open(file_path, "r", encoding="utf-8") as f:
                        sql = f.read()

                    # Run in transaction block
                    try:
                        cur.execute(sql)
                        cur.execute("INSERT INTO schema_migrations (name) VALUES (%s);", (file,))
                        conn.commit()
                        logger.info(f"[Migrations] Completed: {file} applied successfully.")
                    except Exception as tx_err:
                        conn.rollback()
                        logger.error(f"[Migrations] Error in transaction for {file}: {tx_err}")
                        raise tx_err

            logger.info("[Migrations] Database migrations check finished.")
    except Exception as e:
        logger.error(f"[Migrations] Migration runner failed: {e}")
        raise e
