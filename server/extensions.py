from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_cors import CORS
from datetime import timedelta  # Add missing import for timedelta

# Initialize extensions without app context here
db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()
cors = CORS()
# Add others...

# Define shared objects like your blocklist here
# For production, use Redis or a database-backed blocklist,
# but the principle of defining it here remains.
BLOCKLIST = set()

# JWT configurations will be applied in the create_app function
# where we have access to the app instance