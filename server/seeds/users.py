# server/seeds/users.py
from flask_seeder import Seeder
from faker import Faker # Import the main Faker class
from server.models.user import User
from server.extensions import db
import random

# Initialize Faker directly
faker_instance = Faker() # No need for cls or init here usually

class UserSeeder(Seeder):
    def run(self):
        print("Seeding Users...")
        num_artists = 5
        print(f"Creating {num_artists} artists...")
        for _ in range(num_artists):
            # --- FIX FAKER CALLS ---
            user = User(
                username=faker_instance.user_name(), # Direct call
                email=faker_instance.unique.email(), # Use unique for email
                role='artist',
                bio=faker_instance.text(max_nb_chars=200), # Direct call
                profile_image_url=f"https://i.pravatar.cc/150?u={random.randint(1, 10000)}"
            )
            # -----------------------
            user.set_password('password')
            print(f"  Adding artist: {user.username}")
            db.session.add(user)

        num_patrons = 15
        print(f"Creating {num_patrons} patrons...")
        for _ in range(num_patrons):
             # --- FIX FAKER CALLS ---
             user = User(
                username=faker_instance.user_name(), # Direct call
                email=faker_instance.unique.email(), # Use unique for email
                role='patron',
                bio=faker_instance.text(max_nb_chars=150), # Direct call
                profile_image_url=f"https://i.pravatar.cc/150?u={random.randint(1, 10000)}"
             )
             # -----------------------
             user.set_password('password')
             print(f"  Adding patron: {user.username}")
             db.session.add(user)

        # Commit logic (keep explicit commit here)
        try:
            print("Committing seeded users...")
            db.session.commit()
            print("User commit successful.")
        except Exception as e:
            print(f"Error committing users: {e}")
            db.session.rollback()
            raise