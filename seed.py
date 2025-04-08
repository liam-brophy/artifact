from server.app import create_app, db # Import factory and db instance
# Import your specific Seeder classes
from server.seeds.users import UserSeeder
from server.seeds.artworks import ArtworkSeeder

print("Creating Flask app for seeding...")
# Create an app instance specifically for this script
app = create_app()

# --- IMPORTANT: Push an application context ---
# This makes 'db' and other app-bound resources available
with app.app_context():
    print("App context pushed.")

    # --- Optional: Reset Database ---
    # Uncomment these lines if you want to wipe before seeding
    # print("Dropping all tables...")
    # db.drop_all()
    # print("Creating all tables...")
    # db.create_all()
    # print("Tables created.")
    # -----------------------------------

    # Instantiate your seeders (they don't need app/db passed)
    user_seeder = UserSeeder()
    artwork_seeder = ArtworkSeeder()

    # Run the seeders IN THE CORRECT ORDER
    print("\n--- Running User Seeder ---")
    user_seeder.run() # UserSeeder uses db.session internally

    print("\n--- Running Artwork Seeder ---")
    artwork_seeder.run() # ArtworkSeeder uses db.session internally

    # --- Explicit Commit (Optional but Recommended) ---
    # Although the seeders might commit, a final commit ensures everything is saved.
    # Note: If seeders already commit, this might be redundant or cause issues
    # if there was a failure in one of the seeders that wasn't caught.
    # Consider the commit logic within your individual seeders. If they handle
    # commit/rollback, you might not need this final one.
    # try:
    #     print("\nPerforming final commit...")
    #     db.session.commit()
    #     print("Seeding complete and committed.")
    # except Exception as e:
    #     print(f"\nError during final commit: {e}")
    #     db.session.rollback()
    #     print("Rolled back session.")
    # ----------------------------------------------------

    # If your individual seeders handle commits, just print completion:
    print("\nSeeding process finished.")