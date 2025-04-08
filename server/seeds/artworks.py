from flask_seeder import Seeder
from faker import Faker # Import the main Faker class
from server.models.user import User
from server.models.artwork import Artwork
from server.extensions import db
import random

MEDIUMS = ["Oil on Canvas", "Acrylic on Panel", "Watercolor", "Digital Print", "Photograph", "Sculpture", "Mixed Media"]
# Initialize Faker directly
faker_instance = Faker()

class ArtworkSeeder(Seeder):
    def run(self):
        print("Seeding Artworks...")
        print("Fetching artists from database...")
        artists = User.query.filter_by(role='artist').all()

        if not artists:
            print("  WARNING: No artists found. Skipping artwork seeding.")
            return

        print(f"Found {len(artists)} artists. Seeding artworks...")
        total_artworks = 0
        for artist_user in artists:
            num_artworks_per_artist = random.randint(5, 20)
            print(f"  Creating {num_artworks_per_artist} artworks for artist: {artist_user.username} (ID: {artist_user.user_id})...")
            for i in range(num_artworks_per_artist):
                # --- FIX FAKER CALLS ---
                title = faker_instance.sentence(nb_words=random.randint(2, 6)).replace('.', '')
                year = random.randint(1980, 2024)
                medium = random.choice(MEDIUMS)
                img_width = random.randint(400, 800)
                img_height = random.randint(300, 600)
                image_url = f"https://picsum.photos/seed/{artist_user.user_id}_{i}/{img_width}/{img_height}.jpg"
                thumbnail_url = f"https://picsum.photos/seed/{artist_user.user_id}_{i}/250/250.jpg"
                description = faker_instance.paragraph(nb_sentences=random.randint(2, 5))
                # -----------------------

                artwork = Artwork(
                    artist_id=artist_user.user_id,
                    title=title,
                    description=description,
                    image_url=image_url,
                    thumbnail_url=thumbnail_url,
                    year=year,
                    medium=medium
                )
                db.session.add(artwork)
                total_artworks += 1

        # Commit logic (keep explicit commit here)
        try:
            print(f"Committing {total_artworks} seeded artworks...")
            db.session.commit()
            print("Artwork commit successful.")
        except Exception as e:
            print(f"Error committing artworks: {e}")
            db.session.rollback()
            raise

        print(f"Artwork seeding complete. Total artworks created: {total_artworks}")