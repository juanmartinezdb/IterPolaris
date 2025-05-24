// frontend/src/components/dashboard/UpcomingMissionsPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { UserContext } from '../../contexts/UserContext';
import { getContrastColor } from '../../utils/colorUtils';
import '../../styles/dashboard.css'; 
import '../../styles/missions-shared.css'; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const formatDateForDisplay = (isoString, includeTime = true) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        const options = {
            // year: 'numeric', // Decided to remove year for brevity in dashboard
            month: 'short', day: 'numeric',
            ...(includeTime && { hour: '2-digit', minute: '2-digit', hour12: false })
        };
        return date.toLocaleString(navigator.language || 'en-GB', options);
    } catch (e) {
        return 'Invalid Date';
    }
};

function UpcomingMissionsPanel({ activeTagFilters }) {
    const [upcomingItems, setUpcomingItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [questColors, setQuestColors] = useState({});
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext);

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
        } catch (err) {
            console.error("UpcomingMissionsPanel: Failed to fetch quests for colors:", err);
        }
    }, [currentUser]);

    const fetchUpcomingItems = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const params = new URLSearchParams();
        params.append('start_date', today.toISOString().split('T')[0]);
        params.append('end_date', tomorrow.toISOString().split('T')[0]); // Fetch for today and tomorrow

        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId)); // Send as multiple 'tags' params or comma-separated
            // The backend for scheduled-missions and habit-occurrences needs to support this.
            // For now, assuming backend /api/scheduled-missions and /api/habit-occurrences accept `tags` query param (array or CSV)
        }
        
        // Ensure only PENDING items are requested for Upcoming panel for ScheduledMissions
        const scheduledParams = new URLSearchParams(params);
        scheduledParams.append('status', 'PENDING');

        // Ensure only PENDING items are requested for Upcoming panel for HabitOccurrences
        const habitParams = new URLSearchParams(params);
        habitParams.append('status', 'PENDING');


        try {
            const [scheduledResponse, habitsResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/scheduled-missions`, { headers: { 'Authorization': `Bearer ${token}` }, params: scheduledParams }),
                axios.get(`${API_BASE_URL}/habit-occurrences`, { headers: { 'Authorization': `Bearer ${token}` }, params: habitParams })
            ]);

            // Scheduled missions should already have their tags in response.data.tags
            const scheduledMissions = (scheduledResponse.data || [])
                // .filter(m => m.status === 'PENDING') // Filter now done by API query param
                .map(m => ({
                    ...m, // Includes m.tags
                    type: 'SCHEDULED_MISSION',
                    displayDate: m.start_datetime,
                    key: `sm-${m.id}`
                }));

            // Habit occurrences: backend needs to provide template tags or we need another fetch.
            // Assuming backend /api/habit-occurrences returns `template_tags` or similar.
            // If not, this part needs adjustment.
            const habitOccurrences = (habitsResponse.data || [])
                // .filter(h => h.status === 'PENDING') // Filter now done by API query param
                .map(h => ({
                    ...h,
                    // Assuming backend returns tags for the habit template associated with the occurrence
                    // If `h.tags` is not directly available, this needs adjustment.
                    // For PRD v4.1, HabitTemplate has tags. HabitOccurrence implies tags from template.
                    // The backend GET /api/habit-occurrences should ideally populate this.
                    // For now, let's assume `h.template_tags` is returned by backend.
                    // Or if `h.template.tags` is nested.
                    tags: h.template_tags || h.template?.tags || [], // Prioritize, adjust based on actual backend response
                    type: 'HABIT_OCCURRENCE',
                    displayDate: h.scheduled_start_datetime,
                    key: `ho-${h.id}`
                }));

            const combinedItems = [...scheduledMissions, ...habitOccurrences];
            combinedItems.sort((a, b) => new Date(a.displayDate) - new Date(b.displayDate));
            setUpcomingItems(combinedItems);

        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch upcoming items.");
            setUpcomingItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, activeTagFilters]);

    useEffect(() => {
        fetchQuestColors();
    }, [fetchQuestColors]);

    useEffect(() => {
        fetchUpcomingItems();
    }, [fetchUpcomingItems]); // activeTagFilters is a dependency here

    const handleStatusUpdate = async (item, newStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        let url = '';
        let payload = { status: newStatus };

        if (item.type === 'SCHEDULED_MISSION') {
            url = `${API_BASE_URL}/scheduled-missions/${item.id}/status`;
        } else if (item.type === 'HABIT_OCCURRENCE') {
            url = `${API_BASE_URL}/habit-occurrences/${item.id}/status`;
        } else {
            return;
        }

        try {
            const response = await axios.patch(url, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            fetchUpcomingItems(); 
            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined)) {
                refreshUserStatsAndEnergy({ total_points: response.data.user_total_points, level: response.data.user_level });
            } else {
                refreshUserStatsAndEnergy();
            }
        } catch (err) {
            console.error(`Error updating ${item.type} status:`, err.response?.data || err);
            setError(err.response?.data?.error || `Failed to update ${item.type.toLowerCase().replace('_', ' ')} status.`);
        }
    };

    const renderItem = (item) => {
        const questColor = item.quest_id && questColors[item.quest_id]
            ? questColors[item.quest_id]
            : (item.type === 'HABIT_OCCURRENCE' ? 'var(--color-purple-mystic)' : 'var(--color-accent-gold)');
        const textColor = getContrastColor(questColor);
        const isToday = new Date(item.displayDate).toDateString() === new Date().toDateString();

        return (
            <li key={item.key} className="upcoming-item" style={{ borderLeftColor: questColor }}>
                <div className="upcoming-item-main">
                    <div className="upcoming-item-info">
                        <span className="upcoming-item-type-badge" style={{ backgroundColor: questColor, color: textColor }}>
                            {item.type === 'SCHEDULED_MISSION' ? 'Mission' : 'Habit'}
                        </span>
                        <Link 
                            to={item.type === 'SCHEDULED_MISSION' ? `/scheduled-missions#sm-${item.id}` : `/habit-templates#ho-${item.id}`} 
                            className="upcoming-item-title"
                            title={item.title}
                        >
                            {item.title}
                        </Link>
                        <span className="upcoming-item-time" title={new Date(item.displayDate).toLocaleString()}>
                             {isToday ? new Date(item.displayDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : formatDateForDisplay(item.displayDate)}
                        </span>
                    </div>
                    <div className="upcoming-item-actions">
                        <button
                            onClick={() => handleStatusUpdate(item, 'COMPLETED')}
                            className="action-btn complete"
                            title="Mark as Complete"
                            aria-label={`Mark ${item.title} as Complete`}
                        >✓</button>
                        <button
                            onClick={() => handleStatusUpdate(item, 'SKIPPED')}
                            className="action-btn skip"
                            title="Mark as Skipped"
                            aria-label={`Mark ${item.title} as Skipped`}
                        >✕</button>
                    </div>
                </div>
                {item.quest_name && (
                    <div className="upcoming-item-meta-row">
                         <span 
                            className="quest-name-badge-sm" 
                            style={{ 
                                backgroundColor: questColor, 
                                color: textColor,
                                borderColor: textColor === 'var(--color-text-on-accent, #0A192F)' ? 'var(--color-text-on-dark-muted)' : 'transparent'
                            }}
                        >
                            {item.quest_name}
                        </span>
                    </div>
                )}
                {/* Display Tags */}
                {item.tags && item.tags.length > 0 && (
                    <div className="upcoming-item-tags-container">
                        {item.tags.map(tag => (
                            <span key={tag.id} className="tag-badge-sm">{tag.name}</span>
                        ))}
                    </div>
                )}
            </li>
        );
    };

    if (isLoading) {
        return <div className="dashboard-panel"><h3>Upcoming (Today & Tomorrow)</h3><p>Loading items...</p></div>;
    }

    return (
        <div className="dashboard-panel upcoming-missions-panel">
            <h3>Upcoming (Today & Tomorrow)</h3>
            {error && <p className="error-message" style={{ textAlign: 'center' }}>{error}</p>}
            {!isLoading && upcomingItems.length === 0 && !error && (
                <p className="empty-state-message">Nothing pressing for today or tomorrow. Plan ahead or enjoy the calm!</p>
            )}
            {upcomingItems.length > 0 && (
                <ul className="upcoming-items-list">
                    {upcomingItems.map(item => renderItem(item))}
                </ul>
            )}
        </div>
    );
}

export default UpcomingMissionsPanel;