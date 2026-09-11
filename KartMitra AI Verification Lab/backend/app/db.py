import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DATABASE_URL

Base = declarative_base()

def auto_migrate_columns(target_engine):
    """Safely adds missing columns to existing SQLite / PostgreSQL database without data loss."""
    from sqlalchemy import text, inspect
    try:
        insp = inspect(target_engine)
        if "products" in insp.get_table_names():
            cols = [c["name"] for c in insp.get_columns("products")]
            with target_engine.connect() as conn:
                if "keywords" not in cols:
                    conn.execute(text("ALTER TABLE products ADD COLUMN keywords TEXT"))
                    conn.commit()
                if "ocr_text" not in cols:
                    conn.execute(text("ALTER TABLE products ADD COLUMN ocr_text TEXT"))
                    conn.commit()
        if "verification_logs" in insp.get_table_names():
            v_cols = [c["name"] for c in insp.get_columns("verification_logs")]
            with target_engine.connect() as conn:
                if "multi_signal_json" not in v_cols:
                    conn.execute(text("ALTER TABLE verification_logs ADD COLUMN multi_signal_json TEXT"))
                    conn.commit()
    except Exception as e:
        print(f"[DB Migration Warning] Column migration notice: {e}", flush=True)

try:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )
    with engine.connect() as conn:
        pass
    Base.metadata.create_all(bind=engine)
    auto_migrate_columns(engine)
except Exception as e:
    print(f"[DB Warning] PostgreSQL connection failed ({e}). Falling back to SQLite database.", flush=True)
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "kartmitra.db"))
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    auto_migrate_columns(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_default_products_if_empty(db):
    try:
        from app import models
        if not hasattr(models, "Product"):
            return
        count = db.query(models.Product).count()
        if count == 0:
            sample_products = [
                models.Product(id="1", barcode="8901234567890", name="Amul Taaza Milk", price=62, weight=1.0, category="Dairy & Eggs"),
                models.Product(id="2", barcode="123456789012", name="Coca Cola 500ml", price=40, weight=0.5, category="Beverages"),
                models.Product(id="3", barcode="9780201633610", name="Design Patterns Book", price=3200, weight=1.2, category="Books"),
                models.Product(id="prod_amul_butter", barcode="8901262010052", name="Amul Pasteurised Butter 500g", price=275, weight=0.50, category="Dairy & Eggs"),
                models.Product(id="prod_dairy_milk", barcode="7622201741549", name="Cadbury Dairy Milk Silk 150g", price=180, weight=0.15, category="Confectionery"),
                models.Product(id="prod_tata_salt", barcode="8901058000078", name="Tata Salt Iodized 1kg", price=28, weight=1.00, category="Grocery Essentials"),
                models.Product(id="prod_maggi", barcode="8901058852318", name="Maggi 2-Minute Noodles 280g", price=52, weight=0.28, category="Instant Food"),
            ]
            db.add_all(sample_products)
            db.commit()
    except Exception as e:
        print(f"[DB Warning] Seeding warning: {e}", flush=True)

# Clean, ultra-fast dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

