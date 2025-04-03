import os
import uuid
import io  # Required for in-memory file handling with Pillow
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from PIL import Image # For thumbnail generation
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from server.services.auth_helper import artist_required

# --- Constants ---
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
THUMBNAIL_SIZE = (250, 250) # Define desired thumbnail dimensions (max width, max height)

uploads_bp = Blueprint('uploads_bp', __name__, url_prefix='/api/upload-image')

# --- Helper Functions ---

def allowed_file(filename):
    """Checks if the file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_s3_client():
    """Creates and returns an S3 client using environment variables."""
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION')
        )
        # Test credentials validity slightly
        s3_client.list_buckets() # Simple call to check auth
        return s3_client
    except NoCredentialsError:
        current_app.logger.error("AWS credentials not found. Check .env or IAM role.")
        return None
    except ClientError as e:
         current_app.logger.error(f"Failed to initialize S3 client or test credentials: {e}")
         return None


def create_thumbnail(file_stream, size=THUMBNAIL_SIZE):
    """Generates a thumbnail from a file stream."""
    try:
        img = Image.open(file_stream)
        img.thumbnail(size) # Resizes in place, preserving aspect ratio
        thumb_io = io.BytesIO() # Create in-memory byte stream
        # Determine format based on original, default to JPEG
        img_format = img.format if img.format in ['JPEG', 'PNG', 'GIF', 'WEBP'] else 'JPEG'
        img.save(thumb_io, format=img_format, quality=85) # Save resized image to buffer
        thumb_io.seek(0) # Rewind buffer to the beginning for reading
        return thumb_io, img_format.lower() # Return buffer and extension
    except Exception as e:
        current_app.logger.error(f"Thumbnail generation failed: {e}")
        return None, None


def upload_to_s3(file_obj, bucket_name, object_name, content_type, is_public=True):
    """Uploads a file object (like file stream or BytesIO buffer) to S3."""
    s3_client = get_s3_client()
    if not s3_client:
        return None, "S3 client initialization failed."

    extra_args = {'ContentType': content_type}
    if is_public:
        extra_args['ACL'] = 'public-read' # Make object publicly readable via URL

    try:
        s3_client.upload_fileobj(
            file_obj,
            bucket_name,
            object_name,
            ExtraArgs=extra_args
        )
        # Construct the public URL
        region = os.getenv('AWS_REGION')
        # Handle different S3 URL formats (path-style vs virtual-hosted)
        # Virtual-hosted style is generally preferred:
        location = f"https://{bucket_name}.s3.{region}.amazonaws.com/{object_name}"

        # Path-style (less common for new buckets):
        # location = f"https://s3.{region}.amazonaws.com/{bucket_name}/{object_name}"

        current_app.logger.info(f"Successfully uploaded {object_name} to {bucket_name}. URL: {location}")
        return location, None # Return URL and no error

    except ClientError as e:
        current_app.logger.error(f"S3 Upload Failed for {object_name}: {e}")
        return None, f"S3 upload failed: {e.response.get('Error', {}).get('Message', 'Unknown S3 error')}"
    except Exception as e:
        current_app.logger.error(f"An unexpected error occurred during S3 upload for {object_name}: {e}")
        return None, "An internal server error occurred during upload."


# === POST /api/upload-image ===
@uploads_bp.route('', methods=['POST'])
@jwt_required()
@artist_required # Ensures only artists can upload
def upload_image_file():
    """
    Handles image file upload, saves to S3, generates thumbnail, returns URLs.
    Expects 'image' file in multipart/form-data request.
    """
    current_user_id = get_jwt_identity() # For logging or potential use
    current_app.logger.info(f"Upload attempt by user: {current_user_id}")

    if 'image' not in request.files:
        return jsonify({"error": {"code": "UPLOAD_001", "message": "No image file part in the request"}}), 400

    file = request.files['image']

    if file.filename == '':
        return jsonify({"error": {"code": "UPLOAD_002", "message": "No image file selected"}}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": {"code": "UPLOAD_003", "message": "Invalid file type. Allowed types: png, jpg, jpeg, gif, webp"}}), 400

    # --- Prepare for Upload ---
    bucket_name = os.getenv('S3_BUCKET_NAME')
    if not bucket_name:
         current_app.logger.error("S3_BUCKET_NAME environment variable not set.")
         return jsonify({"error": {"code": "CONFIG_ERROR", "message": "Server configuration error [S3 Bucket]"}}), 500

    original_filename = secure_filename(file.filename)
    # Create a unique filename to avoid S3 collisions
    unique_id = uuid.uuid4()
    file_ext = original_filename.rsplit('.', 1)[1].lower()
    s3_object_name = f"artworks/{unique_id}/{original_filename}" # Store in a subfolder

    # --- Generate Thumbnail ---
    file.seek(0) # Ensure stream is at the beginning before reading for thumbnail
    thumbnail_buffer, thumb_ext = create_thumbnail(file.stream) # Pass the raw stream
    file.seek(0) # IMPORTANT: Rewind stream again before uploading the original file!

    s3_thumbnail_object_name = None
    if thumbnail_buffer:
         # Use a distinct name/path for thumbnails
         thumb_filename = f"thumb_{original_filename.rsplit('.', 1)[0]}.{thumb_ext}"
         s3_thumbnail_object_name = f"artworks/{unique_id}/thumbnails/{thumb_filename}"
    else:
        current_app.logger.warning(f"Could not generate thumbnail for {original_filename}")


    # --- Upload Original Image ---
    current_app.logger.info(f"Uploading original to S3: {s3_object_name}")
    image_url, error_msg = upload_to_s3(
        file.stream, # Pass the stream directly
        bucket_name,
        s3_object_name,
        file.content_type # Get content type from the uploaded file
    )
    if error_msg:
        return jsonify({"error": {"code": "S3_UPLOAD_ERROR", "message": error_msg}}), 500


    # --- Upload Thumbnail (if generated) ---
    thumbnail_url = None
    if thumbnail_buffer and s3_thumbnail_object_name:
        current_app.logger.info(f"Uploading thumbnail to S3: {s3_thumbnail_object_name}")
        # Determine thumbnail content type
        thumb_content_type = f'image/{thumb_ext}'
        thumbnail_url, thumb_error_msg = upload_to_s3(
            thumbnail_buffer,
            bucket_name,
            s3_thumbnail_object_name,
            thumb_content_type
        )
        if thumb_error_msg:
            # Log the error but maybe don't fail the whole request?
            # Decide if a missing thumbnail is critical.
            # For now, we'll return success but log the warning.
             current_app.logger.error(f"Thumbnail upload failed: {thumb_error_msg}")
             thumbnail_url = None # Ensure it's None if upload failed
        thumbnail_buffer.close() # Close the BytesIO buffer

    # If no thumbnail was generated or uploaded, maybe default to original URL?
    if not thumbnail_url:
        thumbnail_url = image_url
        current_app.logger.info("Using original image URL as thumbnail URL.")

    # --- Success Response ---
    return jsonify({
        "message": "File uploaded successfully",
        "imageUrl": image_url,
        "thumbnailUrl": thumbnail_url
    }), 200 # 200 OK is appropriate here