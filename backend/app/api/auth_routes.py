# backend/app/api/auth_routes.py
from flask import Blueprint, request, jsonify, current_app, g
from app.models import User, db, Quest, Tag # Asegúrate que Tag esté importado si lo usas
from app.auth_utils import generate_jwt, token_required 
import re
from datetime import date, timedelta # Añadido timedelta

auth_bp = Blueprint('auth_bp', __name__, url_prefix='/api/auth')

def is_valid_email(email_string):
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email_string) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid input: No data provided"}), 400

    email = data.get('email')
    password = data.get('password')
    name = data.get('name')

    if not email or not password or not name:
        return jsonify({"error": "Missing fields: email, password, and name are required"}), 400
    
    if not isinstance(email, str) or not isinstance(password, str) or not isinstance(name, str):
        return jsonify({"error": "Invalid input type for fields"}), 400

    if not is_valid_email(email): 
        return jsonify({"error": "Invalid email format"}), 400
            
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400
            
    if len(name.strip()) == 0:
        return jsonify({"error": "Name cannot be empty"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "User with this email already exists"}), 409

    try:
        new_user = User(email=email, name=name.strip())
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.flush()

        default_quest_name = "General" 
        default_quest_color = "#808080"
        default_quest = Quest(
            user_id=new_user.id,
            name=default_quest_name,
            description="A general Quest for unsorted missions or your main focus.",
            color=default_quest_color,
            is_default_quest=True
        )
        db.session.add(default_quest)

        # PRD: "Base tags can be auto-created on registration."
        default_tags_names = ["Trabajo", "Salud", "Personal", "Estudios", "Hobbies", "Importante", "Social", "Domésticas", "secundaria"]       
        for tag_name in default_tags_names:
            if not Tag.query.filter_by(user_id=new_user.id, name=tag_name).first(): # Evitar duplicados si algo falla y se reintenta
                default_tag = Tag(user_id=new_user.id, name=tag_name)
                db.session.add(default_tag)
        
        # Initialize streak and last_login_date for new user
        new_user.current_streak = 1
        new_user.last_login_date = date.today()

        db.session.commit()

        token = generate_jwt(new_user.id, new_user.email)

        if token:
            return jsonify({
                "message": "User registered successfully and logged in",
                "token": token,
                "user": {
                    "id": str(new_user.id),
                    "email": new_user.email,
                    "name": new_user.name,
                    "level": new_user.level,
                    "total_points": new_user.total_points,
                    "avatar_url": new_user.avatar_url,
                    "current_streak": new_user.current_streak,
                    "last_login_date": new_user.last_login_date.isoformat() if new_user.last_login_date else None
                }
            }), 201
        else:
            current_app.logger.error(f"Token generation failed for new user {new_user.email} after registration.")
            return jsonify({
                "message": "User registered successfully, but auto-login failed. Please log in.",
            }), 201 
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error during registration for {email}: {e}", exc_info=True)
        return jsonify({"error": "Registration failed due to an internal server error"}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid input: No data provided"}), 400

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Invalid input type for fields"}), 400

    user = User.query.filter_by(email=email).first()

    if user and user.check_password(password):
        today = date.today()
        if user.last_login_date:
            if user.last_login_date == today:
                pass # Already logged in today, streak doesn't change
            elif user.last_login_date == (today - timedelta(days=1)):
                user.current_streak = (user.current_streak or 0) + 1 # Ensure current_streak is not None
            else: 
                user.current_streak = 1 
        else: 
            user.current_streak = 1
        
        user.last_login_date = today
        
        try:
            db.session.commit()
        except Exception as e_commit:
            db.session.rollback()
            current_app.logger.error(f"Error updating user stats for {user.email} during login: {e_commit}", exc_info=True)
        
        token = generate_jwt(user.id, user.email)
        if token:
            return jsonify({
                "message": "Login successful",
                "token": token,
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "name": user.name,
                    "level": user.level,
                    "total_points": user.total_points,
                    "avatar_url": user.avatar_url,
                    "current_streak": user.current_streak,
                    "last_login_date": user.last_login_date.isoformat() if user.last_login_date else None
                }
            }), 200
        else:
            # This case should ideally not happen if generate_jwt is robust
            current_app.logger.error(f"Login successful for {user.email} but failed to generate token.")
            return jsonify({"error": "Login successful but failed to generate token"}), 500
    else:
        return jsonify({"error": "Invalid email or password"}), 401

@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    user_email = "Unknown user"
    if hasattr(g, 'current_user') and g.current_user:
        user_email = g.current_user.email
    # For JWT, logout is primarily a client-side concern (deleting the token).
    # Server-side might involve adding token to a blacklist if using refresh tokens.
    # For simplicity, this endpoint just confirms the request.
    return jsonify({"message": f"User {user_email} logout successful. Please clear your token on the client-side."}), 200

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user_profile():
    user = g.current_user 
    if not user:
        # This case should ideally be caught by @token_required if token is invalid or user deleted
        return jsonify({"error": "Current user not found in request context"}), 401
        
    return jsonify({
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "level": user.level,
        "total_points": user.total_points,
        "avatar_url": user.avatar_url,
        "current_streak": user.current_streak,
        "last_login_date": user.last_login_date.isoformat() if user.last_login_date else None,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }), 200

@auth_bp.route('/dev-reset-password', methods=['POST'])
def dev_reset_password():
    # NOTE: This is a development-only endpoint and should NOT be present in production.
    # Consider protecting it with a specific dev environment check if this code ever goes to staging/prod.
    if current_app.env != 'development': # Simple check, can be made more robust
        return jsonify({"error": "This endpoint is for development use only."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid input: No data provided"}), 400

    email = data.get('email')
    new_password = data.get('new_password')

    if not email or not new_password:
        return jsonify({"error": "Email and new_password are required"}), 400
    
    if not isinstance(email, str) or not isinstance(new_password, str):
        return jsonify({"error": "Invalid input type for fields"}), 400

    if not is_valid_email(email):
        return jsonify({"error": "Invalid email format"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters long"}), 400

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "User with this email not found"}), 404

    try:
        user.set_password(new_password)
        db.session.commit()
        return jsonify({"message": f"Password for user {email} has been reset successfully."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error resetting password for {email} (dev): {e}", exc_info=True)
        return jsonify({"error": "Password reset failed due to an internal server error"}), 500