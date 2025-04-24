import psycopg2
import os

def create_enum():
    conn_string = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(conn_string)
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Check if type exists first to prevent errors
    cursor.execute("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'artwork_rarity_enum')")
    exists = cursor.fetchone()[0]
    
    if not exists:
        cursor.execute("CREATE TYPE artwork_rarity_enum AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary')")
        print("Created artwork_rarity_enum type")
    else:
        print("artwork_rarity_enum type already exists")
    
    conn.close()

if __name__ == "__main__":
    create_enum()