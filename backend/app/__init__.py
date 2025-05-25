from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
# Sube un nivel para encontrar .env en la carpeta 'backend'
# (asumiendo que __file__ es backend/app/__init__.py)
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

db = SQLAlchemy()
migrate = Migrate()
# cors = CORS() # Podemos inicializarlo dentro de create_app

def create_app(config_class=None):
    """
    Factory function to create and configure the Flask application.
    """
    app = Flask(__name__)

    # Configuración de la aplicación
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') # Cambiar en producción

    # Configuración JWT desde variables de entorno
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
    app.config['JWT_ALGORITHM'] = os.environ.get('JWT_ALGORITHM', 'HS256')
    app.config['JWT_ACCESS_TOKEN_EXPIRES_MINUTES'] = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES_MINUTES', 30))

    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static', 'avatars')

    # Inicializar extensiones con la aplicación
    db.init_app(app)
    migrate.init_app(app, db) # Flask-Migrate necesita la app y la instancia de db
    CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}}, # Especifica el origen de tu frontend
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"], # Métodos permitidos
    allow_headers=["Authorization", "Content-Type"], # Cabeceras permitidas
    supports_credentials=True # Si planeas usar cookies o autenticación basada en sesión con credenciales
)

    # Importar modelos DESPUÉS de inicializar db y migrate con la app.
    # Esto asegura que los modelos se registren correctamente con SQLAlchemy
    # en el contexto de la aplicación actual.
    with app.app_context():
        from . import models

    # Registrar Blueprints
    from .api.auth_routes import auth_bp
    app.register_blueprint(auth_bp)

    from .api.quest_routes import quest_bp
    app.register_blueprint(quest_bp)

    from .api.tag_routes import tag_bp
    app.register_blueprint(tag_bp) 

    from .api.pool_mission_routes import pool_mission_bp 
    app.register_blueprint(pool_mission_bp)
    
    from .api.scheduled_mission_routes import scheduled_mission_bp
    app.register_blueprint(scheduled_mission_bp)

    from .api.habit_template_routes import habit_template_bp
    app.register_blueprint(habit_template_bp)

    from .api.habit_occurrence_routes import habit_occurrence_bp
    app.register_blueprint(habit_occurrence_bp)

    from .api.energy_log_routes import energy_log_bp
    app.register_blueprint(energy_log_bp)

    from .api.gamification_routes import gamification_bp
    app.register_blueprint(gamification_bp)

    from .api.dashboard_routes import dashboard_bp 
    app.register_blueprint(dashboard_bp)   
    
    @app.route('/')
    def hello():
        return "Backend de Iter Polaris funcionando!"

    return app