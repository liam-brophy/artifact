from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_cors import CORS
from datetime import timedelta  # Add missing import for timedelta

# Initialize extensions without app context here
db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()

# Initialize CORS with default configuration
cors = CORS(resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173", 
            "http://127.0.0.1:5173",
            "https://www.artifact.online"
        ],
        "supports_credentials": True,
        "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-CSRF-Token"]
    }
})

# Add others...

# Define shared objects like your blocklist here
# For production, use Redis or a database-backed blocklist,
# but the principle of defining it here remains.
BLOCKLIST = set()

# JWT configurations will be applied in the create_app function
# where we have access to the app instance