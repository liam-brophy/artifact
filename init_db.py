from server.app import app, db
from sqlalchemy import text

def init_database():
    with app.app_context():
        # First, check and create the enum type
        conn = db.engine.connect()
        try:
            conn.execute(text("CREATE TYPE IF NOT EXISTS artwork_rarity_enum AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary')"))
            conn.commit()
            print("✅ Created or verified artwork_rarity_enum type")
        except Exception as e:
            print(f"⚠️ Error creating enum: {e}")
        
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