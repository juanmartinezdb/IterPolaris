# backend/app/api/pool_mission_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Quest, Tag, PoolMission, EnergyLog # EnergyLog added
from app.auth_utils import token_required
import uuid
from app.services.gamification_services import update_user_stats_after_mission # Import service

pool_mission_bp = Blueprint('pool_mission_bp', __name__, url_prefix='/api/pool-missions')

# validate_pool_mission_data (sin cambios respecto a la versión anterior que te di)
def validate_pool_mission_data(data, is_update=False):
    errors = {}
    required_fields_on_create = ['title', 'energy_value', 'points_value']
    
    if not is_update:
        for field in required_fields_on_create:
            if field not in data or data[field] is None:
                if field not in ['energy_value', 'points_value'] or data.get(field) is None:
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
            if data['quest_id']: 
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

# create_pool_mission (sin cambios respecto a la versión anterior que te di)
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
    quest_id_str = data.get('quest_id')
    tag_ids_str_list = data.get('tag_ids', [])
    status = data.get('status', 'PENDING')
    focus_status = data.get('focus_status', 'ACTIVE')


    assigned_quest_object = None 
    final_quest_id_for_db = None

    if quest_id_str:
        try:
            quest_uuid = uuid.UUID(quest_id_str)
            found_quest = Quest.query.filter_by(id=quest_uuid, user_id=current_user.id).first()
            if not found_quest:
                return jsonify({"error": "Specified Quest not found or access denied."}), 404
            final_quest_id_for_db = found_quest.id
            assigned_quest_object = found_quest
        except ValueError:
             return jsonify({"error": "Invalid Quest ID format provided."}), 400
    else:
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
            status=status,
            focus_status=focus_status
        )
        db.session.add(new_mission)
        db.session.flush() 

        if tag_ids_str_list:
            valid_tag_uuids = []
            for tid_str in tag_ids_str_list:
                try:
                    valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError:
                    current_app.logger.warning(f"Invalid UUID format for tag_id '{tid_str}' during PoolMission creation for user {current_user.id}.")
                    pass 

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

# get_pool_missions (sin cambios respecto a la versión anterior que te di)
@pool_mission_bp.route('', methods=['GET'])
@token_required
def get_pool_missions():
    current_user = g.current_user
    quest_id_filter_str = request.args.get('quest_id')
    tag_ids_filter_str = request.args.get('tags')
    focus_status_filter = request.args.get('focus_status')
    status_filter = request.args.get('status') # Acepta 'PENDING', 'COMPLETED', o 'ALL_STATUSES' desde el frontend
    
    try:
        query = PoolMission.query.filter_by(user_id=current_user.id)

        if quest_id_filter_str:
            try:
                quest_uuid = uuid.UUID(quest_id_filter_str)
                query = query.filter(PoolMission.quest_id == quest_uuid)
            except ValueError:
                pass 
        
        if tag_ids_filter_str:
            tag_ids_list_str = [tid.strip() for tid in tag_ids_filter_str.split(',') if tid.strip()]
            if tag_ids_list_str:
                try:
                    tag_uuids = [uuid.UUID(tid) for tid in tag_ids_list_str]
                    for tag_uuid_item in tag_uuids:
                         query = query.filter(PoolMission.tags.any(Tag.id == tag_uuid_item))
                except ValueError:
                    pass 

        if focus_status_filter and focus_status_filter.upper() in ['ACTIVE', 'DEFERRED']:
            query = query.filter(PoolMission.focus_status == focus_status_filter.upper())

        # Modificación para filtro de status
        if status_filter and status_filter.upper() != 'ALL_STATUSES':
            if status_filter.upper() in ['PENDING', 'COMPLETED']:
                 query = query.filter(PoolMission.status == status_filter.upper())
        elif not status_filter: # Si no se especifica filtro de status, por defecto mostrar solo PENDING
            query = query.filter(PoolMission.status == 'PENDING')
        # Si status_filter es 'ALL_STATUSES', no se aplica filtro de status


        missions = query.order_by(
            db.case(
                (PoolMission.focus_status == 'ACTIVE', 0),
                (PoolMission.focus_status == 'DEFERRED', 1),
                else_=2 
            ),
            PoolMission.status.asc(), # PENDING antes que COMPLETED si se muestran ambos
            PoolMission.created_at.desc() 
        ).all()
        
        missions_data = []
        for mission in missions:
            quest_name_val = None
            if mission.quest: 
                quest_name_val = mission.quest.name
            
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

# get_pool_mission (sin cambios respecto a la versión anterior que te di)
@pool_mission_bp.route('/<uuid:mission_id>', methods=['GET'])
@token_required
def get_pool_mission(mission_id):
    current_user = g.current_user
    try:
        mission = PoolMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission:
            return jsonify({"error": "Pool Mission not found or access denied"}), 404
        
        quest_name_val = mission.quest.name if mission.quest else None
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
        
        # Guardar valores originales de energía/puntos de la misión ANTES de que puedan ser cambiados por el payload
        original_mission_energy = mission_to_update.energy_value
        original_mission_points = mission_to_update.points_value
        
        # Actualizar campos si se proporcionan en el payload
        if 'title' in data: mission_to_update.title = data['title'].strip()
        if 'description' in data: mission_to_update.description = data['description'].strip() if data.get('description') else None
        if 'energy_value' in data: mission_to_update.energy_value = data['energy_value'] # Actualiza el valor base de la misión
        if 'points_value' in data: mission_to_update.points_value = data['points_value'] # Actualiza el valor base de la misión
        if 'focus_status' in data: mission_to_update.focus_status = data['focus_status']
        
        final_assigned_quest_object = mission_to_update.quest 

        if 'quest_id' in data:
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
            tag_ids_str_list = data.get('tag_ids', [])
            valid_tag_uuids = []
            for tid_str in tag_ids_str_list:
                try: valid_tag_uuids.append(uuid.UUID(tid_str))
                except ValueError: pass 

            if valid_tag_uuids:
                tags_to_associate = Tag.query.filter(Tag.id.in_(valid_tag_uuids), Tag.user_id == current_user.id).all()
                mission_to_update.tags = tags_to_associate
            else: 
                mission_to_update.tags = []

        # Lógica de Puntos y Energía al cambiar Status
        if 'status' in data:
            new_status = data['status']
            if new_status != old_status:
                mission_to_update.status = new_status 
                points_change = 0
                log_reason = None
                is_completion_event = False

                if new_status == 'COMPLETED':
                    points_change = original_mission_points # Puntos que otorga la misión
                    log_reason = f"Completed Pool Mission: {mission_to_update.title}"
                    is_completion_event = True
                elif old_status == 'COMPLETED' and new_status == 'PENDING': 
                    points_change = -original_mission_points # Revertir puntos
                    log_reason = f"Reverted Pool Mission completion: {mission_to_update.title}"
                    is_completion_event = False 
                
                if log_reason: 
                    update_user_stats_after_mission(
                        user=current_user,
                        points_to_change=points_change,
                        energy_value_for_log=original_mission_energy, # La energía que movió la misión originalmente
                        source_entity_type='POOL_MISSION',
                        source_entity_id=mission_to_update.id,
                        reason_text=log_reason,
                        is_completion=is_completion_event 
                    )
        
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
            "user_total_points": current_user.total_points,
            "user_level": current_user.level,
            "updated_at": mission_to_update.updated_at.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating pool mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update pool mission: " + str(e)}), 500

@pool_mission_bp.route('/<uuid:mission_id>', methods=['DELETE'])
@token_required
def delete_pool_mission(mission_id):
    current_user = g.current_user
    try:
        mission_to_delete = PoolMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
        if not mission_to_delete:
            return jsonify({"error": "Pool Mission not found or access denied"}), 404

        if mission_to_delete.status == 'COMPLETED':
            # Revertir puntos y marcar el EnergyLog original como inactivo
            update_user_stats_after_mission(
                user=current_user,
                points_to_change=-mission_to_delete.points_value, # Puntos a restar
                energy_value_for_log=mission_to_delete.energy_value, # La energía original
                source_entity_type='POOL_MISSION',
                source_entity_id=mission_to_delete.id,
                reason_text=f"Deleted completed Pool Mission: {mission_to_delete.title}",
                is_completion=False # Indica que es una reversión/cancelación para el EnergyLog
            )
        
        mission_to_delete.tags = [] 
        db.session.flush() 

        mission_title_deleted = mission_to_delete.title
        db.session.delete(mission_to_delete)
        db.session.commit()
        
        return jsonify({
            "message": f"Pool Mission '{mission_title_deleted}' deleted successfully.",
            "user_total_points": current_user.total_points, # Devolver stats actualizadas
            "user_level": current_user.level
            }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting pool mission {mission_id} for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete pool mission due to an internal error"}), 500

# toggle_pool_mission_focus (sin cambios respecto a la versión anterior que te di)
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

        quest_name_val = mission.quest.name if mission.quest else None
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
            "updated_at": mission.updated_at.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error toggling focus for pool mission {mission_id} user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to toggle focus status due to an internal error"}), 500
    

@pool_mission_bp.route('/<uuid:mission_id>/undo-completion', methods=['PATCH'])
@token_required
def undo_pool_mission_completion(mission_id):
    current_user = g.current_user
    mission = PoolMission.query.filter_by(id=mission_id, user_id=current_user.id).first()
    if not mission: return jsonify({"error": "Pool Mission not found"}), 404
    if mission.status != 'COMPLETED': return jsonify({"error": "Mission is not marked as completed"}), 400

    try:
        mission.status = 'PENDING'
        # Revert points and deactivate energy log entry
        update_user_stats_after_mission(
            user=current_user,
            points_to_change=-mission.points_value,
            energy_value_for_log=mission.energy_value,
            source_entity_type='POOL_MISSION',
            source_entity_id=mission.id,
            reason_text=f"Undo completion of PM: {mission.title}",
            is_completion=False
        )
        db.session.commit()
        return jsonify({
            "message": "Pool Mission completion undone.",
            "user_total_points": current_user.total_points,
            "user_level": current_user.level
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error undoing PM {mission.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to undo mission completion"}), 500