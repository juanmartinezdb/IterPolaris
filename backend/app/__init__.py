from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
# Asegúrate de que esta línea esté ANTES de crear la instancia de la app si la config depende de ello
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env')) # Sube un nivel para encontrar .env

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=None):
    """
    Factory function to create and configure the Flask application.
    """
    app = Flask(__name__)

    # Configuración de la aplicación
    # Por ahora, una configuración simple. Se expandirá más adelante.
    # Intenta cargar la URL de la base de datos desde las variables de entorno
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://user:password@host:port/dbname')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a_very_secret_key_for_development') # Cambiar en producción

    # Habilitar CORS
    CORS(app) # Por ahora, permite todas las origins. Se puede restringir más adelante.

    # Inicializar extensiones
    db.init_app(app)
    migrate.init_app(app, db)

    # Registrar Blueprints (se añadirán más tarde)
    # from .api.routes import api_bp  # Ejemplo
    # app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/')
    def hello():
        return "Backend de Iter Polaris funcionando!"

    return app