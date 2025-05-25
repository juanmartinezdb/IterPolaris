# backend/app/api/auth_routes.py
import os
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, current_app, g
from app.models import User, db, Quest, Tag 
from app.auth_utils import generate_jwt, token_required 
import re
from datetime import date, timedelta
import uuid

auth_bp = Blueprint('auth_bp', __name__, url_prefix='/api/auth')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
VALID_PANEL_TYPES = ["UPCOMING_MISSIONS", "PROJECT_TASKS", "TODAY_AGENDA", "MISSION_POOL", "TODAY_HABITS"] # Define valid panel types

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def is_valid_email(email_string):
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email_string) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data: return jsonify({"error": "Invalid input: No data provided"}), 400
    email = data.get('email'); password = data.get('password'); name = data.get('name')
    if not email or not password or not name: return jsonify({"error": "Missing fields: email, password, and name are required"}), 400
    if not isinstance(email, str) or not isinstance(password, str) or not isinstance(name, str): return jsonify({"error": "Invalid input type for fields"}), 400
    if not is_valid_email(email): return jsonify({"error": "Invalid email format"}), 400
    if len(password) < 8: return jsonify({"error": "Password must be at least 8 characters long"}), 400
    if len(name.strip()) == 0: return jsonify({"error": "Name cannot be empty"}), 400
    if User.query.filter_by(email=email).first(): return jsonify({"error": "User with this email already exists"}), 409
    try:
        new_user = User(email=email, name=name.strip())
        new_user.set_password(password)
        
        # Ensure settings is initialized correctly, including dashboard_panels
        new_user.settings = {"sidebar_pinned_tag_ids": [], "dashboard_panels": []}

        db.session.add(new_user); db.session.flush()
        default_quest = Quest(user_id=new_user.id, name="General", description="Default quest for unsorted or main tasks.", color="#808080", is_default_quest=True)
        db.session.add(default_quest)
        default_tags_names = ["Work", "Health", "Personal", "Studies", "Hobbies", "Important", "Social", "Home"]       
        for tag_name in default_tags_names:
            if not Tag.query.filter_by(user_id=new_user.id, name=tag_name).first():
                db.session.add(Tag(user_id=new_user.id, name=tag_name))
        new_user.current_streak = 1; new_user.last_login_date = date.today()
        db.session.commit()
        token = generate_jwt(new_user.id, new_user.email)
        if token:
            user_data_response = {
                "id": str(new_user.id), "email": new_user.email, "name": new_user.name,
                "level": new_user.level, "total_points": new_user.total_points,
                "avatar_url": new_user.avatar_url, "current_streak": new_user.current_streak,
                "last_login_date": new_user.last_login_date.isoformat() if new_user.last_login_date else None,
                "settings": new_user.settings 
            }
            return jsonify({
                "message": "User registered successfully and logged in", "token": token,
                "user": user_data_response
            }), 201
        else:
            current_app.logger.error(f"Token generation failed for new user {new_user.email} after registration.")
            return jsonify({"message": "User registered, but auto-login failed. Please log in."}), 201 
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Registration Error for {email}: {e}", exc_info=True)
        return jsonify({"error": "Registration failed due to an internal server error"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json();
    if not data: return jsonify({"error": "Invalid input: No data provided"}), 400
    email = data.get('email'); password = data.get('password')
    if not email or not password: return jsonify({"error": "Email and password are required"}), 400
    if not isinstance(email, str) or not isinstance(password, str): return jsonify({"error": "Invalid input type for fields"}), 400
    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        today = date.today()
        if user.last_login_date:
            if user.last_login_date == today: pass 
            elif user.last_login_date == (today - timedelta(days=1)): user.current_streak = (user.current_streak or 0) + 1
            else: user.current_streak = 1 
        else: user.current_streak = 1
        user.last_login_date = today
        try: db.session.commit()
        except Exception as e_commit: 
            db.session.rollback()
            current_app.logger.error(f"Error updating user stats for {user.email} during login: {e_commit}", exc_info=True)
        
        token = generate_jwt(user.id, user.email)
        if token:
            user_settings = user.settings
            if user_settings is None or not isinstance(user_settings, dict):
                user_settings = {"sidebar_pinned_tag_ids": [], "dashboard_panels": []}
            if 'sidebar_pinned_tag_ids' not in user_settings or not isinstance(user_settings.get('sidebar_pinned_tag_ids'), list):
                 user_settings['sidebar_pinned_tag_ids'] = []
            if 'dashboard_panels' not in user_settings or not isinstance(user_settings.get('dashboard_panels'), list):
                 user_settings['dashboard_panels'] = []


            user_data_response = {
                "id": str(user.id), "email": user.email, "name": user.name,
                "level": user.level, "total_points": user.total_points,
                "avatar_url": user.avatar_url, "current_streak": user.current_streak,
                "last_login_date": user.last_login_date.isoformat() if user.last_login_date else None,
                "settings": user_settings
            }
            return jsonify({
                "message": "Login successful", "token": token,
                "user": user_data_response
            }), 200
        else:
            current_app.logger.error(f"Login successful for {user.email} but failed to generate token.")
            return jsonify({"error": "Login successful but failed to generate token"}), 500
    else: return jsonify({"error": "Invalid email or password"}), 401

@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    user_email = "Unknown user" 
    if hasattr(g, 'current_user') and g.current_user: 
        user_email = g.current_user.email
    return jsonify({"message": f"User {user_email} logout successful. Please clear your token on the client-side."}), 200

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user_profile():
    user = g.current_user 
    if not user:
        return jsonify({"error": "Current user not found in request context"}), 401
    
    user_settings = user.settings
    if user_settings is None or not isinstance(user_settings, dict):
        user_settings = {"sidebar_pinned_tag_ids": [], "dashboard_panels": []}
    if 'sidebar_pinned_tag_ids' not in user_settings or not isinstance(user_settings.get('sidebar_pinned_tag_ids'), list):
            user_settings['sidebar_pinned_tag_ids'] = []
    if 'dashboard_panels' not in user_settings or not isinstance(user_settings.get('dashboard_panels'), list):
            user_settings['dashboard_panels'] = []

    return jsonify({
        "id": str(user.id), "email": user.email, "name": user.name,
        "level": user.level, "total_points": user.total_points,
        "avatar_url": user.avatar_url, "current_streak": user.current_streak,
        "last_login_date": user.last_login_date.isoformat() if user.last_login_date else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "settings": user_settings
    }), 200

@auth_bp.route('/dev-reset-password', methods=['POST'])
def dev_reset_password():
    if current_app.env != 'development': return jsonify({"error": "This endpoint is for development use only."}), 403
    data = request.get_json();
    if not data: return jsonify({"error": "Invalid input: No data provided"}), 400
    email = data.get('email'); new_password = data.get('new_password')
    if not email or not new_password: return jsonify({"error": "Email and new_password are required"}), 400
    if not isinstance(email, str) or not isinstance(new_password, str): return jsonify({"error": "Invalid input type for fields"}), 400
    if not is_valid_email(email): return jsonify({"error": "Invalid email format"}), 400
    if len(new_password) < 8: return jsonify({"error": "New password must be at least 8 characters long"}), 400
    user = User.query.filter_by(email=email).first()
    if not user: return jsonify({"error": "User with this email not found"}), 404
    try:
        user.set_password(new_password); db.session.commit()
        return jsonify({"message": f"Password for user {email} has been reset successfully."}), 200
    except Exception as e:
        db.session.rollback(); current_app.logger.error(f"Error resetting password for {email} (dev): {e}", exc_info=True)
        return jsonify({"error": "Password reset failed due to an internal server error"}), 500

@auth_bp.route('/me/settings', methods=['PUT'])
@token_required
def update_user_settings():
    current_user = g.current_user # type: User
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    if current_user.settings is None:
        current_user.settings = {}
    
    # Ensure base structure for settings if completely missing
    if not isinstance(current_user.settings, dict):
        current_user.settings = {"sidebar_pinned_tag_ids": [], "dashboard_panels": []}
    if 'sidebar_pinned_tag_ids' not in current_user.settings:
        current_user.settings['sidebar_pinned_tag_ids'] = []
    if 'dashboard_panels' not in current_user.settings:
        current_user.settings['dashboard_panels'] = []

    new_settings_payload = data.get('settings')
    settings_changed = False

    if isinstance(new_settings_payload, dict):
        # Handle sidebar_pinned_tag_ids
        pinned_tags_ids_str = new_settings_payload.get('sidebar_pinned_tag_ids')
        if pinned_tags_ids_str is not None: 
            if not isinstance(pinned_tags_ids_str, list):
                return jsonify({"error": "sidebar_pinned_tag_ids must be a list of tag UUID strings."}), 400
            
            valid_pinned_tag_uuids = []
            for tag_id_str in pinned_tags_ids_str:
                try:
                    tag_uuid = uuid.UUID(str(tag_id_str)) 
                    tag_exists = Tag.query.filter_by(id=tag_uuid, user_id=current_user.id).first()
                    if not tag_exists:
                        return jsonify({"error": f"Invalid or non-existent tag_id for pinned tags: {tag_id_str}"}), 400
                    valid_pinned_tag_uuids.append(str(tag_uuid)) 
                except ValueError:
                    return jsonify({"error": f"Invalid UUID format for pinned tag_id: {tag_id_str}"}), 400
            current_user.settings['sidebar_pinned_tag_ids'] = valid_pinned_tag_uuids
            settings_changed = True

        # Handle dashboard_panels
        dashboard_panels_payload = new_settings_payload.get('dashboard_panels')
        if dashboard_panels_payload is not None:
            if not isinstance(dashboard_panels_payload, list):
                return jsonify({"error": "dashboard_panels must be a list."}), 400
            
            validated_panels = []
            panel_ids_seen = set()
            for panel_data in dashboard_panels_payload:
                if not isinstance(panel_data, dict):
                    return jsonify({"error": "Each item in dashboard_panels must be an object."}), 400
                
                panel_id = panel_data.get('id')
                panel_type = panel_data.get('panel_type')
                panel_name = panel_data.get('name', '') # Default to empty string
                panel_order = panel_data.get('order')
                panel_is_active = panel_data.get('is_active')
                panel_quest_id_str = panel_data.get('quest_id')

                if not panel_id or not isinstance(panel_id, str): return jsonify({"error": "Panel missing 'id' or id is not a string."}), 400
                try: uuid.UUID(panel_id) # Validate UUID format for panel id
                except ValueError: return jsonify({"error": f"Invalid UUID format for panel id: {panel_id}"}), 400
                if panel_id in panel_ids_seen: return jsonify({"error": f"Duplicate panel id found: {panel_id}"}), 400
                panel_ids_seen.add(panel_id)

                if not panel_type or panel_type not in VALID_PANEL_TYPES:
                    return jsonify({"error": f"Panel {panel_id} has invalid or missing 'panel_type'. Valid types are: {', '.join(VALID_PANEL_TYPES)}"}), 400
                if not isinstance(panel_name, str): return jsonify({"error": f"Panel {panel_id} 'name' must be a string."}), 400
                if panel_order is None or not isinstance(panel_order, int): return jsonify({"error": f"Panel {panel_id} missing 'order' or order is not an integer."}), 400
                if panel_is_active is None or not isinstance(panel_is_active, bool): return jsonify({"error": f"Panel {panel_id} missing 'is_active' or is_active is not a boolean."}), 400

                validated_panel = {
                    "id": panel_id, "panel_type": panel_type, "name": panel_name.strip(),
                    "order": panel_order, "is_active": panel_is_active
                }

                if panel_type == "PROJECT_TASKS":
                    if not panel_quest_id_str: return jsonify({"error": f"Panel {panel_id} of type PROJECT_TASKS requires a 'quest_id'."}), 400
                    try:
                        panel_quest_uuid = uuid.UUID(str(panel_quest_id_str))
                        quest_exists = Quest.query.filter_by(id=panel_quest_uuid, user_id=current_user.id).first()
                        if not quest_exists: return jsonify({"error": f"Panel {panel_id}: Quest ID '{panel_quest_id_str}' not found or access denied."}), 400
                        validated_panel["quest_id"] = str(panel_quest_uuid)
                    except ValueError: return jsonify({"error": f"Panel {panel_id}: Invalid UUID format for quest_id: {panel_quest_id_str}"}), 400
                elif "quest_id" in panel_data: # quest_id should only be present for PROJECT_TASKS
                    return jsonify({"error": f"Panel {panel_id}: 'quest_id' should only be provided for PROJECT_TASKS panel type."}), 400
                
                validated_panels.append(validated_panel)
            current_user.settings['dashboard_panels'] = validated_panels
            settings_changed = True
            
    new_avatar_url = data.get('avatar_url')
    if new_avatar_url is not None: 
        if not isinstance(new_avatar_url, str):
            return jsonify({"error": "avatar_url must be a string."}), 400
        current_user.avatar_url = new_avatar_url.strip() if new_avatar_url.strip() else None
        # No need to set settings_changed = True here, avatar is separate

    try:
        if settings_changed : # Only mark settings as modified if the settings part of payload was processed
             from sqlalchemy.orm.attributes import flag_modified
             flag_modified(current_user, "settings")

        db.session.commit()
        
        final_settings = current_user.settings
        if final_settings is None or not isinstance(final_settings, dict):
            final_settings = {"sidebar_pinned_tag_ids": [], "dashboard_panels": []}
        if 'sidebar_pinned_tag_ids' not in final_settings: final_settings['sidebar_pinned_tag_ids'] = []
        if 'dashboard_panels' not in final_settings: final_settings['dashboard_panels'] = []
            
        return jsonify({
            "message": "User data updated successfully.",
            "settings": final_settings,
            "avatar_url": current_user.avatar_url
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating settings for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update settings due to an internal error."}), 500

@auth_bp.route('/me/avatar', methods=['POST'])
@token_required
def upload_avatar():
    current_user = g.current_user 
    upload_folder_path = current_app.config['UPLOAD_FOLDER']
    if 'avatar' not in request.files: return jsonify({"error": "No avatar file part in the request"}), 400
    file = request.files['avatar']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_suffix = uuid.uuid4().hex[:8]
        new_filename = f"user_{current_user.id}_{unique_suffix}_{filename}"
        if not os.path.exists(upload_folder_path):
            try: os.makedirs(upload_folder_path)
            except OSError as e:
                current_app.logger.error(f"Failed to create avatar folder {upload_folder_path}: {e}")
                return jsonify({"error": "Failed to create avatar storage location."}), 500
        file_path = os.path.join(upload_folder_path, new_filename)
        try:
            if current_user.avatar_url and current_user.avatar_url.startswith('/static/avatars/'):
                old_avatar_filename = current_user.avatar_url.split('/')[-1]
                old_avatar_path = os.path.join(upload_folder_path, old_avatar_filename)
                if os.path.exists(old_avatar_path):
                    try: os.remove(old_avatar_path)
                    except OSError as e_ro: current_app.logger.warning(f"Could not delete old avatar {old_avatar_path}: {e_ro}")
            file.save(file_path)
            current_user.avatar_url = f'/static/avatars/{new_filename}'
            db.session.commit()
            user_data_resp = {
                "id": str(current_user.id), "avatar_url": current_user.avatar_url,
                # Incluir otros campos necesarios para actualizar UserContext en frontend si se desea
            }
            return jsonify({"message": "Avatar uploaded successfully.", "user": user_data_resp }), 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error saving avatar for user {current_user.id}: {e}", exc_info=True)
            if os.path.exists(file_path):
                try: os.remove(file_path)
                except OSError as e_rf: current_app.logger.error(f"Failed to remove partially saved avatar {new_filename}: {e_rf}")
            return jsonify({"error": "Failed to upload avatar due to an internal server error."}), 500
    else: return jsonify({"error": "File type not allowed. Allowed: png, jpg, jpeg, gif"}), 400