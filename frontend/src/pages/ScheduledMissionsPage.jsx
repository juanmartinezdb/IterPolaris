// frontend/src/pages/ScheduledMissionsPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext'; 
import ScheduledMissionList from '../components/missions/scheduled/ScheduledMissionList';
import ScheduledMissionForm from '../components/missions/scheduled/ScheduledMissionForm';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import QuestSelector from '../components/quests/QuestSelector';
import Modal from '../components/common/Modal'; // Importar Modal
import '../styles/scheduledmissions.css';
// Dialog.css ya no es necesario aquí si Modal lo maneja o está global.

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function ScheduledMissionsPage({ activeTagFilters }) { // Aceptar activeTagFilters
    const [missions, setMissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showFormModal, setShowFormModal] = useState(false); // Renombrado para claridad
    const [editingMission, setEditingMission] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [missionToDelete, setMissionToDelete] = useState(null);
    const [questColors, setQuestColors] = useState({});

    const [filterQuestId, setFilterQuestId] = useState('');
    const [filterStatus, setFilterStatus] = useState(''); // 'ALL', 'PENDING', 'COMPLETED', 'SKIPPED'
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext); 

    const fetchQuestColors = useCallback(async () => {
        if (!currentUser) return;
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
            console.error("ScheduledMissionsPage: Failed to fetch quests for colors:", err);
        }
    }, [currentUser]);
    
    const fetchScheduledMissions = useCallback(async () => {
        if (!currentUser) { setMissions([]); return; }
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        
        const params = new URLSearchParams();
        if (filterQuestId) params.append('quest_id', filterQuestId);
        if (filterStatus && filterStatus !== "ALL") params.append('status', filterStatus); // No enviar si es "ALL"
        if (filterStartDate) params.append('filter_start_date', filterStartDate);
        if (filterEndDate) params.append('filter_end_date', filterEndDate);

        // Aplicar filtros de tags globales
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }

        try {
            const response = await axios.get(API_SCHEDULED_MISSIONS_URL, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            setMissions(response.data || []);
        } catch (err) {
            console.error("ScheduledMissionsPage: Failed to fetch scheduled missions:", err);
            setError(err.response?.data?.error || "Failed to fetch scheduled missions.");
            setMissions([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, filterQuestId, filterStatus, filterStartDate, filterEndDate, activeTagFilters]); // Añadir activeTagFilters

    useEffect(() => {
        fetchQuestColors();
    }, [fetchQuestColors]);

    useEffect(() => {
        fetchScheduledMissions();
    }, [fetchScheduledMissions]); // Depende de fetchScheduledMissions que ahora incluye activeTagFilters

    const handleOpenCreateForm = () => {
        setEditingMission(null);
        setShowFormModal(true);
    };
    const handleOpenEditForm = (mission) => {
        setEditingMission(mission);
        setShowFormModal(true);
    };
    const handleFormClose = () => {
        setShowFormModal(false);
        setEditingMission(null);
    };
    const handleFormSubmit = (updatedMissionDataFromBackend) => { 
        fetchScheduledMissions();
        if (updatedMissionDataFromBackend && (updatedMissionDataFromBackend.user_total_points !== undefined)) {
            refreshUserStatsAndEnergy({
                total_points: updatedMissionDataFromBackend.user_total_points,
                level: updatedMissionDataFromBackend.user_level
            });
        } else {
            refreshUserStatsAndEnergy();
        }
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
            const response = await axios.delete(`${API_SCHEDULED_MISSIONS_URL}/${missionToDelete.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchScheduledMissions();
            if (response.data && (response.data.user_total_points !== undefined)) {
                 refreshUserStatsAndEnergy({
                    total_points: response.data.user_total_points,
                    level: response.data.user_level
                });
            } else {
                refreshUserStatsAndEnergy(); 
            }
        } catch (err) {
            console.error("ScheduledMissionsPage: Delete error", err.response?.data || err.message);
            setError(err.response?.data?.error || "Failed to delete mission.");
        } finally {
            setShowConfirmDialog(false);
            setMissionToDelete(null);
        }
    };

    const handleUpdateMissionStatus = async (mission, newStatus) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        try {
            const response = await axios.patch(`${API_SCHEDULED_MISSIONS_URL}/${mission.id}/status`, 
                { status: newStatus },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchScheduledMissions(); 
            
            if (response.data && (response.data.user_total_points !== undefined)) {
                 refreshUserStatsAndEnergy({ 
                    total_points: response.data.user_total_points, 
                    level: response.data.user_level 
                });
            } else {
                refreshUserStatsAndEnergy();
            }
        } catch (err) {
            console.error("ScheduledMissionsPage: Update status error", err.response?.data || err.message);
            setError(err.response?.data?.error || "Failed to update mission status.");
        }
    };
    
    return (
        <div className="scheduled-missions-page-container">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>Scheduled Missions</h2>
                <button 
                    onClick={handleOpenCreateForm} 
                    className="add-scheduled-mission-button" // Reutiliza la clase del botón de Quest/Tag
                    style={{margin: 0}} 
                >
                    + Schedule Mission
                </button>
            </div>

            <div className="scheduled-missions-filters">
                <div className="filter-group">
                    <label htmlFor="filter-sm-quest">Filter by Quest:</label>
                    <QuestSelector 
                        selectedQuestId={filterQuestId}
                        onQuestChange={setFilterQuestId}
                        isFilter={true}
                        disabled={isLoading}
                    />
                </div>
                <div className="filter-group">
                    <label htmlFor="filter-sm-status">Filter by Status:</label>
                    <select id="filter-sm-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={isLoading}>
                        <option value="ALL">All Statuses</option> {/* Opción para ver todas */}
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="SKIPPED">Skipped</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="filter-sm-start-date">Missions From:</label>
                    <input type="date" id="filter-sm-start-date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} disabled={isLoading} />
                </div>
                 <div className="filter-group">
                    <label htmlFor="filter-sm-end-date">Missions Until:</label>
                    <input type="date" id="filter-sm-end-date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} disabled={isLoading} />
                </div>
            </div>
            
            {isLoading && missions.length === 0 && <p style={{textAlign: 'center'}}>Loading scheduled missions...</p>}
            {error && <p className="auth-error-message" style={{textAlign: 'center'}}>{error}</p>} {/* auth-error-message para consistencia */}

            {!isLoading && !error && (
                <ScheduledMissionList
                    missions={missions}
                    onEditMission={handleOpenEditForm}
                    onDeleteMission={handleDeleteRequest}
                    onUpdateMissionStatus={handleUpdateMissionStatus}
                    questColors={questColors}
                />
            )}
            
            {showFormModal && (
                <Modal 
                    title={editingMission ? "Edit Scheduled Mission" : "Create Scheduled Mission"}
                    onClose={handleFormClose}
                >
                    <ScheduledMissionForm
                        missionToEdit={editingMission}
                        onFormSubmit={handleFormSubmit} 
                        onCancel={handleFormClose}
                        // slotInfo no se pasa aquí ya que es para creación desde la lista, no desde un slot de calendario
                    />
                </Modal>
            )}

            {showConfirmDialog && missionToDelete && (
                <ConfirmationDialog
                    message={`Are you sure you want to delete the scheduled mission "${missionToDelete.title}"?`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setShowConfirmDialog(false)}
                    confirmButtonText="Delete Mission"
                />
            )}
        </div>
    );
}

export default ScheduledMissionsPage;