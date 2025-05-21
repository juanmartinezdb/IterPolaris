// frontend/src/components/dashboard/TodaysHabitsPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext'; 
import HabitOccurrenceItem from '../habits/HabitOccurrenceItem';
import '../../styles/dashboard.css'; 
import '../../styles/habits.css'; 

const API_HABIT_OCCURRENCES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-occurrences`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function TodaysHabitsPanel({ activeTagFilters }) {
    const [todaysHabits, setTodaysHabits] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [questColors, setQuestColors] = useState({});
    
    const { refreshUserStatsAndEnergy } = useContext(UserContext); 

    const fetchQuestColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if(!token) return;
        try {
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { 
            console.error("TodaysHabitsPanel: Failed to fetch quests for colors:", err);
            setQuestColors({}); // Establecer a objeto vacío en caso de error
        }
    }, []);

    const fetchTodaysHabits = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setIsLoading(false);
            setTodaysHabits([]);
            return;
        }
        const today = new Date().toISOString().split('T')[0]; 

        const params = new URLSearchParams();
        params.append('start_date', today);
        params.append('end_date', today); 

        if (activeTagFilters && activeTagFilters.length > 0) {
            params.append('tags', activeTagFilters.join(','));
        }

        try {
            const response = await axios.get(API_HABIT_OCCURRENCES_URL, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            setTodaysHabits(response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch today's habits.");
            setTodaysHabits([]);
        } finally {
            setIsLoading(false);
        }
    }, [activeTagFilters]); 

    useEffect(() => {
        fetchQuestColors();
        fetchTodaysHabits();
    }, [fetchQuestColors, fetchTodaysHabits]);

    const handleUpdateStatus = async (occurrenceId, newStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            const response = await axios.patch(`${API_HABIT_OCCURRENCES_URL}/${occurrenceId}/status`, 
                { status: newStatus },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined) ) {
                 refreshUserStatsAndEnergy({ 
                    total_points: response.data.user_total_points, 
                    level: response.data.user_level 
                });
            } else { 
                refreshUserStatsAndEnergy();
            }
            fetchTodaysHabits(); 
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update habit status.");
            console.error("Error updating habit status:", err.response?.data || err);
        }
    };

    if (isLoading && todaysHabits.length === 0) { // Mostrar loading solo si no hay hábitos cargados aún
        return <div className="dashboard-panel"><h3>Today's Habits</h3><p>Loading habits...</p></div>;
    }

    return (
        <div className="dashboard-panel todays-habits-panel">
            <h3>Today's Habits</h3>
            {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}
            {!isLoading && todaysHabits.length === 0 && !error && (
                <p className="empty-state-message">No habits scheduled for today, or all done!</p>
            )}
            {todaysHabits.length > 0 && (
                <ul className="habit-occurrence-list">
                    {todaysHabits.map(occ => (
                        <HabitOccurrenceItem 
                            key={occ.id} 
                            occurrence={occ} 
                            onUpdateStatus={handleUpdateStatus}
                            questColors={questColors} // Pasar el mapa de colores
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

export default TodaysHabitsPanel;