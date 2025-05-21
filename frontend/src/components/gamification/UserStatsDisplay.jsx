// frontend/src/components/gamification/UserStatsDisplay.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../../styles/gamification.css'; // Usaremos el mismo CSS

const API_USER_PROFILE_URL = `${import.meta.env.VITE_API_BASE_URL}/auth/me`;
// Asumimos que gamification_services.py tiene estas funciones accesibles vía API o las replicamos aquí
const API_LEVEL_XP_URL = `${import.meta.env.VITE_API_BASE_URL}/gamification/level-xp`; // Endpoint hipotético

// Funciones de cálculo de XP (pueden venir del backend o replicarse si son sencillas)
// Estas son las mismas funciones que definimos en gamification_services.py
// En un escenario ideal, el backend proporcionaría el XP actual, el XP para el nivel actual y el XP para el siguiente.
// Por ahora, vamos a obtener los datos del perfil y calcular el progreso en el frontend.
const getXpForLevel = (level) => {
    if (level <= 1) return 0;
    return Math.floor(50 * ((level - 1)**2) + 50 * (level - 1));
};

function UserStatsDisplay() {
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchUserProfile = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            setIsLoading(false);
            // setUserData(null); // Asegurar que no haya datos viejos si el token desaparece
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const response = await axios.get(API_USER_PROFILE_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setUserData(response.data);
        } catch (err) {
            console.error("Failed to fetch user profile:", err);
            setError(err.response?.data?.error || "Could not load user data.");
            setUserData(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUserProfile();
        // Podríamos añadir un listener para eventos de actualización de perfil si fuera necesario
    }, [fetchUserProfile]);

    // Efecto para actualizar los datos cuando el usuario navega, por si cambian en otra página.
    useEffect(() => {
        const handleFocus = () => {
            // console.log("Window focused, refetching user profile for stats.");
            fetchUserProfile();
        };
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchUserProfile]);


    if (isLoading) {
        return <div className="user-stats-container loading">Loading stats...</div>;
    }
    if (error) {
        // No mostrar errores directamente en la UI de stats, podría ser sutil.
        console.error("UserStatsDisplay Error:", error);
        return <div className="user-stats-container error">User data unavailable.</div>;
    }
    if (!userData) {
        return <div className="user-stats-container"></div>; // No mostrar si no hay datos (ej. no logueado)
    }

    const { name, level, total_points, current_streak, avatar_url } = userData;

    const xpForCurrentLevel = getXpForLevel(level);
    const xpForNextLevel = getXpForLevel(level + 1);
    
    let progressPercentage = 0;
    if (xpForNextLevel > xpForCurrentLevel) { // Evitar división por cero si está en el último nivel definido o error
        const xpInCurrentLevel = total_points - xpForCurrentLevel;
        const xpNeededForThisLevel = xpForNextLevel - xpForCurrentLevel;
        progressPercentage = Math.max(0, Math.min(100, (xpInCurrentLevel / xpNeededForThisLevel) * 100));
    } else if (total_points >= xpForCurrentLevel) { // Si está en un nivel y ya superó el umbral (podría ser max level)
        progressPercentage = 100;
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
                    <span className="xp-text">
                        {total_points} / {xpForNextLevel !== null ? xpForNextLevel : 'Max'} XP
                    </span>
                </div>
            </div>
            <div className="user-streak">
                <span role="img" aria-label="Streak">🔥</span> {current_streak || 0} Day Streak
            </div>
        </div>
    );
}

export default UserStatsDisplay;