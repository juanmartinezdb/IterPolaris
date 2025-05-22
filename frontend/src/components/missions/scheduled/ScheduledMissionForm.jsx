// frontend/src/components/missions/scheduled/ScheduledMissionForm.jsx
import React, { useState, useEffect, useContext } from 'react'; // Removed useCallback as it wasn't used directly
import axios from 'axios';
import { UserContext } from '../../../contexts/UserContext';
import TagSelector from '../../tags/TagSelector';
import QuestSelector from '../../quests/QuestSelector';
import '../../../styles/scheduledmissions.css';

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`; // For deleting after conversion
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

const formatDateTimeForInput = (isoStringOrDate) => {
    if (!isoStringOrDate) return '';
    try {
        const date = new Date(isoStringOrDate); // Works for both ISO string and Date object
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    } catch (e) { return ''; }
};

const formatInputDateTimeToISO = (inputDateTimeStr) => {
    if (!inputDateTimeStr) return null;
    try {
        const localDate = new Date(inputDateTimeStr);
        return localDate.toISOString();
    } catch (e) { return null; }
};

function ScheduledMissionForm({ missionToEdit, slotInfo, onFormSubmit, onCancel }) {
    const { currentUser } = useContext(UserContext);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        energyValue: 0,
        pointsValue: 0,
        startDatetime: '',
        endDatetime: '',
        questId: null,
        selectedTagIds: [],
        status: 'PENDING'
    });

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    
    const isEditing = !!missionToEdit && !slotInfo?.convertingPoolMissionId; // True if editing existing, not converting
    const isConverting = !!slotInfo?.convertingPoolMissionId && !!missionToEdit; // True if converting pool mission

    useEffect(() => {
        const loadInitialData = async () => {
            if (isEditing) { // Editing an existing ScheduledMission
                setFormData({
                    title: missionToEdit.title || '',
                    description: missionToEdit.description || '',
                    energyValue: missionToEdit.energy_value || 0,
                    pointsValue: missionToEdit.points_value || 0,
                    startDatetime: formatDateTimeForInput(missionToEdit.start_datetime),
                    endDatetime: formatDateTimeForInput(missionToEdit.end_datetime),
                    questId: missionToEdit.quest_id || null,
                    selectedTagIds: missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [],
                    status: missionToEdit.status || 'PENDING'
                });
            } else if (isConverting) { // Converting a PoolMission
                 setFormData({
                    title: missionToEdit.title || '', // missionToEdit here is the pool mission data
                    description: missionToEdit.description || '',
                    energyValue: missionToEdit.energy_value || 0,
                    pointsValue: missionToEdit.points_value || 0,
                    startDatetime: formatDateTimeForInput(slotInfo.start),
                    endDatetime: formatDateTimeForInput(slotInfo.end),
                    questId: missionToEdit.quest_id || null,
                    selectedTagIds: missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [],
                    status: 'PENDING'
                });
            } else if (slotInfo) { // Creating new from calendar slot
                setIsFetchingDefaultQuest(true);
                const token = localStorage.getItem('authToken');
                 try {
                    const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                    const quests = response.data || [];
                    const defaultQuest = quests.find(q => q.is_default_quest);
                    setFormData({
                        title: '', description: '', energyValue: 10, pointsValue: 5,
                        startDatetime: formatDateTimeForInput(slotInfo.start),
                        endDatetime: formatDateTimeForInput(slotInfo.end),
                        questId: defaultQuest?.id || (quests.length > 0 ? quests[0].id : null),
                        selectedTagIds: [], status: 'PENDING'
                    });
                } catch (err) {
                    console.error("ScheduledMissionForm: Failed to fetch default quest:", err);
                    setFormData(prev => ({ ...prev, questId: null, startDatetime: formatDateTimeForInput(slotInfo.start), endDatetime: formatDateTimeForInput(slotInfo.end) }));
                } finally { setIsFetchingDefaultQuest(false); }
            } else { // Creating new from "Add" button (no slot/missionToEdit)
                setIsFetchingDefaultQuest(true);
                const token = localStorage.getItem('authToken');
                try {
                    const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                    const quests = response.data || [];
                    const defaultQuest = quests.find(q => q.is_default_quest);
                    const now = new Date();
                    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
                    setFormData({
                        title: '', description: '', energyValue: 10, pointsValue: 5,
                        startDatetime: formatDateTimeForInput(now.toISOString()),
                        endDatetime: formatDateTimeForInput(oneHourLater.toISOString()),
                        selectedTagIds: [], status: 'PENDING',
                        questId: defaultQuest?.id || (quests.length > 0 ? quests[0].id : null)
                    });
                } catch (err) {
                    console.error("ScheduledMissionForm: Failed to fetch default quest:", err);
                    setFormData(prev => ({ ...prev, questId: null }));
                } finally { setIsFetchingDefaultQuest(false); }
            }
        };
        loadInitialData();
    }, [missionToEdit, slotInfo, isEditing, isConverting]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleQuestChange = (newQuestId) => {
        setFormData(prev => ({ ...prev, questId: newQuestId || null }));
    };

    const handleTagsChange = (newTagIds) => {
        setFormData(prev => ({ ...prev, selectedTagIds: newTagIds }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!formData.title.trim()) {
            setError('Mission title is required.'); setIsLoading(false); return;
        }
        if (!formData.startDatetime || !formData.endDatetime) {
            setError('Start and End date/times are required.'); setIsLoading(false); return;
        }
        const finalStartDatetimeISO = formatInputDateTimeToISO(formData.startDatetime);
        const finalEndDatetimeISO = formatInputDateTimeToISO(formData.endDatetime);
        if (!finalStartDatetimeISO || !finalEndDatetimeISO) {
            setError('Invalid date/time format entered.'); setIsLoading(false); return;
        }
        if (new Date(finalEndDatetimeISO) <= new Date(finalStartDatetimeISO)) {
            setError('End datetime must be after start datetime.'); setIsLoading(false); return;
        }

        const missionDataPayload = {
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            energy_value: parseInt(formData.energyValue, 10),
            points_value: parseInt(formData.pointsValue, 10),
            start_datetime: finalStartDatetimeISO,
            end_datetime: finalEndDatetimeISO,
            quest_id: formData.questId,
            tag_ids: formData.selectedTagIds,
            status: isEditing ? formData.status : 'PENDING',
        };
        
        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            if (isEditing) {
                await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${missionToEdit.id}`, missionDataPayload, config);
                onFormSubmit();
            } else { // Creating new (either from slot or conversion)
                await axios.post(API_SCHEDULED_MISSIONS_URL, missionDataPayload, config);
                if (isConverting && slotInfo.convertingPoolMissionId) {
                    // Delete original PoolMission
                    await axios.delete(`${API_POOL_MISSIONS_URL}/${slotInfo.convertingPoolMissionId}`, config);
                    onFormSubmit(true); // Pass true to indicate conversion success
                } else {
                    onFormSubmit();
                }
            }
        } catch (err) {
            console.error("Failed to save scheduled mission:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMessageText = `Failed to ${isEditing ? 'update' : 'create'} scheduled mission.`;
            if (errorData?.errors && typeof errorData.errors === 'object') {
                 const firstErrorKey = Object.keys(errorData.errors)[0];
                 const messages = errorData.errors[firstErrorKey];
                 errorMessageText = `${firstErrorKey.replace(/_/g, ' ')}: ${Array.isArray(messages) ? messages.join(', ') : messages}`;
            } else if (errorData?.error) {
                errorMessageText = errorData.error;
            }
            setError(errorMessageText);
        } finally {
            setIsLoading(false);
        }
    };
    
    const formDisabled = isLoading || isFetchingDefaultQuest;
    const formTitle = isEditing ? 'Edit Scheduled Mission' : (isConverting ? 'Convert to Scheduled Mission' : 'Create New Scheduled Mission');

    return (
        <div className="scheduled-mission-form-container">
            <h3>{formTitle}</h3>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="scheduled-mission-form">
                <div className="form-group">
                    <label htmlFor="sm-title">Title:</label>
                    <input type="text" id="sm-title" name="title" value={formData.title} onChange={handleChange} required disabled={formDisabled} />
                </div>
                <div className="form-group">
                    <label htmlFor="sm-description">Description (Optional):</label>
                    <textarea id="sm-description" name="description" value={formData.description} onChange={handleChange} rows="3" disabled={formDisabled} />
                </div>
                <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="sm-start-datetime">Start Date & Time:</label>
                        <input type="datetime-local" id="sm-start-datetime" name="startDatetime" value={formData.startDatetime} onChange={handleChange} required disabled={formDisabled} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="sm-end-datetime">End Date & Time:</label>
                        <input type="datetime-local" id="sm-end-datetime" name="endDatetime" value={formData.endDatetime} onChange={handleChange} required disabled={formDisabled} />
                    </div>
                </div>
                 <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="sm-energy">Energy Value:</label>
                        <input type="number" id="sm-energy" name="energyValue" value={formData.energyValue} onChange={handleChange} disabled={formDisabled} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="sm-points">Points Value:</label>
                        <input type="number" id="sm-points" name="pointsValue" min="0" value={formData.pointsValue} onChange={handleChange} disabled={formDisabled} />
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="sm-quest">Associate with Quest:</label>
                    <QuestSelector
                        selectedQuestId={formData.questId}
                        onQuestChange={handleQuestChange}
                        disabled={formDisabled}
                        isFilter={false}
                    />
                </div>
                <TagSelector
                    selectedTagIds={formData.selectedTagIds}
                    onSelectedTagsChange={handleTagsChange}
                />
                <div className="form-actions">
                    <button type="button" onClick={onCancel} className="cancel-btn" disabled={isLoading}>Cancel</button>
                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Mission')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ScheduledMissionForm;