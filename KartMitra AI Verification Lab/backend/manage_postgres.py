import os
import sys
import subprocess
import urllib.request
import zipfile
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PG_DIR = BASE_DIR / "postgres"
ZIP_PATH = PG_DIR / "postgresql.zip"
BIN_DIR = PG_DIR / "pgsql" / "bin"
DATA_DIR = PG_DIR / "data"
LOG_FILE = PG_DIR / "postgres.log"

DOWNLOAD_URL = "https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64-binaries.zip"

# Add PG bin directory to PATH so dlls can be resolved
os.environ["PATH"] = str(BIN_DIR) + os.pathsep + os.environ["PATH"]

def log(msg):
    print(f"[Postgres Manager] {msg}", flush=True)

def download_postgres():
    if ZIP_PATH.exists():
        log("Zip archive already exists.")
        return

    PG_DIR.mkdir(parents=True, exist_ok=True)
    log(f"Downloading PostgreSQL binaries from {DOWNLOAD_URL}...")
    
    def report(block_num, block_size, total_size):
        read_so_far = block_num * block_size
        if total_size > 0:
            percent = min(100, read_so_far * 100 // total_size)
            sys.stdout.write(f"\rDownloading... {percent}%")
            sys.stdout.flush()
        else:
            sys.stdout.write(".")
            sys.stdout.flush()

    urllib.request.urlretrieve(DOWNLOAD_URL, ZIP_PATH, reporthook=report)
    print()
    log("Download completed.")

def extract_postgres():
    if BIN_DIR.exists():
        log("Binaries folder already exists.")
        return

    log(f"Extracting {ZIP_PATH} (excluding pgAdmin, doc, symbols to prevent MAX_PATH errors)...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        members = zip_ref.infolist()
        extracted_count = 0
        skipped_count = 0
        for member in members:
            # Skip pgAdmin, doc, symbols, and include folders to avoid path length issues
            path_parts = Path(member.filename).parts
            if len(path_parts) > 1 and any(
                p in path_parts for p in ["pgAdmin 4", "doc", "symbols", "include"]
            ):
                skipped_count += 1
                continue
                
            try:
                zip_ref.extract(member, PG_DIR)
                extracted_count += 1
            except Exception as e:
                # If extraction fails due to path length, log and skip
                log(f"Skipping {member.filename} due to extraction error: {e}")
                skipped_count += 1
                
    log(f"Extraction complete. Extracted {extracted_count} files, skipped {skipped_count} files.")
    
    # Remove ZIP file to save space
    if ZIP_PATH.exists():
        os.remove(ZIP_PATH)
        log("Cleaned up download zip.")

def init_db():
    if DATA_DIR.exists():
        log("Data directory already exists. Skipping initdb.")
        return

    log("Initializing database cluster...")
    initdb_cmd = [
        str(BIN_DIR / "initdb.exe"),
        "-D", str(DATA_DIR),
        "-U", "postgres",
        "--auth-local=trust",
        "--auth-host=trust"
    ]
    result = subprocess.run(initdb_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log(f"initdb failed:\nStdout: {result.stdout}\nStderr: {result.stderr}")
        sys.exit(1)
    log("Database cluster initialized successfully.")

def start_db():
    log("Starting PostgreSQL...")
    pg_ctl = BIN_DIR / "pg_ctl.exe"
    
    # Start pg_ctl without capturing output to avoid blocking on inherited handles
    cmd = [
        str(pg_ctl),
        "-D", str(DATA_DIR),
        "-o", "-p 5432",
        "-l", str(LOG_FILE),
        "start"
    ]
    
    result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS)
    if result.returncode != 0:
        log("Failed to issue start command via pg_ctl.")
        return False
    
    log("PostgreSQL start command issued. Waiting for server to accept connections...")
    
    # Poll using pg_isready to verify startup
    pg_isready = BIN_DIR / "pg_isready.exe"
    ready_cmd = [str(pg_isready), "-p", "5432", "-h", "127.0.0.1", "-U", "postgres"]
    for _ in range(10):
        res = subprocess.run(ready_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if res.returncode == 0:
            log("PostgreSQL is running and ready to accept connections.")
            return True
        time.sleep(1)
        
    log("Timeout waiting for PostgreSQL to start. Check postgres.log for details.")
    return False

def stop_db():
    log("Stopping PostgreSQL...")
    pg_ctl = BIN_DIR / "pg_ctl.exe"
    cmd = [
        str(pg_ctl),
        "-D", str(DATA_DIR),
        "stop"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    log(result.stdout)
    log("PostgreSQL stopped.")

def seed_db():
    log("Seeding database...")
    # Import psycopg here to avoid dependency issues if psycopg is not installed yet
    try:
        import psycopg
    except ImportError:
        log("psycopg is not installed. Make sure virtual environment is active and backend dependencies are installed.")
        return

    # Connect to default postgres DB first to create kartmitra DB if not exists
    try:
        conn = psycopg.connect("postgresql://postgres@127.0.0.1:5432/postgres", autocommit=True)
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = 'kartmitra'")
            exists = cur.fetchone()
            if not exists:
                cur.execute("CREATE DATABASE kartmitra")
                log("Created database 'kartmitra'.")
            else:
                log("Database 'kartmitra' already exists.")
        conn.close()
    except Exception as e:
        log(f"Error checking/creating database: {e}")
        return

    # Now connect to kartmitra DB to create table and seed data
    try:
        conn = psycopg.connect("postgresql://postgres@127.0.0.1:5432/kartmitra", autocommit=True)
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id VARCHAR(255) PRIMARY KEY,
                    barcode VARCHAR(255) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    price INTEGER NOT NULL,
                    weight REAL NOT NULL,
                    category VARCHAR(255) NOT NULL
                );

                CREATE TABLE IF NOT EXISTS product_images (
                    id VARCHAR(255) PRIMARY KEY,
                    product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
                    image_path VARCHAR(512) NOT NULL,
                    thumbnail_path VARCHAR(512) NOT NULL,
                    image_type VARCHAR(100) NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    file_size INTEGER NOT NULL,
                    file_hash VARCHAR(64) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            log("Tables 'products' and 'product_images' created/verified.")

            # Seed data
            products_to_seed = [
                ("1", "8901234567890", "Amul Taaza Milk", 62, 1.0, "Dairy & Eggs"),
                ("2", "123456789012", "Coca Cola 500ml", 40, 0.5, "Beverages"),
                ("3", "9780201633610", "Design Patterns Book", 3200, 1.2, "Books"),
                ("prod_amul_butter", "8901262010052", "Amul Pasteurised Butter 500g", 275, 0.50, "Dairy & Eggs"),
                ("prod_dairy_milk", "7622201741549", "Cadbury Dairy Milk Silk 150g", 180, 0.15, "Confectionery"),
                ("prod_tata_salt", "8901058000078", "Tata Salt Iodized 1kg", 28, 1.00, "Grocery Essentials"),
                ("prod_maggi", "8901058852318", "Maggi 2-Minute Noodles 280g", 52, 0.28, "Instant Food"),
            ]

            for pid, barcode, name, price, weight, category in products_to_seed:
                cur.execute("""
                    INSERT INTO products (id, barcode, name, price, weight, category)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (barcode) DO UPDATE 
                    SET name = EXCLUDED.name, price = EXCLUDED.price, weight = EXCLUDED.weight, category = EXCLUDED.category
                """, (pid, barcode, name, price, weight, category))
                
            log("Sample products seeded successfully.")
        conn.close()
    except Exception as e:
        log(f"Error seeding database: {e}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python manage_postgres.py [start|stop|init|seed|status]")
        sys.exit(1)

    action = sys.argv[1].lower()

    if action == "init":
        download_postgres()
        extract_postgres()
        init_db()
    elif action == "start":
        if not BIN_DIR.exists() or not DATA_DIR.exists():
            log("Postgres is not initialized. Running initialization first...")
            download_postgres()
            extract_postgres()
            init_db()
        start_db()
    elif action == "stop":
        stop_db()
    elif action == "seed":
        seed_db()
    elif action == "status":
        pg_isready = BIN_DIR / "pg_isready.exe"
        if pg_isready.exists():
            ready_cmd = [str(pg_isready), "-p", "5432", "-h", "127.0.0.1", "-U", "postgres"]
            res = subprocess.run(ready_cmd, capture_output=True, text=True)
            print(res.stdout.strip())
        else:
            print("PostgreSQL binaries not found. Not initialized.")
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)

if __name__ == "__main__":
    main()
