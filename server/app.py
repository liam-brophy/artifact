import os
from flask import Flask, jsonify
from dotenv import load_dotenv
from datetime import timedelta, datetime
# Import CSRFProtect
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_cors import CORS # Keep this
from flask_apscheduler import APScheduler
import logging

# from flask_seeder import Seeder # Not currently used, can be commented out or removed if not needed

# Import extensions and BLOCKLIST
from .extensions import db, jwt, migrate, cors, BLOCKLIST

# --- IMPORT MODELS HERE ---
from .models.user import User
from .models.artwork import Artwork     # Assuming you have artwork.py
from .models.collection import Collection # Assuming you have collection.py
from .models.user_follow import UserFollow # Assuming you have user_follow.py
from .models.pack_type import PackType   # Import PackType model
from .models.user_pack import UserPack   # Import UserPack model
from .models.trade import Trade          # Import Trade model


# Create scheduler instance
scheduler = APScheduler()

load_dotenv()

def create_app(config_object=None):
    app = Flask(__name__)

    # --- Determine if in production ---
    is_production = os.environ.get('FLASK_ENV') == 'production'

    # --- Configuration ---
    # Default configuration settings
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev_secret_key'), # MUST BE SET and consistent
        SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URI'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ECHO=False, # Set to True for debugging SQL
        JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY'), # Load from env!
        JWT_TOKEN_LOCATION=["headers", "cookies"], # Keep cookies if you need refresh tokens etc. via cookie
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=1),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=30),
        JWT_COOKIE_SAMESITE="None", # Still needed for JWT cookies
        JWT_COOKIE_SECURE=is_production, # Still needed for JWT cookies
        JWT_ACCESS_COOKIE_NAME="access_token_cookie",
        JWT_REFRESH_COOKIE_NAME="refresh_token_cookie",
        JWT_ACCESS_COOKIE_PATH="/",
        JWT_REFRESH_COOKIE_PATH="/",
        JWT_COOKIE_CSRF_PROTECT=False, # <-- *** DISABLE JWT's CSRF ***
        JWT_BLOCKLIST_ENABLED=True, # Enable blocklisting
        JWT_BLOCKLIST_TOKEN_CHECKS=["access", "refresh"],
        GOOGLE_CLIENT_ID=os.environ.get('GOOGLE_CLIENT_ID'), # Add Google Client ID config

        # Scheduler configuration
        SCHEDULER_API_ENABLED=True,
        SCHEDULER_TIMEZONE="UTC",

        # --- Flask-WTF CSRF Configuration ---
        WTF_CSRF_ENABLED=True,
        WTF_CSRF_TIME_LIMIT=None, # Default is 3600 seconds
        # Header your frontend WILL send
        WTF_CSRF_HEADERS=['X-CSRF-Token'], # Or ['X-CSRFToken'], MATCH FRONTEND
        # --- Cookie settings for Flask-WTF CSRF token ---
        WTF_CSRF_SSL_STRICT=is_production, # Require HTTPS for CSRF cookie in prod
        WTF_CSRF_COOKIE_SECURE=is_production, # Send cookie only over HTTPS in prod
        WTF_CSRF_COOKIE_SAMESITE='None' if is_production else 'Lax', # Crucial for cross-domain
        WTF_CSRF_COOKIE_HTTPONLY=False, # IMPORTANT: JS needs to read this cookie value
        WTF_CSRF_COOKIE_NAME='csrf_token', # Name of the cookie JS will read
        # WTF_CSRF_COOKIE_DOMAIN= # Usually not needed if path is '/' and SameSite=None
        # Prevent checking only session/form data, ensuring cookie settings are respected
        WTF_CSRF_CHECK_DEFAULT=False,
    )

    # Override with config_object if provided (useful for testing)
    if config_object:
        app.config.from_object(config_object)

    # Check essential configurations
    if not app.config['SQLALCHEMY_DATABASE_URI']:
        raise ValueError("DATABASE_URI environment variable not set.")
    if not app.config['JWT_SECRET_KEY']:
        raise ValueError("JWT_SECRET_KEY environment variable not set.")
    if not app.config['GOOGLE_CLIENT_ID']:
        app.logger.warning("GOOGLE_CLIENT_ID environment variable not set. Google Auth will not work.")


    # --- Initialize Extensions ---
    db.init_app(app)
    # jwt must be initialized *before* loaders are defined
    jwt.init_app(app) # Keep JWT for token generation/verification
    # migrate must be initialized *after* db and *after* models are imported/known
    migrate.init_app(app, db)
    # IMPORTANT: Initialize CSRF *after* setting config and *before* registering blueprints
    csrf = CSRFProtect(app)
    # Keep your CORS config, ensure X-CSRF-Token is in allow_headers
    cors.init_app(app, resources={
        r"/api/*": { # Apply CORS to all routes starting with /api/
            "origins": [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",   # Your Vite frontend origin
                "http://127.0.0.1:5173",
                "https://www.artifact.online"
            ],
            "supports_credentials": True, # IMPORTANT for sending/receiving cookies
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
             # Ensure your chosen CSRF header name is here
            "allow_headers": ["Content-Type", "Authorization", "X-CSRF-Token"]
        }
    })

    # --- JWT Loaders (Define them HERE, after jwt.init_app) ---
    @jwt.token_in_blocklist_loader
    def check_if_token_is_blocklisted(jwt_header, jwt_payload: dict):
        jti = jwt_payload["jti"]
        # BLOCKLIST is now imported from extensions
        return jti in BLOCKLIST

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        # User model is imported at the top
        return User.query.get(identity)

    # --- Import and Register Blueprints ---
    # Make sure these imports happen *after* models are known if blueprints import models
    from server.routes.auth import auth_bp
    from server.routes.users import users_bp
    from server.routes.artworks import artworks_bp
    from server.routes.upload import uploads_bp
    # --- ADD Blueprint import for packs ---
    from server.routes.packs import packs_bp # Assuming you created pack_routes.py
    # --- ADD Blueprint import for trades ---
    from server.routes.trades import trades_bp
    from server.routes import search_blueprint  # Import the search blueprint
    # --------------------------------------

    # Register blueprints with appropriate URL prefixes
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(artworks_bp, url_prefix='/api/artworks')
    app.register_blueprint(uploads_bp, url_prefix='/api/upload-image')
    app.register_blueprint(packs_bp, url_prefix='/api') # Using /api as base for packs routes
    app.register_blueprint(trades_bp, url_prefix='/api')
    app.register_blueprint(search_blueprint, url_prefix='/api/search')

    # --- Add Endpoint to Provide Initial CSRF Token ---
    @app.route('/api/auth/csrf-token', methods=['GET'])
    def get_csrf_token():
        """
        Endpoint to initialize the session and set the CSRF cookie.
        The frontend should call this on load.
        """
        token = generate_csrf() # Generates token and ensures cookie is set in response
        response = jsonify({"detail": "CSRF cookie set"})
        # No need to manually set the cookie here, CSRFProtect handles it
        return response

    # --- Global Error Handlers ---
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Resource not found"}}), 404

    @app.errorhandler(500)
    def internal_error(error):
        # Log the error in production
        app.logger.error(f"Server Error: {error}", exc_info=True)
        return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An internal server error occurred"}}), 500

    # --- Initialize Flask-APScheduler ---
    scheduler.init_app(app)
    
    # Only add jobs if scheduler not already running (prevents duplicate jobs during reloads)
    if not scheduler.running:
        from server.services.scheduler_service import generate_daily_packs, check_missing_daily_packs
        
        # Job 1: Daily pack generation at 00:01 UTC every day
        @scheduler.task('cron', id='daily_pack_generation', hour=0, minute=1)
        def scheduled_daily_pack_generation():
            with app.app_context():
                app.logger.info("Running scheduled daily pack generation")
                try:
                    success_count = generate_daily_packs()
                    app.logger.info(f"Daily pack generation completed. Created {success_count} packs.")
                except Exception as e:
                    app.logger.error(f"Error in scheduled daily pack generation: {str(e)}")
        
        # Job 2: Check for missing packs at 12:00 UTC every day
        # This job acts as a safety net in case the main job fails
        @scheduler.task('cron', id='check_missing_packs', hour=12, minute=0)
        def scheduled_check_missing_packs():
            with app.app_context():
                app.logger.info("Running scheduled check for missing daily packs")
                try:
                    recovered_count = check_missing_daily_packs()
                    app.logger.info(f"Missing pack check completed. Recovered {recovered_count} packs.")
                except Exception as e:
                    app.logger.error(f"Error in scheduled missing pack check: {str(e)}")
        
        # Start the scheduler
        scheduler.start()
        app.logger.info("Pack scheduler started successfully")

    # --- Simple Root Route (Optional) ---
    @app.route('/')
    def index():
        return "API is running!"

    return app

# This correctly sets up the app instance for Flask CLI commands like 'flask run', 'flask db'
app = create_app()

# Add a command to generate initial CSRF token if needed (optional)
# You generally want the frontend to hit the endpoint though.
@app.cli.command("generate-csrf")
def generate_csrf_command():
    print("CSRF Token:", generate_csrf())