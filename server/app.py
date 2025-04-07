import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS, cross_origin
import redis # Import redis
from datetime import timedelta # Needed for blocklist expiration

# Corrected import using absolute path
from server.config import get_config # Import ONLY get_config
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize extensions globally first
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()

# Corrected function definition - removed default argument using get_config_name
def create_app():
    """Application Factory Pattern"""
    app = Flask(__name__)
    app_config = get_config()  # Call the function to get the config object
    app.config.from_object(app_config)  # Load config from the object
    # app.redis_client = redis_client
    # --- JWT Configuration ---
    # Choose a strong secret key!
    app.config["JWT_SECRET_KEY"] = "your-super-secret-key-change-me" # CHANGE THIS! Load from env var ideally
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"] # Tell JWT Extended to expect JWTs in cookies
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1) # Example expiration
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30) # Example expiration

        # --- Cookie Configuration ---
    # Set SameSite=Lax or Strict for CSRF protection. Lax is generally okay.
    # Set Secure=True in production (requires HTTPS)
    app.config["JWT_COOKIE_SAMESITE"] = "Lax"
    app.config["JWT_COOKIE_SECURE"] = False # Set to True in production!
    # Set HttpOnly=True to prevent client-side JS access to the JWT cookies
    app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie" # Optional: customize name
    app.config["JWT_REFRESH_COOKIE_NAME"] = "refresh_token_cookie" # Optional: customize name
    # Set path for cookies (usually '/')
    app.config["JWT_ACCESS_COOKIE_PATH"] = "/"
    app.config["JWT_REFRESH_COOKIE_PATH"] = "/"

    # --- CSRF Protection (Important!) ---
    # Enable CSRF protection for cookies
    app.config["JWT_COOKIE_CSRF_PROTECT"] = True
    # Set the header name the frontend must send for CSRF verification (for POST, PUT, DELETE etc)
    app.config["JWT_ACCESS_CSRF_HEADER_NAME"] = "X-CSRF-Token"
    app.config["JWT_REFRESH_CSRF_HEADER_NAME"] = "X-CSRF-Token" # Often same header for simplicity
    # Optional: customize CSRF cookie names if needed
    # app.config["JWT_ACCESS_CSRF_COOKIE_NAME"] = "csrf_access_token"
    # app.config["JWT_REFRESH_CSRF_COOKIE_NAME"] = "csrf_refresh_token"

    # === IMPORTANT: Blocklist Configuration (Example using simple Python set) ===
    # For production, use Redis or a database for the blocklist
    # See Flask-JWT-Extended docs for details:
    # https://flask-jwt-extended.readthedocs.io/en/stable/blocklist_and_token_revoking/
    app.config["JWT_BLOCKLIST_ENABLED"] = True
    app.config["JWT_BLOCKLIST_TOKEN_CHECKS"] = ["access", "refresh"] # Check both token types
    BLOCKLIST = set() # Simple in-memory blocklist (NOT FOR PRODUCTION)

    jwt = JWTManager(app)

    # Callback function to check if a JWT is blocklisted
    @jwt.token_in_blocklist_loader
    def check_if_token_is_blocklisted(jwt_header, jwt_payload: dict):
        jti = jwt_payload["jti"]
        return jti in BLOCKLIST

    # Initialize extensions with the app instance
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    cors.init_app(app,
        resources={r"/api/*": {"origins": "http://localhost:5173"}},  # Your React app URL
        supports_credentials=True,
        methods=["GET", "HEAD", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization"]
    )

    # --- Critical: Import models AFTER db is initialized and within app context ---
    with app.app_context():
        from server.models.user import User
        from server.models.artwork import Artwork
        from server.models.collection import Collection
        from server.models.user_follow import UserFollow

        # Blueprints registration without debug prints
        from server.routes.auth import auth_bp
        app.register_blueprint(auth_bp, url_prefix='/api/auth')

        from server.routes.artworks import artworks_bp
        app.register_blueprint(artworks_bp, url_prefix='/api/artworks')

        from server.routes.users import users_bp
        app.register_blueprint(users_bp, url_prefix='/api/users')

        from server.routes.upload import uploads_bp
        app.register_blueprint(uploads_bp)


    # Add a simple health check or root route if desired
    @app.route('/')
    def index():
        return jsonify({"status": "API is running!"})

    @app.route('/test-db')
    def test_db():
        try:
            db.session.execute('SELECT 1')
            return 'Database connection successful!'
        except Exception as e:
            return f'Database connection failed: {str(e)}'

    # Shell context for `flask shell`
    @app.shell_context_processor
    def make_shell_context():
        from server.models.user import User
        return {'db': db, 'User': User}

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=app.config.get('DEBUG', False), port=5000)