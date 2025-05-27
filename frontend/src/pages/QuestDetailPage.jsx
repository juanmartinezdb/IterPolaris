// frontend/src/pages/QuestDetailPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext';

import PoolMissionList from '../components/missions/pool/PoolMissionList';
import ScheduledMissionList from '../components/missions/scheduled/ScheduledMissionList';
import HabitOccurrenceList from '../components/habits/HabitOccurrenceList'; // Assuming a similar list component exists or we'll adapt

import PoolMissionForm from '../components/missions/pool/PoolMissionForm';
import ScheduledMissionForm from '../components/missions/scheduled/ScheduledMissionForm';
import HabitTemplateForm from '../components/habits/HabitTemplateForm'; // For adding habits (template creates occurrences)
import Modal from '../components/common/Modal';
import ConfirmationDialog from '../components/common/ConfirmationDialog';


import '../styles/quests.css';
import '../styles/dashboard.css'; // For panel-like appearance
import '../styles/poolmissions.css';
import '../styles/scheduledmissions.css';
import '../styles/habits.css';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function QuestDetailPage({ activeTagFilters }) {
    const { questId } = useParams();
    const [questDetails, setQuestDetails] = useState(null);
    const [poolMissions, setPoolMissions] = useState([]);
    const [scheduledMissions, setScheduledMissions] = useState([]);
    const [habitOccurrences, setHabitOccurrences] = useState([]);
    const [questColors, setQuestColors] = useState({});


    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext);
    const navigate = useNavigate();

    // State for modals
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState(null);
    const [itemToEdit, setItemToEdit] = useState(null);
    const [itemTypeForForm, setItemTypeForForm] = useState('');
    const [slotInfoForSMForm, setSlotInfoForSMForm] = useState(null);

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [itemTypeToDelete, setItemTypeToDelete] = useState('');


    const fetchQuestData = useCallback(async () => {
        if (!currentUser || !questId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');
        const token = localStorage.getItem('authToken');
        const headers = { 'Authorization': `Bearer ${token}` };
        const params = new URLSearchParams();
        params.append('quest_id', questId);
        
        // Apply global tag filters if any
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }

        try {
            const [
                questDetailsRes, 
                poolMissionsRes, 
                scheduledMissionsRes, 
                allHabitOccurrencesRes, // Fetch all first, then filter
                allQuestsRes // For colors
            ] = await Promise.all([
                axios.get(`${API_BASE_URL}/quests/${questId}`, { headers }),
                axios.get(`${API_BASE_URL}/pool-missions`, { headers, params }), // Filters include quest_id
                axios.get(`${API_BASE_URL}/scheduled-missions`, { headers, params }), // Filters include quest_id
                axios.get(`${API_BASE_URL}/habit-occurrences`, { // Fetches all user occurrences, then filters locally by quest_id
                    headers, 
                    params: (()=>{ const p = new URLSearchParams(params); p.delete('quest_id'); return p; })() // Remove quest_id for this call
                }),
                axios.get(`${API_BASE_URL}/quests`, { headers })
            ]);

            setQuestDetails(questDetailsRes.data);
            setPoolMissions(poolMissionsRes.data || []);
            setScheduledMissions(scheduledMissionsRes.data || []);
            
            // Client-side filter for habit occurrences by quest_id
            const filteredHabitOccurrences = (allHabitOccurrencesRes.data || []).filter(ho => ho.quest_id === questId);
            setHabitOccurrences(filteredHabitOccurrences);

            const colors = {};
            (allQuestsRes.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);

        } catch (err) {
            console.error(`Failed to fetch data for quest ${questId}:`, err);
            setError(err.response?.data?.error || `Failed to load Quest data.`);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, questId, activeTagFilters]);

    useEffect(() => {
        fetchQuestData();
    }, [fetchQuestData]);

    const handleSuccessfulFormSubmit = () => {
        setShowModal(false);
        setItemToEdit(null);
        setItemTypeForForm('');
        fetchQuestData(); // Refresh all data for the quest
        refreshUserStatsAndEnergy();
    };
    
    const openFormModal = (type, itemData = null) => {
        setItemTypeForForm(type);
        setItemToEdit(itemData); // null for create, item for edit
        setSlotInfoForSMForm(null); // Reset slotInfo

        switch (type) {
            case 'PoolMission':
                setModalTitle(itemData ? 'Edit Pool Mission' : 'Create Pool Mission');
                setModalContent(
                    <PoolMissionForm
                        missionToEdit={itemData}
                        onFormSubmit={handleSuccessfulFormSubmit}
                        onCancel={() => setShowModal(false)}
                        // Pass questId directly if creating, QuestSelector will handle it
                        initialQuestId={!itemData ? questId : null} 
                    />
                );
                break;
            case 'ScheduledMission':
                setModalTitle(itemData ? 'Edit Scheduled Mission' : 'Create Scheduled Mission');
                 // For new SM from Quest Detail, default to today, specific time
                const defaultStart = itemData ? null : new Date();
                const defaultEnd = itemData ? null : new Date(new Date().getTime() + 60 * 60 * 1000); // 1 hour later
                setSlotInfoForSMForm(itemData ? null : {start: defaultStart, end: defaultEnd, allDay: false});

                setModalContent(
                    <ScheduledMissionForm
                        missionToEdit={itemData}
                        slotInfo={itemData ? null : {start: defaultStart, end: defaultEnd, allDay: false, initialQuestId: questId}}
                        onFormSubmit={handleSuccessfulFormSubmit}
                        onCancel={() => setShowModal(false)}
                         initialQuestId={!itemData ? questId : null}
                    />
                );
                break;
            case 'Habit': // This means creating/editing a Habit Template
                setModalTitle(itemData ? 'Edit Habit Template' : 'Create Habit Template');
                setModalContent(
                    <HabitTemplateForm
                        templateToEdit={itemData} // If editing a template (might not be directly from this page's item list)
                        onFormSubmit={handleSuccessfulFormSubmit}
                        onCancel={() => setShowModal(false)}
                        initialQuestId={!itemData ? questId : null} // Pass questId for new templates
                    />
                );
                break;
            default: return;
        }
        setShowModal(true);
    };

    const requestDeleteItem = (item, type) => {
        setItemToDelete(item);
        setItemTypeToDelete(type);
        setShowConfirmDialog(true);
    };

    const confirmDeleteItem = async () => {
        if (!itemToDelete || !itemTypeToDelete) return;
        const token = localStorage.getItem('authToken');
        let url = '';
        switch (itemTypeToDelete) {
            case 'PoolMission': url = `${API_BASE_URL}/pool-missions/${itemToDelete.id}`; break;
            case 'ScheduledMission': url = `${API_BASE_URL}/scheduled-missions/${itemToDelete.id}`; break;
            case 'HabitOccurrence': 
                // Deleting a habit occurrence might be complex - usually templates are deleted.
                // For now, let's assume we can delete an occurrence (if backend supports it).
                // Or this button should rather delete the template. For now, occurrence:
                url = `${API_BASE_URL}/habit-occurrences/${itemToDelete.id}`; // Placeholder, backend might not have DELETE for single occurrence
                alert("Deleting single habit occurrences is not standard. Usually, one deletes the template or skips the occurrence. This is a placeholder action.");
                setShowConfirmDialog(false); return; 
            default: return;
        }
        try {
            await axios.delete(url, { headers: { 'Authorization': `Bearer ${token}` } });
            handleSuccessfulFormSubmit(); // Refresh data
        } catch (err) {
            setError(err.response?.data?.error || `Failed to delete ${itemTypeToDelete}.`);
        } finally {
            setShowConfirmDialog(false);
            setItemToDelete(null);
            setItemTypeToDelete('');
        }
    };
    
    const handleItemStatusUpdate = async (item, newStatus, itemTypeForApiRoute) => {
        const token = localStorage.getItem('authToken');
        setError(null);
        let url = '';
        let payload = { status: newStatus };
         const originalItemId = item.id; 

        if (itemTypeForApiRoute === 'pool-missions') {
            url = `${API_BASE_URL}/pool-missions/${originalItemId}`; // Pool Missions use PUT for status changes and full updates
            // Need to send the full payload for PUT
            const { type, quest_name, ...originalMissionData } = item;
             payload = { ...originalMissionData, tags: item.tags?.map(t => t.id) || [], status: newStatus };
        } else if (itemTypeForApiRoute === 'scheduled-missions') {
            url = `${API_BASE_URL}/scheduled-missions/${originalItemId}/status`;
        } else if (itemTypeForApiRoute === 'habit-occurrences') {
            url = `${API_BASE_URL}/habit-occurrences/${originalItemId}/status`;
        } else { return; }

        try {
            const response = (itemTypeForApiRoute === 'pool-missions')
                ? await axios.put(url, payload, { headers: { 'Authorization': `Bearer ${token}` } })
                : await axios.patch(url, payload, { headers: { 'Authorization': `Bearer ${token}` } });

            fetchQuestData(); // Refresh panel data
            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined)) {
                 refreshUserStatsAndEnergy({ total_points: response.data.user_total_points, level: response.data.user_level });
            } else { refreshUserStatsAndEnergy(); }
        } catch (err) {
            setError(err.response?.data?.error || `Failed to update ${itemTypeForApiRoute} status.`);
            console.error(`Error updating ${itemTypeForApiRoute} for item ${originalItemId}:`, err.response?.data || err.message);
        }
    };
    
    const handlePoolMissionFocusToggle = async (mission, newFocusStatus) => {
        const token = localStorage.getItem('authToken'); setError(null);
        try {
            await axios.patch(`${API_BASE_URL}/pool-missions/${mission.id}/focus`, 
                { focus_status: newFocusStatus }, { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchQuestData(); 
        } catch (err) { setError(err.response?.data?.error || "Failed to update focus status."); }
    };


    if (isLoading) {
        return <div className="page-container quests-page-container"><p>Loading Quest Details...</p></div>;
    }
    if (error) {
        return <div className="page-container quests-page-container"><p className="auth-error-message">{error}</p></div>;
    }
    if (!questDetails) {
        return <div className="page-container quests-page-container"><p>Quest not found.</p> <Link to="/quests-overview">Back to Quests</Link></div>;
    }

    const panelHeaderStyle = {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--color-accent-gold-hover)',
        paddingBottom: '0.5rem', marginBottom: '1rem'
    };
    const panelAddButtonStyle = {
        background: 'var(--color-accent-secondary)', color: 'var(--color-text-on-accent)',
        border: 'none', borderRadius: 'var(--border-radius-button)',
        padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8em'
    };

    return (
        <div className="page-container quest-detail-page" style={{ maxWidth: '1200px', margin: '0 auto'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${questDetails.color || 'var(--color-accent-gold)'}`, paddingBottom: '0.5rem', marginBottom: '1.5rem'}}>
                <h2 style={{ color: questDetails.color || 'var(--color-accent-gold)', margin: 0 }}>
                    {questDetails.name}
                </h2>
                <Link 
                    to={`/logbook/quest/${questId}`} 
                    className="auth-button" 
                    style={{textDecoration: 'none', fontSize: '0.9em', padding: '0.5em 1em'}}
                >
                    View Logbook
                </Link>
            </div>
            {questDetails.description && <p style={{ marginBottom: '2rem', color: 'var(--color-text-on-dark-muted)' }}>{questDetails.description}</p>}

            <div className="dashboard-panels-flow-container">
                <div className="dashboard-panel">
                    <div style={panelHeaderStyle}>
                        <h3 style={{margin:0}}>Pool Missions</h3>
                        <button onClick={() => openFormModal('PoolMission')} style={panelAddButtonStyle} title="Add Pool Mission to this Quest">+ Add</button>
                    </div>
                    <PoolMissionList
                        missions={poolMissions}
                        onEditMission={(mission) => openFormModal('PoolMission', mission)}
                        onDeleteMission={(mission) => requestDeleteItem(mission, 'PoolMission')}
                        onToggleFocusStatus={handlePoolMissionFocusToggle}
                        onToggleCompleteStatus={(mission, newStatus) => handleItemStatusUpdate(mission, newStatus, 'pool-missions')}
                        questColors={questColors}
                        // title="" // No title needed here as panel has one
                        emptyListMessage="No pool missions for this quest with current filters."
                    />
                </div>

                <div className="dashboard-panel">
                     <div style={panelHeaderStyle}>
                        <h3 style={{margin:0}}>Scheduled Missions</h3>
                        <button onClick={() => openFormModal('ScheduledMission')} style={panelAddButtonStyle} title="Add Scheduled Mission to this Quest">+ Add</button>
                    </div>
                    <ScheduledMissionList
                        missions={scheduledMissions}
                        onEditMission={(mission) => openFormModal('ScheduledMission', mission)}
                        onDeleteMission={(mission) => requestDeleteItem(mission, 'ScheduledMission')}
                        onUpdateMissionStatus={(mission, newStatus) => handleItemStatusUpdate(mission, newStatus, 'scheduled-missions')}
                        questColors={questColors}
                        // title=""
                        emptyListMessage="No scheduled missions for this quest with current filters."
                    />
                </div>

                <div className="dashboard-panel">
                     <div style={panelHeaderStyle}>
                        <h3 style={{margin:0}}>Habits</h3>
                        <button onClick={() => openFormModal('Habit')} style={panelAddButtonStyle} title="Add Habit Template to this Quest">+ Add</button>
                    </div>
                    <HabitOccurrenceList
                        occurrences={habitOccurrences} // Assuming HabitOccurrenceList can take occurrences
                        onUpdateStatus={(occurrenceId, newStatus) => {
                            const occ = habitOccurrences.find(o => o.id === occurrenceId);
                            if (occ) handleItemStatusUpdate(occ, newStatus, 'habit-occurrences');
                        }}
                        questColors={questColors}
                        // title=""
                        emptyListMessage="No habit occurrences for this quest with current filters."
                    />
                </div>
            </div>
            {showModal && (
                <Modal title={modalTitle} onClose={() => setShowModal(false)}>
                    {modalContent}
                </Modal>
            )}
            {showConfirmDialog && itemToDelete && (
                 <ConfirmationDialog
                    message={`Are you sure you want to delete "${itemToDelete.title}"?`}
                    onConfirm={confirmDeleteItem}
                    onCancel={() => setShowConfirmDialog(false)}
                    confirmButtonText="Delete"
                />
            )}
        </div>
    );
}

export default QuestDetailPage;