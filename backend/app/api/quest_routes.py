from flask import Blueprint, request, jsonify, g, current_app  # 'g' para acceder a g.current_user
from app.models import db, User, Quest, PoolMission, ScheduledMission, HabitTemplate, HabitOccurrence # HabitOccurrence añadidofrom app.auth_utils import token_required
from app.auth_utils import token_required
import re # Para validación de color HEX (opcional, pero buena práctica)

quest_bp = Blueprint('quest_bp', __name__, url_prefix='/api/quests')

# Función de validación de color HEX (simplificada)
def is_valid_hex_color(color_string):
    if not color_string: # Permitir color nulo o vacío si el default lo maneja
        return True 
    pattern = re.compile(r'^#(?:[0-9a-fA-F]{3}){1,2}$')
    return bool(pattern.match(color_string))

# --- Endpoint para CREAR una nueva Quest ---
@quest_bp.route('', methods=['POST'])
@token_required
def create_quest():
    data = request.get_json()
    current_user = g.current_user

    name = data.get('name')
    description = data.get('description', None) # Opcional
    color = data.get('color', '#FFFFFF')       # Default si no se provee

    # Validaciones
    if not name:
        return jsonify({"error": "Quest name is required"}), 400
    if not isinstance(name, str) or (description and not isinstance(description, str)) or not isinstance(color, str) :
        return jsonify({"error": "Invalid data type for fields"}), 400
    if not is_valid_hex_color(color):
        return jsonify({"error": "Invalid HEX color format. Use #RRGGBB or #RGB."}), 400
    if len(name.strip()) == 0 :
        return jsonify({"error": "Quest name cannot be empty"}), 400
    if len(name) > 100: # Límite de longitud ejemplo
        return jsonify({"error": "Quest name is too long (max 100 characters)"}), 400
    if description and len(description) > 500: # Límite de longitud ejemplo
        return jsonify({"error": "Quest description is too long (max 500 characters)"}), 400


    # Verificar si ya existe una Quest con el mismo nombre para este usuario
    existing_quest = Quest.query.filter_by(user_id=current_user.id, name=name).first()
    if existing_quest:
        return jsonify({"error": f"A Quest with the name '{name}' already exists."}), 409 # Conflict

    try:
        new_quest = Quest(
            user_id=current_user.id,
            name=name.strip(),
            description=description.strip() if description else None,
            color=color
            # is_default_quest se maneja por separado (no se crea vía este endpoint)
        )
        db.session.add(new_quest)
        db.session.commit()
        
        # Devolver la Quest creada
        return jsonify({
            "id": str(new_quest.id),
            "name": new_quest.name,
            "description": new_quest.description,
            "color": new_quest.color,
            "is_default_quest": new_quest.is_default_quest,
            "created_at": new_quest.created_at.isoformat(),
            "updated_at": new_quest.updated_at.isoformat()
        }), 201 # 201 Created
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating quest for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to create quest due to an internal error"}), 500

# --- Endpoint para OBTENER TODAS las Quests del usuario ---
@quest_bp.route('', methods=['GET'])
@token_required
def get_quests():
    current_user = g.current_user
    try:
        quests = Quest.query.filter_by(user_id=current_user.id).order_by(Quest.created_at.asc()).all()
        # Opcional: ordenar las default primero, luego las otras
        # quests = Quest.query.filter_by(user_id=current_user.id).order_by(Quest.is_default_quest.desc(), Quest.name.asc()).all()
        
        quests_data = [{
            "id": str(quest.id),
            "name": quest.name,
            "description": quest.description,
            "color": quest.color,
            "is_default_quest": quest.is_default_quest,
            "created_at": quest.created_at.isoformat(),
            "updated_at": quest.updated_at.isoformat()
        } for quest in quests]
        
        return jsonify(quests_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching quests for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to fetch quests due to an internal error"}), 500

# --- Endpoint para OBTENER UNA Quest específica por ID ---
@quest_bp.route('/<uuid:quest_id>', methods=['GET'])
@token_required
def get_quest(quest_id):
    current_user = g.current_user
    try:
        # quest_id se convierte a UUID automáticamente por el convertidor de tipo en la ruta
        quest = Quest.query.filter_by(id=quest_id, user_id=current_user.id).first()
        
        if not quest:
            return jsonify({"error": "Quest not found or access denied"}), 404
            
        return jsonify({
            "id": str(quest.id),
            "name": quest.name,
            "description": quest.description,
            "color": quest.color,
            "is_default_quest": quest.is_default_quest,
            "created_at": quest.created_at.isoformat(),
            "updated_at": quest.updated_at.isoformat()
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching quest {quest_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to fetch quest due to an internal error"}), 500

# --- Endpoint para ACTUALIZAR una Quest ---
@quest_bp.route('/<uuid:quest_id>', methods=['PUT'])
@token_required
def update_quest(quest_id):
    data = request.get_json()
    current_user = g.current_user

    name = data.get('name')
    description = data.get('description') # Puede ser None para borrarla
    color = data.get('color')

    # Validaciones
    if not name and description is None and not color : # Al menos un campo debe actualizarse
        return jsonify({"error": "No update data provided. At least one field (name, description, color) is required."}), 400
    if name is not None and not isinstance(name, str):
        return jsonify({"error": "Invalid data type for name"}), 400
    if description is not None and not isinstance(description, str): # Si se provee, debe ser string
        return jsonify({"error": "Invalid data type for description"}), 400
    if color is not None and (not isinstance(color, str) or not is_valid_hex_color(color)):
         return jsonify({"error": "Invalid data type or HEX color format for color"}), 400
    if name is not None and len(name.strip()) == 0:
        return jsonify({"error": "Quest name cannot be empty if provided"}), 400
    if name and len(name) > 100:
        return jsonify({"error": "Quest name is too long (max 100 characters)"}), 400
    if description and len(description) > 500:
        return jsonify({"error": "Quest description is too long (max 500 characters)"}), 400


    try:
        quest_to_update = Quest.query.filter_by(id=quest_id, user_id=current_user.id).first()

        if not quest_to_update:
            return jsonify({"error": "Quest not found or access denied"}), 404

        # La Quest por defecto no puede cambiar su nombre a uno que ya existe para el usuario
        # si se está renombrando.
        if name and name != quest_to_update.name:
            existing_quest_with_new_name = Quest.query.filter(
                Quest.user_id == current_user.id,
                Quest.name == name,
                Quest.id != quest_id # Excluir la quest actual de la búsqueda
            ).first()
            if existing_quest_with_new_name:
                return jsonify({"error": f"A Quest with the name '{name}' already exists."}), 409

        # Actualizar campos si se proporcionan
        if name is not None:
            quest_to_update.name = name.strip()
        if description is not None: # Permitir string vacío para borrar descripción
            quest_to_update.description = description.strip() if description.strip() else None
        if color is not None:
            quest_to_update.color = color
        
        # No se permite cambiar is_default_quest a través de este endpoint.
        # La Quest por defecto puede ser renombrada y re-coloreada, pero no eliminada
        # ni se puede cambiar su estado de "default".

        db.session.commit()
        
        return jsonify({
            "id": str(quest_to_update.id),
            "name": quest_to_update.name,
            "description": quest_to_update.description,
            "color": quest_to_update.color,
            "is_default_quest": quest_to_update.is_default_quest,
            "updated_at": quest_to_update.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating quest {quest_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to update quest due to an internal error"}), 500

# --- Endpoint para ELIMINAR una Quest ---
# --- Reemplazar la función delete_quest existente ---
@quest_bp.route('/<uuid:quest_id>', methods=['DELETE'])
@token_required
def delete_quest(quest_id):
    current_user = g.current_user
    try:
        quest_to_delete = Quest.query.filter_by(id=quest_id, user_id=current_user.id).first()

        if not quest_to_delete:
            return jsonify({"error": "Quest not found or access denied"}), 404

        if quest_to_delete.is_default_quest:
            return jsonify({"error": "The default Quest cannot be deleted."}), 403

        generic_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
        
        if not generic_quest:
            current_app.logger.error(f"User {current_user.id} does not have a default Quest for task reassignment.")
            return jsonify({"error": "Default Quest not found. Cannot delete Quest."}), 500

        if generic_quest.id == quest_to_delete.id:
            current_app.logger.error(f"Attempted to reassign tasks to the quest being deleted (default quest {quest_to_delete.id}).")
            return jsonify({"error": "Critical error: Cannot reassign tasks to the quest being deleted."}), 500

        # Reasignar tareas
        PoolMission.query.filter_by(quest_id=quest_to_delete.id, user_id=current_user.id).update({"quest_id": generic_quest.id})
        ScheduledMission.query.filter_by(quest_id=quest_to_delete.id, user_id=current_user.id).update({"quest_id": generic_quest.id})
        HabitTemplate.query.filter_by(quest_id=quest_to_delete.id, user_id=current_user.id).update({"quest_id": generic_quest.id})
        HabitOccurrence.query.filter_by(quest_id=quest_to_delete.id, user_id=current_user.id).update({"quest_id": generic_quest.id}) # Reasignar también ocurrencias
        
        quest_name_deleted = quest_to_delete.name
        db.session.delete(quest_to_delete)
        db.session.commit()
        
        return jsonify({"message": f"Quest '{quest_name_deleted}' deleted successfully. Associated tasks have been reassigned to '{generic_quest.name}'."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting quest {quest_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to delete quest due to an internal error"}), 500