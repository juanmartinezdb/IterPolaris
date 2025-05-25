// frontend/src/pages/PoolMissionsPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext'; // Corrected path
import PoolMissionList from '../components/missions/pool/PoolMissionList';
import PoolMissionForm from '../components/missions/pool/PoolMissionForm';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import QuestSelector from '../components/quests/QuestSelector';
import Modal from '../components/common/Modal';
import '../styles/poolmissions.css'; 

const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function PoolMissionsPage({ activeTagFilters }) { 
    const [allMissions, setAllMissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingMission, setEditingMission] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [missionToDelete, setMissionToDelete] = useState(null);
    const [questColors, setQuestColors] = useState({});

    const [filterQuestId, setFilterQuestId] = useState('');
    const [filterFocusStatus, setFilterFocusStatus] = useState('ALL'); 
    const [filterCompletionStatus, setFilterCompletionStatus] = useState('ALL'); 

    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext);

    const fetchQuestColors = useCallback(async () => {
        if (!currentUser) return;
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { console.error("PoolMissionsPage: Failed to fetch quests for colors:", err); }
    }, [currentUser]);

    const fetchPoolMissionsData = useCallback(async () => {
        if (!currentUser) { setAllMissions([]); return; }
        setIsLoading(true); setError(null);
        const token = localStorage.getItem('authToken');
        
        const params = new URLSearchParams();
        if (filterQuestId) params.append('quest_id', filterQuestId);
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }
        if (filterFocusStatus && filterFocusStatus !== 'ALL') {
            params.append('focus_status', filterFocusStatus);
        }
        if (filterCompletionStatus && filterCompletionStatus !== 'ALL') {
            params.append('status', filterCompletionStatus);
        } else if (filterCompletionStatus === 'ALL') {
            params.append('status', 'ALL_STATUSES'); 
        }

        try {
            const response = await axios.get(API_POOL_MISSIONS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }, params
            });
            setAllMissions(response.data || []);
        } catch (err) {
            console.error("PoolMissionsPage: Failed to fetch pool missions:", err);
            setError(err.response?.data?.error || "Failed to fetch pool missions.");
            setAllMissions([]);
        } finally { setIsLoading(false); }
    }, [currentUser, filterQuestId, activeTagFilters, filterFocusStatus, filterCompletionStatus]);

    useEffect(() => { fetchQuestColors(); }, [fetchQuestColors]);
    useEffect(() => { fetchPoolMissionsData(); }, [fetchPoolMissionsData]);

    const handleOpenCreateForm = () => { setEditingMission(null); setShowFormModal(true); };
    const handleOpenEditForm = (mission) => { setEditingMission(mission); setShowFormModal(true); };
    const handleFormClose = () => { setShowFormModal(false); setEditingMission(null); };
    
    const handleFormSubmit = (updatedMissionData) => { 
        fetchPoolMissionsData();
        if (updatedMissionData && (updatedMissionData.user_total_points !== undefined)) {
            refreshUserStatsAndEnergy({
                total_points: updatedMissionData.user_total_points,
                level: updatedMissionData.user_level
            });
        } else {
            refreshUserStatsAndEnergy();
        }
        handleFormClose();
    };

    const handleDeleteRequest = (mission) => { setMissionToDelete(mission); setShowConfirmDialog(true); };

    const handleConfirmDelete = async () => {
        if (!missionToDelete) return;
        const token = localStorage.getItem('authToken'); setError(null);
        try {
            const response = await axios.delete(`${API_POOL_MISSIONS_URL}/${missionToDelete.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchPoolMissionsData();
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
        } finally { setShowConfirmDialog(false); setMissionToDelete(null); }
    };

    const handleToggleFocusStatus = async (mission, newFocusStatus) => {
        const token = localStorage.getItem('authToken'); setError(null);
        try {
            await axios.patch(`${API_POOL_MISSIONS_URL}/${mission.id}/focus`, 
                { focus_status: newFocusStatus }, { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchPoolMissionsData(); 
        } catch (err) { setError(err.response?.data?.error || "Failed to update focus status."); }
    };
    
    const handleToggleCompleteStatus = async (mission, newStatus) => {
        const token = localStorage.getItem('authToken'); setError(null);
        try {
            const payload = {
                ...mission, 
                tags: mission.tags.map(t => t.id), 
                status: newStatus 
            };
            delete payload.id; 
            delete payload.created_at;
            delete payload.updated_at;
            delete payload.user_id; 
            delete payload.quest_name; 

            const response = await axios.put(`${API_POOL_MISSIONS_URL}/${mission.id}`, 
                payload, { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchPoolMissionsData(); 
            if (response.data && (response.data.user_total_points !== undefined)) {
                refreshUserStatsAndEnergy({
                    total_points: response.data.user_total_points,
                    level: response.data.user_level
                });
            } else {
                refreshUserStatsAndEnergy();
            }
        } catch (err) { setError(err.response?.data?.error || "Failed to update mission status."); }
    };
    
    return (
        <div className="page-container pool-missions-page-container" style={{maxWidth: '900px', margin: '2rem auto'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>Mission Pool Items</h2>
                <button onClick={handleOpenCreateForm} className="add-quest-button" style={{margin: 0}}>
                    + Add Pool Mission
                </button>
            </div>

            <div className="mission-pool-filters" style={{padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: 'var(--border-radius-standard)'}}>
                <div className="filter-group">
                    <label htmlFor="filter-pm-quest">Filter by Quest:</label>
                    <QuestSelector 
                        selectedQuestId={filterQuestId}
                        onQuestChange={setFilterQuestId}
                        isFilter={true}
                        disabled={isLoading}
                    />
                </div>
                <div className="filter-group">
                    <label htmlFor="filter-pm-focus">Focus Status:</label>
                    <select id="filter-pm-focus" value={filterFocusStatus} onChange={(e) => setFilterFocusStatus(e.target.value)} disabled={isLoading}>
                        <option value="ALL">All Focus</option>
                        <option value="ACTIVE">Active</option>
                        <option value="DEFERRED">Deferred</option>
                    </select>
                </div>
                 <div className="filter-group">
                    <label htmlFor="filter-pm-completion">Completion Status:</label>
                    <select id="filter-pm-completion" value={filterCompletionStatus} onChange={(e) => setFilterCompletionStatus(e.target.value)} disabled={isLoading}>
                        <option value="ALL">All</option>
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                    </select>
                </div>
            </div>
            
            {isLoading && allMissions.length === 0 && <p style={{textAlign: 'center'}}>Loading pool missions...</p>}
            {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}

            {!isLoading && !error && (
                <PoolMissionList
                    missions={allMissions} 
                    // No title prop here, as the page has its own main title
                    emptyListMessage="No pool missions match the current filters." // Custom message
                    onEditMission={handleOpenEditForm}
                    onDeleteMission={handleDeleteRequest}
                    onToggleFocusStatus={handleToggleFocusStatus}
                    onToggleCompleteStatus={handleToggleCompleteStatus}
                    questColors={questColors}
                />
            )}
            
            {showFormModal && (
                <Modal 
                    title={editingMission ? "Edit Pool Mission" : "Create Pool Mission"}
                    onClose={handleFormClose}
                >
                    <PoolMissionForm
                        missionToEdit={editingMission}
                        onFormSubmit={handleFormSubmit} 
                        onCancel={handleFormClose}
                    />
                </Modal>
            )}

            {showConfirmDialog && missionToDelete && (
                <ConfirmationDialog
                    message={`Are you sure you want to delete the pool mission "${missionToDelete.title}"?`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setShowConfirmDialog(false)}
                    confirmButtonText="Delete Mission"
                />
            )}
        </div>
    );
}

export default PoolMissionsPage;