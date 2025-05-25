// frontend/src/components/dashboard/ProximosPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext';
import DashboardScheduledItem from './DashboardScheduledItem';
import HabitOccurrenceItem from '../habits/HabitOccurrenceItem';
import '../../styles/dashboard.css'; 
import '../../styles/missions-shared.css'; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function ProximosPanel({ config, activeTagFilters, title }) {
    const { currentUser, refreshUserStatsAndEnergy, isLoadingProfile } = useContext(UserContext);
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('today'); // 'today' or 'this_week'
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
        } catch (err) { console.error("ProximosPanel: Failed to fetch quests for colors:", err); }
    }, [currentUser]);

    const fetchUpcomingItems = useCallback(async () => {
        if (!currentUser || isLoadingProfile) {
            setItems([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');

        const today = new Date();
        let startDate, endDate;

        if (activeTab === 'today') {
            startDate = new Date(today.setHours(0,0,0,0));
            endDate = new Date(today.setHours(23,59,59,999));
        } else { // this_week
            startDate = new Date(today.setHours(0,0,0,0));
            const endOfWeek = new Date(today);
            endOfWeek.setDate(startDate.getDate() + (6 - startDate.getDay() + 1)); // +1 if week starts Monday, adjust if Sunday
            endOfWeek.setHours(23,59,59,999);
            endDate = endOfWeek;
        }

        const params = new URLSearchParams();
        params.append('start_date', startDate.toISOString().split('T')[0]); // Query by date part
        params.append('end_date', endDate.toISOString().split('T')[0]);
        params.append('status', 'PENDING'); 

        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }
        
        try {
            const [scheduledResponse, habitsResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/scheduled-missions`, { headers: { 'Authorization': `Bearer ${token}` }, params: new URLSearchParams(params) }),
                axios.get(`${API_BASE_URL}/habit-occurrences`, { headers: { 'Authorization': `Bearer ${token}` }, params: new URLSearchParams(params) })
            ]);

            const scheduledMissions = (scheduledResponse.data || [])
                .filter(m => new Date(m.start_datetime) <= endDate) // Further client-side filter if backend returns wider than tab range
                .map(m => ({
                ...m, type: 'SCHEDULED_MISSION', displayDate: m.start_datetime, key: `proximos-sm-${m.id}`,
                tags: m.tags || []
            }));
            const habitOccurrences = (habitsResponse.data || [])
                 .filter(h => new Date(h.scheduled_start_datetime) <= endDate)
                .map(h => ({
                ...h, type: 'HABIT_OCCURRENCE', displayDate: h.scheduled_start_datetime, key: `proximos-ho-${h.id}`,
                tags: h.template_tags || h.template?.tags || []
            }));

            const combinedItems = [...scheduledMissions, ...habitOccurrences];
            combinedItems.sort((a, b) => new Date(a.displayDate) - new Date(b.displayDate));
            setItems(combinedItems);

        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch upcoming items.");
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, activeTagFilters, activeTab, isLoadingProfile]);

    useEffect(() => { fetchQuestColors(); }, [fetchQuestColors]);
    useEffect(() => { fetchUpcomingItems(); }, [fetchUpcomingItems]);

    const handleStatusUpdate = async (item, newStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        let url = '';
        if (item.type === 'SCHEDULED_MISSION') {
            url = `${API_BASE_URL}/scheduled-missions/${item.id}/status`;
        } else if (item.type === 'HABIT_OCCURRENCE') {
            url = `${API_BASE_URL}/habit-occurrences/${item.id}/status`;
        } else { return; }

        try {
            const response = await axios.patch(url, { status: newStatus }, { headers: { 'Authorization': `Bearer ${token}` } });
            fetchUpcomingItems(); 
            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined)) {
                 refreshUserStatsAndEnergy({ total_points: response.data.user_total_points, level: response.data.user_level });
            } else { refreshUserStatsAndEnergy(); }
        } catch (err) {
            setError(err.response?.data?.error || `Failed to update ${item.type.toLowerCase().replace('_', ' ')} status.`);
        }
    };

    const panelTitle = title || "Upcoming Items";

    return (
        <div className="dashboard-panel proximos-panel">
            <h3>{panelTitle}</h3>
            <div className="panel-tabs">
                <button 
                    className={`tab-button ${activeTab === 'today' ? 'active' : ''}`}
                    onClick={() => setActiveTab('today')}
                >
                    Today
                </button>
                <button 
                    className={`tab-button ${activeTab === 'this_week' ? 'active' : ''}`}
                    onClick={() => setActiveTab('this_week')}
                >
                    This Week
                </button>
            </div>
            {isLoading && <p>Loading items...</p>}
            {error && <p className="error-message" style={{ textAlign: 'center' }}>{error}</p>}
            {!isLoading && items.length === 0 && !error && (
                <p className="empty-state-message">Nothing upcoming for {activeTab === 'today' ? 'today' : 'this week'} with current filters.</p>
            )}
            {items.length > 0 && (
                <ul className="upcoming-items-list panel-list-condensed">
                    {items.map(item => {
                        if (item.type === 'SCHEDULED_MISSION') {
                            return (
                                <DashboardScheduledItem
                                    key={item.key}
                                    item={item}
                                    questColor={questColors[item.quest_id] || 'var(--color-accent-gold)'}
                                    onStatusUpdate={handleStatusUpdate}
                                />
                            );
                        } else if (item.type === 'HABIT_OCCURRENCE') {
                            return (
                                <HabitOccurrenceItem
                                    key={item.key}
                                    occurrence={item}
                                    onUpdateStatus={(occurrenceId, newStatus) => handleStatusUpdate({id: occurrenceId, type: 'HABIT_OCCURRENCE'}, newStatus)}
                                    questColors={questColors}
                                />
                            );
                        }
                        return null;
                    })}
                </ul>
            )}
        </div>
    );
}
export default ProximosPanel;