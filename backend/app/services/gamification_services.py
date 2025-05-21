# backend/app/services/gamification_services.py
from datetime import datetime, timedelta, timezone
from app.models import db, User, EnergyLog
from sqlalchemy import func, cast, Numeric, and_
from math import floor, sqrt # Añadido sqrt para una progresión no lineal

# Constantes para la progresión de niveles
BASE_XP_FOR_LEVEL_2 = 100  # Puntos necesarios para pasar del nivel 1 al 2
XP_INCREASE_FACTOR = 50   # Cuánto más se necesita para cada nivel subsiguiente (lineal)
# O, para una progresión un poco más lenta/curva:
# XP_POWER_FACTOR = 1.5 # Exponencial (p.ej., 100 * (level-1)^1.5)
# SCALING_FACTOR = 100 # Multiplicador general

def get_xp_for_level(level: int) -> int:
    """
    Calcula el total de XP necesario para alcanzar un cierto nivel.
    Nivel 1 requiere 0 XP.
    """
    if level <= 1:
        return 0
    # Ejemplo de progresión incremental:
    # Nivel 2: BASE_XP_FOR_LEVEL_2
    # Nivel 3: BASE_XP_FOR_LEVEL_2 + (BASE_XP_FOR_LEVEL_2 + XP_INCREASE_FACTOR * 1)
    # Nivel L: Suma de una progresión aritmética.
    # O una fórmula más simple:
    # total_xp_needed = BASE_XP_FOR_LEVEL_2
    # for i in range(2, level):
    #     total_xp_needed += (BASE_XP_FOR_LEVEL_2 + (i-1) * XP_INCREASE_FACTOR)
    # return total_xp_needed
    
    # Fórmula simplificada y más común para RPGs (puntos totales para alcanzar el nivel X):
    # xp = base * (nivel - 1) + ((nivel - 1) * (nivel - 2) / 2) * incremento_adicional
    # O una más simple cuadrática/exponencial:
    # Por ejemplo: 50 * (level-1)^2 + 50 * (level-1)
    # Esto significa: Nivel 1 = 0xp, Nivel 2 = 100xp, Nivel 3 = 300xp, Nivel 4 = 600xp, Nivel 5 = 1000xp
    if level <= 1:
        return 0
    
    # Ajustamos la fórmula para que sea progresiva y no un diccionario fijo.
    # Puntos necesarios para alcanzar el `level` desde el inicio (0 puntos).
    # Esta fórmula es un ejemplo, puedes ajustarla según la curva de dificultad deseada.
    # xp_needed = sum(BASE_XP_FOR_LEVEL_2 + (i * XP_INCREASE_FACTOR) for i in range(level - 1))
    
    # Fórmula de ejemplo: XP_para_nivel_X = 50 * (X-1)^2 + 50 * (X-1)
    # Level 1: 0
    # Level 2: 50*(1)^2 + 50*(1) = 100
    # Level 3: 50*(2)^2 + 50*(2) = 200 + 100 = 300
    # Level 4: 50*(3)^2 + 50*(3) = 450 + 150 = 600
    # Level 5: 50*(4)^2 + 50*(4) = 800 + 200 = 1000
    # Level 10: 50*(9)^2 + 50*(9) = 50*81 + 450 = 4050 + 450 = 4500
    # Level 11: 50*(10)^2 + 50*(10) = 5000 + 500 = 5500 (Coincide con el antiguo umbral para nivel 10)

    required_xp = floor(50 * ((level - 1)**2) + 50 * (level - 1))
    return required_xp


def calculate_user_level(user: User):
    """
    Calculates and updates the user's level based on their total_points.
    Itera hacia arriba desde el nivel 1 para encontrar el nivel actual del usuario.
    """
    if user.total_points < 0: # Asegurar que los puntos no sean negativos para el cálculo de nivel
        user.total_points = 0

    new_level = 1
    while True:
        xp_needed_for_next_level = get_xp_for_level(new_level + 1)
        if user.total_points >= xp_needed_for_next_level:
            new_level += 1
        else:
            break # Se encontró el nivel actual

    if user.level != new_level:
        user.level = new_level
    return user.level

def get_next_level_xp_requirement(current_level: int):
    """
    Returns the total XP needed to reach the next level.
    """
    return get_xp_for_level(current_level + 1)

def get_current_level_xp_start(current_level: int):
    """
    Returns the total XP needed to achieve the current level.
    """
    return get_xp_for_level(current_level)


def calculate_energy_balance(user_id: str):
    """
    Calculates the 7-Day Rolling Energy Balance for a user.
    Returns:
        - balance_percentage (float): The energy balance percentage.
        - zone (str): 'RED', 'GREEN', or 'YELLOW'.
        - total_energy_moved (int)
        - positive_energy (int)
    """
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    tem_result = db.session.query(
        func.sum(func.abs(EnergyLog.energy_value))
    ).filter(
        EnergyLog.user_id == user_id,
        EnergyLog.created_at >= seven_days_ago,
        EnergyLog.energy_value.isnot(None) 
    ).scalar() or 0

    pe_result = db.session.query(
        func.sum(EnergyLog.energy_value)
    ).filter(
        EnergyLog.user_id == user_id,
        EnergyLog.created_at >= seven_days_ago,
        EnergyLog.energy_value > 0
    ).scalar() or 0
    
    total_energy_moved = int(tem_result)
    positive_energy = int(pe_result)

    if total_energy_moved == 0:
        balance_percentage = 50.0
    else:
        balance_percentage = (positive_energy / total_energy_moved) * 100

    zone = ''
    # PRD: 0-39% (Red Zone/Negative), 40-60% (Green Zone/Balanced/Optimal), 61-100% (Yellow Zone/Overly Positive)
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

def update_user_stats_after_mission(user: User, points_change: int, energy_value_change: int, source_entity_type: str, source_entity_id, reason_text: str):
    """
    Updates user's total points, recalculates level, and logs energy.
    This function assumes the user object is part of the current db session.
    """
    if points_change != 0:
        user.total_points = (user.total_points or 0) + points_change
        if user.total_points < 0: # Los puntos no deberían ser negativos
            user.total_points = 0
        calculate_user_level(user) 

    if energy_value_change is not None:
        energy_log = EnergyLog(
            user_id=user.id,
            source_entity_type=source_entity_type,
            source_entity_id=source_entity_id,
            energy_value=energy_value_change,
            reason_text=reason_text
        )
        db.session.add(energy_log)
    
    # db.session.add(user) # User is already in session, changes will be committed by the caller