# ============================================================
# api/database.py
# Responsibility: Manage Neon Postgres connections for the API
# Uses same env var pattern as pipeline/load.py
# ============================================================
import os 
import psycopg2
import psycopg2.extras 
from dotenv import load_dotenv
from contextlib import contextmanager 

load_dotenv()

def get_connection():
    """
    Create and return a Postgres connection.
    Uses Neon if NEON_DB is set, otherwise local Docker.
    """

    neon_host = os.getenv("NEON_DB_HOST")

    if neon_host:
        conn = psycopg2.connect(
            host=neon_host,
            port=os.getenv("NEON_DB_PORT", 5432),
            dbname=os.getenv("NEON_DB_NAME", "neondb"),
            user=os.getenv("NEON_DB_USER"),
            password=os.getenv("NEON_DB_PASSWORD"),
            sslmode= os.getenv("NEON_DB_SSLMODE", "require")
        )
    else:
        conn = psycopg2.connect(
            host = os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", 5432),
            dbname=os.getenv("DB_NAME", "nz_energy"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres")
        )
    
    return conn

@contextmanager
def get_db():
    """
    Context manager for database connections.
    Ensures connection is always closed after use.

    Usage: 
        with get_db() as conn:
            cursor = conn.cursor(...)
            cursor = execute(...)
    """

    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()

def query_one(sql:str, params: tuple = None) -> dict:
    """
    Execute a query and return a single row as a dict.
    Returns None if no rows found.
    """

    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None

def query_many(sql: str, params: tuple = None) -> list:
    """
    Execute a query and return all rows as a list of dicts.
    Returns empty list if no rows found.
    """

    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(row) for row in rows]


