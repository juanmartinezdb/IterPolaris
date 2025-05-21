# backend/app/services/gamification_services.py
from datetime import datetime, timedelta, timezone
from app.models import db, User, EnergyLog # No es necesario Quest aquí
from sqlalchemy import func, and_ # and_ importado
from math import floor

# ... (funciones get_xp_for_level, calculate_user_level, get_next_level_xp_requirement, get_current_level_xp_start sin cambios) ...
def get_xp_for_level(level: int) -> int:
    if level <= 1:
        return 0
    required_xp = floor(50 * ((level - 1)**2) + 50 * (level - 1))
    return required_xp

def calculate_user_level(user: User):
    if user.total_points < 0: 
        user.total_points = 0
    new_level = 1
    while True:
        xp_needed_for_next_level = get_xp_for_level(new_level + 1)
        if user.total_points >= xp_needed_for_next_level:
            new_level += 1
        else:
            break 
    if user.level != new_level:
        user.level = new_level
    return user.level

def get_next_level_xp_requirement(current_level: int):
    return get_xp_for_level(current_level + 1)

def get_current_level_xp_start(current_level: int):
    return get_xp_for_level(current_level)


def calculate_energy_balance(user_id: str):
    """
    Calculates the 7-Day Rolling Energy Balance for a user.
    Only considers active EnergyLog entries.
    """
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Sum of absolute energy values (Total Energy Moved - TEM)
    # Solo incluir logs donde is_active = True
    tem_result = db.session.query(
        func.sum(func.abs(EnergyLog.energy_value))
    ).filter(
        EnergyLog.user_id == user_id,
        EnergyLog.created_at >= seven_days_ago,
        EnergyLog.energy_value.isnot(None),
        EnergyLog.is_active == True  # MODIFICACIÓN AQUÍ
    ).scalar() or 0

    # Sum of positive energy values (Positive Energy - PE)
    # Solo incluir logs donde is_active = True
    pe_result = db.session.query(
        func.sum(EnergyLog.energy_value)
    ).filter(
        EnergyLog.user_id == user_id,
        EnergyLog.created_at >= seven_days_ago,
        EnergyLog.energy_value > 0,
        EnergyLog.is_active == True  # MODIFICACIÓN AQUÍ
    ).scalar() or 0
    
    total_energy_moved = int(tem_result)
    positive_energy = int(pe_result)

    if total_energy_moved == 0:
        balance_percentage = 50.0
    else:
        balance_percentage = (positive_energy / total_energy_moved) * 100

    zone = ''
    if balance_percentage < 40:
        zone = 'RED'
    elif balance_percentage <= 60:
        zone = 'GREEN'
    else:
        zone = 'YELLOW'
        
    return {
        "balance_percentage": round(balance_percentage, 2),
        "zone": zone,
        "total_energy_moved": total_energy_moved,
        "positive_energy": positive_energy,
        "calculation_period_days": 7
    }

def update_user_stats_after_mission(
    user: User, 
    points_to_change: int, 
    energy_value_for_log: int, # La energía original de la tarea
    source_entity_type: str, 
    source_entity_id, 
    reason_text: str,
    is_completion: bool # True si es una nueva completitud, False si es una reversión de completitud
):
    """
    Updates user's total points, recalculates level.
    Manages EnergyLog: creates a new active log on completion, 
    or deactivates the original log on reversion.
    """
    if points_to_change != 0:
        user.total_points = (user.total_points or 0) + points_to_change
        if user.total_points < 0:
            user.total_points = 0
        calculate_user_level(user) 

    if is_completion:
        if energy_value_for_log is not None: # Solo loguear si hay un valor de energía
            energy_log = EnergyLog(
                user_id=user.id,
                source_entity_type=source_entity_type,
                source_entity_id=source_entity_id,
                energy_value=energy_value_for_log, # Usar el valor original de la tarea
                reason_text=reason_text,
                is_active=True # Nueva completitud es activa
            )
            db.session.add(energy_log)
    else: # Es una reversión
        # Buscar el EnergyLog original activo para esta tarea y desactivarlo
        original_log_entry = EnergyLog.query.filter(
            EnergyLog.user_id == user.id,
            EnergyLog.source_entity_type == source_entity_type,
            EnergyLog.source_entity_id == source_entity_id,
            EnergyLog.is_active == True,
            # Podríamos añadir un filtro por energy_value si fuera necesario para mayor precisión,
            # pero source_entity_id debería ser suficiente si las tareas son únicas.
            # EnergyLog.energy_value == energy_value_for_log # El valor original que se dio
        ).order_by(EnergyLog.created_at.desc()).first() # El más reciente activo para esta tarea

        if original_log_entry:
            original_log_entry.is_active = False
            db.session.add(original_log_entry)
            # No creamos una entrada negativa, solo desactivamos la positiva.
            # El reason_text de la llamada a esta función (ej. "Reverted Pool Mission...") es más para logging de la acción en sí.
        else:
            # Esto podría pasar si se intenta revertir algo que no tuvo un log activo (raro)
            # o si ya fue revertido. Simplemente no hacemos nada con el EnergyLog.
            current_app.logger.warning(f"Reversion attempted for {source_entity_type} {source_entity_id} but no active EnergyLog found to deactivate.")
    
    # db.session.add(user) # El usuario ya está en sesión
    # La ruta que llama debe hacer db.session.commit()