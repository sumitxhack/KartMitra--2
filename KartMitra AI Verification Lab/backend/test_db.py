try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    DB_CONN_STRING = "host=127.0.0.1 port=5432 user=postgres dbname=kartmitra connect_timeout=3"
    print("Attempting to connect to PostgreSQL...")
    with psycopg2.connect(DB_CONN_STRING) as conn:
        print("Connected successfully!")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, name, price, weight, category FROM products WHERE barcode = %s", ("8901234567890",))
            res = cur.fetchone()
            print("Query completed. Result:", res)
except Exception as e:
    print(f"Database notice: {e}")

