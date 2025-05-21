// frontend/src/components/gamification/UserStatsDisplay.jsx
import React, { useContext } from 'react'; // No más useState, useEffect, useCallback, axios
import { UserContext } from '../../contexts/UserContext'; // Importar contexto
import '../../styles/gamification.css'; 

// Funciones de cálculo de XP (se mantienen o se obtienen del backend)
const getXpForLevel = (level) => {
    if (level <= 1) return 0;
    // XP_para_nivel_X = 50 * (X-1)^2 + 50 * (X-1)
    return Math.floor(50 * ((level - 1)**2) + 50 * (level - 1));
};

function UserStatsDisplay() {
    const { currentUser, isLoadingProfile } = useContext(UserContext);

    if (isLoadingProfile && !currentUser) {
        return <div className="user-stats-container loading">Loading stats...</div>;
    }
    
    if (!currentUser) {
        // No mostrar error directamente, solo no renderizar o un placeholder si es necesario
        return <div className="user-stats-container"></div>;
    }

    const { name, level, total_points, current_streak, avatar_url } = currentUser;

    const xpForCurrentLevel = getXpForLevel(level);
    const xpForNextLevel = getXpForLevel(level + 1);
    
    let progressPercentage = 0;
    let xpText = `${total_points} / ${xpForNextLevel}`;

    if (xpForNextLevel > xpForCurrentLevel) { 
        const xpInCurrentLevel = total_points - xpForCurrentLevel;
        const xpNeededForThisLevel = xpForNextLevel - xpForCurrentLevel;
        if (xpNeededForThisLevel > 0) { // Evitar división por cero
             progressPercentage = Math.max(0, Math.min(100, (xpInCurrentLevel / xpNeededForThisLevel) * 100));
        } else if (total_points >= xpForCurrentLevel) {
            progressPercentage = 100;
        }
    } else { // Podría ser el último nivel o un caso inesperado
        progressPercentage = (total_points >= xpForCurrentLevel) ? 100 : 0;
        xpText = `${total_points} XP (Max Level Reached or Next Undefined)`;
    }
    
    // Si es el nivel máximo y los puntos superan o igualan el umbral del nivel actual.
    // Si getXpForLevel(level + 1) devuelve lo mismo que getXpForLevel(level) (indicando no más progresión definida)
    if (xpForNextLevel === xpForCurrentLevel && total_points >= xpForCurrentLevel) {
        progressPercentage = 100;
        xpText = `${total_points} XP`; // O "Max Level"
    }


    return (
        <div className="user-stats-container">
            <div className="user-avatar-name">
                {avatar_url ? (
                    <img src={avatar_url} alt={name} className="user-avatar-stats" />
                ) : (
                    <div className="user-avatar-placeholder-stats">
                        {name ? name.charAt(0).toUpperCase() : '?'}
                    </div>
                )}
                <span className="user-name-stats">{name || 'Adventurer'}</span>
            </div>
            <div className="user-level-points">
                <span className="user-level">Level {level}</span>
                <div className="xp-bar-container">
                    <div className="xp-bar-track">
                        <div className="xp-bar-fill" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                    <span className="xp-text">{xpText}</span>
                </div>
            </div>
            <div className="user-streak">
                <span role="img" aria-label="Streak">🔥</span> {current_streak || 0} Day Streak
            </div>
        </div>
    );
}

export default UserStatsDisplay;