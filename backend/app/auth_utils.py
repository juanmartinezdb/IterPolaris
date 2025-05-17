import jwt
from datetime import datetime, timedelta, timezone
from flask import current_app, jsonify # Añadido jsonify para respuestas de error consistentes
from functools import wraps
from flask import request, g # g es un objeto de contexto de aplicación de Flask

def generate_jwt(user_id, user_email):
    """
    Genera un JWT para un usuario.
    """
    try:
        payload = {
            'exp': datetime.now(timezone.utc) + timedelta(minutes=current_app.config['JWT_ACCESS_TOKEN_EXPIRES_MINUTES']),
            'iat': datetime.now(timezone.utc),
            'sub': str(user_id), # 'sub' (subject) es el ID del usuario
            'email': user_email # Puedes incluir otros datos no sensibles
        }
        token = jwt.encode(
            payload,
            current_app.config['JWT_SECRET_KEY'],
            algorithm=current_app.config['JWT_ALGORITHM']
        )
        return token
    except Exception as e:
        current_app.logger.error(f"Error generating JWT: {e}")
        return None


def decode_jwt(token):
    """
    Decodifica un JWT. Devuelve el payload si es válido, None si no.
    """
    try:
        payload = jwt.decode(
            token,
            current_app.config['JWT_SECRET_KEY'],
            algorithms=[current_app.config['JWT_ALGORITHM']]
        )
        return payload
    except jwt.ExpiredSignatureError:
        current_app.logger.warning("JWT expired.")
        return {'error': 'Token has expired', 'status_code': 401}
    except jwt.InvalidTokenError:
        current_app.logger.warning("JWT invalid.")
        return {'error': 'Invalid token', 'status_code': 401}
    except Exception as e:
        current_app.logger.error(f"Error decoding JWT: {e}")
        return {'error': 'Token processing error', 'status_code': 500}

def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        # Buscar token en el header 'Authorization' (formato: Bearer <token>)
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token_type, token = auth_header.split()
                if token_type.lower() != 'bearer':
                    token = None # No es un Bearer token
            except ValueError:
                # Malformado el header Authorization
                token = None

        if not token:
            return jsonify({'error': 'Token is missing or invalid format'}), 401

        decoded_token = decode_jwt(token)

        if not decoded_token or 'error' in decoded_token:
            error_message = decoded_token.get('error', 'Invalid token') if isinstance(decoded_token, dict) else 'Invalid token'
            status_code = decoded_token.get('status_code', 401) if isinstance(decoded_token, dict) else 401
            return jsonify({'error': error_message}), status_code

        # Cargar el usuario actual en el contexto de la aplicación (g) para fácil acceso en la ruta
        # Esto asume que 'sub' en tu token JWT es el user_id
        from app.models import User 
        current_user = User.query.get(decoded_token['sub'])
        if not current_user:
            return jsonify({'error': 'User not found for token subject'}), 401

        g.current_user = current_user # Hacer current_user accesible en la ruta

        return f(*args, **kwargs)
    return decorated_function