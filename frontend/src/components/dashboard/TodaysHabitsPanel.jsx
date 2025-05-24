// frontend/src/components/dashboard/TodaysHabitsPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext'; 
import HabitOccurrenceItem from '../habits/HabitOccurrenceItem'; // Ya debería mostrar tags si se le pasan
import '../../styles/dashboard.css'; 
import '../../styles/habits.css'; 
import '../../styles/missions-shared.css'; // For .tag-badge-sm if needed directly here, or ensure HabitOccurrenceItem handles it

const API_HABIT_OCCURRENCES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-occurrences`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`; // Para colores de quest

function TodaysHabitsPanel({ activeTagFilters }) { // Aceptar prop
    const [todaysHabits, setTodaysHabits] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [questColors, setQuestColors] = useState({});
    
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext); 

    const fetchQuestColors = useCallback(async () => {
        if (!currentUser) return;
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { 
            console.error("TodaysHabitsPanel: Failed to fetch quests for colors:", err);
            setQuestColors({});
        }
    }, [currentUser]);

    const fetchTodaysHabits = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        
        const today = new Date().toISOString().split('T')[0]; 

        const params = new URLSearchParams();
        params.append('start_date', today);
        params.append('end_date', today); 
        // params.append('status', 'PENDING'); // El panel de "Today's Habits" debe mostrar todos los de hoy, no solo pendientes

        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
            // Backend /api/habit-occurrences necesita soportar filtrado por tags (de la plantilla)
        }

        try {
            const response = await axios.get(API_HABIT_OCCURRENCES_URL, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            // Suponiendo que la respuesta incluye `template_tags` o `template.tags` para cada ocurrencia
            const habitsWithTags = (response.data || []).map(occ => ({
                ...occ,
                tags: occ.template_tags || occ.template?.tags || [] 
            }));
            setTodaysHabits(habitsWithTags);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch today's habits.");
            setTodaysHabits([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, activeTagFilters]); 

    useEffect(() => {
        fetchQuestColors();
    }, [fetchQuestColors]);

    useEffect(() => {
        fetchTodaysHabits();
    }, [fetchTodaysHabits]); // activeTagFilters es dependencia

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

    // Modificar HabitOccurrenceItem para que acepte y muestre tags
    // O, si HabitOccurrenceItem ya lo hace, asegurarse que se le pasan los tags.
    // Viendo HabitOccurrenceItem.jsx, no muestra tags. Hay que añadirlo.

    if (isLoading && todaysHabits.length === 0) {
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
                            occurrence={occ} // occ ahora debe tener una propiedad 'tags'
                            onUpdateStatus={handleUpdateStatus}
                            questColors={questColors}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

export default TodaysHabitsPanel;