# backend/app/api/dashboard_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.models import db, User, Quest, Tag, ScheduledMission, HabitOccurrence, HabitTemplate, PoolMission # PoolMission added
from app.auth_utils import token_required
import uuid
from datetime import date, time, datetime, timezone
from sqlalchemy import and_, or_, desc # or_ and desc added

dashboard_bp = Blueprint('dashboard_bp', __name__, url_prefix='/api/dashboard')

@dashboard_bp.route('/today-agenda', methods=['GET'])
@token_required
def get_today_agenda():
    current_user = g.current_user
    tag_ids_param = request.args.getlist('tags')

    today_start_utc = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
    today_end_utc = datetime.combine(date.today(), time.max, tzinfo=timezone.utc)
    
    valid_tag_uuids = []
    if tag_ids_param:
        for tid_str in tag_ids_param:
            for tid in tid_str.split(','): # Handle comma-separated and multiple params
                if tid.strip():
                    try: valid_tag_uuids.append(uuid.UUID(tid.strip()))
                    except ValueError: current_app.logger.warning(f"Invalid UUID format for tag filter: {tid}")

    try:
        # 1. All-day Scheduled Missions for today
        all_day_sm_query = ScheduledMission.query.options(
            db.joinedload(ScheduledMission.quest), 
            db.selectinload(ScheduledMission.tags)
        ).filter(
            ScheduledMission.user_id == current_user.id,
            ScheduledMission.is_all_day == True,
            ScheduledMission.status == 'PENDING',
            ScheduledMission.start_datetime <= today_end_utc, 
            ScheduledMission.end_datetime >= today_start_utc    
        )
        if valid_tag_uuids:
            for tag_uuid_item in valid_tag_uuids:
                all_day_sm_query = all_day_sm_query.filter(ScheduledMission.tags.any(Tag.id == tag_uuid_item))
        
        all_day_missions_results = all_day_sm_query.order_by(ScheduledMission.title.asc()).all()
        all_day_missions = [{
            "id": str(sm.id), "title": sm.title, "status": sm.status, "is_all_day": True,
            "start_datetime": sm.start_datetime.isoformat(), "end_datetime": sm.end_datetime.isoformat(),
            "energy_value": sm.energy_value, "points_value": sm.points_value,
            "quest_id": str(sm.quest_id) if sm.quest_id else None, 
            "quest_name": sm.quest.name if sm.quest else None,
            "type": "SCHEDULED_MISSION_ALL_DAY", # Distinguish type for frontend
            "tags": [{"id": str(t.id), "name": t.name} for t in sm.tags]
        } for sm in all_day_missions_results]

        # 2. Today's Pending Habit Occurrences
        ho_query = HabitOccurrence.query.options(
            db.joinedload(HabitOccurrence.quest),
            db.joinedload(HabitOccurrence.template).selectinload(HabitTemplate.tags)
        ).filter(
            HabitOccurrence.user_id == current_user.id,
            HabitOccurrence.status == 'PENDING',
            HabitOccurrence.scheduled_start_datetime >= today_start_utc,
            HabitOccurrence.scheduled_start_datetime <= today_end_utc
        )
        if valid_tag_uuids:
             ho_query = ho_query.join(HabitTemplate, HabitOccurrence.habit_template_id == HabitTemplate.id)
             for tag_uuid_item in valid_tag_uuids:
                ho_query = ho_query.filter(HabitTemplate.tags.any(Tag.id == tag_uuid_item))

        todays_habits_results = ho_query.order_by(HabitOccurrence.scheduled_start_datetime.asc()).all()
        todays_habits = [{
            "id": str(ho.id), "title": ho.title, "status": ho.status,
            "scheduled_start_datetime": ho.scheduled_start_datetime.isoformat(),
            "scheduled_end_datetime": ho.scheduled_end_datetime.isoformat(),
            "energy_value": ho.energy_value, "points_value": ho.points_value,
            "quest_id": str(ho.quest_id) if ho.quest_id else None, 
            "quest_name": ho.quest.name if ho.quest else None,
            "type": "HABIT_OCCURRENCE",
            "rec_duration_minutes": ho.template.rec_duration_minutes if ho.template else None,
            "tags": [{"id": str(t.id), "name": t.name} for t in ho.template.tags] if ho.template else []
        } for ho in todays_habits_results]

        # 3. Timed Scheduled Missions for today
        timed_sm_query = ScheduledMission.query.options(
            db.joinedload(ScheduledMission.quest), 
            db.selectinload(ScheduledMission.tags)
        ).filter(
            ScheduledMission.user_id == current_user.id,
            ScheduledMission.is_all_day == False,
            ScheduledMission.status == 'PENDING',
            ScheduledMission.start_datetime >= today_start_utc,
            ScheduledMission.start_datetime <= today_end_utc
        )
        if valid_tag_uuids:
            for tag_uuid_item in valid_tag_uuids:
                timed_sm_query = timed_sm_query.filter(ScheduledMission.tags.any(Tag.id == tag_uuid_item))

        timed_missions_results = timed_sm_query.order_by(ScheduledMission.start_datetime.asc()).all()
        timed_missions = [{
            "id": str(sm.id), "title": sm.title, "status": sm.status, "is_all_day": False,
            "start_datetime": sm.start_datetime.isoformat(), "end_datetime": sm.end_datetime.isoformat(),
            "energy_value": sm.energy_value, "points_value": sm.points_value,
            "quest_id": str(sm.quest_id) if sm.quest_id else None, 
            "quest_name": sm.quest.name if sm.quest else None,
            "type": "SCHEDULED_MISSION_TIMED", # Distinguish type
            "tags": [{"id": str(t.id), "name": t.name} for t in sm.tags]
        } for sm in timed_missions_results]
        
        return jsonify({
            "all_day_missions": all_day_missions,
            "todays_habits": todays_habits,
            "timed_missions": timed_missions
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching today's agenda for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch today's agenda"}), 500

@dashboard_bp.route('/recent-activity', methods=['GET'])
@token_required
def get_recent_activity():
    current_user = g.current_user
    tag_ids_param = request.args.getlist('tags')
    limit = request.args.get('limit', 10, type=int)

    valid_tag_uuids = []
    if tag_ids_param:
        for tid_str in tag_ids_param:
            for tid in tid_str.split(','):
                if tid.strip():
                    try: valid_tag_uuids.append(uuid.UUID(tid.strip()))
                    except ValueError: current_app.logger.warning(f"Invalid UUID format for tag filter: {tid}")
    try:
        completed_items = []
        # Scheduled Missions
        sm_query = ScheduledMission.query.options(
            db.joinedload(ScheduledMission.quest), db.selectinload(ScheduledMission.tags)
        ).filter(
            ScheduledMission.user_id == current_user.id, ScheduledMission.status == 'COMPLETED'
        )
        if valid_tag_uuids:
            for tag_uuid_item in valid_tag_uuids:
                sm_query = sm_query.filter(ScheduledMission.tags.any(Tag.id == tag_uuid_item))
        completed_sm = sm_query.order_by(desc(ScheduledMission.updated_at)).limit(limit).all()
        for sm in completed_sm:
            completed_items.append({
                "id": str(sm.id), "title": sm.title, "type": "SCHEDULED_MISSION", 
                "completed_at": sm.updated_at.isoformat(), # Using updated_at as proxy for completion
                "quest_name": sm.quest.name if sm.quest else None, "quest_color": sm.quest.color if sm.quest else '#FFFFFF',
                "tags": [{"id": str(t.id), "name": t.name} for t in sm.tags],
                "energy_value": sm.energy_value, "points_value": sm.points_value
            })

        # Habit Occurrences
        ho_query = HabitOccurrence.query.options(
            db.joinedload(HabitOccurrence.quest), 
            db.joinedload(HabitOccurrence.template).selectinload(HabitTemplate.tags)
        ).filter(
            HabitOccurrence.user_id == current_user.id, HabitOccurrence.status == 'COMPLETED'
        )
        if valid_tag_uuids:
            ho_query = ho_query.join(HabitTemplate, HabitOccurrence.habit_template_id == HabitTemplate.id)
            for tag_uuid_item in valid_tag_uuids:
                ho_query = ho_query.filter(HabitTemplate.tags.any(Tag.id == tag_uuid_item))
        completed_ho = ho_query.order_by(desc(HabitOccurrence.actual_completion_datetime)).limit(limit).all()
        for ho in completed_ho:
            completed_items.append({
                "id": str(ho.id), "title": ho.title, "type": "HABIT_OCCURRENCE",
                "completed_at": ho.actual_completion_datetime.isoformat() if ho.actual_completion_datetime else ho.updated_at.isoformat(),
                "quest_name": ho.quest.name if ho.quest else None, "quest_color": ho.quest.color if ho.quest else '#FFFFFF',
                "tags": [{"id": str(t.id), "name": t.name} for t in ho.template.tags] if ho.template else [],
                "energy_value": ho.energy_value, "points_value": ho.points_value
            })
        
        # Pool Missions
        pm_query = PoolMission.query.options(
            db.joinedload(PoolMission.quest), db.selectinload(PoolMission.tags)
        ).filter(
            PoolMission.user_id == current_user.id, PoolMission.status == 'COMPLETED'
        )
        if valid_tag_uuids:
            for tag_uuid_item in valid_tag_uuids:
                pm_query = pm_query.filter(PoolMission.tags.any(Tag.id == tag_uuid_item))
        completed_pm = pm_query.order_by(desc(PoolMission.updated_at)).limit(limit).all()
        for pm in completed_pm:
            completed_items.append({
                "id": str(pm.id), "title": pm.title, "type": "POOL_MISSION",
                "completed_at": pm.updated_at.isoformat(), # Using updated_at as proxy
                "quest_name": pm.quest.name if pm.quest else None, "quest_color": pm.quest.color if pm.quest else '#FFFFFF',
                "tags": [{"id": str(t.id), "name": t.name} for t in pm.tags],
                "energy_value": pm.energy_value, "points_value": pm.points_value
            })

        # Sort all collected items by completion date and take the top 'limit'
        completed_items.sort(key=lambda x: x["completed_at"], reverse=True)
        return jsonify(completed_items[:limit]), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching recent activity for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch recent activity"}), 500

@dashboard_bp.route('/rescue-missions', methods=['GET'])
@token_required
def get_rescue_missions():
    current_user = g.current_user
    tag_ids_param = request.args.getlist('tags')
    limit = request.args.get('limit', 10, type=int) # Keep a limit for dashboard performance

    valid_tag_uuids = []
    if tag_ids_param:
        for tid_str in tag_ids_param:
            for tid in tid_str.split(','):
                if tid.strip():
                    try: valid_tag_uuids.append(uuid.UUID(tid.strip()))
                    except ValueError: current_app.logger.warning(f"RescueMissions: Invalid UUID format for tag filter: {tid}")
    
    rescue_items = []
    try:
        # Skipped Scheduled Missions
        sm_query = ScheduledMission.query.options(
            db.joinedload(ScheduledMission.quest), db.selectinload(ScheduledMission.tags)
        ).filter(
            ScheduledMission.user_id == current_user.id, ScheduledMission.status == 'SKIPPED'
        )
        if valid_tag_uuids:
            for tag_uuid_item in valid_tag_uuids:
                sm_query = sm_query.filter(ScheduledMission.tags.any(Tag.id == tag_uuid_item))
        
        # Order by when they were supposed to start, most recent skipped first
        skipped_sm_results = sm_query.order_by(desc(ScheduledMission.start_datetime)).limit(limit).all()
        for sm in skipped_sm_results:
            rescue_items.append({
                "id": str(sm.id), "title": sm.title, "type": "SCHEDULED_MISSION", "status": "SKIPPED",
                "original_start_datetime": sm.start_datetime.isoformat(), 
                "quest_name": sm.quest.name if sm.quest else None, 
                "quest_id": str(sm.quest_id) if sm.quest_id else None, # Added quest_id
                "quest_color": sm.quest.color if sm.quest else '#FFFFFF',
                "tags": [{"id": str(t.id), "name": t.name} for t in sm.tags],
                "energy_value": sm.energy_value, "points_value": sm.points_value,
                "description": sm.description # Added description
            })
        
        # Deferred Pool Missions
        pm_query = PoolMission.query.options(
            db.joinedload(PoolMission.quest), db.selectinload(PoolMission.tags)
        ).filter(
            PoolMission.user_id == current_user.id, 
            PoolMission.status == 'PENDING', # Crucially, must be PENDING to be "rescuable" to ACTIVE
            PoolMission.focus_status == 'DEFERRED'
        )
        if valid_tag_uuids:
            for tag_uuid_item in valid_tag_uuids:
                pm_query = pm_query.filter(PoolMission.tags.any(Tag.id == tag_uuid_item))
        
        # Order by when they were last updated (likely when focus changed to DEFERRED)
        deferred_pm_results = pm_query.order_by(desc(PoolMission.updated_at)).limit(limit).all()
        for pm in deferred_pm_results:
            rescue_items.append({
                "id": str(pm.id), "title": pm.title, "type": "POOL_MISSION", "status": "DEFERRED", # Frontend uses this to show 'Deferred Task'
                "focus_status": pm.focus_status, # Actual focus status
                "quest_name": pm.quest.name if pm.quest else None, 
                "quest_id": str(pm.quest_id) if pm.quest_id else None, # Added quest_id
                "quest_color": pm.quest.color if pm.quest else '#FFFFFF',
                "tags": [{"id": str(t.id), "name": t.name} for t in pm.tags],
                "energy_value": pm.energy_value, "points_value": pm.points_value,
                "description": pm.description # Added description
            })
        
        # Simple sort after combining, may need refinement if specific cross-type ordering is desired
        rescue_items.sort(key=lambda x: x.get("original_start_datetime") or x.get("updated_at", datetime.min.isoformat()), reverse=True)
        
        return jsonify(rescue_items[:limit]), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching rescue missions for user {current_user.id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch rescue missions data."}), 500
