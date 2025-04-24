from sqlalchemy import create_engine, text
import os

# Get database URL from environment
database_url = os.environ.get('DATABASE_URL')

# Handle postgres:// vs postgresql:// in connection strings
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

try:
    # Create engine and execute SQL directly
    engine = create_engine(database_url)
    with engine.connect() as conn:
        # Check if enum exists
        result = conn.execute(text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'artwork_rarity_enum')"))
        exists = result.scalar()
        
        if not exists:
            conn.execute(text("CREATE TYPE artwork_rarity_enum AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary')"))
            conn.commit()
            print("Created artwork_rarity_enum type")
        else:
            print("artwork_rarity_enum type already exists")
except Exception as e:
    print(f"Error fixing migrations: {e}")