from flask import Blueprint, request, jsonify, current_app, g # Añadido 'g' para el contexto de la aplicación
from app.models import User, db, Quest
from app.auth_utils import generate_jwt, token_required, decode_jwt # decode_jwt no se usa aquí directamente pero es parte del módulo
import re
from datetime import date

auth_bp = Blueprint('auth_bp', __name__, url_prefix='/api/auth')

def is_valid_email(email_string):
    """ Función simple para validar el formato de un email usando regex. """
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

    # --- Validaciones de Entrada ---
    if not email or not password or not name:
        return jsonify({"error": "Missing fields: email, password, and name are required"}), 400
    
    if not isinstance(email, str) or not isinstance(password, str) or not isinstance(name, str):
        return jsonify({"error": "Invalid input type for fields"}), 400

    # Asumo que tienes una función is_valid_email(email) definida en este archivo o importada
    if not is_valid_email(email): 
        return jsonify({"error": "Invalid email format"}), 400
            
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400
            
    if len(name.strip()) == 0:
        return jsonify({"error": "Name cannot be empty"}), 400

    # --- Verificar si el usuario ya existe ---
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "User with this email already exists"}), 409 # Conflict

    try:
        # --- Crear el Usuario ---
        new_user = User(email=email, name=name)
        new_user.set_password(password) # Hashear la contraseña
        db.session.add(new_user)
        
        # Hacemos un flush para que new_user.id esté disponible para la Quest por defecto,
        # pero sin comitear la transacción todavía.
        db.session.flush()

        # --- Crear la Quest por Defecto ---
        default_quest_name = "General" 
        default_quest_color = "#808080" # Gris neutral, puedes cambiarlo
        
        default_quest = Quest(
            user_id=new_user.id, # user_id ahora está disponible después del flush
            name=default_quest_name,
            description="A general Quest for unsorted missions or your main focus.",
            color=default_quest_color,
            is_default_quest=True
        )
        db.session.add(default_quest)
        
        # --- Comitear la transacción (Usuario y Quest por Defecto) ---
        db.session.commit()

        # --- Generar JWT para el auto-login ---
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
                    # No incluimos la Quest por defecto aquí, el frontend la obtendrá al listar Quests
                }
            }), 201 # 201 Created
        else:
            # Este caso es menos probable si generate_jwt es robusto, pero es un fallback.
            # El usuario y la Quest por defecto SÍ se crearon y comitearon.
            current_app.logger.error(f"Token generation failed for new user {new_user.email} after registration (user and default quest created).")
            # Podrías devolver un mensaje específico indicando que se registre manualmente.
            return jsonify({
                "message": "User registered successfully, but auto-login failed. Please log in.",
                # No devolvemos datos del usuario aquí ya que no hay token.
            }), 201 # Aún 201 porque el recurso principal (usuario) fue creado.
    
    except Exception as e:
        db.session.rollback() # Revierte la creación del usuario y la Quest por defecto
        current_app.logger.error(f"Error during registration for {email}: {e}")
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
        user.last_login_date = date.today()
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating last_login_date for user {user.id}: {e}")
        
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
            return jsonify({"error": "Login successful but failed to generate token"}), 500
    else:
        return jsonify({"error": "Invalid email or password"}), 401

@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    user_email = "Unknown user"
    if hasattr(g, 'current_user') and g.current_user: # g.current_user es el objeto User completo
        user_email = g.current_user.email
    return jsonify({"message": f"User {user_email} logout successful. Please clear your token on the client-side."}), 200

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user_profile():
    user = g.current_user 
    if not user:
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

# --- NUEVO ENDPOINT PARA RESETEO DE CONTRASEÑA (MODO DESARROLLO) ---
@auth_bp.route('/dev-reset-password', methods=['POST'])
def dev_reset_password():
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
        user.set_password(new_password) # Hashea y establece la nueva contraseña
        db.session.commit()
        return jsonify({"message": f"Password for user {email} has been reset successfully."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error resetting password for {email}: {e}")
        return jsonify({"error": "Password reset failed due to an internal server error"}), 500