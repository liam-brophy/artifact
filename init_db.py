from server.app import app, db
from sqlalchemy import text, exc

def init_database():
    with app.app_context():
        conn = db.engine.connect()
        
        # Define all enum types needed
        enum_types = {
            'artwork_rarity_enum': ['common', 'uncommon', 'rare', 'epic', 'legendary'],
            'tradestatus': ['pending', 'accepted', 'rejected', 'canceled']  # Add the values for tradestatus
        }
        
        # Create all enum types
        for enum_name, enum_values in enum_types.items():
            try:
                result = conn.execute(text(
                    f"SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}')"
                ))
                enum_exists = result.scalar()
                
                if not enum_exists:
                    values_str = "', '".join(enum_values)
                    conn.execute(text(
                        f"CREATE TYPE {enum_name} AS ENUM ('{values_str}')"
                    ))
                    conn.commit()
                    print(f"✅ Created {enum_name} type")
                else:
                    print(f"✅ {enum_name} type already exists")
                    
            except Exception as e:
                print(f"⚠️ Error with enum {enum_name}: {e}")
                
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