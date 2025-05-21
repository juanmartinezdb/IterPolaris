// frontend/src/components/dashboard/TodaysHabitsPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import HabitOccurrenceItem from '../habits/HabitOccurrenceItem';
import '../../styles/dashboard.css'; // o un habits.css si es más general
import '../../styles/habits.css'; // Para estilos de HabitOccurrenceItem

const API_HABIT_OCCURRENCES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-occurrences`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`; // For quest colors

function TodaysHabitsPanel({ activeTagFilters }) { // activeTagFilters (de Tarea 9) aún no se usa aquí
    const [todaysHabits, setTodaysHabits] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [questColors, setQuestColors] = useState({});

    const fetchQuestColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { console.error("Failed to fetch quests for colors:", err); }
    }, []);

    const fetchTodaysHabits = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        const params = new URLSearchParams();
        params.append('start_date', today);
        params.append('end_date', today); // Filtra ocurrencias que empiezan hoy

        // TODO Tarea 9: Integrar activeTagFilters si es necesario para este panel
        // if (activeTagFilters && activeTagFilters.length > 0) {
        //     params.append('tags', activeTagFilters.join(','));
        // }

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
    }, [/* activeTagFilters */]); // Añadir activeTagFilters cuando se implemente

    useEffect(() => {
        fetchQuestColors();
        fetchTodaysHabits();
    }, [fetchQuestColors, fetchTodaysHabits]);

    const handleUpdateStatus = async (occurrenceId, newStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            await axios.patch(`${API_HABIT_OCCURRENCES_URL}/${occurrenceId}/status`, 
                { status: newStatus },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            // Refrescar la lista para mostrar el estado actualizado
            fetchTodaysHabits(); 
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update habit status.");
            console.error("Error updating habit status:", err.response?.data || err);
        }
    };

    if (isLoading) {
        return <div className="dashboard-panel"><h3>Today's Habits</h3><p>Loading habits...</p></div>;
    }

    return (
        <div className="dashboard-panel todays-habits-panel">
            <h3>Today's Habits</h3>
            {error && <p className="error-message">{error}</p>}
            {todaysHabits.length === 0 && !error && (
                <p className="empty-state-message">No habits scheduled for today, or all done!</p>
            )}
            {todaysHabits.length > 0 && (
                <ul className="habit-occurrence-list">
                    {todaysHabits.map(occ => (
                        <HabitOccurrenceItem 
                            key={occ.id} 
                            occurrence={occ} 
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