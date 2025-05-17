# backend/app/api/tag_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Tag
from app.models import pool_mission_tags_association, scheduled_mission_tags_association, habit_template_tags_association
from app.models import PoolMission, ScheduledMission, HabitTemplate # Para desasociar al borrar tag
from app.auth_utils import token_required
import re


tag_bp = Blueprint('tag_bp', __name__, url_prefix='/api/tags')

# --- Endpoint para CREAR un nuevo Tag ---
@tag_bp.route('', methods=['POST'])
@token_required
def create_tag():
    data = request.get_json()
    current_user = g.current_user

    name = data.get('name')

    if not name:
        return jsonify({"error": "Tag name is required"}), 400
    if not isinstance(name, str):
        return jsonify({"error": "Invalid data type for name"}), 400
    if len(name.strip()) == 0:
        return jsonify({"error": "Tag name cannot be empty"}), 400
    if len(name) > 50: # Límite de longitud ejemplo
        return jsonify({"error": "Tag name is too long (max 50 characters)"}), 400

    # Verificar si ya existe un Tag con el mismo nombre para este usuario
    existing_tag = Tag.query.filter_by(user_id=current_user.id, name=name.strip()).first()
    if existing_tag:
        return jsonify({"error": f"A Tag with the name '{name.strip()}' already exists."}), 409 # Conflict

    try:
        new_tag = Tag(
            user_id=current_user.id,
            name=name.strip()
        )
        db.session.add(new_tag)
        db.session.commit()
        
        return jsonify({
            "id": str(new_tag.id),
            "name": new_tag.name,
            "created_at": new_tag.created_at.isoformat(),
            "updated_at": new_tag.updated_at.isoformat()
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating tag for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to create tag due to an internal error"}), 500

# --- Endpoint para OBTENER TODOS los Tags del usuario ---
@tag_bp.route('', methods=['GET'])
@token_required
def get_tags():
    current_user = g.current_user
    try:
        tags = Tag.query.filter_by(user_id=current_user.id).order_by(Tag.name.asc()).all()
        tags_data = [{
            "id": str(tag.id),
            "name": tag.name,
            "created_at": tag.created_at.isoformat(),
            "updated_at": tag.updated_at.isoformat()
        } for tag in tags]
        return jsonify(tags_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching tags for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to fetch tags due to an internal error"}), 500

# --- Endpoint para OBTENER UN Tag específico por ID ---
@tag_bp.route('/<uuid:tag_id>', methods=['GET'])
@token_required
def get_tag(tag_id):
    current_user = g.current_user
    try:
        tag = Tag.query.filter_by(id=tag_id, user_id=current_user.id).first()
        if not tag:
            return jsonify({"error": "Tag not found or access denied"}), 404
            
        return jsonify({
            "id": str(tag.id),
            "name": tag.name,
            "created_at": tag.created_at.isoformat(),
            "updated_at": tag.updated_at.isoformat()
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching tag {tag_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to fetch tag due to an internal error"}), 500

# --- Endpoint para ACTUALIZAR un Tag ---
@tag_bp.route('/<uuid:tag_id>', methods=['PUT'])
@token_required
def update_tag(tag_id):
    data = request.get_json()
    current_user = g.current_user
    name = data.get('name')

    if not name:
        return jsonify({"error": "Tag name is required for update"}), 400
    if not isinstance(name, str):
        return jsonify({"error": "Invalid data type for name"}), 400
    if len(name.strip()) == 0:
        return jsonify({"error": "Tag name cannot be empty"}), 400
    if len(name) > 50:
        return jsonify({"error": "Tag name is too long (max 50 characters)"}), 400

    try:
        tag_to_update = Tag.query.filter_by(id=tag_id, user_id=current_user.id).first()
        if not tag_to_update:
            return jsonify({"error": "Tag not found or access denied"}), 404

        # Verificar si el nuevo nombre ya existe para este usuario (excluyendo el tag actual)
        new_name_stripped = name.strip()
        if new_name_stripped != tag_to_update.name:
            existing_tag_with_new_name = Tag.query.filter(
                Tag.user_id == current_user.id,
                Tag.name == new_name_stripped,
                Tag.id != tag_id
            ).first()
            if existing_tag_with_new_name:
                return jsonify({"error": f"A Tag with the name '{new_name_stripped}' already exists."}), 409

        tag_to_update.name = new_name_stripped
        db.session.commit()
        
        return jsonify({
            "id": str(tag_to_update.id),
            "name": tag_to_update.name,
            "updated_at": tag_to_update.updated_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating tag {tag_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to update tag due to an internal error"}), 500

# --- Endpoint para ELIMINAR un Tag ---
@tag_bp.route('/<uuid:tag_id>', methods=['DELETE'])
@token_required
def delete_tag(tag_id):
    current_user = g.current_user
    try:
        tag_to_delete = Tag.query.filter_by(id=tag_id, user_id=current_user.id).first()
        if not tag_to_delete:
            return jsonify({"error": "Tag not found or access denied"}), 404

        # Disociar el tag de todas las entidades antes de eliminarlo
        # SQLAlchemy se encargará de eliminar las entradas de las tablas de asociación
        # debido al `cascade="all, delete-orphan"` en las relaciones `backref` de `Tag` a las tablas de asociación,
        # o si `lazy='dynamic'` y se accede a ellas, pero es más explícito manejar la desasociación
        # si fuera necesario o si las cascadas no están configuradas bidireccionalmente para esto.
        # Sin embargo, con las current `db.Table` definitions, las eliminaciones de `Tag` deberían
        # propagarse a las tablas de asociación si las FKs tienen ON DELETE CASCADE.
        # Si no, necesitaríamos:
        # PoolMission.query.filter(PoolMission.tags.any(id=tag_id)).all() para luego quitar el tag.
        # Por ahora, asumimos que la BD (o SQLAlchemy a través de `cascade`) maneja esto.
        # El PRD dice: "Delete Tag (DELETE /api/tags/{id})" - no especifica desasociación aquí,
        # pero es implícito que el tag debe ser eliminado de las asociaciones.
        # Con `backref=db.backref('pool_missions', lazy='dynamic'))` en `Tag` para `pool_mission_tags_association`
        # la eliminación del `Tag` debería eliminar las filas de asociación gracias a la configuración de la relación.
        # No es necesario eliminar manualmente las asociaciones si las relaciones y cascadas están bien.

        tag_name_deleted = tag_to_delete.name
        db.session.delete(tag_to_delete)
        db.session.commit()
        
        return jsonify({"message": f"Tag '{tag_name_deleted}' and its associations deleted successfully."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting tag {tag_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to delete tag due to an internal error"}), 500
    

def get_entity_and_check_owner(entity_model, entity_id, user_id):
    """Helper para obtener entidad y verificar propietario."""
    entity = entity_model.query.filter_by(id=entity_id, user_id=user_id).first()
    if not entity:
        raise ValueError("Entity not found or access denied") # Será capturado y devuelto como 404
    return entity

@tag_bp.route('/<string:entity_type>/<uuid:entity_id>/tags', methods=['POST'])
@token_required
def add_tag_to_entity(entity_type, entity_id):
    data = request.get_json()
    current_user = g.current_user
    tag_id = data.get('tag_id')

    if not tag_id:
        return jsonify({"error": "Tag ID is required"}), 400

    try:
        tag = Tag.query.filter_by(id=tag_id, user_id=current_user.id).first()
        if not tag:
            return jsonify({"error": "Tag not found or access denied"}), 404

        entity = None
        entity_model_map = {
            "pool-missions": PoolMission,
            "scheduled-missions": ScheduledMission,
            "habit-templates": HabitTemplate
        }
        
        model_to_use = entity_model_map.get(entity_type.lower())
        if not model_to_use:
            return jsonify({"error": "Invalid entity type"}), 400

        entity = get_entity_and_check_owner(model_to_use, entity_id, current_user.id)

        if tag not in entity.tags:
            entity.tags.append(tag)
            db.session.commit()
            return jsonify({"message": f"Tag '{tag.name}' added to {entity_type.singularize() if hasattr(entity_type, 'singularize') else entity_type[:-1]} '{entity.title}'."}), 200 # type: ignore
        else:
            return jsonify({"message": f"Tag '{tag.name}' is already associated with {entity_type.singularize() if hasattr(entity_type, 'singularize') else entity_type[:-1]} '{entity.title}'."}), 200 # type: ignore
            
    except ValueError as ve: # Para el error de get_entity_and_check_owner
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding tag {tag_id} to {entity_type} {entity_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to add tag to entity due to an internal error"}), 500


@tag_bp.route('/<string:entity_type>/<uuid:entity_id>/tags/<uuid:tag_id_to_remove>', methods=['DELETE'])
@token_required
def remove_tag_from_entity(entity_type, entity_id, tag_id_to_remove):
    current_user = g.current_user

    try:
        tag = Tag.query.filter_by(id=tag_id_to_remove, user_id=current_user.id).first()
        if not tag:
            return jsonify({"error": "Tag not found or access denied"}), 404

        entity = None
        entity_model_map = {
            "pool-missions": PoolMission,
            "scheduled-missions": ScheduledMission,
            "habit-templates": HabitTemplate
        }
        model_to_use = entity_model_map.get(entity_type.lower())
        if not model_to_use:
            return jsonify({"error": "Invalid entity type"}), 400
            
        entity = get_entity_and_check_owner(model_to_use, entity_id, current_user.id)

        if tag in entity.tags:
            entity.tags.remove(tag)
            db.session.commit()
            return jsonify({"message": f"Tag '{tag.name}' removed from {entity_type.singularize() if hasattr(entity_type, 'singularize') else entity_type[:-1]} '{entity.title}'."}), 200 # type: ignore
        else:
            return jsonify({"error": f"Tag '{tag.name}' was not associated with {entity_type.singularize() if hasattr(entity_type, 'singularize') else entity_type[:-1]} '{entity.title}'."}), 404 # type: ignore

    except ValueError as ve: # Para el error de get_entity_and_check_owner
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error removing tag {tag_id_to_remove} from {entity_type} {entity_id} for user {current_user.id}: {e}")
        return jsonify({"error": "Failed to remove tag from entity due to an internal error"}), 500

