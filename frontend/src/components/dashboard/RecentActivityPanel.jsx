// frontend/src/components/dashboard/RecentActivityPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { UserContext } from '../../contexts/UserContext';
import { getContrastColor } from '../../utils/colorUtils';
import '../../styles/dashboard.css'; 
import '../../styles/missions-shared.css'; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const formatCompletionTime = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffSeconds = Math.round((now - date) / 1000);
        if (diffSeconds < 2) return 'just now';
        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        const diffMinutes = Math.round(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString(navigator.language || 'en-GB', { month: 'short', day: 'numeric' });
    } catch (e) { return 'Invalid Date'; }
};

function RecentActivityPanel({ config, activeTagFilters, title }) {
    const { currentUser, isLoadingProfile, refreshUserStatsAndEnergy } = useContext(UserContext);
    const [recentActivities, setRecentActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [infoMessage, setInfoMessage] = useState(''); // For success/error of undo

    const clearInfoMessage = useCallback(() => {
        setTimeout(() => setInfoMessage(''), 3000);
    }, []);

    const fetchRecentActivity = useCallback(async () => {
        if (!currentUser || isLoadingProfile) {
            setRecentActivities([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams();
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }
        params.append('limit', '7'); 

        try {
            const response = await axios.get(`${API_BASE_URL}/dashboard/recent-activity`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            setRecentActivities(response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch recent activity.");
            setRecentActivities([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, activeTagFilters, isLoadingProfile]);

    useEffect(() => {
        fetchRecentActivity();
    }, [fetchRecentActivity]);

    const handleUndoCompletion = async (item) => {
        const token = localStorage.getItem('authToken');
        setError(''); setInfoMessage('');
        let undoUrl = '';
        switch(item.type) {
            case 'SCHEDULED_MISSION': undoUrl = `${API_BASE_URL}/scheduled-missions/${item.id}/undo-completion`; break;
            case 'HABIT_OCCURRENCE': undoUrl = `${API_BASE_URL}/habit-occurrences/${item.id}/undo-completion`; break;
            case 'POOL_MISSION': undoUrl = `${API_BASE_URL}/pool-missions/${item.id}/undo-completion`; break;
            default: setError("Cannot undo this item type."); return;
        }
        try {
            const response = await axios.patch(undoUrl, {}, { headers: { 'Authorization': `Bearer ${token}` } });
            setInfoMessage(`"${item.title}" marked as pending.`);
            fetchRecentActivity(); // Refresh the list
            refreshUserStatsAndEnergy({ // Pass data if backend returns it after undo
                 total_points: response.data.user_total_points, 
                 level: response.data.user_level 
            });
            clearInfoMessage();
        } catch (err) {
            setError(err.response?.data?.error || `Failed to undo completion for "${item.title}".`);
            clearInfoMessage();
        }
    };

    const getItemTypeDisplayName = (type) => {
        switch(type) {
            case 'SCHEDULED_MISSION': return 'Mission';
            case 'HABIT_OCCURRENCE': return 'Habit';
            case 'POOL_MISSION': return 'Pool Task';
            default: return 'Activity';
        }
    };
    
    const getItemLink = (item) => {
        switch(item.type) {
            case 'SCHEDULED_MISSION': return `/scheduled-missions#sm-${item.id}`;
            case 'HABIT_OCCURRENCE': return `/habit-templates#ho-${item.id}`; 
            case 'POOL_MISSION': return `/pool-missions#pm-${item.id}`;
            default: return '#';
        }
    };

    const panelTitle = title || "Recent Activity";

    return (
        <div className="dashboard-panel recent-activity-panel">
            <h3>{panelTitle}</h3>
            {infoMessage && <p className="auth-success-message" style={{fontSize: '0.85em', padding: '0.5rem', margin: '0 0 0.5rem 0'}}>{infoMessage}</p>}
            {isLoading && <p>Loading recent activity...</p>}
            {error && <p className="error-message" style={{ textAlign: 'center' }}>{error}</p>}
            {!isLoading && recentActivities.length === 0 && !error && (
                <p className="empty-state-message">No recent completed activities found.</p>
            )}
            {recentActivities.length > 0 && (
                <ul className="upcoming-items-list panel-list-condensed">
                    {recentActivities.map(item => {
                        const itemQuestColor = item.quest_color || 'var(--color-text-on-dark-muted)';
                        const textColor = getContrastColor(itemQuestColor);
                        return (
                            <li key={`${item.type}-${item.id}`} className="upcoming-item" style={{ borderLeftColor: itemQuestColor, opacity: 0.85 }}>
                                <div className="upcoming-item-main">
                                    <div className="upcoming-item-info">
                                        <span className="upcoming-item-type-badge" style={{ backgroundColor: itemQuestColor, color: textColor, fontSize: '0.7em' }}>
                                            {getItemTypeDisplayName(item.type)}
                                        </span>
                                        <Link 
                                            to={getItemLink(item)}
                                            className="upcoming-item-title"
                                            title={item.title}
                                            style={{textDecoration: 'line-through', color: 'var(--color-text-on-dark-muted)'}}
                                        >
                                            {item.title}
                                        </Link>
                                        <span className="upcoming-item-time" title={new Date(item.completed_at).toLocaleString()}>
                                            {formatCompletionTime(item.completed_at)}
                                        </span>
                                    </div>
                                    <div className="upcoming-item-actions">
                                         <button
                                            onClick={() => handleUndoCompletion(item)}
                                            className="action-btn" // Style this 'undo' button
                                            title="Undo Completion (Mark as Pending)"
                                            aria-label={`Undo completion for ${item.title}`}
                                            style={{borderColor: 'var(--color-warning)', color: 'var(--color-warning)'}}
                                        >↩️</button>
                                    </div>
                                </div>
                                <div className="upcoming-item-meta-row" style={{paddingLeft: 'calc(0.2em + 4px + 0.6rem)', fontSize: '0.8em'}}>
                                    {item.quest_name && (
                                         <span 
                                            className="quest-name-badge-sm" 
                                            style={{ 
                                                backgroundColor: itemQuestColor, color: textColor,
                                                borderColor: textColor === 'var(--color-text-on-accent, #0A192F)' ? 'var(--color-text-on-dark-muted)' : 'transparent'
                                            }}
                                            title={`Quest: ${item.quest_name}`}
                                        >
                                            {item.quest_name}
                                        </span>
                                    )}
                                    <span style={{marginLeft: item.quest_name ? '0.5rem' : '0'}}>
                                        ⚡{item.energy_value > 0 ? `+${item.energy_value}` : item.energy_value} | ⭐{item.points_value}
                                    </span>
                                </div>
                                {item.tags && item.tags.length > 0 && (
                                    <div className="upcoming-item-tags-container" style={{paddingLeft: 'calc(0.2em + 4px + 0.6rem)'}}>
                                        {item.tags.map(tag => (
                                            <span key={tag.id} className="tag-badge-sm">{tag.name}</span>
                                        ))}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default RecentActivityPanel;