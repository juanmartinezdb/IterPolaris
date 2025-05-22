// frontend/src/components/dashboard/MissionPoolPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext';
import PoolMissionList from '../missions/pool/PoolMissionList';
import PoolMissionForm from '../missions/pool/PoolMissionForm';
import ConfirmationDialog from '../common/ConfirmationDialog';
import QuestSelector from '../quests/QuestSelector';
import '../../styles/poolmissions.css';
import '../../styles/dialog.css';

const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function MissionPoolPanel({ activeTagFilters }) {
    const [allMissionsFromApi, setAllMissionsFromApi] = useState([]); // Stores all missions fetched based on non-focus filters
    const [activeFocusMissions, setActiveFocusMissions] = useState([]);
    const [deferredFocusMissions, setDeferredFocusMissions] = useState([]);
    const [completedMissions, setCompletedMissions] = useState([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingMission, setEditingMission] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [missionToDelete, setMissionToDelete] = useState(null);

    const [questColors, setQuestColors] = useState({});

    const [filterQuestId, setFilterQuestId] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // Default to 'ALL'

    const { refreshUserStatsAndEnergy } = useContext(UserContext);

    const fetchQuestsForColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        try {
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const colors = {};
            (response.data || []).forEach(quest => {
                colors[quest.id] = quest.color;
            });
            setQuestColors(colors);
        } catch (err) {
            console.error("MissionPoolPanel: Failed to fetch quests for colors:", err);
        }
    }, []);

    const fetchPoolMissions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setIsLoading(false);
            return;
        }
        
        const params = new URLSearchParams();
        if (activeTagFilters && activeTagFilters.length > 0) {
            params.append('tags', activeTagFilters.join(','));
        }
        if (filterQuestId) {
            params.append('quest_id', filterQuestId);
        }

        // Adjust status query based on filterStatus
        if (filterStatus === 'PENDING') {
            params.append('status', 'PENDING');
        } else if (filterStatus === 'COMPLETED') {
            params.append('status', 'COMPLETED');
        } else { // For 'ALL', we don't append status, or backend handles 'ALL_STATUSES'
            params.append('status', 'ALL_STATUSES'); // Backend handles this to fetch both
        }


        try {
            const response = await axios.get(API_POOL_MISSIONS_URL, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            const missions = response.data || [];
            setAllMissionsFromApi(missions); 
            
            // Filter locally based on the selected filterStatus for display logic
            // The backend might already return filtered data if 'status' param is PENDING or COMPLETED.
            // If 'ALL_STATUSES' is sent, backend returns both, and we filter here for display sections.

            setActiveFocusMissions(missions.filter(m => m.status === 'PENDING' && m.focus_status === 'ACTIVE'));
            setDeferredFocusMissions(missions.filter(m => m.status === 'PENDING' && m.focus_status === 'DEFERRED'));
            setCompletedMissions(missions.filter(m => m.status === 'COMPLETED'));

        } catch (err) {
            console.error("MissionPoolPanel: Failed to fetch pool missions:", err);
            setError(err.response?.data?.error || "Failed to fetch pool missions.");
            setAllMissionsFromApi([]);
            setActiveFocusMissions([]);
            setDeferredFocusMissions([]);
            setCompletedMissions([]);
        } finally {
            setIsLoading(false);
        }
    }, [activeTagFilters, filterQuestId, filterStatus]);

    useEffect(() => {
        fetchQuestsForColors();
    }, [fetchQuestsForColors]);

    useEffect(() => {
        fetchPoolMissions();
    }, [fetchPoolMissions]);


    const handleOpenCreateForm = () => {
        setEditingMission(null);
        setShowForm(true);
    };
    const handleOpenEditForm = (mission) => {
        setEditingMission(mission);
        setShowForm(true);
    };
    const handleFormClose = () => {
        setShowForm(false);
        setEditingMission(null);
    };
    const handleFormSubmit = () => { 
        fetchPoolMissions(); 
        refreshUserStatsAndEnergy(); 
        handleFormClose();
    };

    const handleDeleteRequest = (mission) => {
        setMissionToDelete(mission);
        setShowConfirmDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!missionToDelete) return;
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            await axios.delete(`${API_POOL_MISSIONS_URL}/${missionToDelete.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchPoolMissions(); 
            refreshUserStatsAndEnergy();
        } catch (err) {
            console.error("MissionPoolPanel: Delete error", err.response?.data || err.message);
            setError(err.response?.data?.error || "Failed to delete mission.");
        } finally {
            setShowConfirmDialog(false);
            setMissionToDelete(null);
        }
    };

    const handleToggleFocusStatus = async (mission, newFocusStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            await axios.patch(`${API_POOL_MISSIONS_URL}/${mission.id}/focus`, 
                { focus_status: newFocusStatus },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchPoolMissions(); 
        } catch (err) {
            console.error("MissionPoolPanel: Focus toggle error", err.response?.data || err.message);
            setError(err.response?.data?.error || "Failed to update focus status.");
        }
    };
    
    const handleToggleCompleteStatus = async (mission, newStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            const payload = {
                ...mission, 
                tags: mission.tags.map(t => t.id),
                status: newStatus
            };
            delete payload.id; 
            delete payload.created_at;
            delete payload.updated_at;
            delete payload.quest_name; 

            const response = await axios.put(`${API_POOL_MISSIONS_URL}/${mission.id}`, 
                payload,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchPoolMissions(); 

            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined)) {
                refreshUserStatsAndEnergy({
                    total_points: response.data.user_total_points,
                    level: response.data.user_level
                });
            } else {
                 refreshUserStatsAndEnergy();
            }
        } catch (err) {
            console.error("MissionPoolPanel: Complete toggle error", err.response?.data || err.message);
            setError(err.response?.data?.error || "Failed to update mission status.");
        }
    };
    
    const renderModal = () => {
        if (!showForm) return null;
        return (
            <div className="dialog-overlay">
                 <div className="dialog-content" style={{maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left'}}>
                    <PoolMissionForm
                        missionToEdit={editingMission}
                        onFormSubmit={handleFormSubmit}
                        onCancel={handleFormClose}
                    />
                </div>
            </div>
        );
    };

    // Determine which lists to show based on filterStatus
    const showActiveFocus = filterStatus === 'ALL' || filterStatus === 'PENDING';
    const showDeferredFocus = filterStatus === 'ALL' || filterStatus === 'PENDING';
    const showCompleted = filterStatus === 'ALL' || filterStatus === 'COMPLETED';

    return (
        <div className="mission-pool-panel dashboard-panel">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h3>Mission Pool</h3>
                <button 
                    onClick={handleOpenCreateForm} 
                    className="add-quest-button" 
                    title="Add New Pool Mission"
                    style={{margin: 0, fontSize: '0.9em', padding: '0.5em 1em'}} 
                >
                    + Add
                </button>
            </div>

            <div className="mission-pool-filters">
                <div>
                    <label htmlFor="filter-quest-pool">Quest:</label>
                    <QuestSelector 
                        selectedQuestId={filterQuestId}
                        onQuestChange={setFilterQuestId}
                        isFilter={true}
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label htmlFor="filter-status-pool">Status:</label>
                    <select id="filter-status-pool" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={isLoading}>
                        <option value="ALL">All</option>
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                    </select>
                </div>
            </div>

            {isLoading && <p style={{textAlign: 'center'}}>Loading missions...</p>}
            {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}

            {!isLoading && !error && activeFocusMissions.length === 0 && deferredFocusMissions.length === 0 && completedMissions.length === 0 && (
                <p style={{ textAlign: 'center', marginTop: '2rem', fontStyle: 'italic', color: 'var(--color-text-on-dark-muted)' }}>
                    No pool missions here. Add some!
                </p>
            )}
            
            {!isLoading && !error && (
                <>
                    {showActiveFocus && activeFocusMissions.length > 0 && (
                        <PoolMissionList
                            missions={activeFocusMissions}
                            title="Active Focus"
                            onEditMission={handleOpenEditForm}
                            onDeleteMission={handleDeleteRequest}
                            onToggleFocusStatus={handleToggleFocusStatus}
                            onToggleCompleteStatus={handleToggleCompleteStatus}
                            questColors={questColors}
                        />
                    )}
                     {showDeferredFocus && deferredFocusMissions.length > 0 && (
                        <PoolMissionList
                            missions={deferredFocusMissions}
                            title="Deferred Focus"
                            onEditMission={handleOpenEditForm}
                            onDeleteMission={handleDeleteRequest}
                            onToggleFocusStatus={handleToggleFocusStatus}
                            onToggleCompleteStatus={handleToggleCompleteStatus}
                            questColors={questColors}
                        />
                    )}
                    {showCompleted && completedMissions.length > 0 && (
                         <PoolMissionList
                            missions={completedMissions}
                            title="Completed"
                            onEditMission={handleOpenEditForm}
                            onDeleteMission={handleDeleteRequest}
                            onToggleFocusStatus={handleToggleFocusStatus}
                            onToggleCompleteStatus={handleToggleCompleteStatus}
                            questColors={questColors}
                        />
                    )}
                </>
            )}
            
            {renderModal()}

            {showConfirmDialog && missionToDelete && (
                <ConfirmationDialog
                    message={`Are you sure you want to delete the mission "${missionToDelete.title}"?`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setShowConfirmDialog(false)}
                    confirmButtonText="Delete Mission"
                />
            )}
        </div>
    );
}

export default MissionPoolPanel;