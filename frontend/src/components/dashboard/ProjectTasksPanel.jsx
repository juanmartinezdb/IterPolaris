// frontend/src/components/dashboard/ProjectTasksPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { UserContext } from '../../contexts/UserContext'; //
import { getContrastColor } from '../../utils/colorUtils'; //

import HabitOccurrenceItem from '../habits/HabitOccurrenceItem'; //
import PoolMissionItem from '../missions/pool/PoolMissionItem'; //
import DashboardScheduledItem from './DashboardScheduledItem'; 

import '../../styles/dashboard.css'; //
import '../../styles/missions-shared.css'; //
import '../../styles/poolmissions.css'; 
import '../../styles/habits.css';     

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function ProjectTasksPanel({ config, activeTagFilters, title }) {
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext); //
    const [questItems, setQuestItems] = useState({
        todays_habit_occurrences: [],
        pending_scheduled_missions: [],
        pending_pool_missions: []
    });
    const [questInfo, setQuestInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const questId = config?.quest_id;

    const fetchProjectItems = useCallback(async () => {
        if (!currentUser || !questId) {
            setQuestItems({ todays_habit_occurrences: [], pending_scheduled_missions: [], pending_pool_missions: [] });
            setQuestInfo(null);
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
            const response = await axios.get(`${API_BASE_URL}/quests/${questId}/dashboard-items`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            setQuestItems({
                todays_habit_occurrences: response.data.todays_habit_occurrences || [],
                pending_scheduled_missions: response.data.pending_scheduled_missions || [],
                pending_pool_missions: response.data.pending_pool_missions || [],
            });
            setQuestInfo(response.data.quest_info || null);
        } catch (err) {
            setError(err.response?.data?.error || `Failed to fetch items for project.`);
            setQuestItems({ todays_habit_occurrences: [], pending_scheduled_missions: [], pending_pool_missions: [] });
            setQuestInfo(null);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, questId, activeTagFilters]);

    useEffect(() => {
        fetchProjectItems();
    }, [fetchProjectItems]);
    
    const handleGenericStatusUpdate = async (item, newStatus, itemTypeForApi) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        let url = '';
        let httpMethod = 'patch'; // Default to PATCH for status-only updates
        let payload = { status: newStatus };
        const originalItemId = item.id; // Ensure we use the correct ID

        if (itemTypeForApi === 'habit-occurrences') {
            url = `${API_BASE_URL}/habit-occurrences/${originalItemId}/status`;
        } else if (itemTypeForApi === 'scheduled-missions') {
            url = `${API_BASE_URL}/scheduled-missions/${originalItemId}/status`;
        } else if (itemTypeForApi === 'pool-missions') {
            httpMethod = 'put'; // Pool missions use PUT for full update including status
            url = `${API_BASE_URL}/pool-missions/${originalItemId}`;
            // Construct full payload for PUT, preserving other attributes of the mission
            const { type, quest_name, ...originalMissionData } = item; // Remove transient frontend fields
            payload = { 
                ...originalMissionData, 
                tags: item.tags?.map(t => t.id) || [], // Send tag IDs
                status: newStatus 
            };
        } else { 
            console.error("Unknown item type for status update:", itemTypeForApi);
            return; 
        }

        try {
            let response;
            if (httpMethod === 'patch') {
                response = await axios.patch(url, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            } else { // put
                response = await axios.put(url, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            }
            
            fetchProjectItems(); // Refresh panel data
            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined)) {
                 refreshUserStatsAndEnergy({ total_points: response.data.user_total_points, level: response.data.user_level }); //
            } else { 
                refreshUserStatsAndEnergy(); //
            }
        } catch (err) {
            setError(err.response?.data?.error || `Failed to update ${itemTypeForApi} status.`);
            console.error(`Error updating ${itemTypeForApi} status for item ${originalItemId}:`, err.response?.data || err.message);
        }
    };
    
    const handlePoolMissionFocusToggle = async (mission, newFocusStatus) => {
        const token = localStorage.getItem('authToken'); setError(null);
        try {
            await axios.patch(`${API_BASE_URL}/pool-missions/${mission.id}/focus`, 
                { focus_status: newFocusStatus }, { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchProjectItems(); 
        } catch (err) { setError(err.response?.data?.error || "Failed to update focus status."); }
    };

    const projectColor = questInfo?.color || 'var(--color-accent-gold)';
    const panelTitle = title || (questInfo?.name ? `Project: ${questInfo.name}` : "Project Tasks");
    const allEmpty = questItems.todays_habit_occurrences.length === 0 &&
                     questItems.pending_scheduled_missions.length === 0 &&
                     questItems.pending_pool_missions.length === 0;

    return (
        <div className="dashboard-panel project-tasks-panel" style={{ borderTopColor: projectColor }}>
            <h3 style={{color: projectColor}}>{panelTitle}</h3>
            {isLoading && <p>Loading project items...</p>}
            {error && <p className="error-message" style={{ textAlign: 'center' }}>{error}</p>}
            {!isLoading && !error && allEmpty && (
                <p className="empty-state-message">No pending items for this project with current filters.</p>
            )}

            {!isLoading && !error && (
                <>
                    {questItems.todays_habit_occurrences.length > 0 && (
                        <section className="panel-section">
                            <h4>Today's Habits</h4>
                            <ul className="habit-occurrence-list panel-list-condensed">
                                {questItems.todays_habit_occurrences.map(ho => (
                                    <HabitOccurrenceItem
                                        key={`proj-ho-${ho.id}`}
                                        occurrence={ho}
                                        onUpdateStatus={(occurrenceId, newStatus) => handleGenericStatusUpdate(ho, newStatus, 'habit-occurrences')}
                                        questColors={{ [questId]: projectColor }}
                                    />
                                ))}
                            </ul>
                        </section>
                    )}
                    {questItems.pending_scheduled_missions.length > 0 && (
                        <section className="panel-section">
                            <h4>Scheduled Missions</h4>
                            <ul className="upcoming-items-list panel-list-condensed">
                                {questItems.pending_scheduled_missions.map(sm => (
                                    <DashboardScheduledItem
                                        key={`proj-sm-${sm.id}`}
                                        item={sm}
                                        questColor={projectColor}
                                        onStatusUpdate={(item, newStatus) => handleGenericStatusUpdate(item, newStatus, 'scheduled-missions')}
                                    />
                                ))}
                            </ul>
                        </section>
                    )}
                    {questItems.pending_pool_missions.length > 0 && (
                        <section className="panel-section">
                            <h4>Pool Missions</h4>
                            <ul className="pool-mission-list panel-list-condensed">
                                {questItems.pending_pool_missions.map(pm => (
                                    <PoolMissionItem
                                        key={`proj-pm-${pm.id}`}
                                        mission={pm}
                                        questColors={{ [questId]: projectColor }}
                                        onToggleComplete={(mission, newStatus) => handleGenericStatusUpdate(mission, newStatus, 'pool-missions')}
                                        onToggleFocus={handlePoolMissionFocusToggle}
                                        onEdit={() => alert("Edit action for pool mission in Project Panel: Link to main Pool Missions page or implement modal.")}
                                        onDelete={() => alert("Delete action for pool mission in Project Panel: Implement confirmation and API call.")}
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

export default ProjectTasksPanel;