# backend/app/api/auth_routes.py
from flask import Blueprint, request, jsonify, current_app, g
from app.models import User, db, Quest, Tag 
from app.auth_utils import generate_jwt, token_required 
import re
from datetime import date, timedelta
import uuid # <--- IMPORTACIÓN AÑADIDA

auth_bp = Blueprint('auth_bp', __name__, url_prefix='/api/auth')

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
        # Asegurar que settings se inicialice como un diccionario vacío si el default no lo hace (aunque debería)
        if new_user.settings is None:
            new_user.settings = {"sidebar_pinned_tag_ids": []}
        elif not isinstance(new_user.settings, dict): # Por si acaso el default no es un dict
             new_user.settings = {"sidebar_pinned_tag_ids": []}
        elif 'sidebar_pinned_tag_ids' not in new_user.settings: # Asegurar que la clave exista
            new_user.settings['sidebar_pinned_tag_ids'] = []


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
            if user.last_login_date == today: pass # No change to streak
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
                user_settings = {"sidebar_pinned_tag_ids": []}
            elif 'sidebar_pinned_tag_ids' not in user_settings or not isinstance(user_settings.get('sidebar_pinned_tag_ids'), list):
                 user_settings['sidebar_pinned_tag_ids'] = []


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
    user_email = "Unknown user" # Default
    if hasattr(g, 'current_user') and g.current_user: # Check if g.current_user is set
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
        user_settings = {"sidebar_pinned_tag_ids": []}
    elif 'sidebar_pinned_tag_ids' not in user_settings or not isinstance(user_settings.get('sidebar_pinned_tag_ids'), list):
            user_settings['sidebar_pinned_tag_ids'] = []

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

    # Inicializar current_user.settings si es None
    if current_user.settings is None:
        current_user.settings = {}
    
    # Procesar 'settings' si se encuentra en el payload
    new_settings_payload = data.get('settings')
    if isinstance(new_settings_payload, dict):
        pinned_tags_ids_str = new_settings_payload.get('sidebar_pinned_tag_ids')
        if pinned_tags_ids_str is not None: # Solo validar y actualizar si se provee
            if not isinstance(pinned_tags_ids_str, list):
                return jsonify({"error": "sidebar_pinned_tag_ids must be a list of tag UUID strings."}), 400
            
            valid_pinned_tag_uuids = []
            for tag_id_str in pinned_tags_ids_str:
                try:
                    tag_uuid = uuid.UUID(str(tag_id_str)) # Convertir a UUID para validar formato
                    # Verificar que el tag exista y pertenezca al usuario
                    tag_exists = Tag.query.filter_by(id=tag_uuid, user_id=current_user.id).first()
                    if not tag_exists:
                        return jsonify({"error": f"Invalid or non-existent tag_id provided: {tag_id_str}"}), 400
                    valid_pinned_tag_uuids.append(str(tag_uuid)) # Guardar como string
                except ValueError:
                    return jsonify({"error": f"Invalid UUID format for tag_id: {tag_id_str}"}), 400
            current_user.settings['sidebar_pinned_tag_ids'] = valid_pinned_tag_uuids
        # Aquí se podrían procesar otras claves dentro de new_settings_payload si existieran
        # current_user.settings.update(new_settings_payload) # Opción más genérica pero menos controlada

    # Procesar 'avatar_url' si se encuentra en el payload (fuera del objeto 'settings')
    new_avatar_url = data.get('avatar_url')
    if new_avatar_url is not None: 
        if not isinstance(new_avatar_url, str):
            return jsonify({"error": "avatar_url must be a string."}), 400
        current_user.avatar_url = new_avatar_url.strip() if new_avatar_url.strip() else None

    try:
        from sqlalchemy.orm.attributes import flag_modified
        if isinstance(new_settings_payload, dict) : # Solo marcar como modificado si se intentó actualizar settings
             flag_modified(current_user, "settings")

        db.session.commit()
        
        # Asegurar que la respuesta siempre tenga una estructura de settings válida
        final_settings = current_user.settings
        if final_settings is None or not isinstance(final_settings, dict):
            final_settings = {"sidebar_pinned_tag_ids": []}
        elif 'sidebar_pinned_tag_ids' not in final_settings or not isinstance(final_settings.get('sidebar_pinned_tag_ids'), list):
            final_settings['sidebar_pinned_tag_ids'] = []
            
        return jsonify({
            "message": "User data updated successfully.",
            "settings": final_settings,
            "avatar_url": current_user.avatar_url
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating settings for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update settings due to an internal error."}), 500