from server.app import app, db
from sqlalchemy import text, exc

def init_database():
    with app.app_context():
        conn = db.engine.connect()
        
        # Check if enum type exists before trying to create it
        try:
            result = conn.execute(text(
                "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'artwork_rarity_enum')"
            ))
            enum_exists = result.scalar()
            
            if not enum_exists:
                conn.execute(text(
                    "CREATE TYPE artwork_rarity_enum AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary')"
                ))
                conn.commit()
                print("✅ Created artwork_rarity_enum type")
            else:
                print("✅ artwork_rarity_enum type already exists")
                
        except Exception as e:
            print(f"⚠️ Error checking/creating enum: {e}")
            
        # Drop all tables first (to avoid conflicts)
        try:
            db.drop_all()
            print("✅ Dropped existing tables")
        except Exception as e:
            print(f"⚠️ Error dropping tables: {e}")
        
        # Create all tables from scratch
        try:
            db.create_all()
            print("✅ Created all tables from models")
            return True
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
            return False

if __name__ == "__main__":
    success = init_database()
    if success:
        print("Database initialization complete!")
    else:
        print("Database initialization failed.")