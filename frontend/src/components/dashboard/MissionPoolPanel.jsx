// frontend/src/components/dashboard/MissionPoolPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext'; // Importar UserContext
import PoolMissionList from '../missions/pool/PoolMissionList';
import PoolMissionForm from '../missions/pool/PoolMissionForm';
import ConfirmationDialog from '../common/ConfirmationDialog';
import QuestSelector from '../quests/QuestSelector';
import '../../styles/poolmissions.css';
import '../../styles/dialog.css';

const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function MissionPoolPanel({ activeTagFilters }) { // activeTagFilters from props
    const [allMissions, setAllMissions] = useState([]);
    const [activeFocusMissions, setActiveFocusMissions] = useState([]);
    const [deferredFocusMissions, setDeferredFocusMissions] = useState([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingMission, setEditingMission] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [missionToDelete, setMissionToDelete] = useState(null);

    const [questColors, setQuestColors] = useState({});

    const [filterQuestId, setFilterQuestId] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const { refreshUserStatsAndEnergy } = useContext(UserContext); // Use UserContext

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
        if (filterStatus) {
            params.append('status', filterStatus);
        }

        try {
            const response = await axios.get(API_POOL_MISSIONS_URL, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            const missions = response.data || [];
            setAllMissions(missions); 
            setActiveFocusMissions(missions.filter(m => m.status === 'PENDING' && m.focus_status === 'ACTIVE'));
            setDeferredFocusMissions(missions.filter(m => m.status === 'PENDING' && m.focus_status === 'DEFERRED'));
            // Completed missions can be shown in a separate list if desired, or filtered out if not needed in this panel
        } catch (err) {
            console.error("MissionPoolPanel: Failed to fetch pool missions:", err);
            setError(err.response?.data?.error || "Failed to fetch pool missions.");
            setAllMissions([]);
            setActiveFocusMissions([]);
            setDeferredFocusMissions([]);
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
    const handleFormSubmit = () => { // Called after successful form submission
        fetchPoolMissions(); // Refetch all pool missions
        refreshUserStatsAndEnergy(); // Refresh global user stats and energy (in case points/energy changed via form, though less common for pool)
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
            fetchPoolMissions(); // Refetch missions
            // If deleting a completed mission had reversed points/energy, backend would handle it.
            // We then call refreshUserStatsAndEnergy to update frontend displays.
            // For pool missions, deletion typically doesn't award/revoke points unless it was completed.
            // Assuming backend handles any reversal logic for completed items if applicable on delete.
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
            // Focus status change does not affect points/energy, so no need to call refreshUserStatsAndEnergy
        } catch (err) {
            console.error("MissionPoolPanel: Focus toggle error", err.response?.data || err.message);
            setError(err.response?.data?.error || "Failed to update focus status.");
        }
    };
    
    const handleToggleCompleteStatus = async (mission, newStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            // The PUT endpoint for PoolMission expects all relevant fields.
            // We are only changing 'status' here based on UI interaction.
            // The backend's PUT /api/pool-missions/:id handles the points/energy logic.
            const payload = {
                ...mission, // Send existing mission data
                tags: mission.tags.map(t => t.id), // Send tag IDs
                status: newStatus
            };
            delete payload.id; // Don't send id in body for PUT
            delete payload.created_at;
            delete payload.updated_at;
            delete payload.quest_name; // Not part of the model for PUT

            const response = await axios.put(`${API_POOL_MISSIONS_URL}/${mission.id}`, 
                payload,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchPoolMissions(); // Refresh list

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

    const completedMissions = allMissions.filter(m => m.status === 'COMPLETED');

    return (
        <div className="mission-pool-panel dashboard-panel"> {/* Added dashboard-panel class */}
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
                        <option value="">All (Pending)</option> {/* Default to pending if "All" for status is confusing */}
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                         <option value="ALL_STATUSES">All Statuses</option> {/* If you want to show all including completed here */}
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
                    {activeFocusMissions.length > 0 && (
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
                     {deferredFocusMissions.length > 0 && (
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
                    {/* Optional: Show completed pool missions here if filterStatus is 'COMPLETED' or 'ALL_STATUSES' */}
                    {filterStatus === 'COMPLETED' && completedMissions.length > 0 && (
                         <PoolMissionList
                            missions={completedMissions}
                            title="Completed"
                            onEditMission={handleOpenEditForm} // Likely disabled for completed
                            onDeleteMission={handleDeleteRequest}
                            onToggleFocusStatus={handleToggleFocusStatus} // Likely N/A for completed
                            onToggleCompleteStatus={handleToggleCompleteStatus} // To revert
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