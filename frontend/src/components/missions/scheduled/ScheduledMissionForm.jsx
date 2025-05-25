// frontend/src/components/missions/scheduled/ScheduledMissionForm.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../../contexts/UserContext';
import TagSelector from '../../tags/TagSelector';
import QuestSelector from '../../quests/QuestSelector';
import '../../../styles/scheduledmissions.css';

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

// Helper to format date for 'date' input type (YYYY-MM-DD)
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

// Helper to format datetime for 'datetime-local' input (YYYY-MM-DDTHH:mm)
const formatDateTimeForInput = (isoStringOrDate) => {
    if (!isoStringOrDate) return '';
    try {
        const date = new Date(isoStringOrDate);
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    } catch (e) { return ''; }
};

// Helper to convert input value (date or datetime-local) back to ISO string
const formatInputToISO = (inputValue, isAllDay = false) => {
    if (!inputValue) return null;
    try {
        if (isAllDay) { // Input is YYYY-MM-DD
            const dateParts = inputValue.split('-');
            const dateObj = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
            return dateObj.toISOString(); // Will be YYYY-MM-DDT00:00:00.000Z
        } else { // Input is YYYY-MM-DDTHH:mm
            const localDate = new Date(inputValue);
            return localDate.toISOString();
        }
    } catch (e) { return null; }
};


function ScheduledMissionForm({ missionToEdit, slotInfo, onFormSubmit, onCancel }) {
    const { currentUser } = useContext(UserContext);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        energyValue: 0,
        pointsValue: 0,
        startDatetime: '', // Will store YYYY-MM-DD or YYYY-MM-DDTHH:mm
        endDatetime: '',   // Will store YYYY-MM-DDTHH:mm, hidden if allDay
        isAllDay: false,   // New state for the checkbox
        questId: null,
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

            if (isEditing) {
                initialIsAllDay = missionToEdit.is_all_day || false;
                if (initialIsAllDay) {
                    initialStartDt = formatDateForDateInput(missionToEdit.start_datetime);
                    // For all-day, endDatetime is not directly edited by user in this form
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
                    questId: missionToEdit.quest_id || null,
                    selectedTagIds: missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [],
                    status: missionToEdit.status || 'PENDING'
                });
            } else if (isConverting) {
                initialIsAllDay = slotInfo.allDay || false; // If react-big-calendar slotInfo provides this
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
                    questId: missionToEdit.quest_id || null,
                    selectedTagIds: missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [],
                    status: 'PENDING'
                });
            } else if (slotInfo) { // Creating new from calendar slot
                setIsFetchingDefaultQuest(true);
                initialIsAllDay = slotInfo.allDay || (slotInfo.slots && slotInfo.slots.length === 1); // Guess if it's an all-day slot
                if (initialIsAllDay) {
                    initialStartDt = formatDateForDateInput(slotInfo.start);
                } else {
                    initialStartDt = formatDateTimeForInput(slotInfo.start);
                    initialEndDt = formatDateTimeForInput(slotInfo.end);
                }
                const token = localStorage.getItem('authToken');
                 try {
                    const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                    const quests = response.data || [];
                    const defaultQuest = quests.find(q => q.is_default_quest);
                    setFormData({
                        title: '', description: '', energyValue: 10, pointsValue: 5,
                        startDatetime: initialStartDt,
                        endDatetime: initialEndDt,
                        isAllDay: initialIsAllDay,
                        questId: defaultQuest?.id || (quests.length > 0 ? quests[0].id : null),
                        selectedTagIds: [], status: 'PENDING'
                    });
                } catch (err) {
                    setFormData(prev => ({ ...prev, questId: null, startDatetime: initialStartDt, endDatetime: initialEndDt, isAllDay: initialIsAllDay }));
                } finally { setIsFetchingDefaultQuest(false); }
            } else { // Creating new from "Add" button
                setIsFetchingDefaultQuest(true);
                const token = localStorage.getItem('authToken');
                try {
                    const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                    const quests = response.data || [];
                    const defaultQuest = quests.find(q => q.is_default_quest);
                    const now = new Date();
                    // For "Add New", default to not all-day
                    initialStartDt = formatDateTimeForInput(now.toISOString());
                    initialEndDt = formatDateTimeForInput(new Date(now.getTime() + 60 * 60 * 1000).toISOString());
                    setFormData({
                        title: '', description: '', energyValue: 10, pointsValue: 5,
                        startDatetime: initialStartDt,
                        endDatetime: initialEndDt,
                        isAllDay: false, // Default to not all-day for manual creation
                        selectedTagIds: [], status: 'PENDING',
                        questId: defaultQuest?.id || (quests.length > 0 ? quests[0].id : null)
                    });
                } catch (err) {
                    setFormData(prev => ({ ...prev, questId: null, isAllDay: false }));
                } finally { setIsFetchingDefaultQuest(false); }
            }
        };
        loadInitialData();
    }, [missionToEdit, slotInfo, isEditing, isConverting]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === "isAllDay") {
            setFormData(prev => ({
                ...prev,
                isAllDay: checked,
                // When toggling isAllDay, clear/reformat startDatetime and clear endDatetime if needed
                startDatetime: checked ? formatDateForDateInput(prev.startDatetime || new Date()) : formatDateTimeForInput(prev.startDatetime || new Date()),
                endDatetime: checked ? '' : formatDateTimeForInput(new Date(new Date(prev.startDatetime || new Date()).getTime() + 60*60*1000)) // Provide a default end if switching to timed
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
        if (!formData.startDatetime) { // startDatetime is always required (either date or datetime-local)
            setError('Start date/time is required.'); setIsLoading(false); return;
        }
        
        let finalStartDatetimeISO = formatInputToISO(formData.startDatetime, formData.isAllDay);
        let finalEndDatetimeISO;

        if (formData.isAllDay) {
            if (!finalStartDatetimeISO) {setError('Invalid start date for all-day event.'); setIsLoading(false); return;}
            // Backend will set end to end of day for is_all_day: true
            // We can send the same as start, or let backend derive it based on is_all_day flag
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
            end_datetime: finalEndDatetimeISO, // Backend handles BoD/EoD if is_all_day
            is_all_day: formData.isAllDay,
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
            } else { 
                await axios.post(API_SCHEDULED_MISSIONS_URL, missionDataPayload, config);
                if (isConverting && slotInfo.convertingPoolMissionId) {
                    await axios.delete(`${API_POOL_MISSIONS_URL}/${slotInfo.convertingPoolMissionId}`, config);
                    onFormSubmit(true); 
                } else {
                    onFormSubmit();
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
                 <div className="form-group"> {/* Checkbox for All-Day */}
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