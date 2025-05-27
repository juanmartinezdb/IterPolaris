// frontend/src/components/missions/scheduled/ScheduledMissionForm.jsx
import React, { useState, useEffect, useContext } from 'react'; // Removed useCallback
import axios from 'axios';
import { UserContext } from '../../../contexts/UserContext';
import TagSelector from '../../tags/TagSelector';
import QuestSelector from '../../quests/QuestSelector';
import '../../../styles/scheduledmissions.css';

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

const formatDateForDateInput = (isoStringOrDate) => {
    if (!isoStringOrDate) return '';
    try {
        const date = new Date(isoStringOrDate);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) { return ''; }
};

const formatDateTimeForInput = (isoStringOrDate) => {
    if (!isoStringOrDate) return '';
    try {
        const date = new Date(isoStringOrDate);
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    } catch (e) { return ''; }
};

const formatInputToISO = (inputValue, isAllDay = false) => {
    if (!inputValue) return null;
    try {
        if (isAllDay) {
            const dateParts = inputValue.split('-');
            const dateObj = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
            return dateObj.toISOString();
        } else { 
            const localDate = new Date(inputValue);
            return localDate.toISOString();
        }
    } catch (e) { return null; }
};


function ScheduledMissionForm({ missionToEdit, slotInfo, onFormSubmit, onCancel, initialQuestId: directInitialQuestId = null }) {
    const { currentUser } = useContext(UserContext);
    const effectiveInitialQuestId = missionToEdit?.quest_id || slotInfo?.initialQuestId || directInitialQuestId;

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        energyValue: 0,
        pointsValue: 0,
        startDatetime: '', 
        endDatetime: '',   
        isAllDay: false,  
        questId: effectiveInitialQuestId || null,
        selectedTagIds: [],
        status: 'PENDING'
    });

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    
    const isEditing = !!missionToEdit && !slotInfo?.convertingPoolMissionId;
    const isConverting = !!slotInfo?.convertingPoolMissionId && !!missionToEdit;

    useEffect(() => {
        const loadInitialData = async () => {
            let initialIsAllDay = false;
            let initialStartDt = '';
            let initialEndDt = '';
            let currentQuestId = effectiveInitialQuestId || null;

            if (isEditing) {
                initialIsAllDay = missionToEdit.is_all_day || false;
                if (initialIsAllDay) {
                    initialStartDt = formatDateForDateInput(missionToEdit.start_datetime);
                } else {
                    initialStartDt = formatDateTimeForInput(missionToEdit.start_datetime);
                    initialEndDt = formatDateTimeForInput(missionToEdit.end_datetime);
                }
                setFormData({
                    title: missionToEdit.title || '',
                    description: missionToEdit.description || '',
                    energyValue: missionToEdit.energy_value || 0,
                    pointsValue: missionToEdit.points_value || 0,
                    startDatetime: initialStartDt,
                    endDatetime: initialEndDt,
                    isAllDay: initialIsAllDay,
                    questId: missionToEdit.quest_id || currentQuestId,
                    selectedTagIds: missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [],
                    status: missionToEdit.status || 'PENDING'
                });
            } else if (isConverting) {
                initialIsAllDay = slotInfo.allDay || false; 
                 if (initialIsAllDay) {
                    initialStartDt = formatDateForDateInput(slotInfo.start);
                } else {
                    initialStartDt = formatDateTimeForInput(slotInfo.start);
                    initialEndDt = formatDateTimeForInput(slotInfo.end);
                }
                 setFormData({
                    title: missionToEdit.title || '', 
                    description: missionToEdit.description || '',
                    energyValue: missionToEdit.energy_value || 0,
                    pointsValue: missionToEdit.points_value || 0,
                    startDatetime: initialStartDt,
                    endDatetime: initialEndDt,
                    isAllDay: initialIsAllDay,
                    questId: missionToEdit.quest_id || currentQuestId,
                    selectedTagIds: missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [],
                    status: 'PENDING'
                });
            } else if (slotInfo) { 
                setIsFetchingDefaultQuest(true);
                initialIsAllDay = slotInfo.allDay || (slotInfo.slots && slotInfo.slots.length === 1);
                if (initialIsAllDay) {
                    initialStartDt = formatDateForDateInput(slotInfo.start);
                } else {
                    initialStartDt = formatDateTimeForInput(slotInfo.start);
                    initialEndDt = formatDateTimeForInput(slotInfo.end);
                }
                
                if (!currentQuestId) { // Only fetch default if no initialQuestId was provided
                    const token = localStorage.getItem('authToken');
                     try {
                        const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                        const quests = response.data || [];
                        const defaultQuest = quests.find(q => q.is_default_quest);
                        currentQuestId = defaultQuest?.id || (quests.length > 0 ? quests[0].id : null);
                    } catch (err) { /* currentQuestId remains null */ }
                }
                setFormData({
                    title: '', description: '', energyValue: 10, pointsValue: 5,
                    startDatetime: initialStartDt,
                    endDatetime: initialEndDt,
                    isAllDay: initialIsAllDay,
                    questId: currentQuestId,
                    selectedTagIds: [], status: 'PENDING'
                });
                setIsFetchingDefaultQuest(false); 
            } else { // Creating new from "Add" button (no slotInfo)
                setIsFetchingDefaultQuest(true);
                const now = new Date();
                initialStartDt = formatDateTimeForInput(now.toISOString());
                initialEndDt = formatDateTimeForInput(new Date(now.getTime() + 60 * 60 * 1000).toISOString());
                
                if (!currentQuestId) { // Only fetch default if no initialQuestId was provided
                    const token = localStorage.getItem('authToken');
                    try {
                        const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                        const quests = response.data || [];
                        const defaultQuest = quests.find(q => q.is_default_quest);
                        currentQuestId = defaultQuest?.id || (quests.length > 0 ? quests[0].id : null);
                    } catch (err) { /* currentQuestId remains null */ }
                }
                setFormData({
                    title: '', description: '', energyValue: 10, pointsValue: 5,
                    startDatetime: initialStartDt,
                    endDatetime: initialEndDt,
                    isAllDay: false, 
                    selectedTagIds: [], status: 'PENDING',
                    questId: currentQuestId
                });
                setIsFetchingDefaultQuest(false);
            }
        };
        loadInitialData();
    }, [missionToEdit, slotInfo, isEditing, isConverting, effectiveInitialQuestId]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === "isAllDay") {
            setFormData(prev => ({
                ...prev,
                isAllDay: checked,
                startDatetime: checked ? formatDateForDateInput(prev.startDatetime || new Date()) : formatDateTimeForInput(prev.startDatetime || new Date()),
                endDatetime: checked ? '' : formatDateTimeForInput(new Date(new Date(prev.startDatetime || new Date()).getTime() + 60*60*1000)) 
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
        setError('');
    };

    const handleQuestChange = (newQuestId) => setFormData(prev => ({ ...prev, questId: newQuestId || null }));
    const handleTagsChange = (newTagIds) => setFormData(prev => ({ ...prev, selectedTagIds: newTagIds }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!formData.title.trim()) {
            setError('Mission title is required.'); setIsLoading(false); return;
        }
        if (!formData.startDatetime) { 
            setError('Start date/time is required.'); setIsLoading(false); return;
        }
        
        let finalStartDatetimeISO = formatInputToISO(formData.startDatetime, formData.isAllDay);
        let finalEndDatetimeISO;

        if (formData.isAllDay) {
            if (!finalStartDatetimeISO) {setError('Invalid start date for all-day event.'); setIsLoading(false); return;}
            const startDateObj = new Date(finalStartDatetimeISO);
            finalEndDatetimeISO = new Date(Date.UTC(startDateObj.getUTCFullYear(), startDateObj.getUTCMonth(), startDateObj.getUTCDate(), 23, 59, 59, 999)).toISOString();
            finalStartDatetimeISO = new Date(Date.UTC(startDateObj.getUTCFullYear(), startDateObj.getUTCMonth(), startDateObj.getUTCDate(), 0, 0, 0, 0)).toISOString();
        } else {
            if (!formData.endDatetime) {
                setError('End date/time is required for timed events.'); setIsLoading(false); return;
            }
            finalEndDatetimeISO = formatInputToISO(formData.endDatetime, false);
            if (!finalStartDatetimeISO || !finalEndDatetimeISO) {
                setError('Invalid date/time format entered.'); setIsLoading(false); return;
            }
            if (new Date(finalEndDatetimeISO) <= new Date(finalStartDatetimeISO)) {
                setError('End datetime must be after start datetime.'); setIsLoading(false); return;
            }
        }

        const missionDataPayload = {
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            energy_value: parseInt(formData.energyValue, 10),
            points_value: parseInt(formData.pointsValue, 10),
            start_datetime: finalStartDatetimeISO,
            end_datetime: finalEndDatetimeISO, 
            is_all_day: formData.isAllDay,
            quest_id: formData.questId,
            tag_ids: formData.selectedTagIds,
            status: isEditing ? formData.status : 'PENDING',
        };
        
        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            let response;
            if (isEditing) {
                response = await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${missionToEdit.id}`, missionDataPayload, config);
                onFormSubmit(response.data);
            } else { 
                response = await axios.post(API_SCHEDULED_MISSIONS_URL, missionDataPayload, config);
                if (isConverting && slotInfo.convertingPoolMissionId) {
                    await axios.delete(`${API_POOL_MISSIONS_URL}/${slotInfo.convertingPoolMissionId}`, config);
                    onFormSubmit(response.data, true); // Pass true for conversion
                } else {
                    onFormSubmit(response.data);
                }
            }
        } catch (err) {
            const errorData = err.response?.data;
            let em = `Failed to ${isEditing ? 'update' : 'create'} SM.`;
            if (errorData?.errors) em = Object.values(errorData.errors).flat().join(' ');
            else if (errorData?.error) em = errorData.error;
            setError(em);
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
                    <label htmlFor="sm-is-all-day" className="checkbox-label" style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal' }}>
                        <input
                            type="checkbox"
                            id="sm-is-all-day"
                            name="isAllDay"
                            checked={formData.isAllDay}
                            onChange={handleChange}
                            disabled={formDisabled}
                            style={{ width: 'auto', marginRight: '0.5rem' }}
                        />
                        All-day event
                    </label>
                </div>
                <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="sm-start-datetime">{formData.isAllDay ? 'Date:' : 'Start Date & Time:'}</label>
                        <input
                            type={formData.isAllDay ? 'date' : 'datetime-local'}
                            id="sm-start-datetime"
                            name="startDatetime"
                            value={formData.startDatetime}
                            onChange={handleChange}
                            required
                            disabled={formDisabled}
                        />
                    </div>
                    {!formData.isAllDay && (
                        <div className="form-group">
                            <label htmlFor="sm-end-datetime">End Date & Time:</label>
                            <input
                                type="datetime-local"
                                id="sm-end-datetime"
                                name="endDatetime"
                                value={formData.endDatetime}
                                onChange={handleChange}
                                required={!formData.isAllDay}
                                disabled={formDisabled || formData.isAllDay}
                            />
                        </div>
                    )}
                </div>
                <div className="form-group">
                    <label htmlFor="sm-description">Description (Optional):</label>
                    <textarea id="sm-description" name="description" value={formData.description} onChange={handleChange} rows="3" disabled={formDisabled} />
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
                    <QuestSelector selectedQuestId={formData.questId} onQuestChange={handleQuestChange} disabled={formDisabled} />
                </div>
                <TagSelector selectedTagIds={formData.selectedTagIds} onSelectedTagsChange={handleTagsChange} />
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