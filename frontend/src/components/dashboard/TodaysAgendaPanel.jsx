// frontend/src/components/dashboard/TodaysAgendaPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext'; //
import HabitOccurrenceItem from '../habits/HabitOccurrenceItem'; //
import DashboardScheduledItem from './DashboardScheduledItem';
import '../../styles/dashboard.css'; //
import '../../styles/missions-shared.css'; //
import '../../styles/habits.css';     //

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function TodaysAgendaPanel({ config, activeTagFilters, title }) {
    const { currentUser, refreshUserStatsAndEnergy, isLoadingProfile } = useContext(UserContext); //
    const [agendaItems, setAgendaItems] = useState({
        all_day_missions: [],
        todays_habits: [],
        timed_missions: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [questColors, setQuestColors] = useState({});

    const fetchQuestColors = useCallback(async () => {
        if (!currentUser) return;
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(`${API_BASE_URL}/quests`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { console.error("TodaysAgendaPanel: Failed to fetch quests for colors:", err); }
    }, [currentUser]);

    const fetchTodaysAgenda = useCallback(async () => {
        if (!currentUser || isLoadingProfile) {
             setAgendaItems({ all_day_missions: [], todays_habits: [], timed_missions: [] });
             return;
        }
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams();
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/dashboard/today-agenda`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            setAgendaItems({
                all_day_missions: response.data.all_day_missions || [],
                todays_habits: response.data.todays_habits || [],
                timed_missions: response.data.timed_missions || []
            });
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch today's agenda.");
            setAgendaItems({ all_day_missions: [], todays_habits: [], timed_missions: [] });
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, activeTagFilters, isLoadingProfile]);
    
    useEffect(() => {
        fetchQuestColors();
    }, [fetchQuestColors]);

    useEffect(() => {
        fetchTodaysAgenda();
    }, [fetchTodaysAgenda]);

    const handleGenericStatusUpdate = async (item, newStatus, itemTypeForApi) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        let url = '';
        if (itemTypeForApi === 'habit-occurrences') {
            url = `${API_BASE_URL}/habit-occurrences/${item.id}/status`;
        } else if (itemTypeForApi === 'scheduled-missions') {
            url = `${API_BASE_URL}/scheduled-missions/${item.id}/status`;
        } else { return; }
        try {
            const response = await axios.patch(url, { status: newStatus }, { headers: { 'Authorization': `Bearer ${token}` } });
            fetchTodaysAgenda();
            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined)) {
                 refreshUserStatsAndEnergy({ total_points: response.data.user_total_points, level: response.data.user_level }); //
            } else { refreshUserStatsAndEnergy(); } //
        } catch (err) {
            setError(err.response?.data?.error || `Failed to update ${itemTypeForApi} status.`);
             console.error(`Error updating ${itemTypeForApi} status for item ${item.id}:`, err.response?.data || err.message);
        }
    };
    
    const panelTitle = title || "Today's Agenda";
    const allEmpty = agendaItems.all_day_missions.length === 0 &&
                     agendaItems.todays_habits.length === 0 &&
                     agendaItems.timed_missions.length === 0;

    return (
        <div className="dashboard-panel todays-agenda-panel">
            <h3>{panelTitle}</h3>
            {isLoading && <p>Loading agenda...</p>}
            {error && <p className="error-message" style={{ textAlign: 'center' }}>{error}</p>}
            {!isLoading && !error && allEmpty && (
                <p className="empty-state-message">Your agenda for today is clear!</p>
            )}

            {!isLoading && !error && !allEmpty && (
                <>
                    {agendaItems.all_day_missions.length > 0 && (
                        <section className="panel-section">
                            <h4>All-Day</h4>
                            <ul className="upcoming-items-list panel-list-condensed">
                                {agendaItems.all_day_missions.map(sm => (
                                    <DashboardScheduledItem
                                        key={`agenda-smad-${sm.id}`}
                                        item={sm}
                                        questColor={questColors[sm.quest_id] || 'var(--color-accent-gold)'}
                                        onStatusUpdate={(item, newStatus) => handleGenericStatusUpdate(item, newStatus, 'scheduled-missions')}
                                    />
                                ))}
                            </ul>
                        </section>
                    )}
                    {agendaItems.todays_habits.length > 0 && (
                        <section className="panel-section">
                            <h4>Habits</h4>
                            <ul className="habit-occurrence-list panel-list-condensed">
                                {agendaItems.todays_habits.map(ho => (
                                    <HabitOccurrenceItem
                                        key={`agenda-ho-${ho.id}`}
                                        occurrence={ho}
                                        onUpdateStatus={(occurrenceId, newStatus) => handleGenericStatusUpdate(ho, newStatus, 'habit-occurrences')}
                                        questColors={questColors}
                                    />
                                ))}
                            </ul>
                        </section>
                    )}
                    {agendaItems.timed_missions.length > 0 && (
                        <section className="panel-section">
                            <h4>Scheduled Events</h4>
                            <ul className="upcoming-items-list panel-list-condensed">
                                {agendaItems.timed_missions.map(sm => (
                                    <DashboardScheduledItem
                                        key={`agenda-smt-${sm.id}`}
                                        item={sm}
                                        questColor={questColors[sm.quest_id] || 'var(--color-accent-gold)'}
                                        onStatusUpdate={(item, newStatus) => handleGenericStatusUpdate(item, newStatus, 'scheduled-missions')}
                                    />
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

export default TodaysAgendaPanel;