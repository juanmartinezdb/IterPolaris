# backend/app/api/pool_mission_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Quest, Tag, PoolMission
# Quita la importación de las tablas de asociación si no las usas directamente en este archivo
# from app.models import pool_mission_tags_association 
from app.auth_utils import token_required
import uuid

pool_mission_bp = Blueprint('pool_mission_bp', __name__, url_prefix='/api/pool-missions')

# Función de validación (la que tenías o una similar)
def validate_pool_mission_data(data, is_update=False):
    errors = {}
    # Campos requeridos para la creación, no necesariamente para la actualización si no se cambian
    required_fields_on_create = ['title', 'energy_value', 'points_value']
    
    if not is_update:
        for field in required_fields_on_create:
            if field not in data or data[field] is None: # Permitir 0 para energy/points
                errors[field] = f"{field} is required."
    
    if 'title' in data and (not isinstance(data.get('title'), str) or len(data.get('title', '').strip()) == 0):
        errors['title'] = "Title must be a non-empty string."
    elif 'title' in data and len(data.get('title', '')) > 255:
        errors['title'] = "Title is too long (max 255 characters)."

    if 'description' in data and data.get('description') is not None and not isinstance(data.get('description'), str):
        errors['description'] = "Description must be a string."
    
    if 'energy_value' in data and not isinstance(data.get('energy_value'), int):
        errors['energy_value'] = "Energy value must be an integer."
    
    if 'points_value' in data:
        if not isinstance(data.get('points_value'), int):
            errors['points_value'] = "Points value must be an integer."
        elif data.get('points_value', 0) < 0:
            errors['points_value'] = "Points value cannot be negative."

    if 'quest_id' in data and data.get('quest_id') is not None:
        try:
            if data['quest_id']: # Solo validar si no es una cadena vacía que representa "ninguna"
                 uuid.UUID(str(data['quest_id']))
        except ValueError:
            errors['quest_id'] = "Invalid Quest ID format."
            
    if 'status' in data and data.get('status') not in ['PENDING', 'COMPLETED']:
        errors['status'] = "Invalid status. Must be 'PENDING' or 'COMPLETED'."

    if 'focus_status' in data and data.get('focus_status') not in ['ACTIVE', 'DEFERRED']:
        errors['focus_status'] = "Invalid focus status. Must be 'ACTIVE' or 'DEFERRED'."

    if 'tag_ids' in data:
        if not isinstance(data.get('tag_ids'), list):
            errors['tag_ids'] = "tag_ids must be a list."
        else:
            for tag_id_str in data.get('tag_ids', []):
                try:
                    uuid.UUID(str(tag_id_str))
                except ValueError:
                    errors['tag_ids'] = f"Invalid UUID format for tag_id: {tag_id_str}."
                    break
    return errors


@pool_mission_bp.route('', methods=['POST'])
@token_required
def create_pool_mission():
    data = request.get_json()
    current_user = g.current_user

    errors = validate_pool_mission_data(data, is_update=False)
    if errors:
        return jsonify({"errors": errors}), 400

    title = data['title'].strip()
    description = data.get('description', '').strip() if data.get('description') else None
    energy_value = data['energy_value']
    points_value = data['points_value']
    quest_id_str = data.get('quest_id') # Puede ser string UUID, "", o None
    tag_ids_str_list = data.get('tag_ids', [])

    assigned_quest_object = None 
    final_quest_id_for_db = None

    if quest_id_str: # Si el usuario seleccionó una quest específica
        try:
            quest_uuid = uuid.UUID(quest_id_str)
            found_quest = Quest.query.filter_by(id=quest_uuid, user_id=current_user.id).first()
            if not found_quest:
                return jsonify({"error": "Specified Quest not found or access denied."}), 404
            final_quest_id_for_db = found_quest.id
            assigned_quest_object = found_quest
        except ValueError:
             return jsonify({"error": "Invalid Quest ID format provided."}), 400
    else: # Si quest_id_str es "" o None, asignar a la Quest "General"
        default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
        if not default_quest:
            current_app.logger.error(f"CRITICAL: User {current_user.id} does not have a default Quest for PoolMission assignment.")
            return jsonify({"error": "Default quest not found. Cannot create mission."}), 500
        final_quest_id_for_db = default_quest.id
        assigned_quest_object = default_quest
    
    try:
        new_mission = PoolMission(
            user_id=current_user.id,
            title=title,
            description=description,
            energy_value=energy_value,
            points_value=points_value,
            quest_id=final_quest_id_for_db,
            status=data.get('status', 'PENDING'),
            focus_status=data.get('focus_status', 'ACTIVE')
        )
        db.session.add(new_mission)
        db.session.flush() 

        if tag_ids_str_list:
            valid_tag_uuids = []
            for tid_str in tag_ids_str_list:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError:
                    # Opcional: manejar o loguear tag_id inválido
                    current_app.logger.warning(f"Invalid UUID format for tag_id '{tid_str}' during PoolMission creation for user {current_user.id}.")
                    pass # Ignorar tag_id inválido o devolver error

            if valid_tag_uuids:
                tags_to_associate = Tag.query.filter(Tag.id.in_(valid_tag_uuids), Tag.user_id == current_user.id).all()
                new_mission.tags = tags_to_associate
            else:
                new_mission.tags = []


        db.session.commit()
        
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in new_mission.tags]

        return jsonify({
            "id": str(new_mission.id),
            "title": new_mission.title,
            "description": new_mission.description,
            "energy_value": new_mission.energy_value,
            "points_value": new_mission.points_value,
            "status": new_mission.status,
            "focus_status": new_mission.focus_status,
            "quest_id": str(new_mission.quest_id) if new_mission.quest_id else None,
            "quest_name": assigned_quest_object.name if assigned_quest_object else None, 
            "tags": mission_tags_data,
            "created_at": new_mission.created_at.isoformat(),
            "updated_at": new_mission.updated_at.isoformat()
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating pool mission for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to create pool mission due to an internal error"}), 500


@pool_mission_bp.route('/<uuid:mission_id>', methods=['PUT'])
@token_required
def update_pool_mission(mission_id):
    data = request.get_json()
    current_user = g.current_user # type: User

    mission_to_update = PoolMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
    if not mission_to_update:
        return jsonify({"error": "Pool Mission not found or access denied"}), 404

    errors = validate_pool_mission_data(data, is_update=True) 
    if errors:
        return jsonify({"errors": errors}), 400

    try:
        old_status = mission_to_update.status
        new_status = data.get('status', old_status) # Mantener status si no se provee

        # Actualizar campos básicos
        if 'title' in data: mission_to_update.title = data['title'].strip()
        if 'description' in data: mission_to_update.description = data['description'].strip() if data.get('description') else None
        if 'energy_value' in data: mission_to_update.energy_value = data['energy_value']
        if 'points_value' in data: mission_to_update.points_value = data['points_value']
        # No actualizar status aquí directamente, se maneja abajo con la lógica de energía/puntos
        if 'focus_status' in data: mission_to_update.focus_status = data['focus_status']
        
        final_assigned_quest_object = Quest.query.get(mission_to_update.quest_id) if mission_to_update.quest_id else None

        if 'quest_id' in data:
            # ... (lógica de asignación de quest_id como antes) ...
            quest_id_str = data.get('quest_id') 
            if quest_id_str: 
                try:
                    quest_uuid_to_assign = uuid.UUID(quest_id_str)
                    quest_to_assign = Quest.query.filter_by(id=quest_uuid_to_assign, user_id=current_user.id).first()
                    if not quest_to_assign:
                        return jsonify({"error": "Specified Quest not found or access denied for update."}), 404
                    mission_to_update.quest_id = quest_to_assign.id
                    final_assigned_quest_object = quest_to_assign
                except ValueError:
                     return jsonify({"error": "Invalid Quest ID format for update."}), 400
            else: 
                default_quest = Quest.query.filter_by(user_id=current_user.id, is_default_quest=True).first()
                if not default_quest: 
                    current_app.logger.error(f"CRITICAL: User {current_user.id} missing default Quest during mission update.")
                    return jsonify({"error": "Default quest not found. Cannot update mission."}), 500
                mission_to_update.quest_id = default_quest.id
                final_assigned_quest_object = default_quest
        
        if 'tag_ids' in data:
            # ... (lógica de asignación de tags como antes) ...
            tag_ids_str_list = data.get('tag_ids', [])
            valid_tag_uuids = []
            for tid_str in tag_ids_str_list:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError:
                    current_app.logger.warning(f"Invalid UUID format for tag_id '{tid_str}' during PoolMission update for user {current_user.id}.")
                    pass 

            if valid_tag_uuids:
                tags_to_associate = Tag.query.filter(Tag.id.in_(valid_tag_uuids), Tag.user_id == current_user.id).all()
                mission_to_update.tags = tags_to_associate
            else: 
                mission_to_update.tags = []

        # Lógica de Puntos y Energía al cambiar Status
        if 'status' in data and new_status != old_status:
            mission_to_update.status = new_status # Aplicar el nuevo estado
            if new_status == 'COMPLETED':
                current_user.total_points += mission_to_update.points_value
                energy_log_reason = f"Completed Pool Mission: {mission_to_update.title}"
                log_energy_value = mission_to_update.energy_value
                current_app.logger.info(f"PoolMission {mission_to_update.id} COMPLETED. Points: +{mission_to_update.points_value}, Energy: {log_energy_value}")
            elif old_status == 'COMPLETED' and new_status == 'PENDING': # Reversión
                current_user.total_points -= mission_to_update.points_value
                energy_log_reason = f"Reverted Pool Mission completion: {mission_to_update.title}"
                log_energy_value = -mission_to_update.energy_value # Negar la energía
                current_app.logger.info(f"PoolMission {mission_to_update.id} REVERTED. Points: -{mission_to_update.points_value}, Energy: {log_energy_value}")
            else: # Otros cambios de estado (ej. PENDING a PENDING, o DEFERRED a PENDING) no afectan puntos/energía aquí
                energy_log_reason = None
                log_energy_value = None

            if energy_log_reason and log_energy_value is not None:
                energy_log_entry = EnergyLog(
                    user_id=current_user.id,
                    source_entity_type='POOL_MISSION',
                    source_entity_id=mission_to_update.id,
                    energy_value=log_energy_value,
                    reason_text=energy_log_reason
                )
                db.session.add(energy_log_entry)
        
        # Aquí llamaremos a la función para recalcular nivel más adelante (Subtask 8.5)
        # Por ejemplo: update_user_level(current_user)

        db.session.commit()
        
        final_mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission_to_update.tags]

        return jsonify({
            "id": str(mission_to_update.id),
            "title": mission_to_update.title,
            "description": mission_to_update.description,
            "energy_value": mission_to_update.energy_value,
            "points_value": mission_to_update.points_value,
            "status": mission_to_update.status,
            "focus_status": mission_to_update.focus_status,
            "quest_id": str(mission_to_update.quest_id) if mission_to_update.quest_id else None,
            "quest_name": final_assigned_quest_object.name if final_assigned_quest_object else None,
            "tags": final_mission_tags_data,
            "user_total_points": current_user.total_points, # Devolver puntos actualizados
            "user_level": current_user.level,             # Devolver nivel (se actualizará en 8.5)
            "updated_at": mission_to_update.updated_at.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating pool mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update pool mission: " + str(e)}), 500


@pool_mission_bp.route('', methods=['GET'])
@token_required
def get_pool_missions():
    current_user = g.current_user
    quest_id_filter_str = request.args.get('quest_id')
    tag_ids_filter_str = request.args.get('tags')
    focus_status_filter = request.args.get('focus_status')
    status_filter = request.args.get('status')
    
    try:
        query = PoolMission.query.filter_by(user_id=current_user.id)

        if quest_id_filter_str:
            try:
                quest_uuid = uuid.UUID(quest_id_filter_str)
                query = query.filter(PoolMission.quest_id == quest_uuid)
            except ValueError: # Si quest_id_filter_str no es un UUID válido, no aplicar filtro o error
                pass # Opcionalmente: return jsonify({"error": "Invalid quest_id format for filter."}), 400
        
        if tag_ids_filter_str:
            tag_ids_list_str = [tid.strip() for tid in tag_ids_filter_str.split(',') if tid.strip()]
            if tag_ids_list_str:
                try:
                    tag_uuids = [uuid.UUID(tid) for tid in tag_ids_list_str]
                    for tag_uuid_item in tag_uuids:
                        query = query.filter(PoolMission.tags.any(Tag.id == tag_uuid_item))
                except ValueError:
                    pass # Opcionalmente: return jsonify({"error": "Invalid tag_id format in tags filter."}), 400

        if focus_status_filter and focus_status_filter.upper() in ['ACTIVE', 'DEFERRED']:
            query = query.filter(PoolMission.focus_status == focus_status_filter.upper())

        if status_filter and status_filter.upper() in ['PENDING', 'COMPLETED']:
            query = query.filter(PoolMission.status == status_filter.upper())

        missions = query.order_by(PoolMission.focus_status.asc(), PoolMission.created_at.desc()).all() # Priorizar ACTIVE
        
        missions_data = []
        for mission in missions:
            # Para obtener el nombre de la quest, hacemos una subconsulta o join.
            # Es más eficiente si se hace con un join en la query principal, pero para simplicidad aquí:
            quest_name_val = None
            if mission.quest_id:
                quest_obj = Quest.query.get(mission.quest_id) # db.session.get(Quest, mission.quest_id) con SQLAlchemy 2.0
                if quest_obj:
                    quest_name_val = quest_obj.name
            
            mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission.tags]
            missions_data.append({
                "id": str(mission.id),
                "title": mission.title,
                "description": mission.description,
                "energy_value": mission.energy_value,
                "points_value": mission.points_value,
                "status": mission.status,
                "focus_status": mission.focus_status,
                "quest_id": str(mission.quest_id) if mission.quest_id else None,
                "quest_name": quest_name_val,
                "tags": mission_tags_data,
                "created_at": mission.created_at.isoformat(),
                "updated_at": mission.updated_at.isoformat()
            })
        
        return jsonify(missions_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching pool missions for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch pool missions due to an internal error"}), 500


@pool_mission_bp.route('/<uuid:mission_id>', methods=['GET'])
@token_required
def get_pool_mission(mission_id):
    current_user = g.current_user
    try:
        mission = PoolMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission:
            return jsonify({"error": "Pool Mission not found or access denied"}), 404
        
        quest_name_val = None
        if mission.quest_id:
            quest_obj = Quest.query.get(mission.quest_id)
            if quest_obj:
                quest_name_val = quest_obj.name
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission.tags]
            
        return jsonify({
            "id": str(mission.id),
            "title": mission.title,
            "description": mission.description,
            "energy_value": mission.energy_value,
            "points_value": mission.points_value,
            "status": mission.status,
            "focus_status": mission.focus_status,
            "quest_id": str(mission.quest_id) if mission.quest_id else None,
            "quest_name": quest_name_val,
            "tags": mission_tags_data,
            "created_at": mission.created_at.isoformat(),
            "updated_at": mission.updated_at.isoformat()
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching pool mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch pool mission due to an internal error"}), 500


@pool_mission_bp.route('/<uuid:mission_id>', methods=['DELETE'])
@token_required
def delete_pool_mission(mission_id):
    current_user = g.current_user
    try:
        mission_to_delete = PoolMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission_to_delete:
            return jsonify({"error": "Pool Mission not found or access denied"}), 404

        # Desasociar tags explícitamente antes de borrar la misión para limpiar la tabla de asociación.
        # Aunque SQLAlchemy podría manejarlo con `cascade='delete-orphan'` en la relación `tags` de `PoolMission`,
        # es más seguro si la tabla de asociación usa ON DELETE CASCADE en la BD.
        # Si no, esto es necesario:
        mission_to_delete.tags = [] 
        db.session.flush() # Aplicar la desasociación

        mission_title_deleted = mission_to_delete.title
        db.session.delete(mission_to_delete)
        db.session.commit()
        
        return jsonify({"message": f"Pool Mission '{mission_title_deleted}' deleted successfully."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting pool mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete pool mission due to an internal error"}), 500


@pool_mission_bp.route('/<uuid:mission_id>/focus', methods=['PATCH'])
@token_required
def toggle_pool_mission_focus(mission_id):
    data = request.get_json()
    current_user = g.current_user

    new_focus_status = data.get('focus_status')
    if not new_focus_status or new_focus_status.upper() not in ['ACTIVE', 'DEFERRED']:
        return jsonify({"error": "Invalid or missing focus_status. Must be 'ACTIVE' or 'DEFERRED'."}), 400

    try:
        mission = PoolMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission:
            return jsonify({"error": "Pool Mission not found or access denied"}), 404

        mission.focus_status = new_focus_status.upper()
        db.session.commit()

        quest_name_val = None
        if mission.quest_id:
            quest_obj = Quest.query.get(mission.quest_id)
            if quest_obj: quest_name_val = quest_obj.name
        mission_tags_data = [{"id": str(tag.id), "name": tag.name} for tag in mission.tags]

        return jsonify({
            "id": str(mission.id),
            "title": mission.title,
            "description": mission.description,
            "energy_value": mission.energy_value,
            "points_value": mission.points_value,
            "status": mission.status,
            "focus_status": mission.focus_status,
            "quest_id": str(mission.quest_id) if mission.quest_id else None,
            "quest_name": quest_name_val,
            "tags": mission_tags_data,
            "updated_at": mission.updated_at.isoformat() # Importante devolver el objeto completo y actualizado
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error toggling focus for pool mission {mission_id} user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to toggle focus status due to an internal error"}), 500