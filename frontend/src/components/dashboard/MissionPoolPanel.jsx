// frontend/src/components/dashboard/MissionPoolPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PoolMissionList from '../missions/pool/PoolMissionList';
import PoolMissionForm from '../missions/pool/PoolMissionForm';
import ConfirmationDialog from '../common/ConfirmationDialog';
import QuestSelector from '../quests/QuestSelector'; // Importado para filtro
import '../../styles/poolmissions.css';
import '../../styles/dialog.css'; // Para el modal simulado

const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;


function MissionPoolPanel({ activeTagFilters }) { // activeTagFilters desde props (DashboardPage)
    const [allMissions, setAllMissions] = useState([]);
    // Separar misiones por focus_status para renderizado
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

    const fetchQuestsForColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
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
            console.error("Failed to fetch quests for colors:", err);
        }
    }, []);

    const fetchPoolMissions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        
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
            setActiveFocusMissions(missions.filter(m => m.focus_status === 'ACTIVE'));
            setDeferredFocusMissions(missions.filter(m => m.focus_status === 'DEFERRED'));

        } catch (err) {
            console.error("Failed to fetch pool missions:", err);
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

    useEffect(() => { // Separar useEffect para fetchPoolMissions para que se ejecute cuando cambien los filtros
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
        handleFormClose();
    };

    const handleDeleteRequest = (mission) => {
        setMissionToDelete(mission);
        setShowConfirmDialog(true);
    };
    const handleConfirmDelete = async () => {
        if (!missionToDelete) return;
        const token = localStorage.getItem('authToken');
        // setIsLoading(true); // Opcional para el diálogo
        try {
            await axios.delete(`${API_POOL_MISSIONS_URL}/${missionToDelete.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchPoolMissions();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to delete mission.");
        } finally {
            setShowConfirmDialog(false);
            setMissionToDelete(null);
            // setIsLoading(false);
        }
    };

    const handleToggleFocusStatus = async (mission, newFocusStatus) => {
        const token = localStorage.getItem('authToken');
        try {
            await axios.patch(`${API_POOL_MISSIONS_URL}/${mission.id}/focus`, 
                { focus_status: newFocusStatus },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchPoolMissions(); 
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update focus status.");
            console.error("Error updating focus status:", err);
        }
    };
    
    const handleToggleCompleteStatus = async (mission, newStatus) => {
        const token = localStorage.getItem('authToken');
        try {
            const missionDataPayload = {
                title: mission.title, // El backend espera todos los campos para PUT o los que cambian para PATCH
                description: mission.description,
                energy_value: mission.energy_value,
                points_value: mission.points_value,
                quest_id: mission.quest_id,
                tag_ids: mission.tags.map(t => t.id),
                focus_status: mission.focus_status,
                status: newStatus // El campo que cambia
            };

            await axios.put(`${API_POOL_MISSIONS_URL}/${mission.id}`, 
                missionDataPayload,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchPoolMissions();
            // Lógica de gamificación se activará en Tarea 8
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update mission status.");
            console.error("Error updating mission status:", err.response?.data || err);
        }
    };
    
    // Simulación de Modal (para PoolMissionForm)
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

    return (
        <div className="mission-pool-panel">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h3>Mission Pool</h3>
                <button 
                    onClick={handleOpenCreateForm} 
                    className="add-quest-button" 
                    title="Add New Pool Mission"
                    style={{margin: 0}} 
                >
                    + Add Mission
                </button>
            </div>

            <div className="mission-pool-filters">
                <div>
                    <label htmlFor="filter-quest-pool">Quest:</label>
                    <QuestSelector 
                        selectedQuestId={filterQuestId}
                        onQuestChange={setFilterQuestId}
                        isFilter={true} // <--- ASEGÚRATE QUE ESTÉ ASÍ PARA EL FILTRO
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label htmlFor="filter-status-pool">Status:</label>
                    <select id="filter-status-pool" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={isLoading}>
                        <option value="">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                    </select>
                </div>
            </div>

            {isLoading && <p style={{textAlign: 'center'}}>Loading missions...</p>}
            {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}

            {!isLoading && !error && allMissions.length === 0 && (
                <p style={{ textAlign: 'center', marginTop: '2rem' }}>No pool missions found matching your criteria. Try creating some!</p>
            )}

            {!isLoading && !error && (activeFocusMissions.length > 0 || deferredFocusMissions.length > 0) && (
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