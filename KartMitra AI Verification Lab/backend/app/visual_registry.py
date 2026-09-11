import sys
from app.db import SessionLocal
from app.visual_registry_service import build_product_visual_registry

def main():
    args = sys.argv[1:]
    command = args[0] if args else "rebuild"
    
    if command.lower() == "rebuild":
        print("Visual Registry Build")
        print("---------------------")
        db = SessionLocal()
        try:
            stats = build_product_visual_registry(db)
            print(f"Products: {stats['products_processed']}")
            print(f"Images: {stats['images_processed']}")
            print(f"Successfully Embedded: {stats['embeddings_created']}")
            print(f"Failed: {stats['failed_images']}")
            print(f"FAISS Index: {stats['index_size']} vectors")
            print(f"Model: {stats['model']}")
        finally:
            db.close()
    else:
        print(f"Unknown command: '{command}'. Usage: python -m app.visual_registry rebuild")

if __name__ == "__main__":
    main()
