from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_cors import CORS
from datetime import timedelta  # Add missing import for timedelta

# Initialize extensions without app context here
db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()
cors = CORS()  # Initialize CORS without any resources here
BLOCKLIST = set()