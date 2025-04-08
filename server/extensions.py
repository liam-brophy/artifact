from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_cors import CORS
# Add any other extensions you use (like Marshmallow, Bcrypt, etc.)

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