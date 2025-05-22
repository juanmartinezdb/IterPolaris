// frontend/src/components/calendar/CalendarMissionPool.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import PoolMissionItem from '../missions/pool/PoolMissionItem';
import { UserContext } from '../../contexts/UserContext';
import QuestSelector from '../quests/QuestSelector';
import '../../styles/poolmissions.css';

const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function CalendarMissionPool({ 
    onDragStartPoolMission, 
    activeTagFilters, 
    refreshTrigger,
    // These prop names MUST match what CalendarPage passes
    onEditMissionInSidebar,
    onDeleteMissionInSidebar,
    onToggleFocusInSidebar,
    onToggleCompleteInSidebar
}) {
    const [poolMissions, setPoolMissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [questColors, setQuestColors] = useState({});
    const [filterQuestId, setFilterQuestId] = useState('');
    const { currentUser } = useContext(UserContext);

    const fetchQuestColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !currentUser) return;
        try {
            const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { console.error("CalendarMissionPool: Failed to fetch quests for colors:", err); }
    }, [currentUser]);

    const fetchDraggablePoolMissions = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams();
        params.append('status', 'PENDING');
        params.append('focus_status', 'ACTIVE'); 
        if (activeTagFilters && activeTagFilters.length > 0) params.append('tags', activeTagFilters.join(','));
        if (filterQuestId) params.append('quest_id', filterQuestId);
        try {
            const response = await axios.get(API_POOL_MISSIONS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }, params
            });
            setPoolMissions(response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch pool missions for calendar.");
            setPoolMissions([]);
        } finally { setIsLoading(false); }
    }, [currentUser, activeTagFilters, filterQuestId]);

    useEffect(() => { fetchQuestColors(); }, [fetchQuestColors]);
    useEffect(() => { 
        if (currentUser) fetchDraggablePoolMissions(); 
    }, [fetchDraggablePoolMissions, refreshTrigger, currentUser]);

    return (
        <div className="calendar-mission-pool-sidebar">
            <h4>Draggable Pool Missions (Active)</h4>
            <div className="mission-pool-filters" style={{padding: '0 0 0.5rem 0', borderBottom: '1px solid var(--color-accent-gold-hover)', marginBottom: '0.5rem'}}>
                <div className="filter-group" style={{flexGrow: 1}}>
                    <label htmlFor="filter-quest-cal-pool" style={{fontSize:'0.8em'}}>Quest:</label>
                    <QuestSelector 
                        selectedQuestId={filterQuestId}
                        onQuestChange={setFilterQuestId}
                        isFilter={true}
                        disabled={isLoading}
                    />
                </div>
            </div>

            {isLoading && <p>Loading missions...</p>}
            {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}
            {!isLoading && !error && poolMissions.length === 0 && (
                <p style={{ fontSize: '0.85em', fontStyle: 'italic', color: 'var(--color-text-on-dark-muted)', textAlign: 'center', padding: '1rem 0'}}>
                    No active pool missions match filters.
                </p>
            )}
            {!isLoading && !error && poolMissions.length > 0 && (
                <ul className="pool-mission-list" style={{maxHeight: 'calc(100% - 70px)', overflowY: 'auto'}}>
                    {poolMissions.map(mission => (
                        <PoolMissionItem
                            key={mission.id}
                            mission={mission}
                            questColors={questColors}
                            onDragStart={onDragStartPoolMission}
                            // Pass the correctly named props to PoolMissionItem's expected prop names
                            onEdit={onEditMissionInSidebar} // onEditMissionInSidebar -> onEdit
                            onDelete={onDeleteMissionInSidebar} // onDeleteMissionInSidebar -> onDelete
                            onToggleFocus={onToggleFocusInSidebar} // onToggleFocusInSidebar -> onToggleFocus
                            onToggleComplete={onToggleCompleteInSidebar} // onToggleCompleteInSidebar -> onToggleComplete
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

export default CalendarMissionPool;