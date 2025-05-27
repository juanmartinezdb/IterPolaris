// frontend/src/components/calendar/CalendarMissionPool.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import PoolMissionItem from '../missions/pool/PoolMissionItem';
import PoolMissionForm from '../missions/pool/PoolMissionForm';
import ConfirmationDialog from '../common/ConfirmationDialog';
import Modal from '../common/Modal';
import { UserContext } from '../../contexts/UserContext';
import QuestSelector from '../quests/QuestSelector';
import '../../styles/poolmissions.css';

const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function CalendarMissionPool({ 
    onDragStartPoolMission, 
    activeTagFilters,
    refreshTrigger
}) {
    const [poolMissions, setPoolMissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [questColors, setQuestColors] = useState({});
    const [filterQuestId, setFilterQuestId] = useState('');
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext);

    const [showEditFormModal, setShowEditFormModal] = useState(false);
    const [editingMission, setEditingMission] = useState(null);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [missionToDelete, setMissionToDelete] = useState(null);

    const fetchQuestColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !currentUser) return;
        try {
            const response = await axios.get(API_QUESTS_URL, { headers: { Authorization: `Bearer ${token}` } });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { console.error("CalendarMissionPool: Failed to fetch quests for colors:", err); }
    }, [currentUser]);

    const fetchDraggablePoolMissions = useCallback(async () => {
        if (!currentUser) { setPoolMissions([]); return; }
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams();
        params.append('status', 'PENDING'); 
        params.append('focus_status', 'ACTIVE'); 
        
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }
        if (filterQuestId) {
            params.append('quest_id', filterQuestId);
        }
        try {
            const response = await axios.get(API_POOL_MISSIONS_URL, {
                headers: { Authorization: `Bearer ${token}` }, params
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

    const handleEditMission = (mission) => {
        setEditingMission(mission);
        setShowEditFormModal(true);
    };

    const handleDeleteRequest = (mission) => {
        setMissionToDelete(mission);
        setShowDeleteConfirmModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!missionToDelete) return;
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            const response = await axios.delete(`${API_POOL_MISSIONS_URL}/${missionToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDraggablePoolMissions();
            if (response.data && (response.data.user_total_points !== undefined)) {
                refreshUserStatsAndEnergy({
                    total_points: response.data.user_total_points,
                    level: response.data.user_level
                });
            } else {
                refreshUserStatsAndEnergy();
            }
        } catch (err) {
            setError(err.response?.data?.error || "Failed to delete mission.");
        } finally {
            setShowDeleteConfirmModal(false);
            setMissionToDelete(null);
        }
    };

    const handleToggleFocusStatus = async (mission, newFocusStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            await axios.patch(`${API_POOL_MISSIONS_URL}/${mission.id}/focus`, 
                { focus_status: newFocusStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchDraggablePoolMissions();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update focus status.");
        }
    };
    
    const handleToggleCompleteStatus = async (mission, newStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            const payload = { ...mission, tags: mission.tags?.map(t => t.id) || [], status: newStatus };
            delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.quest_name; 

            const response = await axios.put(`${API_POOL_MISSIONS_URL}/${mission.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            fetchDraggablePoolMissions(); 
            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined)) {
                refreshUserStatsAndEnergy({
                    total_points: response.data.user_total_points,
                    level: response.data.user_level
                });
            } else {
                 refreshUserStatsAndEnergy();
            }
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update mission status.");
        }
    };

    const handleFormSubmit = () => {
        setShowEditFormModal(false);
        setEditingMission(null);
        fetchDraggablePoolMissions(); 
        refreshUserStatsAndEnergy();
    };

    return (
        <div className="calendar-mission-pool-sidebar">
            <h4>Pool</h4> {/* CONFIRMED TITLE CHANGE */}
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
            {error && <p className="auth-error-message" style={{textAlign: 'center'}}>{error}</p>}
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
                            onEdit={handleEditMission}
                            onDelete={handleDeleteRequest}
                            onToggleFocus={handleToggleFocusStatus}
                            onToggleComplete={handleToggleCompleteStatus}
                        />
                    ))}
                </ul>
            )}

            {showEditFormModal && editingMission && (
                <Modal title="Edit Pool Mission" onClose={() => { setShowEditFormModal(false); setEditingMission(null); }}>
                    <PoolMissionForm
                        missionToEdit={editingMission}
                        onFormSubmit={handleFormSubmit}
                        onCancel={() => { setShowEditFormModal(false); setEditingMission(null); }}
                    />
                </Modal>
            )}

            {showDeleteConfirmModal && missionToDelete && (
                <ConfirmationDialog
                    message={`Are you sure you want to delete the pool mission "${missionToDelete.title}"?`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => { setShowDeleteConfirmModal(false); setMissionToDelete(null); }}
                    confirmButtonText="Delete Mission"
                />
            )}
        </div>
    );
}

export default CalendarMissionPool;