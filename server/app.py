import os
from flask import Flask, jsonify
from dotenv import load_dotenv
from datetime import timedelta, datetime
# from flask_cors import CORS
from flask_apscheduler import APScheduler
import logging

# from flask_seeder import Seeder # Not currently used, can be commented out or removed if not needed

# Import extensions and BLOCKLIST from the new file
from .extensions import db, jwt, migrate, cors, BLOCKLIST

# --- IMPORT MODELS HERE ---
# This is the crucial section where Flask-Migrate needs to know about ALL your models
from .models.user import User
from .models.artwork import Artwork     # Assuming you have artwork.py
from .models.collection import Collection # Assuming you have collection.py
from .models.user_follow import UserFollow # Assuming you have user_follow.py
# --- ADD THESE IMPORTS for the new pack models ---
from .models.pack_type import PackType   # Import PackType model
from .models.user_pack import UserPack   # Import UserPack model
from .models.trade import Trade          # Import Trade model
# ---------------------------------------------------
# Import any other models you have (e.g., UserFollow)

# Create scheduler instance
scheduler = APScheduler()

load_dotenv()

def create_app(config_object=None):
    app = Flask(__name__)

    # --- Configuration ---
    # Default configuration settings
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev_secret_key'), # Default for dev
        SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URI'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ECHO=False, # Set to True for debugging SQL
        JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY'), # Load from env!
        JWT_TOKEN_LOCATION=["headers", "cookies"],
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=1),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=30),
        JWT_COOKIE_SAMESITE="Lax",
        JWT_COOKIE_SECURE=os.environ.get('FLASK_ENV') == 'production', # True in prod (HTTPS)
        JWT_ACCESS_COOKIE_NAME="access_token_cookie",
        JWT_REFRESH_COOKIE_NAME="refresh_token_cookie",
        JWT_ACCESS_COOKIE_PATH="/",
        JWT_REFRESH_COOKIE_PATH="/",
        JWT_COOKIE_CSRF_PROTECT=True, # Enable CSRF protection
        JWT_ACCESS_CSRF_HEADER_NAME="X-CSRF-Token",
        JWT_REFRESH_CSRF_HEADER_NAME="X-CSRF-Token",
        JWT_BLOCKLIST_ENABLED=True, # Enable blocklisting
        JWT_BLOCKLIST_TOKEN_CHECKS=["access", "refresh"],
        GOOGLE_CLIENT_ID=os.environ.get('GOOGLE_CLIENT_ID'), # Add Google Client ID config
        
        # Scheduler configuration
        SCHEDULER_API_ENABLED=True,
        SCHEDULER_TIMEZONE="UTC"
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
    jwt.init_app(app)
    # migrate must be initialized *after* db and *after* models are imported/known
    migrate.init_app(app, db)
    # cors.init_app(app, resources={
    #     r"/api/*": { # Apply CORS to all routes starting with /api/
    #         "origins": [
    #             "http://localhost:3000",
    #             "http://127.0.0.1:3000",
    #             "http://localhost:5173",   # Your Vite frontend origin
    #             "http://127.0.0.1:5173",
    #             "https://www.artifact.online"
    #         ],
    #         "supports_credentials": True, # IMPORTANT for sending/receiving cookies
    #         "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    #         "allow_headers": ["Content-Type", "Authorization", "X-CSRF-Token"]
    #     }
    # })

    @app.after_request
    def add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = 'https://www.artifact.online'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRF-Token'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

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
    # --- REGISTER pack blueprint ---
    app.register_blueprint(packs_bp, url_prefix='/api') # Using /api as base for packs routes
    # --- REGISTER trades blueprint ---
    app.register_blueprint(trades_bp, url_prefix='/api')
    app.register_blueprint(search_blueprint, url_prefix='/api/search')
    # -------------------------------

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