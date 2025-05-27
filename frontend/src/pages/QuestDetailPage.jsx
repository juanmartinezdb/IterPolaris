// frontend/src/pages/QuestDetailPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext';

import PoolMissionList from '../components/missions/pool/PoolMissionList';
import ScheduledMissionList from '../components/missions/scheduled/ScheduledMissionList';
// import HabitOccurrenceList from '../components/habits/HabitOccurrenceList'; // Replaced
import HabitTemplateList from '../components/habits/HabitTemplateList'; // Added

import PoolMissionForm from '../components/missions/pool/PoolMissionForm';
import ScheduledMissionForm from '../components/missions/scheduled/ScheduledMissionForm';
import HabitTemplateForm from '../components/habits/HabitTemplateForm';
import Modal from '../components/common/Modal';
import ConfirmationDialog from '../components/common/ConfirmationDialog';

import '../styles/quests.css';
import '../styles/dashboard.css';
import '../styles/poolmissions.css';
import '../styles/scheduledmissions.css';
import '../styles/habittemplates.css'; // Changed from habits.css

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function QuestDetailPage({ activeTagFilters }) {
    const { questId } = useParams();
    const navigate = useNavigate();
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext);

    const [questDetails, setQuestDetails] = useState(null);
    const [poolMissions, setPoolMissions] = useState([]);
    const [scheduledMissions, setScheduledMissions] = useState([]);
    const [habitTemplates, setHabitTemplates] = useState([]); // Changed from habitOccurrences
    const [questColors, setQuestColors] = useState({});

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState(null);
    const [itemToEdit, setItemToEdit] = useState(null);
    // itemTypeForForm is useful to distinguish which form to render
    // const [itemTypeForForm, setItemTypeForForm] = useState(''); NO LONGER USED, each button calls specific openForm

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [itemTypeToDelete, setItemTypeToDelete] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState(''); // For success messages

    const clearFeedback = useCallback(() => {
        setTimeout(() => setFeedbackMessage(''), 3000);
    }, []);


    const fetchQuestData = useCallback(async () => {
        if (!currentUser || !questId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');
        const token = localStorage.getItem('authToken');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const baseParams = new URLSearchParams();
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => baseParams.append('tags', tagId));
        }

        const questSpecificParams = new URLSearchParams(baseParams);
        questSpecificParams.append('quest_id', questId);
        
        try {
            const [
                questDetailsRes, 
                poolMissionsRes, 
                scheduledMissionsRes, 
                habitTemplatesRes, // Changed from allHabitOccurrencesRes
                allQuestsRes 
            ] = await Promise.all([
                axios.get(`${API_BASE_URL}/quests/${questId}`, { headers }),
                axios.get(`${API_BASE_URL}/pool-missions`, { headers, params: questSpecificParams }),
                axios.get(`${API_BASE_URL}/scheduled-missions`, { headers, params: questSpecificParams }),
                axios.get(`${API_BASE_URL}/habit-templates`, { headers, params: questSpecificParams }), // Fetch templates for this quest
                axios.get(`${API_BASE_URL}/quests`, { headers }) // For all quest colors
            ]);

            setQuestDetails(questDetailsRes.data);
            setPoolMissions(poolMissionsRes.data || []);
            setScheduledMissions(scheduledMissionsRes.data || []);
            setHabitTemplates(habitTemplatesRes.data || []); // Set habit templates

            const colors = {};
            (allQuestsRes.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);

        } catch (err) {
            console.error(`Failed to fetch data for quest ${questId}:`, err);
            setError(err.response?.data?.error || `Failed to load Quest data.`);
            if (err.response?.status === 404) {
                setQuestDetails(null); // Ensure questDetails is null if quest not found
            }
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, questId, activeTagFilters]);

    useEffect(() => {
        fetchQuestData();
    }, [fetchQuestData]);

    const handleSuccessfulFormSubmit = (message) => {
        setShowModal(false);
        setItemToEdit(null);
        fetchQuestData(); 
        refreshUserStatsAndEnergy();
        if(message) {
            setFeedbackMessage(message);
            clearFeedback();
        }
    };
    
    const openPoolMissionForm = (mission = null) => {
        setItemToEdit(mission);
        setModalTitle(mission ? 'Edit Pool Mission' : 'Create Pool Mission');
        setModalContent(
            <PoolMissionForm
                missionToEdit={mission}
                onFormSubmit={() => handleSuccessfulFormSubmit(mission ? 'Pool Mission updated!' : 'Pool Mission created!')}
                onCancel={() => setShowModal(false)}
                initialQuestId={questId} // Pass current questId
            />
        );
        setShowModal(true);
    };

    const openScheduledMissionForm = (mission = null) => {
        setItemToEdit(mission);
        const defaultStart = mission ? null : new Date();
        const defaultEnd = mission ? null : new Date(new Date().getTime() + 60 * 60 * 1000);
        const slotInfo = mission ? null : {start: defaultStart, end: defaultEnd, allDay: false, initialQuestId: questId};

        setModalTitle(mission ? 'Edit Scheduled Mission' : 'Create Scheduled Mission');
        setModalContent(
            <ScheduledMissionForm
                missionToEdit={mission}
                slotInfo={slotInfo} // Pass for new missions, includes initialQuestId
                onFormSubmit={() => handleSuccessfulFormSubmit(mission ? 'Scheduled Mission updated!' : 'Scheduled Mission created!')}
                onCancel={() => setShowModal(false)}
                // initialQuestId prop no longer needed here if passed via slotInfo
            />
        );
        setShowModal(true);
    };
    
    const openHabitTemplateForm = (template = null) => {
        setItemToEdit(template);
        setModalTitle(template ? 'Edit Habit Template' : 'Create Habit Template');
        setModalContent(
            <HabitTemplateForm
                templateToEdit={template}
                onFormSubmit={() => handleSuccessfulFormSubmit(template ? 'Habit Template updated!' : 'Habit Template created!')}
                onCancel={() => setShowModal(false)}
                initialQuestId={questId} // Pass current questId
            />
        );
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
        let itemTitle = itemToDelete.title;

        switch (itemTypeToDelete) {
            case 'PoolMission': url = `${API_BASE_URL}/pool-missions/${itemToDelete.id}`; break;
            case 'ScheduledMission': url = `${API_BASE_URL}/scheduled-missions/${itemToDelete.id}`; break;
            case 'HabitTemplate': url = `${API_BASE_URL}/habit-templates/${itemToDelete.id}`; break;
            default: 
                setError("Unknown item type for deletion.");
                setShowConfirmDialog(false);
                return;
        }
        try {
            await axios.delete(url, { headers: { 'Authorization': `Bearer ${token}` } });
            handleSuccessfulFormSubmit(`${itemTypeToDelete} "${itemTitle}" deleted successfully.`);
            refreshUserStatsAndEnergy(); 
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
            url = `${API_BASE_URL}/pool-missions/${originalItemId}`;
            const { type, quest_name, ...originalMissionData } = item;
             payload = { ...originalMissionData, tags: item.tags?.map(t => t.id) || [], status: newStatus };
        } else if (itemTypeForApiRoute === 'scheduled-missions') {
            url = `${API_BASE_URL}/scheduled-missions/${originalItemId}/status`;
        } else if (itemTypeForApiRoute === 'habit-occurrences') { // This will be used by HabitOccurrenceItem if needed
            url = `${API_BASE_URL}/habit-occurrences/${originalItemId}/status`;
        } else { return; }

        try {
            const response = (itemTypeForApiRoute === 'pool-missions')
                ? await axios.put(url, payload, { headers: { 'Authorization': `Bearer ${token}` } })
                : await axios.patch(url, payload, { headers: { 'Authorization': `Bearer ${token}` } });

            fetchQuestData();
            if (response.data && (response.data.user_total_points !== undefined || response.data.user_level !== undefined)) {
                 refreshUserStatsAndEnergy({ total_points: response.data.user_total_points, level: response.data.user_level });
            } else { refreshUserStatsAndEnergy(); }
            setFeedbackMessage("Status updated!");
            clearFeedback();
        } catch (err) {
            setError(err.response?.data?.error || `Failed to update ${itemTypeForApiRoute} status.`);
        }
    };
    
    const handlePoolMissionFocusToggle = async (mission, newFocusStatus) => {
        const token = localStorage.getItem('authToken'); setError(null);
        try {
            await axios.patch(`${API_BASE_URL}/pool-missions/${mission.id}/focus`, 
                { focus_status: newFocusStatus }, { headers: { 'Authorization': `Bearer ${token}` } }
            );
            fetchQuestData(); 
            setFeedbackMessage("Focus status updated!");
            clearFeedback();
        } catch (err) { setError(err.response?.data?.error || "Failed to update focus status."); }
    };
    
    const handleGenerateOccurrencesForTemplate = async (template) => {
        if (!template || !template.is_active) {
            setError("Cannot extend an inactive habit template.");
            return;
        }
        setError(null);
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.post(`${API_BASE_URL}/habit-templates/${template.id}/generate-occurrences`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setFeedbackMessage(response.data.message || `Occurrences extended for "${template.title}".`);
            clearFeedback();
            fetchQuestData(); // Potentially refresh to see if template's `updated_at` changed or if any occurrences are now listed
        } catch (err) {
            setError(err.response?.data?.error || "Failed to generate more occurrences.");
        }
    };


    if (isLoading) {
        return <div className="page-container quests-page-container"><p>Loading Quest Details...</p></div>;
    }
    if (error && !questDetails) { // Show error prominently if quest details themselves failed to load
        return (
            <div className="page-container quests-page-container">
                <p className="auth-error-message">{error}</p>
                <Link to="/quests-overview">Back to Quests Overview</Link>
            </div>
        );
    }
    if (!questDetails) { // Handles 404 or other cases where questDetails is null after loading
        return (
            <div className="page-container quests-page-container">
                <p>Quest not found or could not be loaded.</p>
                <Link to="/quests-overview">Back to Quests Overview</Link>
            </div>
        );
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
            {error && <p className="auth-error-message" style={{textAlign: 'center'}}>{error}</p>}
            {feedbackMessage && <p className="auth-success-message" style={{textAlign: 'center'}}>{feedbackMessage}</p>}

            <div className="dashboard-panels-flow-container">
                <div className="dashboard-panel">
                    <div style={panelHeaderStyle}>
                        <h3 style={{margin:0}}>Pool Missions</h3>
                        <button onClick={() => openPoolMissionForm()} style={panelAddButtonStyle} title="Add Pool Mission to this Quest">+ Add</button>
                    </div>
                    <PoolMissionList
                        missions={poolMissions}
                        onEditMission={(mission) => openPoolMissionForm(mission)}
                        onDeleteMission={(mission) => requestDeleteItem(mission, 'PoolMission')}
                        onToggleFocusStatus={handlePoolMissionFocusToggle}
                        onToggleCompleteStatus={(mission, newStatus) => handleItemStatusUpdate(mission, newStatus, 'pool-missions')}
                        questColors={questColors}
                        emptyListMessage="No pool missions for this quest with current filters."
                    />
                </div>

                <div className="dashboard-panel">
                     <div style={panelHeaderStyle}>
                        <h3 style={{margin:0}}>Scheduled Missions</h3>
                        <button onClick={() => openScheduledMissionForm()} style={panelAddButtonStyle} title="Add Scheduled Mission to this Quest">+ Add</button>
                    </div>
                    <ScheduledMissionList
                        missions={scheduledMissions}
                        onEditMission={(mission) => openScheduledMissionForm(mission)}
                        onDeleteMission={(mission) => requestDeleteItem(mission, 'ScheduledMission')}
                        onUpdateMissionStatus={(mission, newStatus) => handleItemStatusUpdate(mission, newStatus, 'scheduled-missions')}
                        questColors={questColors}
                        emptyListMessage="No scheduled missions for this quest with current filters."
                    />
                </div>

                <div className="dashboard-panel">
                     <div style={panelHeaderStyle}>
                        <h3 style={{margin:0}}>Habit Templates</h3>
                        <button onClick={() => openHabitTemplateForm()} style={panelAddButtonStyle} title="Add Habit Template to this Quest">+ Add</button>
                    </div>
                    <HabitTemplateList 
                        templates={habitTemplates}
                        onEditTemplate={(template) => openHabitTemplateForm(template)}
                        onDeleteTemplate={(template) => requestDeleteItem(template, 'HabitTemplate')}
                        questColors={questColors}
                        onGenerateOccurrences={handleGenerateOccurrencesForTemplate} 
                        // emptyListMessage can be added to HabitTemplateList component if desired
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