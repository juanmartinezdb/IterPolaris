// frontend/src/pages/ScheduledMissionsPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext'; 
import ScheduledMissionList from '../components/missions/scheduled/ScheduledMissionList';
import ScheduledMissionForm from '../components/missions/scheduled/ScheduledMissionForm';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import QuestSelector from '../components/quests/QuestSelector';
import '../styles/scheduledmissions.css';
import '../styles/dialog.css'; 

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function ScheduledMissionsPage() {
    const [missions, setMissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingMission, setEditingMission] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [missionToDelete, setMissionToDelete] = useState(null);
    const [questColors, setQuestColors] = useState({});

    const [filterQuestId, setFilterQuestId] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    const { refreshUserStatsAndEnergy } = useContext(UserContext); 

    const fetchQuestColors = useCallback(async () => {
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
            console.error("ScheduledMissionsPage: Failed to fetch quests for colors:", err);
        }
    }, []);
    
    const fetchScheduledMissions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setIsLoading(false);
            setMissions([]);
            return;
        }
        
        const params = new URLSearchParams();
        if (filterQuestId) params.append('quest_id', filterQuestId);
        if (filterStatus) params.append('status', filterStatus);
        if (filterStartDate) params.append('filter_start_date', filterStartDate);
        if (filterEndDate) params.append('filter_end_date', filterEndDate);

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
    }, [filterQuestId, filterStatus, filterStartDate, filterEndDate]);

    useEffect(() => {
        fetchQuestColors();
    }, [fetchQuestColors]);

    useEffect(() => {
        fetchScheduledMissions();
    }, [fetchScheduledMissions]);

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
    
    const renderModal = () => {
        if (!showForm) return null;
        return (
            <div className="dialog-overlay">
                 <div className="dialog-content" style={{maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left'}}>
                    <ScheduledMissionForm
                        missionToEdit={editingMission}
                        onFormSubmit={handleFormSubmit} 
                        onCancel={handleFormClose}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="scheduled-missions-page-container">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>Scheduled Missions</h2>
                <button 
                    onClick={handleOpenCreateForm} 
                    className="add-scheduled-mission-button"
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
                        <option value="">All Statuses</option>
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
            {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}

            {!isLoading && !error && (
                <ScheduledMissionList
                    missions={missions}
                    onEditMission={handleOpenEditForm}
                    onDeleteMission={handleDeleteRequest}
                    onUpdateMissionStatus={handleUpdateMissionStatus}
                    questColors={questColors}
                />
            )}
            
            {renderModal()}

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